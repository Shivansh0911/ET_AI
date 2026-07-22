"""
Vulnerability prioritisation — the government-infrastructure bullet of PS#7.

The statement asks for an agent that "maps the organisation's asset inventory against live CVE
feeds, contextualises exploitability given the specific network topology and observed threat
actor profiles, and generates a dynamic, risk-ranked remediation queue — addressing the reality
that government teams cannot patch everything at once."

This is a scoped MVP of exactly that, and it is honest about which parts are real:

  REAL       the CVEs and their CVSS scores and vectors, pulled from the NIST NVD API 2.0
             (data/cve/nvd_slice.json). The ranking formula, shown in full below and in the UI.
             The observed-activity term, computed from live detections on each asset.
  ILLUSTRATIVE  the asset-to-software mapping. Real AIIMS/CBSE inventories are not public; these
             are plausible assignments so the ranking has something to rank. Labelled everywhere.

The formula is deliberately transparent — a black-box priority number would be the opposite of
what a patch-planning team needs:

    priority = CVSS_normalised(0-1) · exposure(0.4-1.0) · (1 + observed_activity(0-1)) · 100

so a critical CVE on an internet-facing asset under active attack outranks a critical CVE on an
isolated asset that nothing is touching — which is the whole point of "cannot patch everything".
"""
from __future__ import annotations

import json
from pathlib import Path

from .assets import ASSETS

SLICE = Path(__file__).resolve().parent.parent / "data" / "cve" / "nvd_slice.json"

# How internet-facing each asset is. A public exam portal is fully exposed; a space-research
# network sits deep behind segmentation. Illustrative, like the asset personas themselves.
EXPOSURE = {
    "CBSE-Digital": 1.00, "NIC-GOV": 0.95, "RailNet-CR": 0.80, "SBI-Core": 0.72,
    "AIIMS-Delhi": 0.70, "BSNL-NOC": 0.60, "PowerGrid-NR": 0.50, "ISRO-NRSC": 0.40,
}

# Plausible software exposure per asset -> which curated CVEs apply. Illustrative mapping;
# the CVEs themselves and their scores are real NVD data.
ASSET_SOFTWARE = {
    "AIIMS-Delhi": {"services": ["Microsoft Exchange", "Apache Log4j", "OpenSSL"],
                    "cves": ["CVE-2021-26855", "CVE-2021-44228", "CVE-2014-0160"]},
    "CBSE-Digital": {"services": ["MOVEit Transfer", "Apache Log4j", "Fortinet SSL VPN"],
                     "cves": ["CVE-2023-34362", "CVE-2021-44228", "CVE-2018-13379"]},
    "PowerGrid-NR": {"services": ["Windows RDP", "Windows SMBv1"],
                     "cves": ["CVE-2019-0708", "CVE-2017-0144"]},
    "RailNet-CR": {"services": ["F5 BIG-IP", "Fortinet SSL VPN"],
                   "cves": ["CVE-2022-1388", "CVE-2018-13379"]},
    "SBI-Core": {"services": ["Apache Log4j", "Active Directory", "Microsoft Outlook"],
                 "cves": ["CVE-2021-44228", "CVE-2020-1472", "CVE-2023-23397"]},
    "ISRO-NRSC": {"services": ["Windows SMBv1", "Windows Print Spooler"],
                  "cves": ["CVE-2017-0144", "CVE-2021-34527"]},
    "NIC-GOV": {"services": ["Microsoft Exchange", "Fortinet SSL VPN", "Active Directory"],
                "cves": ["CVE-2021-26855", "CVE-2018-13379", "CVE-2020-1472"]},
    "BSNL-NOC": {"services": ["Windows RDP", "F5 BIG-IP"],
                 "cves": ["CVE-2019-0708", "CVE-2022-1388"]},
}

_catalog: dict | None = None


def _catalog_by_id() -> tuple[dict, dict]:
    global _catalog
    if _catalog is None:
        _catalog = json.loads(SLICE.read_text(encoding="utf-8")) if SLICE.exists() else {"cves": []}
    return _catalog, {c["id"]: c for c in _catalog.get("cves", [])}


def _activity(detections: list[dict]) -> tuple[dict, int]:
    """Observed detections per asset in the current window — the dynamic term."""
    counts: dict[str, int] = {}
    for d in detections:
        counts[d["asset"]] = counts.get(d["asset"], 0) + 1
    return counts, max(counts.values(), default=0)


def remediation_queue(detections: list[dict]) -> dict:
    meta, by_id = _catalog_by_id()
    if not by_id:
        return {"available": False,
                "reason": "data/cve/nvd_slice.json missing — run the CVE downloader"}

    activity, peak = _activity(detections)
    items = []

    for asset, spec in ASSET_SOFTWARE.items():
        exposure = EXPOSURE.get(asset, 0.5)
        observed = activity.get(asset, 0)
        activity_norm = round(observed / peak, 4) if peak else 0.0

        for cve_id in spec["cves"]:
            cve = by_id.get(cve_id)
            if not cve or cve.get("cvss") is None:
                continue
            cvss = float(cve["cvss"])
            # Compute from the same rounded components the UI shows, so the displayed
            # breakdown reconstructs the priority exactly — a black-box score no analyst can
            # verify is the opposite of what a patch-planning queue needs.
            cvss_norm = round(cvss / 10, 3)
            activity_mult = round(1 + activity_norm, 3)
            priority = round(cvss_norm * exposure * activity_mult * 100, 1)
            items.append({
                "cve": cve_id,
                "asset": asset,
                "asset_type": ASSETS.get(asset, {}).get("type"),
                "cvss": cvss,
                "severity": cve.get("severity"),
                "vector": cve.get("vector"),
                "published": cve.get("published"),
                "description": cve.get("description"),
                "service": next((s for s in spec["services"]), None),
                "exposure": exposure,
                "observed_detections": observed,
                "activity_factor": round(1 + activity_norm, 3),
                "priority": priority,
                "components": {
                    "cvss_normalised": cvss_norm,
                    "exposure": exposure,
                    "activity_multiplier": activity_mult,
                },
            })

    items.sort(key=lambda x: -x["priority"])
    for rank, item in enumerate(items, 1):
        item["rank"] = rank

    return {
        "available": True,
        "queue": items,
        "formula": "priority = (CVSS / 10) x internet_exposure x (1 + observed_activity) x 100",
        "formula_explained": {
            "CVSS / 10": "real base score from NVD, normalised to 0-1",
            "internet_exposure": "how internet-facing the asset is (0.4 isolated - 1.0 public)",
            "observed_activity": "detections on this asset this window / the busiest asset (0-1), "
                                 "so the queue re-ranks as the threat picture changes",
        },
        "source": meta.get("source"),
        "retrieved": meta.get("retrieved"),
        "counts": {"cves_tracked": len(by_id), "assets": len(ASSET_SOFTWARE),
                   "items": len(items)},
        "provenance": {
            "real": "CVE identifiers, CVSS scores and vectors (NIST NVD); the ranking formula; "
                    "the observed-activity term (live detections).",
            "illustrative": "the asset-to-software mapping — real government inventories are not "
                            "public, so these are plausible assignments, labelled as such.",
        },
    }
