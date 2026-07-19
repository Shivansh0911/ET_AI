# Deploying CyberSentinel

Two pieces: the FastAPI backend (Render) and the React frontend (Netlify). Do the backend first — you need its live URL before configuring the frontend.

## Why Render (backend)

Free hosts for a small FastAPI service that needs to "always work" during a hackathon demo:

| Host | Free & always-on? | Verdict |
|---|---|---|
| **Render** | Free web service, but **sleeps after 15 min idle** (~30-50s cold-start on wake) | Best balance — fix the sleep with a free uptime pinger (below) |
| Fly.io | Free allowance (3 shared VMs), no forced sleep if configured `min_machines_running=1` | Truly always-on for free, but needs Docker + `flyctl` — more setup |
| Railway | No longer has a real free tier (trial credit only) | Skip — will stop working mid-hackathon when credit runs out |
| PythonAnywhere | Free tier only allows outbound requests to a domain allowlist | Skip — **Groq/Tavily API calls will be blocked** |
| Google Cloud Run | Generous free tier but scales to zero (cold start every idle period) | Works, but cold starts during a live judged demo are riskier than Render+pinger |

**Recommendation: Render + UptimeRobot.** Render's free tier is the simplest correct fit for a FastAPI app, and a free UptimeRobot monitor pinging it every 5 minutes keeps it from ever hitting the 15-minute idle-sleep threshold — so in practice it stays warm and always-on, for free.

---

## Part 1 — Backend on Render

1. Go to **render.com** → sign up / log in (GitHub login is easiest).
2. **New +** → **Web Service**.
3. **Connect a repository** → authorize GitHub if prompted → select `Shivansh0911/ET_AI`.
4. Fill in the form exactly like this:

   | Field | Value |
   |---|---|
   | **Name** | `cybersentinel-backend` (or anything) |
   | **Root Directory** | `backend` |
   | **Runtime** | `Python 3` |
   | **Build Command** | `pip install -r requirements.txt` |
   | **Start Command** | `uvicorn main:app --host 0.0.0.0 --port $PORT` |
   | **Instance Type** | `Free` |

5. Scroll to **Environment Variables** → **Add Environment Variable** and add both of these (paste your actual key values, not the words themselves):

   | Key | Value |
   |---|---|
   | `GROQ_API_KEY` | *your Groq key from console.groq.com* |
   | `TAVILY_API_KEY` | *your Tavily key from app.tavily.com (optional — app degrades gracefully without it)* |

6. Click **Create Web Service**. Render will build and deploy — first deploy takes 2-5 minutes. Watch the **Logs** tab for `Uvicorn running on http://0.0.0.0:...` to confirm success.
7. Once live, copy the URL Render gives you — it looks like:
   `https://cybersentinel-backend.onrender.com`
8. Test it: open `https://cybersentinel-backend.onrender.com/` in a browser — you should see
   `{"status":"CyberSentinel API active","version":"1.0.0"}`.

### Keep it always-warm (free) — UptimeRobot

1. Go to **uptimerobot.com** → sign up free.
2. **+ Add New Monitor**.
3. Fill in:

   | Field | Value |
   |---|---|
   | **Monitor Type** | `HTTP(s)` |
   | **Friendly Name** | `CyberSentinel Backend` |
   | **URL (or IP)** | `https://cybersentinel-backend.onrender.com/` |
   | **Monitoring Interval** | `5 minutes` (free plan minimum) |

4. Save. UptimeRobot will now hit your root endpoint every 5 minutes — well under Render's 15-minute sleep timer — so the service never goes cold. Do this **before** you demo/submit, and leave it running through judging.

---

## Part 2 — Frontend on Netlify

1. Go to **netlify.com** → sign up / log in (GitHub login is easiest).
2. **Add new site** → **Import an existing project** → **Deploy with GitHub** → authorize → select `Shivansh0911/ET_AI`.
3. Fill in the build settings:

   | Field | Value |
   |---|---|
   | **Base directory** | `frontend` |
   | **Build command** | `npm run build` |
   | **Publish directory** | `dist` |

   Netlify usually auto-suggests the publish directory once you type the base directory — if it shows `frontend/dist` instead of `dist`, use whatever it auto-fills; both mean the same folder, Netlify's UI is just inconsistent about whether the path is relative to the repo root or the base directory.

4. Before the first deploy (or after, then redeploy), go to **Site configuration → Environment variables → Add a variable**:

   | Key | Value |
   |---|---|
   | `VITE_API_URL` | `https://cybersentinel-backend.onrender.com` (your Render URL from Part 1, **no trailing slash**) |

5. Click **Deploy site**. Netlify builds and gives you a URL like `https://random-name-123.netlify.app` (renameable under **Site configuration → Change site name**).
6. **If you set the environment variable after the first deploy**, trigger a redeploy: **Deploys** tab → **Trigger deploy** → **Deploy site** (env vars are baked in at build time by Vite, so a rebuild is required for the change to take effect).
7. Open the Netlify URL and click through all 5 tabs to confirm it's talking to the live backend (Dashboard should populate with real numbers, not the "Unable to load dashboard data" error).

---

## Pre-demo checklist

- [ ] Render backend responds at its `/` URL
- [ ] UptimeRobot monitor is **active** (not paused)
- [ ] Netlify site loads and Dashboard shows real data (not an error banner)
- [ ] Copilot tab returns a real answer (proves `GROQ_API_KEY` is set correctly on Render)
- [ ] Open the Netlify URL once ~10 minutes before you go on stage/submit, just in case the very first Render request after a long gap is slow
