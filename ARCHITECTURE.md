# CyberSentinel — architecture

A named deliverable of PS#7. Diagrams are Mermaid, so they render in GitHub and stay in
version control rather than drifting away in a slide.

---

## System

```mermaid
flowchart TB
    subgraph ingest["Ingestion"]
        A1["CIC-IDS2017 flows<br/>held-out capture days"]
        A2["OTRF host telemetry<br/>ATT&CK-labelled"]
        A3["Zeek conn.log adapter<br/>31.9% feature coverage"]
    end

    subgraph detect["Detection — two heads"]
        B1["Supervised RandomForest<br/>families seen in training"]
        B2["Novelty model<br/>fitted on benign only"]
        B3{"either head fires"}
        B1 --> B3
        B2 --> B3
    end

    subgraph agents["Agent layer"]
        C1["Correlation engine<br/>cross-plane incidents"]
        C2["ATT&CK mapper<br/>technique attribution"]
        C3["Threat intel<br/>Tavily to Groq"]
        C4["Response orchestrator<br/>playbook to executor"]
        C5["Argus<br/>guarded assistant"]
    end

    subgraph loop["Learning loop"]
        D1["Analyst verdict<br/>real or false"]
        D2["Refit every 4 verdicts"]
        D3["Adaptive layer<br/>stacked on base score"]
        D1 --> D2 --> D3
    end

    subgraph services["Cross-cutting"]
        E1[("Audit ledger<br/>SHA-256 chain")]
        E2[("Metrics registry<br/>single source of truth")]
    end

    A1 --> B1
    A1 --> B2
    A3 --> B1
    B3 --> C1
    A2 --> C1
    B3 --> C2
    C1 --> C4
    C2 --> C4
    C3 --> C4
    B3 --> D1
    D3 -.raises scores.-> B3
    C4 --> E1
    D2 --> E1
    C5 --> E1
    C5 -.reads.-> B3
    C5 -.reads.-> E1
    B3 --> E2
    C4 --> E2
```

## Detection path for one flow

```mermaid
sequenceDiagram
    participant F as Flow
    participant S as Scaler
    participant Sup as Supervised head
    participant Nov as Novelty head
    participant D as Decision
    participant A as Adaptive layer
    participant U as Console

    F->>S: 69 numeric features
    S->>Sup: standardised vector
    S->>Nov: standardised vector
    Sup-->>D: P(attack)
    Nov-->>D: distance from benign baseline
    D->>A: base score
    A-->>D: raised, if analyst verdicts justify it
    D->>U: alert, severity, ATT&CK technique
    U->>A: analyst marks real or false
    Note over A: refits every 4 verdicts,<br/>each refit written to the ledger
```

## Why two heads

```mermaid
flowchart LR
    subgraph known["Families seen in training"]
        K1["DoS, brute force,<br/>web attacks"]
    end
    subgraph novel["Families never seen"]
        N1["PortScan, Bot,<br/>Infiltration"]
    end

    K1 -->|"recognised by pattern"| SUP["Supervised head"]
    N1 -->|"blind — 0.0 to 0.3% recall"| SUP
    N1 -->|"flagged as unlike normal"| NOV["Novelty head"]
    K1 -->|"also often unlike normal"| NOV

    SUP --> OUT["Union"]
    NOV --> OUT
```

A supervised classifier cannot recognise a class nobody showed it. The novelty head never
sees an attack during fitting — only benign traffic — so what it catches owes nothing to
prior knowledge of the attack. That is the behavioural layer PS#7 asks for.

## Evaluation discipline

```mermaid
flowchart LR
    subgraph train["Mon / Tue / Wed"]
        T1["Fit split 75%"]
        T2["Validation 25%<br/>thresholds chosen here"]
    end
    subgraph test["Thu / Fri"]
        T3["Scored once,<br/>at final evaluation"]
    end

    T1 -->|"fits both heads"| M["Detector"]
    T2 -->|"calibrates thresholds<br/>to an FPR budget"| M
    M --> T3
    T3 --> R["Reported numbers"]

    style T3 fill:#fff4e6,stroke:#e8a33d
```

Thresholds are never chosen on the days used to report results. That is the difference
between a measured number and a tuned one.

## Deployment

```mermaid
flowchart LR
    U["Browser"] -->|"HTTPS"| N["Netlify<br/>React build"]
    N -->|"VITE_API_URL baked in at build"| R["Render<br/>FastAPI"]
    R --> M[("Model artifacts<br/>1.5 MB, committed")]
    R --> J[("Metrics artifacts<br/>JSON, committed")]
    R -->|"optional"| G["Groq<br/>llama-3.3-70b"]
    R -->|"optional"| TV["Tavily"]
    R --> L[("Audit ledger<br/>JSONL, ephemeral disk")]
```

Measured footprint: 234 MB RSS against Render's 512 MB free tier. The LLM services are
optional — detection, the learning loop, metrics and the audit chain all work without them.

## What is deliberately absent

| Named in PS#7 | Status |
|---|---|
| CVE prioritisation agent | Not built. Needs a real asset inventory and a live NVD feed; a thin version would be demo-ware. |
| Cyber resilience digital twin | Not built. A project in its own right. |
| RAG over CERT-In advisories | Not built. Would need a scraped corpus we do not have. |
| Persistence, auth, multi-process | Not built. Single-process demo; the ledger resets with the dyno. |

See [GAPS.md](GAPS.md) for the full audit.
