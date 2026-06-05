import axios from 'axios'
import { Mic, MicOff, Volume2 } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

function authHeaders() {
  const token = localStorage.getItem('token')
  return token ? { Authorization: `Bearer ${token}` } : {}
}

interface AudioResult {
  intrusion: boolean
  confidence: number
  timestamp: string
  note?: string
}

const CHUNK_MS       = 2000   // 2-second recording windows
const ALERT_COOLDOWN = 10000  // min ms between alerts

export default function AudioDetect() {
  const [running, setRunning]         = useState(false)
  const [result, setResult]           = useState<AudioResult | null>(null)
  const [error, setError]             = useState('')
  const lastAlertRef                  = useRef<number>(0)
  const mediaRecorderRef              = useRef<MediaRecorder | null>(null)
  const streamRef                     = useRef<MediaStream | null>(null)
  const intervalRef                   = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => () => stopAudio(), [])

  function stopAudio() {
    if (intervalRef.current) clearInterval(intervalRef.current)
    mediaRecorderRef.current?.stop()
    streamRef.current?.getTracks().forEach(t => t.stop())
    streamRef.current = null
    mediaRecorderRef.current = null
    setRunning(false)
  }

  async function startAudio() {
    setError('')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      setRunning(true)
      scheduleChunk(stream)
    } catch {
      setError('Microphone access denied.')
    }
  }

  function scheduleChunk(stream: MediaStream) {
    // Record one chunk, send it, then schedule the next
    const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm' })
    const chunks: BlobEvent['data'][] = []
    mediaRecorderRef.current = recorder

    recorder.ondataavailable = e => { if (e.data.size > 0) chunks.push(e.data) }

    recorder.onstop = async () => {
      if (!streamRef.current) return  // stopped by user
      const blob = new Blob(chunks, { type: 'audio/webm' })
      const arrayBuffer = await blob.arrayBuffer()
      const b64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)))

      try {
        const { data } = await axios.post<AudioResult>(
          '/audio/detect',
          { audio_b64: b64 },
          { headers: authHeaders() },
        )
        setResult(data)

        if (data.intrusion) {
          const now = Date.now()
          if (now - lastAlertRef.current >= ALERT_COOLDOWN) {
            lastAlertRef.current = now
            await axios.post('/predict', {
              type:       'gunshot',
              confidence: data.confidence,
              source:     'audio',
              timestamp:  data.timestamp,
            }, { headers: authHeaders() })
          }
        }
      } catch { /* ignore — keep recording */ }

      // Schedule next chunk
      if (streamRef.current) scheduleChunk(streamRef.current)
    }

    recorder.start()
    setTimeout(() => { if (recorder.state === 'recording') recorder.stop() }, CHUNK_MS)
  }

  const isAlert = result?.intrusion === true

  return (
    <div className={`border rounded-xl p-4 space-y-3 ${isAlert ? 'border-tut-red/30 bg-tut-red/5' : 'border-gray-200 bg-white'}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Volume2 size={16} className={isAlert ? 'text-tut-red' : 'text-tut-teal'} />
          <h3 className="text-sm font-semibold text-tut-teal">Audio Detection</h3>
        </div>

        {running ? (
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1.5 text-xs text-tut-blue font-medium bg-tut-blue/10 border border-tut-blue/20 px-2.5 py-1.5 rounded-lg">
              <span className="w-1.5 h-1.5 rounded-full bg-tut-blue animate-pulse" />
              Listening
            </span>
            <button
              onClick={stopAudio}
              className="flex items-center gap-1.5 text-xs text-tut-red font-semibold bg-tut-red/10 border border-tut-red/20 hover:bg-tut-red/20 px-2.5 py-1.5 rounded-lg transition-colors"
            >
              <MicOff size={13} />
              Stop
            </button>
          </div>
        ) : (
          <button
            onClick={startAudio}
            className="flex items-center gap-1.5 text-xs text-white font-semibold bg-tut-teal hover:bg-tut-blue px-3 py-1.5 rounded-lg transition-colors shadow-sm"
          >
            <Mic size={13} />
            Start Listening
          </button>
        )}
      </div>

      {error && (
        <p className="text-tut-red text-xs bg-tut-red/5 border border-tut-red/20 rounded-lg px-3 py-2">{error}</p>
      )}

      {result && (
        <div className="flex items-center gap-4">
          <div>
            <p className="text-[10px] text-gray-400 uppercase tracking-wide font-semibold mb-0.5">Status</p>
            <span className={`inline-block px-2 py-0.5 rounded-md border text-xs font-semibold ${
              isAlert
                ? 'bg-tut-red/10 text-tut-red border-tut-red/20'
                : 'bg-green-50 text-green-700 border-green-200'
            }`}>
              {isAlert ? 'Intrusion Sound' : 'Normal'}
            </span>
          </div>
          <div className="flex-1">
            <p className="text-[10px] text-gray-400 uppercase tracking-wide font-semibold mb-1">Confidence</p>
            <div className="flex items-center gap-2">
              <div className="flex-1 bg-gray-100 rounded-full h-1.5">
                <div
                  className={`h-1.5 rounded-full ${isAlert ? 'bg-tut-red' : 'bg-tut-blue'}`}
                  style={{ width: `${(result.confidence * 100).toFixed(0)}%` }}
                />
              </div>
              <span className="text-xs font-bold tabular-nums text-tut-teal">
                {(result.confidence * 100).toFixed(1)}%
              </span>
            </div>
          </div>
          {result.note && (
            <p className="text-[10px] text-gray-400 italic">{result.note}</p>
          )}
        </div>
      )}

      {!running && !result && (
        <p className="text-gray-400 text-xs">Click "Start Listening" to enable microphone-based intrusion detection.</p>
      )}
    </div>
  )
}
