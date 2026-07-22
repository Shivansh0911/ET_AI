"""
Host-event tokenisation, shared by the offline corpus builder and the live API.

Both sides must produce identical tokens or the attribution model would be scored on one
representation and served another, so this lives in one place and is imported by both.

Environment-identifying strings — hostnames, domains, SIDs, GUIDs, long hex — are dropped.
They identify the lab that produced a capture rather than the behaviour it demonstrates, and
leaving them in would let a classifier score well by recognising the environment.
"""
from __future__ import annotations

import re
from pathlib import Path

PROCESS_FIELDS = ("Image", "NewProcessName", "ProcessName", "SourceImage")
PARENT_FIELDS = ("ParentImage", "ParentProcessName", "ParentCommandLine")
COMMAND_FIELDS = ("CommandLine", "ProcessCommandLine", "ScriptBlockText")
OBJECT_FIELDS = ("TargetObject", "TargetImage", "TargetFilename", "ServiceName", "ShareName",
                 "PipeName", "QueryName", "DestinationIp", "DestinationPort", "CallTrace",
                 "GrantedAccess", "LogonType", "ObjectName", "Details", "Description",
                 "OriginalFileName", "Product")

GUID = re.compile(r"^[0-9a-f]{8}-[0-9a-f]{4}-", re.I)
HEXY = re.compile(r"^(0x)?[0-9a-f]{6,}$", re.I)
NUMERIC = re.compile(r"^\d+$")
NOISE_SUBSTRINGS = ("blacksmith", ".local", "wardog", "s-1-5-", "windomain")


def useful(token: str) -> bool:
    if len(token) < 3 or len(token) > 40:
        return False
    if GUID.match(token) or HEXY.match(token) or NUMERIC.match(token):
        return False
    return not any(noise in token for noise in NOISE_SUBSTRINGS)


def tokenise(text: str) -> list[str]:
    return [t for t in re.split(r"[^A-Za-z0-9_.\-]+", str(text).lower()) if useful(t)]


def event_tokens(event: dict) -> list[str]:
    """Compact one Windows event into behaviour-bearing tokens."""
    tokens = [f"ch:{str(event.get('Channel', '')).lower()}", f"eid:{event.get('EventID', '')}"]

    for field in PROCESS_FIELDS:
        if value := event.get(field):
            tokens.append(f"img:{Path(str(value)).name.lower()}")
    for field in PARENT_FIELDS:
        if value := event.get(field):
            tokens.append(f"par:{Path(str(value).split()[0]).name.lower()}")
    for field in COMMAND_FIELDS + OBJECT_FIELDS:
        if value := event.get(field):
            tokens.extend(tokenise(value)[:24])

    return tokens


def summarise_event(event: dict) -> dict:
    """The fields the UI and the correlation engine actually need."""
    process = next((event[f] for f in PROCESS_FIELDS if event.get(f)), "")
    parent = next((event[f] for f in PARENT_FIELDS if event.get(f)), "")
    command = next((event[f] for f in COMMAND_FIELDS if event.get(f)), "")
    return {
        "timestamp": event.get("@timestamp") or event.get("TimeCreated", ""),
        "host": event.get("Hostname", ""),
        "channel": event.get("Channel", ""),
        "event_id": event.get("EventID"),
        "process": Path(str(process)).name if process else "",
        "parent": Path(str(parent).split()[0]).name if parent else "",
        "command_line": " ".join(str(command).split())[:220],
        "user": event.get("SubjectUserName") or event.get("TargetUserName") or "",
    }


def identity_analyzer(tokens: list[str]) -> list[str]:
    """Pass-through analyzer for TfidfVectorizer.

    Must be a module-level function, not a lambda: the fitted vectoriser is pickled into
    ml/artifacts/attributor.joblib and has to be importable when the API unpickles it.
    """
    return tokens
