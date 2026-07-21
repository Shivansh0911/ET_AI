"""
Train the base detector on a CROSS-CAPTURE split, and record how badly it generalises.

This replaces the random per-family split as the project's headline evaluation. The random
split reported 99.8% recall, but siblings from the same attack burst landed on both sides of
it — the CSVs carry no timestamp, so near-duplicates cannot be separated within a day. Training
on Monday/Tuesday/Wednesday and testing on Thursday/Friday removes that: every test flow comes
from a capture the model has never seen.

The result is much worse and it is the honest one. The problem statement is about adversaries
that evade signature-based detection — novel behaviour — so a model scored only on families it
was trained on is answering the wrong question. That gap is what ml/eval_continual.py then
closes with analyst feedback.

Outputs:
    ml/artifacts/base_detector.joblib   frozen, versioned, Mon-Wed only
    metrics/baseline.json               random-split vs cross-day, plus trivial baselines

Usage:  python ml/train_base.py
"""
from __future__ import annotations

import hashlib
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

import joblib
import numpy as np
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import roc_auc_score
from sklearn.preprocessing import StandardScaler
from sklearn.tree import DecisionTreeClassifier

BACKEND = Path(__file__).resolve().parent.parent
PROCESSED = BACKEND / "data" / "processed"
ARTIFACTS = Path(__file__).resolve().parent / "artifacts"
METRICS = BACKEND / "metrics"

TRAIN_DAYS = ("Monday", "Tuesday", "Wednesday")
TEST_DAYS = ("Thursday", "Friday")
RANDOM_STATE = 42
CLASS_CAP = 200_000

FOREST = dict(n_estimators=60, max_depth=18, min_samples_leaf=4, n_jobs=-1,
              random_state=RANDOM_STATE, class_weight="balanced_subsample")


def load_meta() -> dict:
    path = PROCESSED / "feature_meta.json"
    if not path.exists():
        raise SystemExit("Missing feature_meta.json — run: python ml/prepare_cicids.py")
    return json.loads(path.read_text(encoding="utf-8"))


def load_days(mask: np.ndarray, days: tuple[str, ...]) -> tuple[np.ndarray, ...]:
    xs, ys, fams = [], [], []
    for shard in sorted(PROCESSED.glob("*.npz")):
        if not any(day in shard.name for day in days):
            continue
        data = np.load(shard)
        xs.append(data["X"][:, mask])
        ys.append(data["y"])
        fams.append(data["family"])
    if not xs:
        raise SystemExit(f"No shards matched {days}")
    return np.concatenate(xs), np.concatenate(ys), np.concatenate(fams)


def cap_classes(X: np.ndarray, y: np.ndarray, cap: int = CLASS_CAP) -> tuple[np.ndarray, np.ndarray]:
    """Cap each class so the fit stays inside memory; never applied to evaluation data."""
    rng = np.random.default_rng(RANDOM_STATE)
    picked = [rng.choice(idx, min(cap, len(idx)), replace=False)
              for idx in (np.flatnonzero(y == 0), np.flatnonzero(y == 1))]
    order = rng.permutation(np.concatenate(picked))
    return X[order], y[order]


def confusion(predicted: np.ndarray, truth: np.ndarray) -> dict:
    tp = int(((predicted == 1) & (truth == 1)).sum())
    fp = int(((predicted == 1) & (truth == 0)).sum())
    tn = int(((predicted == 0) & (truth == 0)).sum())
    fn = int(((predicted == 0) & (truth == 1)).sum())
    precision = tp / (tp + fp) if tp + fp else 0.0
    recall = tp / (tp + fn) if tp + fn else 0.0
    return {
        "tp": tp, "fp": fp, "tn": tn, "fn": fn,
        "precision": round(precision, 6),
        "recall": round(recall, 6),
        "f1": round(2 * precision * recall / (precision + recall), 6) if precision + recall else 0.0,
        "false_positive_rate": round(fp / (fp + tn), 6) if fp + tn else 0.0,
        "false_negative_rate": round(fn / (fn + tp), 6) if fn + tp else 0.0,
        "rows": tp + fp + tn + fn,
    }


def per_family(predicted: np.ndarray, families: np.ndarray, inverse: dict) -> dict:
    out = {}
    for fid in np.unique(families):
        name = inverse[int(fid)]
        if name == "BENIGN":
            continue
        sel = families == fid
        out[name] = {"n": int(sel.sum()), "recall": round(float(predicted[sel].mean()), 6)}
    return dict(sorted(out.items()))


def main() -> int:
    meta = load_meta()
    mask = np.asarray(meta["keep_mask"], dtype=bool)
    features = [n for n, keep in zip(meta["feature_names"], meta["keep_mask"]) if keep]
    inverse = {v: k for k, v in meta["families"].items()}

    print("Loading cross-capture split...")
    X_train, y_train, _ = load_days(mask, TRAIN_DAYS)
    X_test, y_test, fam_test = load_days(mask, TEST_DAYS)
    print(f"  train {len(y_train):,} flows ({int(y_train.sum()):,} attack) — {', '.join(TRAIN_DAYS)}")
    print(f"  test  {len(y_test):,} flows ({int(y_test.sum()):,} attack) — {', '.join(TEST_DAYS)}")

    X_fit, y_fit = cap_classes(X_train, y_train)
    scaler = StandardScaler().fit(X_fit)
    X_fit_scaled = scaler.transform(X_fit)

    print("Fitting base RandomForest...")
    forest = RandomForestClassifier(**FOREST).fit(X_fit_scaled, y_fit)

    probability = forest.predict_proba(scaler.transform(X_test))[:, 1]
    predicted = (probability >= 0.5).astype(np.uint8)
    cross_day = confusion(predicted, y_test)
    cross_day["roc_auc"] = round(float(roc_auc_score(y_test, probability)), 6)

    # Trivial baselines on the same split. A headline metric without one of these beside it
    # is not interpretable — see REVIEW.md.
    baselines = {}
    for label, model in (("decision_stump_depth_1", DecisionTreeClassifier(max_depth=1, random_state=0)),
                         ("decision_tree_depth_6", DecisionTreeClassifier(max_depth=6, random_state=0))):
        model.fit(X_fit_scaled, y_fit)
        baselines[label] = confusion(model.predict(scaler.transform(X_test)), y_test)

    ARTIFACTS.mkdir(parents=True, exist_ok=True)
    artifact = ARTIFACTS / "base_detector.joblib"
    fingerprint = hashlib.sha256(
        f"{FOREST}{TRAIN_DAYS}{len(y_fit)}{RANDOM_STATE}".encode()).hexdigest()[:12]
    joblib.dump({
        "model": forest,
        "scaler": scaler,
        "features": features,
        "keep_mask": meta["keep_mask"],
        "threshold": 0.5,
        "version": f"base-{fingerprint}",
        "trained_on": list(TRAIN_DAYS),
        "trained_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
    }, artifact, compress=3)

    report = {
        "dataset": "CIC-IDS2017",
        "headline_split": "cross-capture (train Mon/Tue/Wed, test Thu/Fri)",
        "why": "The random per-family split scored 99.8% recall, but the CSVs carry no timestamp "
               "so near-duplicate flows from one attack burst cannot be kept on one side of it. "
               "Testing on entirely unseen captures is the honest measure of whether the model "
               "generalises to behaviour it was not trained on.",
        "model": f"RandomForestClassifier(n_estimators={FOREST['n_estimators']}, "
                 f"max_depth={FOREST['max_depth']})",
        "model_version": f"base-{fingerprint}",
        "train_rows": int(len(y_fit)),
        "train_days": list(TRAIN_DAYS),
        "test_days": list(TEST_DAYS),
        "cross_day": cross_day,
        "trivial_baselines_same_split": baselines,
        "per_family_recall": per_family(predicted, fam_test, inverse),
        "artifact_mb": round(artifact.stat().st_size / 1e6, 2),
        "evaluated_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "honesty": [
            "Every test flow comes from a capture day absent from training.",
            "Attack families present on Thu/Fri but not Mon/Tue/Wed are genuinely novel to this "
            "model, which is the point of the split.",
            "Trivial baselines are reported on the same split so the headline number can be "
            "judged against how hard the task actually is.",
        ],
    }

    METRICS.mkdir(parents=True, exist_ok=True)
    (METRICS / "baseline.json").write_text(json.dumps(report, indent=2), encoding="utf-8")

    print(f"\n  cross-day: P={cross_day['precision']:.4f} R={cross_day['recall']:.4f} "
          f"F1={cross_day['f1']:.4f} FPR={cross_day['false_positive_rate']:.4f}")
    print(f"  depth-6 tree, same split: F1={baselines['decision_tree_depth_6']['f1']:.4f}")
    print(f"  artifact {report['artifact_mb']} MB, version base-{fingerprint}")
    print("\n  per-family recall on unseen days:")
    for name, stat in report["per_family_recall"].items():
        print(f"    {name:<30} n={stat['n']:>7,}  recall={stat['recall']:.3f}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
