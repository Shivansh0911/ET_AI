const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

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
  getDashboard: () => request('/api/dashboard'),
  getEvents: (limit = 50) => request(`/api/events?limit=${limit}`),
  getAnomalies: () => request('/api/anomalies'),
  getKillChain: () => request('/api/kill-chain'),
  getCompoundAnalysis: () => request('/api/compound-analysis'),
  searchThreatIntel: (query) =>
    request('/api/threat-intel', { method: 'POST', body: JSON.stringify({ query }) }),
  generatePlaybook: (alertId = 'latest') =>
    request('/api/respond', { method: 'POST', body: JSON.stringify({ alert_id: alertId }) }),
  askCopilot: (message, context = []) =>
    request('/api/copilot', { method: 'POST', body: JSON.stringify({ message, context }) }),
  refresh: () => request('/api/refresh', { method: 'POST' }),
}
