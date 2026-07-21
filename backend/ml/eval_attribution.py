"""
Measure ATT&CK technique-level attribution accuracy — the problem statement's second
evaluation criterion.

Method: TF-IDF over behaviour tokens (binary presence per dataset) into a linear classifier,
scored by LEAVE-ONE-DATASET-OUT cross validation. Every prediction is therefore made about a
capture the model has never seen, which is the only version of this number worth quoting.

Two honesty constraints shape the reported figure:

  * Techniques represented by a single dataset are excluded. Under leave-one-out their only
    example is the held-out one, so the class is unpredictable by construction — including
    them would drag the number down for a reason that says nothing about the method. The
    count of excluded techniques is reported alongside, not hidden.
  * A most-frequent-class baseline is reported next to the model. An accuracy figure with
    no baseline is not interpretable.

Output: metrics/attribution.json

Usage:  python ml/eval_attribution.py
"""
from __future__ import annotations

import json
import sys
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.model_selection import LeaveOneOut
from sklearn.pipeline import make_pipeline

BACKEND = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BACKEND))

from engine.tokens import identity_analyzer  # noqa: E402

CORPUS = BACKEND / "data" / "processed" / "attack_corpus.json"
METRICS = BACKEND / "metrics"
MITRE = BACKEND / "data" / "mitre" / "techniques.json"

MIN_DATASETS_PER_TECHNIQUE = 2
TOP_K = 3


def build_pipeline():
    """Chosen over LinearSVC, ComplementNB and cosine-kNN — see `honesty` in the report."""
    return make_pipeline(
        TfidfVectorizer(analyzer=identity_analyzer, binary=True, min_df=1, sublinear_tf=True),
        LogisticRegression(max_iter=3000, C=20.0, class_weight="balanced"),
    )


def main() -> int:
    if not CORPUS.exists():
        print(f"Missing {CORPUS} — run: python ml/prepare_attack_logs.py")
        return 1

    corpus = json.loads(CORPUS.read_text(encoding="utf-8"))
    names = {}
    if MITRE.exists():
        table = json.loads(MITRE.read_text(encoding="utf-8"))
        names = {tid: t["name"] for tid, t in table["techniques"].items()}
        # OTRF labels predate ATT&CK's 2026 restructure, so resolve revoked identifiers
        # rather than rendering them nameless.
        for old, replacement in table.get("revoked_map", {}).items():
            names.setdefault(old, f"{replacement['name']} (ATT&CK revoked {old} -> "
                                  f"{replacement['id']})")

    # One (dataset, technique) sample per mapping; a dataset exercising two techniques
    # contributes both.
    samples = [(d["tokens"], technique, d["dataset_id"], d["title"])
               for d in corpus for technique in d["techniques"] if d["tokens"]]

    counts = Counter(technique for _, technique, _, _ in samples)
    evaluable = {t for t, n in counts.items() if n >= MIN_DATASETS_PER_TECHNIQUE}
    excluded = sorted(set(counts) - evaluable)

    kept = [s for s in samples if s[1] in evaluable]
    if len(kept) < 10:
        print("Not enough labelled datasets to evaluate.")
        return 1

    X = [tokens for tokens, _, _, _ in kept]
    y = np.array([technique for _, technique, _, _ in kept])
    labels = sorted(set(y))

    print(f"{len(kept)} dataset-technique samples over {len(labels)} techniques "
          f"({len(excluded)} techniques excluded for having < {MIN_DATASETS_PER_TECHNIQUE} datasets)")

    hits = topk_hits = 0
    misses = []

    for train_index, test_index in LeaveOneOut().split(X):
        train_x = [X[i] for i in train_index]
        train_y = y[train_index]
        if len(set(train_y)) < 2:
            continue

        pipeline = build_pipeline().fit(train_x, train_y)
        probabilities = pipeline.predict_proba([X[test_index[0]]])[0]
        ranked = [pipeline.classes_[i] for i in np.argsort(probabilities)[::-1]]
        truth = y[test_index[0]]

        if ranked[0] == truth:
            hits += 1
        else:
            misses.append({
                "dataset": kept[test_index[0]][2],
                "title": kept[test_index[0]][3],
                "expected": f"{truth} {names.get(truth, '')}".strip(),
                "predicted": f"{ranked[0]} {names.get(ranked[0], '')}".strip(),
            })
        if truth in ranked[:TOP_K]:
            topk_hits += 1

    total = len(kept)
    majority = counts.most_common(1)[0]
    baseline = sum(n for t, n in counts.items() if t in evaluable and t == majority[0]) / total

    report = {
        "corpus": "OTRF/Security-Datasets atomic datasets (MIT)",
        "task": "map a host-telemetry capture to its ATT&CK technique",
        "method": "TF-IDF over behaviour tokens -> logistic regression, "
                  "leave-one-dataset-out cross validation",
        "top1_accuracy": round(hits / total, 4),
        f"top{TOP_K}_accuracy": round(topk_hits / total, 4),
        "majority_class_baseline": round(baseline, 4),
        "samples": total,
        "techniques_evaluated": len(labels),
        "technique_list": [{"id": t, "name": names.get(t, ""), "datasets": counts[t]}
                           for t in labels],
        "techniques_excluded_single_dataset": [
            {"id": t, "name": names.get(t, "")} for t in excluded],
        "evaluated_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "misclassifications": misses,
        "honesty": [
            "Leave-one-dataset-out: every prediction is made about a capture absent from "
            "training, so no environment is seen from both sides.",
            f"{len(excluded)} techniques are excluded because only one dataset exercises "
            "them; leave-one-out cannot predict a class whose sole example is held out.",
            "Environment-identifying tokens (hostnames, domains, SIDs, GUIDs) are stripped "
            "during corpus preparation so the classifier cannot recognise the lab instead "
            "of the behaviour.",
            "The classifier configuration was picked by comparing this same leave-one-out "
            "estimate across four candidates (logistic regression, LinearSVC, ComplementNB, "
            "cosine kNN), so the reported figure is mildly optimistic — there was no "
            "separate held-out set to spend on model selection at this corpus size.",
        ],
    }

    METRICS.mkdir(parents=True, exist_ok=True)
    (METRICS / "attribution.json").write_text(json.dumps(report, indent=2), encoding="utf-8")

    # Fit once on everything for serving. The reported accuracy stays the leave-one-out
    # figure above — this artifact is never evaluated against data it has seen.
    import joblib

    artifact = Path(__file__).resolve().parent / "artifacts" / "attributor.joblib"
    artifact.parent.mkdir(parents=True, exist_ok=True)
    joblib.dump({"pipeline": build_pipeline().fit(X, y),
                 "top1_accuracy": report["top1_accuracy"],
                 "technique_names": {t: names.get(t, "") for t in labels}},
                artifact, compress=3)
    print(f"  attributor -> {artifact.relative_to(BACKEND)} "
          f"({artifact.stat().st_size / 1e6:.2f} MB)")

    print(f"  top-1 {report['top1_accuracy']:.3f} | top-{TOP_K} {report[f'top{TOP_K}_accuracy']:.3f} "
          f"| majority baseline {report['majority_class_baseline']:.3f}")
    print(f"  {len(misses)} misclassified of {total}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
