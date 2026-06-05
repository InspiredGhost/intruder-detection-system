import axios from 'axios'
import { AlertTriangle, Loader2, ShieldAlert, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import type { DetectionResult } from '../types'
import CameraView, { type CameraViewHandle } from './CameraView'

function authHeaders() {
  const token = localStorage.getItem('token')
  return token ? { Authorization: `Bearer ${token}` } : {}
}

const SAFE = new Set(['normal', 'normalvideos', 'friendly'])
const ALERT_COOLDOWN_MS = 10_000  // one alert per 10 s max

function detectionBadge(type: string) {
  return SAFE.has(type.toLowerCase())
    ? 'text-green-700 border-green-200 bg-green-50'
    : 'text-tut-red border-tut-red/20 bg-tut-red/10'
}

type RichDetection = DetectionResult & { detected_name?: string | null }

interface IntruderPopup {
  frameUrl: string | null
  confidence: number
  timestamp: string
}

interface Props {
  isRunning: boolean
}

export default function LiveCameraDetect({ isRunning }: Props) {
  const cameraRef       = useRef<CameraViewHandle>(null)
  const intervalRef     = useRef<ReturnType<typeof setInterval> | null>(null)
  const lastAlertRef    = useRef<number>(0)
  const [detection, setDetection]         = useState<RichDetection | null>(null)
  const [intruderAlert, setIntruderAlert] = useState(false)
  const [popup, setPopup]                 = useState<IntruderPopup | null>(null)

  useEffect(() => {
    if (!isRunning) {
      setDetection(null)
      setIntruderAlert(false)
      return
    }

    intervalRef.current = setInterval(async () => {
      const base64 = cameraRef.current?.captureFrame()
      if (!base64) return

      try {
        const { data } = await axios.post<RichDetection>(
          '/webcam/detect',
          { frame_b64: base64 },
          { headers: authHeaders() },
        )
        setDetection(data)

        const isIntruder = data.type.toLowerCase() === 'intruder'
        setIntruderAlert(isIntruder)

        // Fire alert + show popup for any intruder detection, with cooldown to avoid spam
        if (isIntruder) {
          const now = Date.now()
          if (now - lastAlertRef.current >= ALERT_COOLDOWN_MS) {
            lastAlertRef.current = now
            const frameUrl = base64 ? `data:image/jpeg;base64,${base64}` : undefined
            setPopup({
              frameUrl: frameUrl ?? null,
              confidence: data.confidence,
              timestamp: data.timestamp,
            })
            await axios.post('/predict', {
              type:          'intruder',
              confidence:    data.confidence,
              source:        'video',
              timestamp:     data.timestamp,
              frame_url:     frameUrl,
              detected_name: 'Unknown',
            }, { headers: authHeaders() })
          }
        }
      } catch { /* ignore single-frame errors */ }
    }, 2000)

    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [isRunning])

  const overlayLabel = detection
    ? (() => {
        if (detection.detected_name && detection.detected_name !== 'Unknown') {
          return `${detection.detected_name} — ${(detection.confidence * 100).toFixed(0)}%`
        }
        if (detection.type === 'intruder') return `UNKNOWN INTRUDER — ${(detection.confidence * 100).toFixed(0)}%`
        return `${detection.type.toUpperCase()} — ${(detection.confidence * 100).toFixed(0)}%`
      })()
    : undefined

  return (
    <div className="space-y-4">

      {/* ── Intruder popup modal ── */}
      {popup && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={() => setPopup(null)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden border-2 border-tut-red/40"
            onClick={e => e.stopPropagation()}
          >
            {/* Red header */}
            <div className="bg-tut-red px-5 py-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <ShieldAlert size={22} className="text-white" />
                <div>
                  <p className="text-white font-bold text-base leading-tight">INTRUDER DETECTED</p>
                  <p className="text-white/70 text-xs mt-0.5">
                    {new Date(popup.timestamp).toLocaleTimeString()}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setPopup(null)}
                className="text-white/70 hover:text-white p-1.5 rounded-lg hover:bg-white/10 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* Captured photo */}
            {popup.frameUrl ? (
              <div className="bg-gray-950">
                <img
                  src={popup.frameUrl}
                  alt="Intruder"
                  className="w-full max-h-64 object-contain"
                />
              </div>
            ) : (
              <div className="bg-gray-950 h-32 flex items-center justify-center">
                <p className="text-gray-500 text-sm">No image captured</p>
              </div>
            )}

            {/* Details */}
            <div className="px-5 py-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-gray-500 text-sm">Person</span>
                <span className="text-tut-red font-semibold text-sm">Unknown — Not enrolled</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-500 text-sm">Confidence</span>
                <div className="flex items-center gap-2">
                  <div className="w-24 bg-gray-100 rounded-full h-1.5">
                    <div
                      className="h-1.5 rounded-full bg-tut-red"
                      style={{ width: `${(popup.confidence * 100).toFixed(0)}%` }}
                    />
                  </div>
                  <span className="text-tut-red font-bold text-sm tabular-nums">
                    {(popup.confidence * 100).toFixed(0)}%
                  </span>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-500 text-sm">Alert saved</span>
                <span className="text-green-600 text-sm font-medium">✓ Recorded</span>
              </div>
            </div>

            {/* Dismiss button */}
            <div className="px-5 pb-5">
              <button
                onClick={() => setPopup(null)}
                className="w-full bg-tut-red hover:bg-red-700 text-white font-semibold py-2.5 rounded-xl text-sm transition-colors"
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Intruder banner */}
      {intruderAlert && (
        <div className="flex items-center gap-3 bg-tut-red text-white text-sm font-semibold px-4 py-3 rounded-xl shadow-lg animate-pulse">
          <AlertTriangle size={18} />
          UNKNOWN INTRUDER DETECTED — Alert sent
        </div>
      )}

      {/* Camera feed — full width */}
      <CameraView
        ref={cameraRef}
        active={isRunning}
        overlayLabel={overlayLabel}
        overlayColor={detection ? detectionBadge(detection.type) : undefined}
      />

      {/* Detection status bar */}
      <div className="flex items-start gap-4 flex-wrap">
        {isRunning && (
          <div className="flex items-center gap-2 text-xs text-tut-blue font-medium bg-tut-blue/10 border border-tut-blue/20 px-3 py-2 rounded-lg">
            <Loader2 size={13} className="animate-spin" />
            Face scan — every 2 s
          </div>
        )}

        {detection && (
          <div className={`flex items-center gap-3 border rounded-xl px-4 py-2 flex-1 min-w-0 ${intruderAlert ? 'bg-tut-red/5 border-tut-red/20' : 'bg-slate-50 border-gray-200'}`}>
            <div className="shrink-0">
              <p className="text-gray-400 text-[10px] uppercase tracking-wide font-semibold mb-0.5">Status</p>
              <span className={`inline-block px-2.5 py-0.5 rounded-md border text-xs font-semibold capitalize ${detectionBadge(detection.type)}`}>
                {intruderAlert ? 'Unknown Intruder' : detection.detected_name ?? detection.type}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-gray-400 text-[10px] uppercase tracking-wide font-semibold mb-1">Confidence</p>
              <div className="flex items-center gap-2">
                <div className="flex-1 bg-gray-200 rounded-full h-1.5">
                  <div
                    className={`h-1.5 rounded-full ${intruderAlert ? 'bg-tut-red' : 'bg-tut-blue'}`}
                    style={{ width: `${(detection.confidence * 100).toFixed(0)}%` }}
                  />
                </div>
                <span className="text-tut-teal text-xs font-bold tabular-nums shrink-0">
                  {(detection.confidence * 100).toFixed(1)}%
                </span>
              </div>
            </div>
            <div className="shrink-0">
              <p className="text-gray-400 text-[10px] uppercase tracking-wide font-semibold mb-0.5">Source</p>
              <p className="text-tut-teal font-semibold text-xs capitalize">{detection.source}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
