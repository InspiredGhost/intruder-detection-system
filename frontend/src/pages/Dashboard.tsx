import axios from 'axios'
import { Activity, AlertTriangle, Camera, Shield } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import AlertTrendChart from '../components/AlertTrendChart'
import AlertTypeChart from '../components/AlertTypeChart'
import SourceChart from '../components/SourceChart'
import StatCard from '../components/StatCard'
import CameraView from '../components/CameraView'
import type { Alert, Stats } from '../types'

const POLL_INTERVAL_MS = 5000

function authHeaders() {
  const token = localStorage.getItem('token')
  return token ? { Authorization: `Bearer ${token}` } : {}
}

function buildWsUrl(path: string) {
  const token = localStorage.getItem('token') ?? ''
  const proto = window.location.protocol === 'https:' ? 'wss' : 'ws'
  return `${proto}://${window.location.host}${path}?token=${encodeURIComponent(token)}`
}

function formatTime(iso: string) {
  try { return new Date(iso).toLocaleTimeString() } catch { return iso }
}

const TYPE_BADGE: Record<string, string> = {
  normal:       'bg-green-50   text-green-700  border-green-200',
  normalvideos: 'bg-green-50   text-green-700  border-green-200',
  gunshot:      'bg-tut-red/10 text-tut-red    border-tut-red/20',
}
function typeBadge(t: string) {
  return TYPE_BADGE[t.toLowerCase()] ?? 'bg-tut-gold/10 text-tut-teal border-tut-gold/30'
}

export default function Dashboard() {
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [stats, setStats] = useState<Stats | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [error, setError] = useState('')
  const navigate = useNavigate()
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const wsRef = useRef<WebSocket | null>(null)
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Stable ref so the WS handler can call fetchData without stale closure
  const fetchDataRef = useRef<() => void>(() => {})

  const fetchData = useCallback(async () => {
    try {
      const [alertsRes, statsRes] = await Promise.all([
        axios.get<Alert[]>('/alerts', { headers: authHeaders() }),
        axios.get<Stats>('/stats', { headers: authHeaders() }),
      ])
      setAlerts(alertsRes.data)
      setStats(statsRes.data)
      setError('')
    } catch (err: unknown) {
      if (axios.isAxiosError(err) && err.response?.status === 401) {
        localStorage.removeItem('token')
        navigate('/login')
      } else {
        setError('Could not reach the API.')
      }
    }
  }, [navigate])

  // Keep the ref up-to-date so the WS handler always calls the latest version
  useEffect(() => { fetchDataRef.current = fetchData }, [fetchData])

  useEffect(() => {
    fetchData()
    intervalRef.current = setInterval(fetchData, POLL_INTERVAL_MS)
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [fetchData])

  useEffect(() => {
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null
    let destroyed = false

    function connect() {
      if (destroyed) return
      const ws = new WebSocket(buildWsUrl('/ws/alerts'))
      wsRef.current = ws

      ws.onopen = () => {
        // Clear any pending reconnect when connection succeeds
        if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null }
      }

      ws.onmessage = (event) => {
        try {
          const alert = JSON.parse(event.data) as Alert
          // Prepend new alert instantly — no wait for next poll
          setAlerts(prev => [alert, ...prev].slice(0, 100))
          // Also refresh stat counters & chart data straight away
          fetchDataRef.current()

          if (!['normal', 'normalvideos', 'friendly'].includes(alert.type.toLowerCase())) {
            const who = alert.detected_name && alert.detected_name !== 'Unknown'
              ? alert.detected_name
              : alert.type.toUpperCase()
            const msg = `${who} detected (${(alert.confidence * 100).toFixed(0)}% conf)`
            setToast(msg)
            if (toastTimer.current) clearTimeout(toastTimer.current)
            toastTimer.current = setTimeout(() => setToast(null), 5000)
            if (Notification.permission === 'granted') new Notification('SentinelAI Alert', { body: msg })
          }
        } catch { /* ignore malformed frame */ }
      }

      ws.onerror = () => ws.close()

      ws.onclose = () => {
        if (!destroyed) reconnectTimer = setTimeout(connect, 3000)
      }
    }

    if (Notification.permission === 'default') Notification.requestPermission()
    connect()

    return () => {
      destroyed = true
      if (reconnectTimer) clearTimeout(reconnectTimer)
      wsRef.current?.close()
    }
  }, []) // stable — fetchDataRef is a ref, not a dep

  const latest = alerts[0] ?? null
  const isAlert = latest && !['normal', 'normalvideos', 'friendly'].includes(latest.type.toLowerCase())
  const SAFE_TYPES = ['normal', 'normalvideos', 'friendly']
  const threatsToday = alerts.filter(a => {
    const today = new Date().toDateString()
    return new Date(a.timestamp).toDateString() === today && !SAFE_TYPES.includes(a.type.toLowerCase())
  }).length
  const detectionRate = alerts.length > 0
    ? Math.round((alerts.filter(a => !SAFE_TYPES.includes(a.type.toLowerCase())).length / alerts.length) * 100)
    : 0

  return (
    <div className="p-6 space-y-6">

      {/* Alert toast */}
      {toast && (
        <div className="fixed top-5 right-5 z-50 bg-tut-red text-white text-sm font-semibold px-5 py-3 rounded-xl shadow-2xl flex items-center gap-2.5">
          <AlertTriangle size={16} />
          {toast}
        </div>
      )}

      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-tut-teal">Dashboard</h1>
          <p className="text-gray-400 text-sm mt-0.5">Real-time security monitoring</p>
        </div>

        {/* System status badge */}
        <div className={`flex items-center gap-2.5 px-4 py-2 rounded-xl border text-sm font-semibold ${
          isAlert
            ? 'bg-tut-red/10 border-tut-red/30 text-tut-red'
            : 'bg-green-50 border-green-200 text-green-700'
        }`}>
          <span className={`w-2 h-2 rounded-full animate-pulse ${isAlert ? 'bg-tut-red' : 'bg-green-500'}`} />
          {isAlert ? `ALERT — ${latest!.type.toUpperCase()}` : 'ALL CLEAR'}
        </div>
      </div>

      {/* API error */}
      {error && (
        <div className="text-tut-red text-sm bg-tut-red/5 border border-tut-red/20 rounded-xl px-4 py-3">
          {error}
        </div>
      )}

      {/* Stat cards */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard
          label="Total Alerts"
          value={stats?.total ?? alerts.length}
          icon={Activity}
          color="cyan"
          sub="All time"
        />
        <StatCard
          label="Threats Today"
          value={threatsToday}
          icon={AlertTriangle}
          color={threatsToday > 0 ? 'red' : 'green'}
          sub="Non-normal events"
        />
        <StatCard
          label="Detection Rate"
          value={`${detectionRate}%`}
          icon={Shield}
          color="amber"
          sub="Threats / total alerts"
        />
        <StatCard
          label="Cameras Online"
          value={stats?.cameras_online ?? 0}
          icon={Camera}
          color="cyan"
          sub="Registered CCTV"
        />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <AlertTrendChart stats={stats} />
        </div>
        <AlertTypeChart stats={stats} />
      </div>

      {/* Live feed + recent alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4">
          {/* Live feed card */}
          <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-tut-teal font-semibold text-sm">Live Feed</h2>
              <span className="flex items-center gap-1.5 text-xs text-green-600 font-medium bg-green-50 border border-green-200 px-2.5 py-1 rounded-full">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                LIVE
              </span>
            </div>
            <CameraView autoStart />
          </div>

          <SourceChart stats={stats} />
        </div>

        {/* Recent alerts panel */}
        <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm flex flex-col">
          <div className="flex items-center justify-between mb-3 pb-3 border-b border-gray-100">
            <h2 className="text-tut-teal font-semibold text-sm">Recent Alerts</h2>
            <span className="text-xs text-gray-400 bg-slate-100 px-2 py-1 rounded-md border border-gray-200">
              {alerts.length} total
            </span>
          </div>
          <ul className="space-y-2 overflow-y-auto flex-1 pr-0.5" style={{ maxHeight: 400 }}>
            {alerts.length === 0 && (
              <p className="text-gray-400 text-sm text-center py-8">No alerts yet.</p>
            )}
            {alerts.map(a => (
              <li key={a.id} className="flex items-start justify-between gap-2 bg-slate-50 border border-gray-100 rounded-lg px-3 py-2.5 text-xs hover:border-gray-200 transition-colors">
                <div className="space-y-1 min-w-0">
                  <span className={`inline-block px-2 py-0.5 rounded-md border text-xs font-semibold capitalize ${typeBadge(a.type)}`}>
                    {a.type}
                  </span>
                  <p className="text-gray-400 truncate">
                    {a.detected_name && a.detected_name !== 'Unknown'
                      ? a.detected_name
                      : a.source} — {(a.confidence * 100).toFixed(0)}% conf
                  </p>
                </div>
                <span className="text-gray-400 whitespace-nowrap shrink-0">{formatTime(a.timestamp)}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  )
}
