import json
import os

_ATTACK_DATA = None

def load_mitre_attack() -> dict:
    """Load MITRE ATT&CK enterprise data from local JSON."""
    global _ATTACK_DATA
    if _ATTACK_DATA is not None:
        return _ATTACK_DATA

    json_path = os.path.join(os.path.dirname(__file__), "..", "data", "enterprise-attack.json")

    if not os.path.exists(json_path):
        _ATTACK_DATA = get_fallback_techniques()
        return _ATTACK_DATA

    with open(json_path, "r") as f:
        raw = json.load(f)

    techniques = {}
    for obj in raw.get("objects", []):
        if obj.get("type") == "attack-pattern" and not obj.get("revoked", False):
            ext_refs = obj.get("external_references", [])
            tech_id = None
            for ref in ext_refs:
                if ref.get("source_name") == "mitre-attack":
                    tech_id = ref.get("external_id")
                    break
            if tech_id:
                kill_chain = obj.get("kill_chain_phases", [])
                tactic = kill_chain[0]["phase_name"] if kill_chain else "unknown"
                techniques[tech_id] = {
                    "id": tech_id,
                    "name": obj.get("name", ""),
                    "description": obj.get("description", "")[:200],
                    "tactic": tactic.replace("-", " ").title()
                }
    _ATTACK_DATA = techniques
    return _ATTACK_DATA

def get_fallback_techniques() -> dict:
    """Hardcoded subset of common MITRE ATT&CK techniques for when JSON isn't available."""
    return {
        "T1190": {"id": "T1190", "name": "Exploit Public-Facing Application", "tactic": "Initial Access", "description": "Adversary exploits a vulnerability in an internet-facing application."},
        "T1078": {"id": "T1078", "name": "Valid Accounts", "tactic": "Persistence", "description": "Adversary uses legitimate credentials to maintain access."},
        "T1059": {"id": "T1059", "name": "Command and Scripting Interpreter", "tactic": "Execution", "description": "Adversary uses command-line interfaces or scripting to execute commands."},
        "T1053": {"id": "T1053", "name": "Scheduled Task/Job", "tactic": "Persistence", "description": "Adversary uses task scheduling to execute malicious code."},
        "T1021": {"id": "T1021", "name": "Remote Services", "tactic": "Lateral Movement", "description": "Adversary uses remote services to move within the network."},
        "T1048": {"id": "T1048", "name": "Exfiltration Over Alternative Protocol", "tactic": "Exfiltration", "description": "Adversary exfiltrates data using a non-standard protocol."},
        "T1071": {"id": "T1071", "name": "Application Layer Protocol", "tactic": "Command And Control", "description": "Adversary communicates using standard application layer protocols."},
        "T1110": {"id": "T1110", "name": "Brute Force", "tactic": "Credential Access", "description": "Adversary attempts to gain access through systematic password guessing."},
        "T1486": {"id": "T1486", "name": "Data Encrypted for Impact", "tactic": "Impact", "description": "Adversary encrypts data to disrupt availability (ransomware)."},
        "T1003": {"id": "T1003", "name": "OS Credential Dumping", "tactic": "Credential Access", "description": "Adversary dumps credentials from the operating system."},
        "T1055": {"id": "T1055", "name": "Process Injection", "tactic": "Defense Evasion", "description": "Adversary injects code into processes to evade defenses."},
        "T1036": {"id": "T1036", "name": "Masquerading", "tactic": "Defense Evasion", "description": "Adversary manipulates features to make malicious artifacts appear legitimate."},
        "T1046": {"id": "T1046", "name": "Network Service Discovery", "tactic": "Discovery", "description": "Adversary scans for services running on remote hosts."},
        "T1074": {"id": "T1074", "name": "Data Staged", "tactic": "Collection", "description": "Adversary stages collected data in a central location prior to exfiltration."},
        "T1562": {"id": "T1562", "name": "Impair Defenses", "tactic": "Defense Evasion", "description": "Adversary disables or modifies security tools to avoid detection."},
        "T1070": {"id": "T1070", "name": "Indicator Removal", "tactic": "Defense Evasion", "description": "Adversary deletes or modifies artifacts to remove evidence."},
        "T1027": {"id": "T1027", "name": "Obfuscated Files or Information", "tactic": "Defense Evasion", "description": "Adversary encrypts or encodes files to evade detection."},
        "T1547": {"id": "T1547", "name": "Boot or Logon Autostart Execution", "tactic": "Persistence", "description": "Adversary configures system to execute malware at boot."},
        "T1566": {"id": "T1566", "name": "Phishing", "tactic": "Initial Access", "description": "Adversary sends phishing messages to gain access."},
        "T1105": {"id": "T1105", "name": "Ingress Tool Transfer", "tactic": "Command And Control", "description": "Adversary transfers tools from external systems into the environment."},
        "T1195": {"id": "T1195", "name": "Supply Chain Compromise", "tactic": "Initial Access", "description": "Adversary manipulates products or product delivery mechanisms prior to receipt by the end consumer."},
    }
