"""
Reproducible dataset acquisition for CyberSentinel.

Downloads the three external corpora the platform's measured claims rest on. Nothing
here is committed to git except this script — see data/raw/.gitignore.

  cicids  CIC-IDS2017 network flow CSVs (~940 MB) — trains and evaluates the intrusion
          detector. Pulled from the Hugging Face mirror because the official UNB mirrors
          (cicresearch.ca, 205.174.165.80) redirect to an HTML landing page rather than
          serving the zip.
  attack  OTRF/Security-Datasets atomic datasets (~small) — Windows host telemetry with
          ground-truth MITRE ATT&CK technique labels, used to measure attribution accuracy.
  mitre   MITRE ATT&CK enterprise STIX bundle (~53 MB) — trimmed into a real technique
          table so the app stops running on a 21-technique hardcoded fallback.

Usage:
    python ml/download_datasets.py                 # everything
    python ml/download_datasets.py --only cicids
    python ml/download_datasets.py --only mitre attack
"""
from __future__ import annotations

import argparse
import json
import sys
import urllib.request
import urllib.error
from pathlib import Path

BACKEND = Path(__file__).resolve().parent.parent
RAW = BACKEND / "data" / "raw"

HF_CICIDS = "https://huggingface.co/datasets/c01dsnap/CIC-IDS2017/resolve/main"
CICIDS_FILES = [
    "Monday-WorkingHours.pcap_ISCX.csv",
    "Tuesday-WorkingHours.pcap_ISCX.csv",
    "Wednesday-workingHours.pcap_ISCX.csv",
    "Thursday-WorkingHours-Morning-WebAttacks.pcap_ISCX.csv",
    "Thursday-WorkingHours-Afternoon-Infilteration.pcap_ISCX.csv",
    "Friday-WorkingHours-Morning.pcap_ISCX.csv",
    "Friday-WorkingHours-Afternoon-PortScan.pcap_ISCX.csv",
    "Friday-WorkingHours-Afternoon-DDos.pcap_ISCX.csv",
]

OTRF_API = "https://api.github.com/repos/OTRF/Security-Datasets/contents/datasets/atomic/_metadata"
OTRF_RAW = "https://raw.githubusercontent.com/OTRF/Security-Datasets/master/datasets/atomic/_metadata"

MITRE_STIX = (
    "https://raw.githubusercontent.com/mitre-attack/attack-stix-data/master/"
    "enterprise-attack/enterprise-attack.json"
)


def _fetch(url: str, dest: Path, label: str) -> bool:
    """Stream a URL to disk, skipping if the local file already matches remote size."""
    dest.parent.mkdir(parents=True, exist_ok=True)
    req = urllib.request.Request(url, headers={"User-Agent": "CyberSentinel/1.0"})
    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            remote_size = int(resp.headers.get("Content-Length") or 0)
            if dest.exists() and remote_size and dest.stat().st_size == remote_size:
                print(f"  = {label} (already have {remote_size / 1e6:.1f} MB)")
                return True
            print(f"  > {label} ({remote_size / 1e6:.1f} MB)", end="", flush=True)
            written = 0
            with open(dest, "wb") as fh:
                while chunk := resp.read(1 << 20):
                    fh.write(chunk)
                    written += len(chunk)
                    if remote_size:
                        pct = 100 * written / remote_size
                        print(f"\r  > {label} ({remote_size / 1e6:.1f} MB) {pct:5.1f}%",
                              end="", flush=True)
            print()
            return True
    except (urllib.error.URLError, urllib.error.HTTPError, TimeoutError) as exc:
        print(f"\n  ! {label} FAILED: {exc}")
        return False


def get_cicids() -> int:
    print(f"CIC-IDS2017 -> {RAW / 'cicids'}")
    ok = sum(_fetch(f"{HF_CICIDS}/{name}", RAW / "cicids" / name, name)
             for name in CICIDS_FILES)
    print(f"  {ok}/{len(CICIDS_FILES)} files present\n")
    return len(CICIDS_FILES) - ok


def get_attack_logs() -> int:
    """Fetch OTRF metadata YAMLs (technique ground truth) plus their host log archives."""
    meta_dir = RAW / "attack" / "_metadata"
    print(f"OTRF Security-Datasets -> {RAW / 'attack'}")

    req = urllib.request.Request(OTRF_API, headers={"User-Agent": "CyberSentinel/1.0"})
    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            listing = json.load(resp)
    except Exception as exc:
        print(f"  ! could not list metadata directory: {exc}")
        return 1

    names = [item["name"] for item in listing if item["name"].endswith(".yaml")]
    print(f"  {len(names)} metadata files")
    failed = sum(not _fetch(f"{OTRF_RAW}/{n}", meta_dir / n, n) for n in names)

    # The host log archives are referenced from inside each YAML. Parsing them here keeps
    # the download step self-contained rather than splitting it across two scripts.
    import yaml

    archives = 0
    for path in sorted(meta_dir.glob("*.yaml")):
        try:
            doc = yaml.safe_load(path.read_text(encoding="utf-8", errors="replace"))
        except yaml.YAMLError:
            continue
        if not isinstance(doc, dict) or not doc.get("attack_mappings"):
            continue
        for entry in doc.get("files") or []:
            link = (entry or {}).get("link", "")
            if entry.get("type") == "Host" and link.endswith(".zip"):
                dest = RAW / "attack" / "host" / Path(link).name
                if _fetch(link, dest, Path(link).name):
                    archives += 1
    print(f"  {archives} host log archives present\n")
    return failed


def get_mitre() -> int:
    print(f"MITRE ATT&CK STIX -> {RAW / 'mitre'}")
    ok = _fetch(MITRE_STIX, RAW / "mitre" / "enterprise-attack.json", "enterprise-attack.json")
    print()
    return 0 if ok else 1


TARGETS = {"cicids": get_cicids, "attack": get_attack_logs, "mitre": get_mitre}


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__,
                                     formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--only", nargs="+", choices=sorted(TARGETS), default=sorted(TARGETS))
    args = parser.parse_args()

    failures = sum(TARGETS[name]() for name in args.only)
    if failures:
        print(f"{failures} download(s) failed — rerun to resume.")
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
