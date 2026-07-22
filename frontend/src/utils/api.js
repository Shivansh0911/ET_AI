// In production VITE_API_URL is baked in at build time by Vite. Falling back to localhost
// silently is how a deployed site ends up calling a machine that is not there, so the
// fallback is announced loudly in the console and surfaced via api.baseUrl for the UI.
const CONFIGURED = import.meta.env.VITE_API_URL
const BASE_URL = CONFIGURED || 'http://localhost:8000'

if (!CONFIGURED && import.meta.env.PROD) {
  console.error(
    'VITE_API_URL is not set. This production build will call http://localhost:8000 and fail. ' +
    'Set VITE_API_URL to the backend origin and redeploy — Vite bakes env vars in at build time.'
  )
}

async function request(path, options = {}) {
  try {
    const res = await fetch(`${BASE_URL}${path}`, {
      headers: { 'Content-Type': 'application/json' },
      ...options,
    })
    if (!res.ok) throw new Error(`Request failed: ${res.status}`)
    return await res.json()
  } catch (err) {
    console.error(`API error on ${path}:`, err)
    throw err
  }
}

export const api = {
  baseUrl: BASE_URL,
  isConfigured: Boolean(CONFIGURED),

  getDashboard: () => request('/api/dashboard'),
  getEvents: (limit = 50) => request(`/api/events?limit=${limit}`),
  getAnomalies: () => request('/api/anomalies'),
  getKillChain: () => request('/api/kill-chain'),
  getCompoundAnalysis: () => request('/api/compound-analysis'),
  getMetrics: () => request('/api/metrics'),
  getIncidents: () => request('/api/incidents'),
  getGraph: () => request('/api/graph'),
  getRemediation: () => request('/api/remediation'),
  getActor: () => request('/api/actor'),
  getTwin: (entry, harden = []) => request(`/api/twin?entry=${encodeURIComponent(entry)}` + harden.map((h) => `&harden=${encodeURIComponent(h)}`).join('')),
  getAttribution: (limit = 12) => request(`/api/attribution?limit=${limit}`),
  getAudit: (limit = 100) => request(`/api/audit?limit=${limit}`),
  getFeedback: () => request('/api/feedback'),
  sendFeedback: (alertId, verdict) =>
    request('/api/feedback', { method: 'POST', body: JSON.stringify({ alert_id: alertId, verdict }) }),
  resetFeedback: () => request('/api/feedback/reset', { method: 'POST' }),
  verifyAudit: () => request('/api/audit/verify'),
  simulateTamper: () => request('/api/audit/simulate-tamper', { method: 'POST' }),

  searchThreatIntel: (query) =>
    request('/api/threat-intel', { method: 'POST', body: JSON.stringify({ query }) }),
  generatePlaybook: (alertId = 'latest') =>
    request('/api/respond', { method: 'POST', body: JSON.stringify({ alert_id: alertId }) }),
  askCopilot: (message, context = []) =>
    request('/api/copilot', { method: 'POST', body: JSON.stringify({ message, context }) }),
  refresh: () => request('/api/refresh', { method: 'POST' }),
}
