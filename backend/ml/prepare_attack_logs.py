"""
Build a technique-labelled corpus from OTRF/Security-Datasets.

Each atomic dataset ships a metadata YAML carrying the ground-truth ATT&CK technique the
simulation exercised, plus a zip of the Windows event logs it produced. That pairing is what
makes a *measured* attribution accuracy possible instead of an asserted one.

Two outputs:
  data/processed/attack_corpus.json      full corpus, one record per dataset (gitignored)
  data/samples/attack_events_sample.json committed slice of real host events for replay

Token extraction deliberately drops environment-specific strings — hostnames, domains, SIDs,
GUIDs, user names. Those identify the lab that produced a capture rather than the technique,
and leaving them in would let a classifier score well by recognising the environment.

Usage:  python ml/prepare_attack_logs.py
"""
from __future__ import annotations

import json
import sys
import zipfile
from collections import Counter
from pathlib import Path

import yaml

BACKEND = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BACKEND))

from engine.tokens import event_tokens, summarise_event  # noqa: E402

META = BACKEND / "data" / "raw" / "attack" / "_metadata"
HOST = BACKEND / "data" / "raw" / "attack" / "host"
PROCESSED = BACKEND / "data" / "processed"
SAMPLES = BACKEND / "data" / "samples"

MAX_EVENTS_PER_DATASET = 20_000
SAMPLE_DATASETS = 40
SAMPLE_EVENTS_EACH = 12


def read_archive(path: Path, limit: int) -> tuple[Counter, list[dict], int]:
    tokens: Counter = Counter()
    preview: list[dict] = []
    seen = 0

    with zipfile.ZipFile(path) as archive:
        for member in archive.namelist():
            if not member.endswith(".json"):
                continue
            with archive.open(member) as handle:
                for line in handle:
                    if seen >= limit:
                        break
                    try:
                        event = json.loads(line)
                    except (json.JSONDecodeError, UnicodeDecodeError):
                        continue
                    seen += 1
                    tokens.update(event_tokens(event))
                    # Sysmon process/network events carry the most technique signal, so
                    # prefer them for the human-readable preview.
                    if len(preview) < SAMPLE_EVENTS_EACH and event.get("Channel", "").endswith(
                            "Sysmon/Operational"):
                        preview.append(summarise_event(event))
    return tokens, preview, seen


def main() -> int:
    if not META.exists():
        print(f"Missing {META}. Run: python ml/download_datasets.py --only attack")
        return 1

    available = {p.name: p for p in HOST.glob("*.zip")}
    corpus, skipped = [], 0

    for meta_path in sorted(META.glob("*.yaml")):
        try:
            doc = yaml.safe_load(meta_path.read_text(encoding="utf-8", errors="replace"))
        except yaml.YAMLError:
            continue
        if not isinstance(doc, dict) or not doc.get("attack_mappings"):
            continue

        archives = [available[Path(f["link"]).name]
                    for f in (doc.get("files") or [])
                    if f.get("type") == "Host" and Path(f.get("link", "")).name in available]
        if not archives:
            skipped += 1
            continue

        tokens: Counter = Counter()
        preview: list[dict] = []
        events = 0
        for archive in archives:
            found, sample, count = read_archive(archive, MAX_EVENTS_PER_DATASET)
            tokens.update(found)
            preview.extend(sample[: max(0, SAMPLE_EVENTS_EACH - len(preview))])
            events += count

        mappings = doc["attack_mappings"]
        corpus.append({
            "dataset_id": doc.get("id", meta_path.stem),
            "title": doc.get("title", ""),
            "techniques": sorted({m["technique"] for m in mappings}),
            "tactics": sorted({t for m in mappings for t in (m.get("tactics") or [])}),
            "platform": doc.get("platform", []),
            "event_count": events,
            "tokens": sorted(tokens),          # binary presence — see module docstring
            "sample_events": preview,
        })
        print(f"  {corpus[-1]['dataset_id']:<22} {events:>6,} events  "
              f"{len(tokens):>5} tokens  {','.join(corpus[-1]['techniques'])}")

    PROCESSED.mkdir(parents=True, exist_ok=True)
    (PROCESSED / "attack_corpus.json").write_text(json.dumps(corpus), encoding="utf-8")

    # The committed slice carries tokens as well as readable events: the API attributes a
    # capture from the same token representation the model was fitted on, so shipping the
    # events alone would force the runtime to re-derive them from a lossy summary.
    committed = [{k: d[k] for k in ("dataset_id", "title", "techniques", "tactics",
                                    "event_count", "sample_events", "tokens")}
                 for d in corpus if d["sample_events"]][:SAMPLE_DATASETS]
    SAMPLES.mkdir(parents=True, exist_ok=True)
    out = SAMPLES / "attack_events_sample.json"
    out.write_text(json.dumps({
        "source": "OTRF/Security-Datasets (MIT) atomic datasets",
        "note": "Real Windows host telemetry with ground-truth ATT&CK technique labels from "
                "each dataset's metadata.",
        "datasets": committed,
    }, indent=1), encoding="utf-8")

    techniques = Counter(t for d in corpus for t in d["techniques"])
    print(f"\n{len(corpus)} datasets ({skipped} skipped for missing host logs), "
          f"{len(techniques)} distinct techniques")
    print(f"  corpus -> data/processed/attack_corpus.json")
    print(f"  sample -> {out.relative_to(BACKEND)} ({out.stat().st_size / 1e6:.2f} MB, "
          f"{len(committed)} datasets)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
