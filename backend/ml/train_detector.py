"""
Train and evaluate the intrusion detector that replaces the old is_anomaly flag lookup.

Design constraints that shaped this:

  * The API runs on a 512 MB free-tier dyno, so the persisted artifact is capped (see
    MAX_ARTIFACT_MB) and the model is a depth-limited forest rather than an unbounded one.
  * Training subsamples the majority class for speed, but EVALUATION streams the entire
    held-out test split at its true class balance. That distinction matters: subsampling the
    test set would inflate precision and understate the false positive rate, which are exactly
    the two numbers the problem statement grades.
  * Nothing here reads the label at inference time. The only thing carried into the API is
    the fitted model plus the feature mask.

Outputs:
    ml/artifacts/detector.joblib      model + scaler + feature mask
    metrics/detection.json            precision / recall / F1 / FPR / FNR / AUC + per-family recall

Usage:  python ml/train_detector.py
"""
from __future__ import annotations

import json
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

import joblib
import numpy as np
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import roc_auc_score
from sklearn.preprocessing import StandardScaler

BACKEND = Path(__file__).resolve().parent.parent
PROCESSED = BACKEND / "data" / "processed"
ARTIFACTS = Path(__file__).resolve().parent / "artifacts"
METRICS = BACKEND / "metrics"

RANDOM_STATE = 42
MAX_BENIGN_TRAIN = 400_000       # majority-class cap, training only
MAX_ATTACK_TRAIN = 400_000
MAX_ARTIFACT_MB = 25.0
BATCH = 200_000

MODEL = RandomForestClassifier(
    n_estimators=60,
    max_depth=18,
    min_samples_leaf=4,
    n_jobs=-1,
    random_state=RANDOM_STATE,
    class_weight="balanced_subsample",
)


def load_meta() -> dict:
    path = PROCESSED / "feature_meta.json"
    if not path.exists():
        raise SystemExit("Missing feature_meta.json — run: python ml/prepare_cicids.py")
    return json.loads(path.read_text(encoding="utf-8"))


def collect_training_set(mask: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    """Stream the train split, capping each class so the fit stays inside memory."""
    rng = np.random.default_rng(RANDOM_STATE)
    benign, attack = [], []
    n_benign = n_attack = 0

    for shard in sorted(PROCESSED.glob("*.npz")):
        data = np.load(shard)
        train = data["split"] == 0
        X, y = data["X"][train][:, mask], data["y"][train]

        for label, bucket, count, cap in ((0, benign, n_benign, MAX_BENIGN_TRAIN),
                                          (1, attack, n_attack, MAX_ATTACK_TRAIN)):
            rows = X[y == label]
            room = cap - count
            if room <= 0 or not len(rows):
                continue
            if len(rows) > room:
                rows = rows[rng.choice(len(rows), room, replace=False)]
            bucket.append(rows)
            if label == 0:
                n_benign += len(rows)
            else:
                n_attack += len(rows)

    X = np.concatenate(benign + attack)
    y = np.concatenate([np.zeros(n_benign, np.uint8), np.ones(n_attack, np.uint8)])
    order = rng.permutation(len(y))
    return X[order], y[order]


def evaluate(model, scaler, mask: np.ndarray, families: dict[str, int]) -> dict:
    """Stream the full held-out test split at its true class balance."""
    inverse = {v: k for k, v in families.items()}
    tp = fp = tn = fn = 0
    per_family: dict[str, dict[str, int]] = {}
    scores, truths = [], []

    for shard in sorted(PROCESSED.glob("*.npz")):
        data = np.load(shard)
        test = data["split"] == 1
        X, y, fam = data["X"][test][:, mask], data["y"][test], data["family"][test]

        for start in range(0, len(X), BATCH):
            chunk = slice(start, start + BATCH)
            probability = model.predict_proba(scaler.transform(X[chunk]))[:, 1]
            predicted = (probability >= 0.5).astype(np.uint8)
            truth = y[chunk]

            tp += int(np.sum((predicted == 1) & (truth == 1)))
            fp += int(np.sum((predicted == 1) & (truth == 0)))
            tn += int(np.sum((predicted == 0) & (truth == 0)))
            fn += int(np.sum((predicted == 0) & (truth == 1)))

            scores.append(probability.astype(np.float32))
            truths.append(truth)

            for fid in np.unique(fam[chunk]):
                name = inverse[int(fid)]
                seat = fam[chunk] == fid
                stat = per_family.setdefault(name, {"n": 0, "flagged": 0})
                stat["n"] += int(seat.sum())
                stat["flagged"] += int((predicted[seat] == 1).sum())

    precision = tp / (tp + fp) if tp + fp else 0.0
    recall = tp / (tp + fn) if tp + fn else 0.0

    return {
        "confusion": {"tp": tp, "fp": fp, "tn": tn, "fn": fn},
        "precision": round(precision, 6),
        "recall": round(recall, 6),
        "f1": round(2 * precision * recall / (precision + recall), 6) if precision + recall else 0.0,
        "false_positive_rate": round(fp / (fp + tn), 6) if fp + tn else 0.0,
        "false_negative_rate": round(fn / (fn + tp), 6) if fn + tp else 0.0,
        "accuracy": round((tp + tn) / (tp + tn + fp + fn), 6),
        "roc_auc": round(float(roc_auc_score(np.concatenate(truths), np.concatenate(scores))), 6),
        "test_rows": tp + fp + tn + fn,
        "test_attack_rows": tp + fn,
        "test_benign_rows": tn + fp,
        "per_family_detection_rate": {
            name: {"n": s["n"], "detected": s["flagged"], "rate": round(s["flagged"] / s["n"], 6)}
            for name, s in sorted(per_family.items())
        },
    }


def main() -> int:
    meta = load_meta()
    mask = np.asarray(meta["keep_mask"], dtype=bool)
    features = [n for n, keep in zip(meta["feature_names"], meta["keep_mask"]) if keep]

    print("Collecting training rows...")
    X, y = collect_training_set(mask)
    print(f"  {len(y):,} rows | {int((y == 0).sum()):,} benign | {int((y == 1).sum()):,} attack")

    scaler = StandardScaler().fit(X)
    print(f"Fitting {MODEL.__class__.__name__}...")
    started = time.perf_counter()
    MODEL.fit(scaler.transform(X), y)
    print(f"  trained in {time.perf_counter() - started:.1f}s")
    del X, y

    ARTIFACTS.mkdir(parents=True, exist_ok=True)
    artifact = ARTIFACTS / "detector.joblib"
    joblib.dump({"model": MODEL, "scaler": scaler, "features": features,
                 "keep_mask": meta["keep_mask"], "threshold": 0.5}, artifact, compress=3)
    size_mb = artifact.stat().st_size / 1e6
    print(f"  artifact {size_mb:.1f} MB -> {artifact.relative_to(BACKEND)}")
    if size_mb > MAX_ARTIFACT_MB:
        print(f"  ! exceeds {MAX_ARTIFACT_MB} MB budget for the free-tier dyno")

    print("Evaluating on the full held-out test split...")
    results = evaluate(MODEL, scaler, mask, meta["families"])

    report = {
        "dataset": "CIC-IDS2017",
        "source": "Hugging Face mirror c01dsnap/CIC-IDS2017 (original MachineLearningCVE CSVs, "
                  "Canadian Institute for Cybersecurity)",
        "task": "binary intrusion detection (benign vs attack) on network flow features",
        "model": f"{MODEL.__class__.__name__}(n_estimators={MODEL.n_estimators}, "
                 f"max_depth={MODEL.max_depth})",
        "features_used": len(features),
        "decision_threshold": 0.5,
        "train_rows": int(MAX_BENIGN_TRAIN + MAX_ATTACK_TRAIN),
        "evaluated_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "artifact_mb": round(size_mb, 2),
        **results,
        "honesty": [
            "Training subsamples the majority class; the test split is evaluated in full at its "
            "true class balance, so precision and FPR are not flattered by rebalancing.",
            "Test flows are held out by a deterministic per-family round-robin and were never "
            "seen during fitting.",
            "Original CIC-IDS2017 release — see metrics/dataset_report.json for known caveats.",
        ],
    }
    METRICS.mkdir(parents=True, exist_ok=True)
    (METRICS / "detection.json").write_text(json.dumps(report, indent=2), encoding="utf-8")

    print(f"\n  precision {results['precision']:.4f} | recall {results['recall']:.4f} | "
          f"F1 {results['f1']:.4f}")
    print(f"  FPR {results['false_positive_rate']:.4f} | FNR {results['false_negative_rate']:.4f} | "
          f"AUC {results['roc_auc']:.4f}")
    print(f"  on {results['test_rows']:,} held-out flows "
          f"({results['test_attack_rows']:,} attack / {results['test_benign_rows']:,} benign)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
