"""
Clean CIC-IDS2017 into model-ready shards, and record exactly what the cleaning did.

CIC-IDS2017 has well-documented defects (Engelen et al. 2021; Lanvin et al. 2022 published a
corrected re-release). We use the original CSVs, apply the standard cleaning below, and write
every step's row count into metrics/dataset_report.json so the numbers we later report are
traceable rather than asserted:

  1. strip whitespace from the column names (the raw headers are ' Destination Port' etc.)
  2. drop the duplicated 'Fwd Header Length.1' column
  3. coerce features to numeric, replace +/-inf, drop rows with any NaN
  4. drop exact duplicate flows (globally, across all eight files)
  5. downcast to float32
  6. deterministic 70/30 split, exactly stratified per attack family by round-robin so the
     rare classes (Heartbleed has 11 flows, Infiltration 36) cannot land entirely on one side
  7. record zero-variance columns so training can mask them

Everything is processed one file at a time and written to per-file shards, so peak memory
stays near a single chunk rather than the full 2.8M-row table.

Usage:  python ml/prepare_cicids.py
"""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path

import numpy as np
import pandas as pd

BACKEND = Path(__file__).resolve().parent.parent
RAW = BACKEND / "data" / "raw" / "cicids"
PROCESSED = BACKEND / "data" / "processed"
SAMPLES = BACKEND / "data" / "samples"
METRICS = BACKEND / "metrics"

CHUNK = 200_000
TEST_EVERY = 10          # round-robin denominator
TEST_SLOTS = 3           # -> 30% test, exactly stratified per family
DROP_COLUMNS = {"Fwd Header Length.1"}
LABEL_COLUMN = "Label"
BENIGN = "BENIGN"


def normalise_label(raw: str) -> str:
    """'Web Attack – Brute Force' -> 'Web Attack - Brute Force'.

    The raw files are UTF-8 en-dashes read as latin-1, so a single dash arrives as three
    unmappable characters; collapse the run rather than emitting 'Web Attack --- XSS'.
    """
    text = str(raw).encode("ascii", "replace").decode("ascii")
    text = re.sub(r"-{2,}", "-", text.replace("?", "-"))
    return " ".join(text.split())


def clean_chunk(df: pd.DataFrame) -> tuple[pd.DataFrame, pd.Series, dict]:
    """Return (features, labels, per-step drop counts) for one chunk."""
    stats = {"rows_in": len(df)}
    df.columns = [c.strip() for c in df.columns]
    df = df.drop(columns=[c for c in DROP_COLUMNS if c in df.columns])

    labels = df[LABEL_COLUMN].map(normalise_label)
    features = df.drop(columns=[LABEL_COLUMN])

    for col in features.columns:
        if features[col].dtype == object:
            features[col] = pd.to_numeric(features[col], errors="coerce")

    features = features.replace([np.inf, -np.inf], np.nan)
    valid = features.notna().all(axis=1)
    stats["dropped_nan_inf"] = int((~valid).sum())

    return features[valid].astype(np.float32), labels[valid], stats


def main() -> int:
    csv_paths = sorted(RAW.glob("*.csv"))
    if not csv_paths:
        print(f"No CSVs in {RAW}. Run: python ml/download_datasets.py --only cicids")
        return 1

    PROCESSED.mkdir(parents=True, exist_ok=True)
    SAMPLES.mkdir(parents=True, exist_ok=True)
    METRICS.mkdir(parents=True, exist_ok=True)

    seen_hashes: set[int] = set()
    family_ids: dict[str, int] = {}
    family_counter: dict[str, int] = {}
    family_totals: dict[str, dict[str, int]] = {}
    feature_names: list[str] | None = None
    col_min = col_max = None
    report = {"files": [], "rows_read": 0, "dropped_nan_inf": 0, "dropped_duplicate": 0}

    for path in csv_paths:
        shard_x, shard_y, shard_fam, shard_split = [], [], [], []
        file_stats = {"file": path.name, "rows_read": 0, "dropped_nan_inf": 0,
                      "dropped_duplicate": 0, "rows_kept": 0}

        reader = pd.read_csv(path, chunksize=CHUNK, encoding="latin-1", low_memory=False)
        for chunk in reader:
            features, labels, stats = clean_chunk(chunk)
            file_stats["rows_read"] += stats["rows_in"]
            file_stats["dropped_nan_inf"] += stats["dropped_nan_inf"]

            if feature_names is None:
                feature_names = list(features.columns)
            elif list(features.columns) != feature_names:
                print(f"  ! {path.name}: column mismatch, skipping file")
                break

            values = np.ascontiguousarray(features.to_numpy(dtype=np.float32))
            label_values = labels.to_numpy()

            # Global exact-duplicate removal. Hashing the raw feature bytes alongside the
            # label keeps identical flows carrying different labels distinguishable.
            keep = np.ones(len(values), dtype=bool)
            for i in range(len(values)):
                digest = hash((values[i].tobytes(), label_values[i]))
                if digest in seen_hashes:
                    keep[i] = False
                else:
                    seen_hashes.add(digest)
            file_stats["dropped_duplicate"] += int((~keep).sum())

            values, label_values = values[keep], label_values[keep]
            if not len(values):
                continue

            col_min = values.min(axis=0) if col_min is None else np.minimum(col_min, values.min(axis=0))
            col_max = values.max(axis=0) if col_max is None else np.maximum(col_max, values.max(axis=0))

            for i, label in enumerate(label_values):
                if label not in family_ids:
                    family_ids[label] = len(family_ids)
                    family_counter[label] = 0
                    family_totals[label] = {"train": 0, "test": 0}
                seat = family_counter[label] % TEST_EVERY
                family_counter[label] += 1
                is_test = int(seat < TEST_SLOTS)
                shard_fam.append(family_ids[label])
                shard_split.append(is_test)
                family_totals[label]["test" if is_test else "train"] += 1
                shard_y.append(0 if label == BENIGN else 1)

            shard_x.append(values)

        if not shard_x:
            continue

        X = np.concatenate(shard_x)
        out = PROCESSED / f"{path.stem}.npz"
        np.savez_compressed(
            out,
            X=X,
            y=np.asarray(shard_y, dtype=np.uint8),
            family=np.asarray(shard_fam, dtype=np.uint8),
            split=np.asarray(shard_split, dtype=np.uint8),
        )
        file_stats["rows_kept"] = len(X)
        report["files"].append(file_stats)
        for key in ("rows_read", "dropped_nan_inf", "dropped_duplicate"):
            report[key] += file_stats[key]
        print(f"  {path.name}: {file_stats['rows_kept']:>7,} kept "
              f"(-{file_stats['dropped_nan_inf']:,} nan/inf, "
              f"-{file_stats['dropped_duplicate']:,} dup) -> {out.name}")
        del X, shard_x

    if feature_names is None:
        print("Nothing processed.")
        return 1

    zero_variance = [name for name, lo, hi in zip(feature_names, col_min, col_max) if lo == hi]
    keep_mask = [name not in zero_variance for name in feature_names]

    (PROCESSED / "feature_meta.json").write_text(json.dumps({
        "feature_names": feature_names,
        "keep_mask": keep_mask,
        "zero_variance_dropped": zero_variance,
        "families": family_ids,
    }, indent=2), encoding="utf-8")

    report.update({
        "source": "CIC-IDS2017 (Hugging Face mirror c01dsnap/CIC-IDS2017, original "
                  "MachineLearningCVE CSVs from the Canadian Institute for Cybersecurity)",
        "rows_kept": sum(f["rows_kept"] for f in report["files"]),
        "features_total": len(feature_names),
        "features_used": int(sum(keep_mask)),
        "zero_variance_dropped": zero_variance,
        "split": {"scheme": f"deterministic round-robin, {TEST_SLOTS}/{TEST_EVERY} to test",
                  "exactly_stratified_per_family": True},
        "family_totals": family_totals,
        "caveats": [
            "Original (uncorrected) CIC-IDS2017 release; known label/duplication defects "
            "documented by Engelen et al. 2021 and Lanvin et al. 2022.",
            "Exact duplicate flows removed globally across all eight capture files.",
            "'Destination Port' retained as a feature; it carries some service-identity "
            "signal and can flatter a classifier on this dataset.",
        ],
    })
    (METRICS / "dataset_report.json").write_text(json.dumps(report, indent=2), encoding="utf-8")

    write_sample()

    print(f"\n{report['rows_kept']:,} flows kept from {report['rows_read']:,} read")
    print(f"{report['features_used']}/{report['features_total']} features "
          f"({len(zero_variance)} zero-variance dropped)")
    print(f"{len(family_ids)} classes: {', '.join(sorted(family_ids))}")
    return 0


def write_sample(per_family: int = 350) -> None:
    """Commit a small stratified slice of the TEST split for replay and reproducibility."""
    meta = json.loads((PROCESSED / "feature_meta.json").read_text(encoding="utf-8"))
    names = meta["feature_names"]
    inverse = {v: k for k, v in meta["families"].items()}
    taken: dict[int, int] = {}
    rows, labels = [], []

    for shard in sorted(PROCESSED.glob("*.npz")):
        data = np.load(shard)
        test = data["split"] == 1
        X, fam = data["X"][test], data["family"][test]
        for fid in np.unique(fam):
            room = per_family - taken.get(int(fid), 0)
            if room <= 0:
                continue
            idx = np.flatnonzero(fam == fid)[:room]
            rows.append(X[idx])
            labels.extend([inverse[int(fid)]] * len(idx))
            taken[int(fid)] = taken.get(int(fid), 0) + len(idx)

    frame = pd.DataFrame(np.concatenate(rows), columns=names)
    frame[LABEL_COLUMN] = labels
    out = SAMPLES / "cicids_sample.csv"
    frame.to_csv(out, index=False)
    print(f"  sample: {len(frame):,} rows -> {out.relative_to(BACKEND)} "
          f"({out.stat().st_size / 1e6:.1f} MB)")


if __name__ == "__main__":
    sys.exit(main())
