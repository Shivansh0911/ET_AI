# CyberSentinel — AI-Powered Cyber Resilience Platform

An AI-driven cyber threat detection and response platform for critical national infrastructure, built for the ET AI Hackathon 2026 (Problem Statement #7).

CyberSentinel ingests simulated security telemetry (network, auth, endpoint), detects behavioral anomalies, maps them to the MITRE ATT&CK framework, generates automated incident response playbooks, and provides a conversational SOC copilot — all on top of a real-time geospatial dashboard covering Indian critical infrastructure (AIIMS, CBSE, Power Grid, Railways, SBI, ISRO, NIC, BSNL).

## Architecture

Five coordinated agents, chained so each one's output feeds the next:

1. **Anomaly Detector** — flags statistically deviant events from the synthetic log stream
2. **ATT&CK Mapper** — maps anomalies to MITRE techniques/tactics and assembles the observed kill chain
3. **Threat Intel** — live web search via Tavily (falls back to LLM-only briefing if unavailable)
4. **Response Orchestrator** — drafts a CERT-In-aligned incident response playbook
5. **Copilot** — conversational interface over the current alert state

All LLM reasoning runs through Groq (free tier only — no paid APIs).

## Tech Stack

- **Backend**: FastAPI, Groq SDK, Tavily SDK, Pydantic
- **Frontend**: React 18 + Vite, Tailwind CSS, Recharts, Lucide icons
- **Data**: In-memory synthetic log generator (no database) + hardcoded MITRE ATT&CK technique fallback

## Setup & Run

### Backend

```bash
cd backend
pip install -r requirements.txt
cp .env.example .env
# Edit .env — add GROQ_API_KEY (required, free at console.groq.com). TAVILY_API_KEY is optional.
python main.py
# Runs on http://localhost:8000
```

### Frontend

```bash
cd frontend
npm install
npm run dev
# Runs on http://localhost:5173
```

The frontend proxies `/api/*` to `http://localhost:8000` in dev (see `vite.config.js`).

## Notes

- Everything runs in memory — `/api/refresh` regenerates a fresh synthetic event stream on demand.
- If `GROQ_API_KEY` is missing or rate-limited, LLM-backed endpoints degrade gracefully with a fallback message instead of crashing.
- `TAVILY_API_KEY` is optional; threat intel falls back to LLM-only analysis without it.
- The India threat map is drawn as inline SVG — no external mapping library.
