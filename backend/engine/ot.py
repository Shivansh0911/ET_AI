"""
OT (operational technology) plane — a small, clearly SIMULATED Modbus/ICS signal.

PS#7's challenge statement asks to "correlate weak signals across heterogeneous IT **and OT**
environments." Everything else in this platform is IT (network flows, Windows host telemetry).
This adds the OT half so a compound incident can span both planes on one asset — an attacker
probing a substation's network *and* writing to its PLC registers in the same window is exactly
the cross-domain signal the statement is about, and exactly what a purely-IT SOC misses.

This is SIMULATED and labelled as such everywhere. We have no real ICS telemetry, and the honest
move — the one this whole project is built on — is to generate a plausible OT signal and say
plainly that it is generated, rather than dress it up as a live Modbus tap. The event shapes are
real ICS concepts (function-code writes, setpoint deviation, out-of-range coil writes); the data
is synthetic and deterministic.
"""
from __future__ import annotations

import hashlib

from .assets import ASSETS

# Only the assets that actually have an OT/industrial layer. A banking core or an exam portal
# has no PLCs; a power grid, a railway network and a telecom NOC do.
OT_ASSETS = {
    "PowerGrid-NR": {"process": "330 kV substation", "device": "SEL-451 protection relay"},
    "RailNet-CR": {"process": "interlocking / signalling", "device": "Siemens S7-1500 PLC"},
    "BSNL-NOC": {"process": "power & cooling plant", "device": "Modbus RTU gateway"},
    "ISRO-NRSC": {"process": "ground-station HVAC", "device": "Schneider M340 PLC"},
}

# Real ICS attack shapes. Function codes are genuine Modbus (0x05 write coil, 0x06/0x10 write
# register); the values and targets are synthetic.
EVENT_KINDS = [
    {"kind": "unauthorized_register_write", "fc": "0x10 (write multiple registers)",
     "severity": "critical", "detail": "Write to protected setpoint register from a "
                                       "non-engineering-workstation source"},
    {"kind": "setpoint_deviation", "fc": "0x06 (write single register)",
     "severity": "high", "detail": "Commanded setpoint moved outside the safe operating band"},
    {"kind": "coil_force", "fc": "0x05 (write single coil)",
     "severity": "high", "detail": "Output coil forced — bypasses the normal control logic"},
    {"kind": "scan_enumeration", "fc": "0x2B (read device identification)",
     "severity": "medium", "detail": "Sequential device-ID reads — reconnaissance of the "
                                     "Modbus address space"},
]


def _rng(asset: str, index: int) -> int:
    """Deterministic per-(asset, index) draw so the demo is reproducible."""
    h = hashlib.sha256(f"{asset}:{index}".encode()).hexdigest()
    return int(h[:8], 16)


def signals(per_asset: int = 2) -> list[dict]:
    """Generate simulated OT signals spread across the OT-bearing assets and the window."""
    out = []
    assets = list(OT_ASSETS)
    for a_i, asset in enumerate(assets):
        spec = OT_ASSETS[asset]
        for i in range(per_asset):
            draw = _rng(asset, i)
            kind = EVENT_KINDS[draw % len(EVENT_KINDS)]
            position = a_i * per_asset + i
            out.append({
                "id": f"OT-{asset}-{i}",
                "plane": "ot",
                "asset": asset,
                "location": ASSETS[asset]["city"],
                "process": spec["process"],
                "device": spec["device"],
                "kind": kind["kind"],
                "function_code": kind["fc"],
                "severity": kind["severity"],
                "detail": kind["detail"],
                "register": 40001 + (draw % 200),
                "simulated": True,
                # Spread across the replay window like the host signals do.
                "spread": position / max(len(assets) * per_asset, 1),
            })
    return out


NOTE = ("OT signals are SIMULATED — plausible Modbus/ICS events (real function codes, synthetic "
        "values) on the assets that have an industrial layer. We have no live ICS telemetry and "
        "say so rather than fake a tap. What is real is the correlation: an OT write and IT "
        "network activity on the same asset in the same window become one cross-domain incident.")
