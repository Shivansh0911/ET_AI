import { useEffect, useState } from 'react'
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend } from 'recharts'
import { RefreshCw, Sparkles } from 'lucide-react'
import MetricsBar from './MetricsBar'
import AnomalyFeed from './AnomalyFeed'
import { ProvenanceBanner } from './Provenance'
import { api } from '../utils/api'
import { severityColor } from './SeverityBadge'

export default function Dashboard() {
  const [dashboard, setDashboard] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [refreshing, setRefreshing] = useState(false)
  const [analysis, setAnalysis] = useState(null)
  const [analysisLoading, setAnalysisLoading] = useState(false)

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await api.getDashboard()
      setDashboard(data)
    } catch (e) {
      setError('Unable to load dashboard data — is the backend running on :8000?')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const handleRefresh = async () => {
    setRefreshing(true)
    try {
      await api.refresh()
      await load()
    } catch (e) {
      setError('Refresh failed.')
    } finally {
      setRefreshing(false)
    }
  }

  const handleAnalyze = async () => {
    setAnalysisLoading(true)
    setAnalysis(null)
    try {
      const res = await api.getCompoundAnalysis()
      setAnalysis(res.analysis)
    } catch (e) {
      setAnalysis('Compound analysis unavailable right now.')
    } finally {
      setAnalysisLoading(false)
    }
  }

  if (loading) {
    return <div className="text-gray-500 p-8 text-center">Loading intel...</div>
  }
  if (error) {
    return <div className="text-red-400 p-8 text-center">{error}</div>
  }

  const severityData = Object.entries(dashboard.severity_counts || {}).map(([name, value]) => ({
    name, value,
  }))

  const infraData = Object.entries(dashboard.infra_breakdown || {}).map(([name, value]) => ({
    name, value,
  }))

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-200">Security Overview</h2>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-gray-900 border border-gray-800 text-sm text-gray-300 hover:border-emerald-500/50 transition disabled:opacity-50"
        >
          <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
          Refresh Intel
        </button>
      </div>

      <ProvenanceBanner provenance={dashboard.data_provenance} source={dashboard.stream_source} />

      <MetricsBar dashboard={dashboard} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        <div className="bg-card border border-gray-800 rounded-xl p-4">
          <h3 className="text-sm font-semibold text-gray-400 mb-2">Severity Distribution</h3>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={severityData} dataKey="value" nameKey="name" innerRadius={50} outerRadius={80} paddingAngle={3}>
                {severityData.map((entry, i) => (
                  <Cell key={i} fill={severityColor(entry.name)} stroke="none" />
                ))}
              </Pie>
              <Tooltip contentStyle={{ background: '#12121a', border: '1px solid #27272a', borderRadius: 8 }} />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-card border border-gray-800 rounded-xl p-4 lg:col-span-2">
          <h3 className="text-sm font-semibold text-gray-400 mb-2">Infrastructure Type Breakdown</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={infraData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
              <XAxis dataKey="name" tick={{ fill: '#6b7280', fontSize: 11 }} />
              <YAxis tick={{ fill: '#6b7280', fontSize: 11 }} allowDecimals={false} />
              <Tooltip contentStyle={{ background: '#12121a', border: '1px solid #27272a', borderRadius: 8 }} />
              <Bar dataKey="value" fill="#10b981" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <h3 className="text-sm font-semibold text-gray-400 mb-2">Live Anomaly Feed</h3>
          <AnomalyFeed anomalies={dashboard.recent_anomalies} />
        </div>

        <div className="bg-card border border-gray-800 rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold text-gray-400">AI Compound Threat Analysis</h3>
            <button
              onClick={handleAnalyze}
              disabled={analysisLoading}
              className="flex items-center gap-1 text-xs px-2 py-1 rounded-md bg-gray-900 border border-gray-800 text-emerald-400 hover:border-emerald-500/50 disabled:opacity-50"
            >
              <Sparkles size={12} /> Analyze
            </button>
          </div>
          {analysisLoading && <p className="text-sm text-gray-500">Analyzing threat cluster...</p>}
          {!analysisLoading && !analysis && (
            <p className="text-sm text-gray-500">Click Analyze for AI-generated compound risk assessment.</p>
          )}
          {analysis && (
            <p className="text-sm text-gray-300 whitespace-pre-wrap leading-relaxed">{analysis}</p>
          )}
        </div>
      </div>
    </div>
  )
}
