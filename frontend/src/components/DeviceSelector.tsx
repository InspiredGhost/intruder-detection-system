import axios from 'axios'
import { Cpu, Mic, RefreshCw, Save, Video } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'

interface Device { index: number; name: string }
interface DevicesResponse {
  cameras: Device[]
  microphones: Device[]
  current: { camera_index: number; audio_device: number }
}

function authHeaders() {
  const token = localStorage.getItem('token')
  return token ? { Authorization: `Bearer ${token}` } : {}
}

export default function DeviceSelector() {
  const [devices, setDevices] = useState<DevicesResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [camera, setCamera] = useState(0)
  const [audioDevice, setAudioDevice] = useState(4)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const { data } = await axios.get<DevicesResponse>('/devices', { headers: authHeaders() })
      setDevices(data)
      setCamera(data.current.camera_index)
      setAudioDevice(data.current.audio_device)
      setError('')
    } catch {
      setError('Could not load devices.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const save = async () => {
    setSaving(true)
    setSaved(false)
    try {
      await axios.post('/devices/config', { camera_index: camera, audio_device: audioDevice }, { headers: authHeaders() })
      setSaved(true)
      setTimeout(() => setSaved(false), 6000)
    } catch {
      setError('Failed to save config.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <p className="text-gray-400 text-sm py-4">Scanning for devices…</p>

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-tut-teal font-semibold text-sm">Device Configuration</h2>
          <p className="text-gray-400 text-xs mt-0.5">Select the camera and microphone used by the detection system</p>
        </div>
        <button
          onClick={load}
          className="text-gray-400 hover:text-tut-blue p-1.5 rounded-lg hover:bg-tut-blue/10 transition-colors"
          title="Refresh device list"
        >
          <RefreshCw size={14} />
        </button>
      </div>

      {error && (
        <p className="text-tut-red text-xs bg-tut-red/5 border border-tut-red/20 rounded-lg px-3 py-2">{error}</p>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Camera */}
        <div className="bg-slate-50 border border-gray-200 rounded-xl p-4 space-y-3">
          <div className="flex items-center gap-2 text-tut-blue">
            <Video size={16} />
            <span className="text-sm font-semibold text-tut-teal">Camera</span>
          </div>
          {(devices?.cameras.length ?? 0) === 0 ? (
            <p className="text-gray-400 text-xs">No cameras found</p>
          ) : (
            <select
              value={camera}
              onChange={e => setCamera(Number(e.target.value))}
              className="w-full bg-white border border-gray-200 text-tut-teal text-sm rounded-lg px-3 py-2 outline-none focus:border-tut-blue shadow-sm"
            >
              {devices?.cameras.map(c => (
                <option key={c.index} value={c.index}>{c.name}</option>
              ))}
            </select>
          )}
          <p className="text-gray-400 text-xs flex items-center gap-1">
            <Cpu size={11} />
            Active: Camera {camera}
          </p>
        </div>

        {/* Microphone */}
        <div className="bg-slate-50 border border-gray-200 rounded-xl p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Mic size={16} className="text-tut-gold" />
            <span className="text-sm font-semibold text-tut-teal">Microphone</span>
          </div>
          {(devices?.microphones.length ?? 0) === 0 ? (
            <p className="text-gray-400 text-xs">No microphones found</p>
          ) : (
            <select
              value={audioDevice}
              onChange={e => setAudioDevice(Number(e.target.value))}
              className="w-full bg-white border border-gray-200 text-tut-teal text-sm rounded-lg px-3 py-2 outline-none focus:border-tut-blue shadow-sm"
            >
              {devices?.microphones.map(m => (
                <option key={m.index} value={m.index}>{m.name}</option>
              ))}
            </select>
          )}
          <p className="text-gray-400 text-xs flex items-center gap-1">
            <Cpu size={11} />
            Active: Device {audioDevice}
          </p>
        </div>
      </div>

      {/* Save row */}
      <div className="flex items-center gap-3 flex-wrap">
        <button
          onClick={save}
          disabled={saving}
          className="flex items-center gap-2 bg-tut-blue hover:bg-[#004a80] disabled:opacity-50 text-white font-semibold px-4 py-2 rounded-lg text-sm transition-colors shadow-sm"
        >
          <Save size={14} />
          {saving ? 'Saving…' : 'Save & Apply'}
        </button>
        {saved && (
          <p className="text-tut-teal text-xs bg-tut-gold/10 border border-tut-gold/30 rounded-lg px-3 py-2">
            Saved — restart the system (<code className="font-mono">Ctrl+C</code> then <code className="font-mono">python start.py</code>) to apply
          </p>
        )}
      </div>
    </div>
  )
}
