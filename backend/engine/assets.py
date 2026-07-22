"""
Critical-infrastructure asset personas used to present detections geographically.

IMPORTANT — this mapping is ILLUSTRATIVE and the UI says so. The flow features being
scored are genuine CIC-IDS2017 captures from the Canadian Institute for Cybersecurity;
they are not traffic from AIIMS, CBSE or any Indian network. The personas exist so the
dashboard can show what a national-scale deployment would look like. Presenting the
flows as literal Indian infrastructure traffic would be exactly the kind of unbacked
claim this rebuild removes.
"""
from __future__ import annotations

ILLUSTRATIVE = True

ASSETS: dict[str, dict] = {
    "AIIMS-Delhi":  {"subnet": "10.1.1", "city": "Delhi",     "lat": 28.5672, "lng": 77.2100, "type": "Healthcare"},
    "CBSE-Digital": {"subnet": "10.2.1", "city": "Delhi",     "lat": 28.6139, "lng": 77.2090, "type": "Education"},
    "PowerGrid-NR": {"subnet": "10.3.1", "city": "Lucknow",   "lat": 26.8467, "lng": 80.9462, "type": "Energy"},
    "RailNet-CR":   {"subnet": "10.4.1", "city": "Mumbai",    "lat": 19.0760, "lng": 72.8777, "type": "Transport"},
    "SBI-Core":     {"subnet": "10.5.1", "city": "Mumbai",    "lat": 18.9300, "lng": 72.8350, "type": "Banking"},
    "ISRO-NRSC":    {"subnet": "10.6.1", "city": "Hyderabad", "lat": 17.3850, "lng": 78.4867, "type": "Space/Defense"},
    "NIC-GOV":      {"subnet": "10.7.1", "city": "Delhi",     "lat": 28.6129, "lng": 77.2295, "type": "Government IT"},
    "BSNL-NOC":     {"subnet": "10.8.1", "city": "Chennai",   "lat": 13.0827, "lng": 80.2707, "type": "Telecom"},
}

ASSET_NAMES = list(ASSETS)

PROVENANCE = (
    "Flow features are real CIC-IDS2017 captures; the asset, city and IP overlay is an "
    "illustrative presentation layer, not measured Indian infrastructure traffic."
)


def asset_for(index: int) -> tuple[str, dict]:
    """Deterministically assign an event to an asset so reloads are stable."""
    name = ASSET_NAMES[index % len(ASSET_NAMES)]
    return name, ASSETS[name]
