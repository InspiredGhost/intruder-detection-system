import axios from 'axios'
import { CameraOff, Loader2, Square } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import type { DetectionResult } from '../types'
import CameraView, { type CameraViewHandle } from './CameraView'

function authHeaders() {
  const token = localStorage.getItem('token')
  return token ? { Authorization: `Bearer ${token}` } : {}
}

const NORMAL = new Set(['normal', 'normalvideos'])

function detectionBadge(type: string) {
  return NORMAL.has(type.toLowerCase())
    ? 'text-green-700 border-green-200 bg-green-50'
    : 'text-tut-red border-tut-red/20 bg-tut-red/10'
}

export default function LiveCameraDetect() {
  const cameraRef   = useRef<CameraViewHandle>(null)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const [detection, setDetection] = useState<DetectionResult | null>(null)
  // Auto-start detection immediately on mount
  const [isRunning, setIsRunning] = useState(true)

  useEffect(() => {
    if (!isRunning) return
    intervalRef.current = setInterval(async () => {
      const base64 = cameraRef.current?.captureFrame()
      if (!base64) return
      try {
        const { data } = await axios.post<DetectionResult>(
          '/webcam/detect',
          { frame_b64: base64 },
          { headers: authHeaders() },
        )
        setDetection(data)
        if (!NORMAL.has(data.type.toLowerCase()) && data.confidence > 0.5) {
          // Capture the current frame so it is saved with the alert
          const raw = cameraRef.current?.captureFrame()
          const frameUrl = raw ? `data:image/jpeg;base64,${raw}` : undefined
          await axios.post('/predict', {
            type:       data.type,
            confidence: data.confidence,
            source:     'video',
            timestamp:  data.timestamp,
            frame_url:  frameUrl,
          }, { headers: authHeaders() })
        }
      } catch { /* ignore single-frame errors */ }
    }, 2000)

    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [isRunning])

  return (
    <div className="space-y-4">
      <div className="flex gap-6 items-start flex-wrap">

        {/* Camera feed */}
        <CameraView
          ref={cameraRef}
          active={isRunning}
          overlayLabel={
            detection
              ? `${detection.type.toUpperCase()} — ${(detection.confidence * 100).toFixed(0)}%`
              : undefined
          }
          overlayColor={detection ? detectionBadge(detection.type) : undefined}
        />

        {/* Controls + last detection */}
        <div className="flex-1 min-w-48 space-y-4">

          {/* Status + stop button */}
          <div className="flex items-center gap-3 flex-wrap">
            {isRunning ? (
              <>
                <div className="flex items-center gap-2 text-xs text-tut-blue font-medium bg-tut-blue/10 border border-tut-blue/20 px-3 py-2 rounded-lg">
                  <Loader2 size={13} className="animate-spin" />
                  Detecting — every 2 s
                </div>
                <button
                  onClick={() => { setIsRunning(false); setDetection(null) }}
                  className="flex items-center gap-2 bg-tut-red/10 hover:bg-tut-red/20 border border-tut-red/20 text-tut-red font-semibold text-sm px-4 py-2 rounded-lg transition-colors"
                >
                  <Square size={13} />
                  Stop
                </button>
              </>
            ) : (
              <button
                onClick={() => setIsRunning(true)}
                className="flex items-center gap-2 bg-tut-blue hover:bg-[#004a80] text-white font-semibold text-sm px-5 py-2.5 rounded-lg transition-colors shadow-sm"
              >
                <CameraOff size={16} />
                Restart Detection
              </button>
            )}
          </div>

          {/* Last detection result */}
          {detection && (
            <div className="bg-slate-50 border border-gray-200 rounded-xl p-4">
              <p className="text-xs text-gray-400 uppercase tracking-wider mb-3 font-semibold">Last Detection</p>
              <div className="grid grid-cols-1 gap-3">
                <div>
                  <p className="text-gray-400 text-xs mb-0.5">Type</p>
                  <span className={`inline-block px-2.5 py-0.5 rounded-md border text-xs font-semibold capitalize ${detectionBadge(detection.type)}`}>
                    {detection.type}
                  </span>
                </div>
                <div>
                  <p className="text-gray-400 text-xs mb-1">Confidence</p>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 bg-gray-200 rounded-full h-1.5">
                      <div
                        className="h-1.5 rounded-full bg-tut-blue"
                        style={{ width: `${(detection.confidence * 100).toFixed(0)}%` }}
                      />
                    </div>
                    <span className="text-tut-teal text-xs font-bold tabular-nums">
                      {(detection.confidence * 100).toFixed(1)}%
                    </span>
                  </div>
                </div>
                <div>
                  <p className="text-gray-400 text-xs mb-0.5">Source</p>
                  <p className="text-tut-teal font-semibold text-sm capitalize">{detection.source}</p>
                </div>
              </div>
              {detection.note && (
                <p className="text-tut-teal text-xs mt-3 bg-tut-gold/10 border border-tut-gold/30 rounded-lg px-3 py-2">
                  {detection.note}
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
