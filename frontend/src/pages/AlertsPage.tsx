import axios from 'axios'
import { Filter, RefreshCw, Trash2, X } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { Alert } from '../types'

function authHeaders() {
  const token = localStorage.getItem('token')
  return token ? { Authorization: `Bearer ${token}` } : {}
}

function formatDateTime(iso: string) {
  try { return new Date(iso).toLocaleString() } catch { return iso }
}

const SOURCE_LABEL: Record<string, string> = {
  audio: 'Audio',
  video: 'Video',
  both: 'Audio+Video',
}

const TYPE_BADGE: Record<string, string> = {
  normal:       'bg-green-50   text-green-700  border-green-200',
  normalvideos: 'bg-green-50   text-green-700  border-green-200',
  gunshot:      'bg-tut-red/10 text-tut-red    border-tut-red/20',
}
function typeBadge(t: string) {
  return TYPE_BADGE[t.toLowerCase()] ?? 'bg-tut-gold/10 text-tut-teal border-tut-gold/30'
}

const SOURCE_BADGE: Record<string, string> = {
  audio: 'bg-tut-gold/10 text-tut-teal  border-tut-gold/30',
  video: 'bg-tut-blue/10 text-tut-blue  border-tut-blue/20',
  both:  'bg-tut-red/10  text-tut-red   border-tut-red/20',
}

export default function AlertsPage() {
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [loading, setLoading] = useState(true)
  const [clearing, setClearing] = useState(false)
  const [error, setError] = useState('')
  const [typeFilter, setTypeFilter] = useState('all')
  const [sourceFilter, setSourceFilter] = useState('all')
  const [selectedAlert, setSelectedAlert] = useState<Alert | null>(null)
  const navigate = useNavigate()

  const token = localStorage.getItem('token') ?? ''

  const fetchAlerts = useCallback(async () => {
    setLoading(true)
    try {
      const { data } = await axios.get<Alert[]>('/alerts?limit=200', { headers: authHeaders() })
      setAlerts(data)
      setError('')
    } catch (err: unknown) {
      if (axios.isAxiosError(err) && err.response?.status === 401) {
        localStorage.removeItem('token')
        navigate('/login')
      } else {
        setError('Could not load alerts.')
      }
    } finally {
      setLoading(false)
    }
  }, [navigate])

  useEffect(() => { fetchAlerts() }, [fetchAlerts])

  const clearAlerts = async () => {
    if (!window.confirm('Delete ALL alerts and saved media files? This cannot be undone.')) return
    setClearing(true)
    try {
      await axios.delete('/alerts', { headers: authHeaders() })
      setAlerts([])
      setError('')
    } catch {
      setError('Failed to clear alerts.')
    } finally {
      setClearing(false)
    }
  }

  const allTypes   = Array.from(new Set(alerts.map(a => a.type)))
  const allSources = Array.from(new Set(alerts.map(a => a.source)))

  const filtered = alerts.filter(a =>
    (typeFilter === 'all' || a.type === typeFilter) &&
    (sourceFilter === 'all' || a.source === sourceFilter),
  )

  const threatCount = filtered.filter(
    a => !['normal', 'normalvideos'].includes(a.type.toLowerCase()),
  ).length
  const avgConf = filtered.length > 0
    ? (filtered.reduce((s, a) => s + a.confidence, 0) / filtered.length * 100).toFixed(0)
    : '0'

  return (
    <div className="p-6 space-y-6">

      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-tut-teal">Alerts</h1>
          <p className="text-gray-400 text-sm mt-0.5">Full detection history</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchAlerts}
            disabled={loading}
            className="flex items-center gap-2 text-sm text-gray-500 hover:text-tut-blue bg-white hover:bg-slate-50 border border-gray-200 px-3.5 py-2 rounded-lg transition-colors shadow-sm"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
          <button
            onClick={clearAlerts}
            disabled={clearing || alerts.length === 0}
            className="flex items-center gap-2 text-sm text-tut-red hover:text-white bg-white hover:bg-tut-red border border-tut-red/30 hover:border-tut-red px-3.5 py-2 rounded-lg transition-colors shadow-sm disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Trash2 size={14} />
            {clearing ? 'Clearing…' : 'Clear All'}
          </button>
        </div>
      </div>

      {error && (
        <div className="text-tut-red text-sm bg-tut-red/5 border border-tut-red/20 rounded-xl px-4 py-3">
          {error}
        </div>
      )}

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white border border-gray-200 rounded-xl p-4 text-center shadow-sm">
          <p className="text-2xl font-bold text-tut-blue">{filtered.length}</p>
          <p className="text-gray-400 text-xs mt-1 font-medium uppercase tracking-wide">Total (filtered)</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4 text-center shadow-sm">
          <p className={`text-2xl font-bold ${threatCount > 0 ? 'text-tut-red' : 'text-green-600'}`}>{threatCount}</p>
          <p className="text-gray-400 text-xs mt-1 font-medium uppercase tracking-wide">Threats</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4 text-center shadow-sm">
          <p className="text-2xl font-bold text-tut-teal">{avgConf}%</p>
          <p className="text-gray-400 text-xs mt-1 font-medium uppercase tracking-wide">Avg Confidence</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2 text-gray-400 text-sm font-medium">
          <Filter size={14} />
          Filters:
        </div>
        <select
          value={typeFilter}
          onChange={e => setTypeFilter(e.target.value)}
          className="bg-white border border-gray-200 text-tut-teal text-sm rounded-lg px-3 py-2 outline-none focus:border-tut-blue shadow-sm"
        >
          <option value="all">All Types</option>
          {allTypes.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <select
          value={sourceFilter}
          onChange={e => setSourceFilter(e.target.value)}
          className="bg-white border border-gray-200 text-tut-teal text-sm rounded-lg px-3 py-2 outline-none focus:border-tut-blue shadow-sm"
        >
          <option value="all">All Sources</option>
          {allSources.map(s => <option key={s} value={s}>{SOURCE_LABEL[s] ?? s}</option>)}
        </select>
      </div>

      {/* Alerts table */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-slate-50 text-gray-400 text-xs uppercase tracking-wider">
              <th className="text-left px-5 py-3.5 font-semibold">Type</th>
              <th className="text-left px-5 py-3.5 font-semibold">Person</th>
              <th className="text-left px-5 py-3.5 font-semibold">Source</th>
              <th className="text-left px-5 py-3.5 font-semibold">Confidence</th>
              <th className="text-left px-5 py-3.5 font-semibold">Timestamp</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={5} className="text-center text-gray-400 py-12">Loading…</td>
              </tr>
            )}
            {!loading && filtered.length === 0 && (
              <tr>
                <td colSpan={5} className="text-center text-gray-400 py-12">No alerts match the current filters.</td>
              </tr>
            )}
            {filtered.map((a, i) => (
              <tr
                key={a.id}
                onClick={() => setSelectedAlert(a)}
                className={`border-b border-gray-100 hover:bg-tut-blue/5 transition-colors cursor-pointer ${
                  i === filtered.length - 1 ? 'border-b-0' : ''
                }`}
              >
                <td className="px-5 py-3">
                  <span className={`inline-block px-2.5 py-0.5 rounded-md border text-xs font-semibold capitalize ${typeBadge(a.type)}`}>
                    {a.type}
                  </span>
                </td>
                <td className="px-5 py-3">
                  {a.detected_name ? (
                    <span className={`inline-block px-2.5 py-0.5 rounded-md border text-xs font-semibold ${
                      a.detected_name === 'Unknown'
                        ? 'bg-tut-red/10 text-tut-red border-tut-red/20'
                        : 'bg-green-50 text-green-700 border-green-200'
                    }`}>
                      {a.detected_name}
                    </span>
                  ) : (
                    <span className="text-gray-300 text-xs">—</span>
                  )}
                </td>
                <td className="px-5 py-3">
                  <span className={`inline-block px-2.5 py-0.5 rounded-md border text-xs font-medium ${SOURCE_BADGE[a.source] ?? 'bg-gray-50 text-gray-500 border-gray-200'}`}>
                    {SOURCE_LABEL[a.source] ?? a.source}
                  </span>
                </td>
                <td className="px-5 py-3">
                  <div className="flex items-center gap-2">
                    <div className="w-20 bg-gray-100 rounded-full h-1.5">
                      <div
                        className="h-1.5 rounded-full bg-tut-blue"
                        style={{ width: `${(a.confidence * 100).toFixed(0)}%` }}
                      />
                    </div>
                    <span className="text-gray-500 tabular-nums text-xs font-medium">
                      {(a.confidence * 100).toFixed(1)}%
                    </span>
                  </div>
                </td>
                <td className="px-5 py-3 text-gray-400 tabular-nums text-xs">{formatDateTime(a.timestamp)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Alert detail modal */}
      {selectedAlert !== null && (
        <div
          className="fixed inset-0 bg-tut-teal/30 backdrop-blur-sm flex items-center justify-center z-50"
          onClick={() => setSelectedAlert(null)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl p-6 max-w-2xl w-full mx-4 border border-gray-200"
            onClick={e => e.stopPropagation()}
          >
            {/* Modal header */}
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-gray-100">
              <h2 className="text-tut-teal font-bold text-base">Alert Detail</h2>
              <button
                onClick={() => setSelectedAlert(null)}
                className="text-gray-400 hover:text-tut-teal p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            {/* Timestamp */}
            <p className="text-gray-400 text-xs mb-4">{formatDateTime(selectedAlert.timestamp)}</p>

            {/* Badges */}
            <div className="flex items-center gap-2 mb-4 flex-wrap">
              <span className={`inline-block px-2.5 py-0.5 rounded-md border text-xs font-semibold capitalize ${typeBadge(selectedAlert.type)}`}>
                {selectedAlert.type}
              </span>
              <span className={`inline-block px-2.5 py-0.5 rounded-md border text-xs font-medium ${SOURCE_BADGE[selectedAlert.source] ?? 'bg-gray-50 text-gray-500 border-gray-200'}`}>
                {SOURCE_LABEL[selectedAlert.source] ?? selectedAlert.source}
              </span>
              {selectedAlert.detected_name && (
                <span className={`inline-block px-2.5 py-0.5 rounded-md border text-xs font-semibold ${
                  selectedAlert.detected_name === 'Unknown'
                    ? 'bg-tut-red/10 text-tut-red border-tut-red/20'
                    : 'bg-green-50 text-green-700 border-green-200'
                }`}>
                  {selectedAlert.detected_name === 'Unknown' ? 'Unknown Intruder' : selectedAlert.detected_name}
                </span>
              )}
            </div>

            {/* Confidence bar */}
            <div className="mb-4">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-gray-400 text-xs font-medium">Confidence</span>
                <span className="text-tut-teal text-xs font-bold tabular-nums">
                  {(selectedAlert.confidence * 100).toFixed(1)}%
                </span>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-2">
                <div
                  className="h-2 rounded-full bg-tut-blue"
                  style={{ width: `${(selectedAlert.confidence * 100).toFixed(0)}%` }}
                />
              </div>
            </div>

            {/* Frame image (cropped intruder face or scene) */}
            {selectedAlert.frame_file && (
              <div className="mt-2">
                {selectedAlert.detected_name === 'Unknown' && (
                  <p className="text-xs font-semibold text-tut-red uppercase tracking-wide mb-1.5 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-tut-red inline-block" />
                    Intruder — captured photo
                  </p>
                )}
                <img
                  src={`/alerts/media/${selectedAlert.frame_file}?token=${token}`}
                  className="w-full rounded-xl max-h-72 object-contain border border-gray-100 bg-gray-50"
                  alt={selectedAlert.detected_name === 'Unknown' ? 'Intruder face' : 'Alert frame'}
                />
              </div>
            )}

            {/* Audio player */}
            {selectedAlert.audio_file && (
              <div className="mt-4">
                <p className="text-gray-400 text-xs font-medium mb-2 uppercase tracking-wide">Recorded audio (5s)</p>
                <audio controls src={`/alerts/media/${selectedAlert.audio_file}?token=${token}`} className="w-full" />
              </div>
            )}

            {/* Close */}
            <div className="mt-5 flex justify-end">
              <button
                onClick={() => setSelectedAlert(null)}
                className="bg-tut-blue hover:bg-[#004a80] text-white font-semibold px-5 py-2 rounded-lg text-sm transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
