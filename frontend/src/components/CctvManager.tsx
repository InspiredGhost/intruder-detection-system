import axios from 'axios'
import { Camera, Plus, Trash2, Wifi, WifiOff } from 'lucide-react'
import { useEffect, useState } from 'react'
import type { Camera as CameraType } from '../types'

function authHeaders() {
  const token = localStorage.getItem('token')
  return token ? { Authorization: `Bearer ${token}` } : {}
}

function isHttpStream(url: string) {
  return url.startsWith('http://') || url.startsWith('https://')
}

export default function CctvManager() {
  const [cameras, setCameras] = useState<CameraType[]>([])
  const [name, setName] = useState('')
  const [url, setUrl] = useState('')
  const [adding, setAdding] = useState(false)
  const [error, setError] = useState('')
  const [showForm, setShowForm] = useState(false)

  useEffect(() => {
    axios.get('/cameras', { headers: authHeaders() })
      .then(r => setCameras(Array.isArray(r.data) ? r.data : []))
      .catch(() => {})
  }, [])

  async function addCamera() {
    if (!name.trim() || !url.trim()) return
    setAdding(true)
    setError('')
    try {
      const { data } = await axios.post<CameraType>('/cameras', { name, url }, { headers: authHeaders() })
      setCameras(prev => [...prev, data])
      setName('')
      setUrl('')
      setShowForm(false)
    } catch {
      setError('Failed to add camera.')
    } finally {
      setAdding(false)
    }
  }

  async function deleteCamera(id: string) {
    try {
      await axios.delete(`/cameras/${id}`, { headers: authHeaders() })
      setCameras(prev => prev.filter(c => c.id !== id))
    } catch {
      // ignore
    }
  }

  return (
    <div className="space-y-4">
      {/* Add camera button / form */}
      {!showForm ? (
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 bg-cyan-500 hover:bg-cyan-400 text-gray-950 font-semibold text-sm px-5 py-2.5 rounded-lg transition-colors"
        >
          <Plus size={16} />
          Add CCTV Camera
        </button>
      ) : (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 space-y-3">
          <p className="text-white font-medium text-sm">New Camera</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Camera Name</label>
              <input
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Front Gate"
                className="w-full bg-gray-800 border border-gray-700 text-white text-sm rounded-lg px-3 py-2 outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/20"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Stream URL</label>
              <input
                value={url}
                onChange={e => setUrl(e.target.value)}
                placeholder="http://192.168.1.x/stream or rtsp://..."
                className="w-full bg-gray-800 border border-gray-700 text-white text-sm rounded-lg px-3 py-2 outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/20"
              />
            </div>
          </div>
          {error && <p className="text-red-400 text-xs">{error}</p>}
          <div className="flex gap-2">
            <button
              onClick={addCamera}
              disabled={adding || !name.trim() || !url.trim()}
              className="bg-cyan-500 hover:bg-cyan-400 disabled:opacity-50 text-gray-950 font-semibold text-sm px-4 py-2 rounded-lg transition-colors"
            >
              {adding ? 'Adding…' : 'Add Camera'}
            </button>
            <button
              onClick={() => { setShowForm(false); setError('') }}
              className="text-gray-400 hover:text-white text-sm px-4 py-2 rounded-lg hover:bg-gray-800 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Camera grid */}
      {cameras.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-14 text-gray-600">
          <Camera size={40} className="opacity-40" />
          <p className="text-sm">No cameras registered yet.</p>
          <p className="text-xs text-gray-700">Add an HTTP MJPEG or RTSP stream URL above.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {cameras.map(cam => (
            <div key={cam.id} className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
              {/* Live stream preview or placeholder */}
              <div className="aspect-video bg-gray-950 flex items-center justify-center relative">
                {isHttpStream(cam.url) ? (
                  <img
                    src={cam.url}
                    alt={cam.name}
                    className="w-full h-full object-cover"
                    onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
                  />
                ) : (
                  <div className="flex flex-col items-center gap-2 text-gray-600">
                    <WifiOff size={32} className="opacity-40" />
                    <p className="text-xs text-center px-4">
                      RTSP stream — use the detector client to connect
                    </p>
                  </div>
                )}
                <div className="absolute top-2 right-2 flex items-center gap-1.5 bg-gray-900/80 rounded-full px-2 py-1 text-xs">
                  <Wifi size={10} className="text-green-400" />
                  <span className="text-gray-400">Active</span>
                </div>
              </div>

              {/* Info + delete */}
              <div className="px-4 py-3 flex items-center justify-between">
                <div className="min-w-0">
                  <p className="text-white text-sm font-medium truncate">{cam.name}</p>
                  <p className="text-gray-600 text-xs truncate mt-0.5">{cam.url}</p>
                </div>
                <button
                  onClick={() => deleteCamera(cam.id)}
                  className="shrink-0 ml-3 text-gray-600 hover:text-red-400 transition-colors p-1.5 rounded-lg hover:bg-red-500/10"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
