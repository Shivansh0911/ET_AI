"""
Synthetic security log generator simulating Indian critical infrastructure.
Generates realistic events for: AIIMS, CBSE, Power Grid, Railway, Banking infra.
"""
import random
import uuid
from datetime import datetime, timedelta
from typing import List

ASSETS = {
    "AIIMS-Delhi": {"ips": ["10.1.1.0/24"], "city": "Delhi", "lat": 28.5672, "lng": 77.2100, "type": "Healthcare"},
    "CBSE-Digital": {"ips": ["10.2.1.0/24"], "city": "Delhi", "lat": 28.6139, "lng": 77.2090, "type": "Education"},
    "PowerGrid-NR": {"ips": ["10.3.1.0/24"], "city": "Lucknow", "lat": 26.8467, "lng": 80.9462, "type": "Energy"},
    "RailNet-CR": {"ips": ["10.4.1.0/24"], "city": "Mumbai", "lat": 19.0760, "lng": 72.8777, "type": "Transport"},
    "SBI-Core": {"ips": ["10.5.1.0/24"], "city": "Mumbai", "lat": 18.9300, "lng": 72.8350, "type": "Banking"},
    "ISRO-NRSC": {"ips": ["10.6.1.0/24"], "city": "Hyderabad", "lat": 17.3850, "lng": 78.4867, "type": "Space/Defense"},
    "NIC-GOV": {"ips": ["10.7.1.0/24"], "city": "Delhi", "lat": 28.6129, "lng": 77.2295, "type": "Government IT"},
    "BSNL-NOC": {"ips": ["10.8.1.0/24"], "city": "Chennai", "lat": 13.0827, "lng": 80.2707, "type": "Telecom"},
}

ATTACK_SCENARIOS = [
    {
        "name": "APT_Ransomware_Campaign",
        "events": [
            {"type": "phishing_click", "severity": "medium", "desc": "User clicked suspicious email link from spoofed gov.in domain", "mitre": "T1566"},
            {"type": "malware_download", "severity": "high", "desc": "PowerShell executed encoded payload download from external C2 server", "mitre": "T1059"},
            {"type": "credential_dump", "severity": "critical", "desc": "Mimikatz-like credential harvesting detected on domain controller", "mitre": "T1003"},
            {"type": "lateral_movement", "severity": "critical", "desc": "RDP session initiated from compromised workstation to database server", "mitre": "T1021"},
            {"type": "data_encryption", "severity": "critical", "desc": "Mass file encryption detected — ransomware payload active", "mitre": "T1486"},
        ]
    },
    {
        "name": "Data_Exfiltration_APT",
        "events": [
            {"type": "recon_scan", "severity": "low", "desc": "Internal network scan detected from single workstation — 1500+ ports probed", "mitre": "T1046"},
            {"type": "privilege_escalation", "severity": "high", "desc": "Service account elevated to domain admin via Kerberoasting", "mitre": "T1078"},
            {"type": "data_staging", "severity": "high", "desc": "Large volume of sensitive files copied to staging directory", "mitre": "T1074"},
            {"type": "dns_exfil", "severity": "critical", "desc": "Anomalous DNS query volume — possible data exfiltration via DNS tunneling", "mitre": "T1048"},
        ]
    },
    {
        "name": "Brute_Force_Campaign",
        "events": [
            {"type": "auth_failure_spike", "severity": "medium", "desc": "847 failed SSH login attempts in 5 minutes from external IP", "mitre": "T1110"},
            {"type": "successful_auth", "severity": "high", "desc": "Successful login after brute force — compromised credentials confirmed", "mitre": "T1078"},
            {"type": "persistence_installed", "severity": "critical", "desc": "Cron job created for reverse shell callback every 60 seconds", "mitre": "T1053"},
        ]
    },
    {
        "name": "Supply_Chain_Compromise",
        "events": [
            {"type": "software_update_anomaly", "severity": "medium", "desc": "Vendor update package hash mismatch — potential supply chain tampering", "mitre": "T1195"},
            {"type": "defense_evasion", "severity": "high", "desc": "Antivirus service forcefully stopped on 12 endpoints simultaneously", "mitre": "T1562"},
            {"type": "c2_beacon", "severity": "critical", "desc": "Periodic HTTPS beacon to known APT infrastructure detected", "mitre": "T1071"},
        ]
    },
]

NORMAL_EVENTS = [
    {"type": "auth_success", "severity": "info", "desc": "Successful user login via SSO"},
    {"type": "firewall_allow", "severity": "info", "desc": "Outbound HTTPS connection allowed to approved vendor"},
    {"type": "patch_applied", "severity": "info", "desc": "Windows security update KB5034441 applied successfully"},
    {"type": "backup_complete", "severity": "info", "desc": "Nightly database backup completed — 12.4 GB"},
    {"type": "vpn_connect", "severity": "info", "desc": "VPN tunnel established from authorized remote endpoint"},
    {"type": "cert_renewal", "severity": "low", "desc": "SSL certificate auto-renewed for internal portal"},
]


def generate_ip(base: str) -> str:
    prefix = base.rsplit(".", 1)[0]
    return f"{prefix}.{random.randint(1, 254)}"


def generate_logs(num_events: int = 200, attack_ratio: float = 0.3) -> List[dict]:
    """Generate a mix of normal and attack events."""
    events = []
    now = datetime.utcnow()
    asset_keys = list(ASSETS.keys())

    num_normal = int(num_events * (1 - attack_ratio))
    for i in range(num_normal):
        asset_name = random.choice(asset_keys)
        asset = ASSETS[asset_name]
        evt = random.choice(NORMAL_EVENTS)
        events.append({
            "id": str(uuid.uuid4())[:8],
            "timestamp": (now - timedelta(minutes=random.randint(0, 1440))).isoformat(),
            "source_ip": generate_ip(asset["ips"][0]),
            "dest_ip": generate_ip(asset["ips"][0]),
            "event_type": evt["type"],
            "description": evt["desc"],
            "severity": evt["severity"],
            "asset": asset_name,
            "location": asset["city"],
            "lat": asset["lat"],
            "lng": asset["lng"],
            "infra_type": asset["type"],
            "is_anomaly": False,
            "anomaly_score": round(random.uniform(0.0, 0.2), 2),
            "mitre_id": None,
            "raw_log": f"[{evt['type'].upper()}] {asset_name} — {evt['desc']}"
        })

    num_attacks = num_events - num_normal
    for i in range(num_attacks):
        scenario = random.choice(ATTACK_SCENARIOS)
        evt = random.choice(scenario["events"])
        asset_name = random.choice(asset_keys)
        asset = ASSETS[asset_name]
        attacker_ip = f"{random.randint(40,220)}.{random.randint(1,254)}.{random.randint(1,254)}.{random.randint(1,254)}"
        events.append({
            "id": str(uuid.uuid4())[:8],
            "timestamp": (now - timedelta(minutes=random.randint(0, 720))).isoformat(),
            "source_ip": attacker_ip,
            "dest_ip": generate_ip(asset["ips"][0]),
            "event_type": evt["type"],
            "description": evt["desc"],
            "severity": evt["severity"],
            "asset": asset_name,
            "location": asset["city"],
            "lat": asset["lat"],
            "lng": asset["lng"],
            "infra_type": asset["type"],
            "is_anomaly": True,
            "anomaly_score": round(random.uniform(0.6, 1.0), 2),
            "mitre_id": evt.get("mitre"),
            "scenario": scenario["name"],
            "raw_log": f"[ALERT:{evt['severity'].upper()}] {asset_name} — {evt['desc']} — src:{attacker_ip}"
        })

    events.sort(key=lambda x: x["timestamp"], reverse=True)
    return events


if __name__ == "__main__":
    import json
    logs = generate_logs(200)
    with open("sample_logs.json", "w") as f:
        json.dump(logs, f, indent=2)
    print(f"Generated {len(logs)} events. Anomalies: {sum(1 for e in logs if e['is_anomaly'])}")
