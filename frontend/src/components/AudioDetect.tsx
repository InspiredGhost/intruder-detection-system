import axios from 'axios'
import { ShieldAlert, Volume2, X } from 'lucide-react'
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

const CHUNK_MS          = 2000
const ALERT_COOLDOWN    = 10000
const POST_ALERT_PAUSE  = 5000  // wait 5s after detection before next recording

interface Props {
  isRunning: boolean
}

interface AudioPopup {
  confidence: number
  timestamp: string
}

export default function AudioDetect({ isRunning }: Props) {
  const [result, setResult]   = useState<AudioResult | null>(null)
  const [error, setError]     = useState('')
  const [popup, setPopup]     = useState<AudioPopup | null>(null)
  const lastAlertRef          = useRef<number>(0)
  const mediaRecorderRef      = useRef<MediaRecorder | null>(null)
  const streamRef             = useRef<MediaStream | null>(null)

  // Start/stop mic stream when parent toggles isRunning
  useEffect(() => {
    if (isRunning) {
      setError('')
      setResult(null)
      startAudio()
    } else {
      stopAudio()
    }
    return () => stopAudio()
  }, [isRunning])

  function stopAudio() {
    mediaRecorderRef.current?.stop()
    streamRef.current?.getTracks().forEach(t => t.stop())
    streamRef.current = null
    mediaRecorderRef.current = null
  }

  async function startAudio() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      scheduleChunk(stream)
    } catch {
      setError('Microphone access denied.')
    }
  }

  function scheduleChunk(stream: MediaStream) {
    if (!streamRef.current) return
    const recorder = new MediaRecorder(stream)
    const chunks: Blob[] = []
    mediaRecorderRef.current = recorder

    recorder.ondataavailable = e => { if (e.data.size > 0) chunks.push(e.data) }

    recorder.onstop = async () => {
      if (!streamRef.current) return
      let detectedIntrusion = false
      try {
        const blob = new Blob(chunks, { type: recorder.mimeType })
        const b64 = await blobToWavBase64(blob)

        const { data } = await axios.post<AudioResult>(
          '/audio/detect',
          { audio_b64: b64 },
          { headers: authHeaders() },
        )
        setResult(data)

        if (data.intrusion) {
          detectedIntrusion = true
          const now = Date.now()
          if (now - lastAlertRef.current >= ALERT_COOLDOWN) {
            lastAlertRef.current = now
            setPopup({ confidence: data.confidence, timestamp: data.timestamp })
            await axios.post('/predict', {
              type:       'suspicious_audio',
              confidence: data.confidence,
              source:     'audio',
              timestamp:  data.timestamp,
            }, { headers: authHeaders() })
          }
        }
      } catch { /* keep going */ }

      if (!streamRef.current) return
      // After a detection pause to let the room settle before next recording
      if (detectedIntrusion) {
        await new Promise(r => setTimeout(r, POST_ALERT_PAUSE))
      }
      if (streamRef.current) scheduleChunk(streamRef.current)
    }

    recorder.start()
    setTimeout(() => { if (recorder.state === 'recording') recorder.stop() }, CHUNK_MS)
  }

  /**
   * Decode any browser audio blob (webm/ogg/mp4) via AudioContext,
   * resample to 16 kHz mono, and encode as 16-bit PCM WAV base64.
   * This is what the Python audio model expects.
   */
  async function blobToWavBase64(blob: Blob): Promise<string> {
    const arrayBuffer = await blob.arrayBuffer()

    // Decode compressed audio (WebM/Opus etc.)
    const decodeCtx = new AudioContext()
    const decoded   = await decodeCtx.decodeAudioData(arrayBuffer)
    await decodeCtx.close()

    // Resample to 16 kHz mono
    const TARGET_SR = 16000
    const numSamples = Math.ceil(decoded.duration * TARGET_SR)
    const offlineCtx = new OfflineAudioContext(1, numSamples, TARGET_SR)
    const src = offlineCtx.createBufferSource()
    src.buffer = decoded
    src.connect(offlineCtx.destination)
    src.start(0)
    const resampled = await offlineCtx.startRendering()

    // Encode as 16-bit PCM WAV
    const pcm = resampled.getChannelData(0)
    const wavBuffer = new ArrayBuffer(44 + pcm.length * 2)
    const view = new DataView(wavBuffer)
    const write = (offset: number, str: string) =>
      [...str].forEach((c, i) => view.setUint8(offset + i, c.charCodeAt(0)))

    write(0, 'RIFF')
    view.setUint32(4, 36 + pcm.length * 2, true)
    write(8, 'WAVE')
    write(12, 'fmt ')
    view.setUint32(16, 16, true)
    view.setUint16(20, 1, true)          // PCM
    view.setUint16(22, 1, true)          // mono
    view.setUint32(24, TARGET_SR, true)
    view.setUint32(28, TARGET_SR * 2, true)
    view.setUint16(32, 2, true)
    view.setUint16(34, 16, true)
    write(36, 'data')
    view.setUint32(40, pcm.length * 2, true)
    let offset = 44
    for (let i = 0; i < pcm.length; i++) {
      view.setInt16(offset, Math.max(-1, Math.min(1, pcm[i])) * 0x7FFF, true)
      offset += 2
    }

    const bytes = new Uint8Array(wavBuffer)
    let binary = ''
    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i])
    return btoa(binary)
  }

  const isAlert = result?.intrusion === true

  return (
    <>
    {/* Audio intrusion popup */}
    {popup && (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
        onClick={() => setPopup(null)}
      >
        <div
          className="bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4 overflow-hidden border-2 border-tut-red/40"
          onClick={e => e.stopPropagation()}
        >
          {/* Red header */}
          <div className="bg-tut-red px-5 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <ShieldAlert size={22} className="text-white" />
              <div>
                <p className="text-white font-bold text-base leading-tight">INTRUSION SOUND DETECTED</p>
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

          {/* Icon */}
          <div className="flex flex-col items-center justify-center py-8 gap-3 bg-tut-red/5">
            <div className="w-16 h-16 rounded-full bg-tut-red/10 border-2 border-tut-red/20 flex items-center justify-center">
              <Volume2 size={32} className="text-tut-red" />
            </div>
            <p className="text-tut-red font-semibold text-sm">Suspicious audio event captured</p>
          </div>

          {/* Details */}
          <div className="px-5 py-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-gray-500 text-sm">Sound type</span>
              <span className="text-tut-red font-semibold text-sm">Suspicious Audio</span>
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

    <div className={`h-full border rounded-xl p-4 space-y-4 flex flex-col ${isAlert ? 'border-tut-red/30 bg-tut-red/5' : 'border-gray-200 bg-white'}`}>

      {/* Header */}
      <div className="flex items-center gap-2">
        <Volume2 size={16} className={isAlert ? 'text-tut-red' : 'text-tut-teal'} />
        <h3 className="text-sm font-semibold text-tut-teal">Audio Detection</h3>
        {isRunning && (
          <span className="ml-auto flex items-center gap-1.5 text-xs text-tut-blue font-medium bg-tut-blue/10 border border-tut-blue/20 px-2.5 py-1 rounded-lg">
            <span className="w-1.5 h-1.5 rounded-full bg-tut-blue animate-pulse" />
            Listening
          </span>
        )}
      </div>

      {/* Error */}
      {error && (
        <p className="text-tut-red text-xs bg-tut-red/5 border border-tut-red/20 rounded-lg px-3 py-2">{error}</p>
      )}

      {/* Idle state */}
      {!isRunning && !result && (
        <div className="flex-1 flex flex-col items-center justify-center text-center gap-2 py-8">
          <Volume2 size={32} className="text-gray-200" />
          <p className="text-gray-400 text-sm">Audio monitoring inactive</p>
          <p className="text-gray-300 text-xs">Press Start Detection to begin</p>
        </div>
      )}

      {/* Live waveform visualiser */}
      {isRunning && (
        <div className="flex-1 flex flex-col items-center justify-center gap-4">
          {/* Animated bars */}
          <div className="flex items-end gap-1 h-20">
            {Array.from({ length: 20 }).map((_, i) => (
              <div
                key={i}
                className={`w-2 rounded-full animate-pulse ${isAlert ? 'bg-tut-red' : 'bg-tut-blue/60'}`}
                style={{
                  height: `${20 + Math.sin(i * 0.8) * 15 + Math.random() * 20}px`,
                  animationDelay: `${i * 0.05}s`,
                  animationDuration: `${0.6 + Math.random() * 0.4}s`,
                }}
              />
            ))}
          </div>
          <p className="text-gray-400 text-xs">Analysing 2-second audio windows…</p>
        </div>
      )}

      {/* Result */}
      {result && (
        <div className="space-y-3">
          <div>
            <p className="text-[10px] text-gray-400 uppercase tracking-wide font-semibold mb-1">Last Result</p>
            <span className={`inline-block px-2.5 py-0.5 rounded-md border text-xs font-semibold ${
              isAlert
                ? 'bg-tut-red/10 text-tut-red border-tut-red/20'
                : 'bg-green-50 text-green-700 border-green-200'
            }`}>
              {isAlert ? '⚠ Suspicious Audio Detected' : 'Normal — No Threat'}
            </span>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <p className="text-[10px] text-gray-400 uppercase tracking-wide font-semibold">Confidence</p>
              <span className="text-xs font-bold tabular-nums text-tut-teal">
                {(result.confidence * 100).toFixed(1)}%
              </span>
            </div>
            <div className="w-full bg-gray-100 rounded-full h-2">
              <div
                className={`h-2 rounded-full transition-all ${isAlert ? 'bg-tut-red' : 'bg-tut-blue'}`}
                style={{ width: `${(result.confidence * 100).toFixed(0)}%` }}
              />
            </div>
          </div>

          {result.note && (
            <p className="text-[10px] text-gray-400 italic">{result.note}</p>
          )}
        </div>
      )}
    </div>
    </>
  )
}
