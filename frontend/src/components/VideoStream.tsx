import { CameraOff, RefreshCw } from 'lucide-react'
import { useState } from 'react'

export default function VideoStream() {
  const [offline, setOffline] = useState(false)
  const [key, setKey] = useState(0)

  const token = localStorage.getItem('token') ?? ''
  const streamUrl = `/stream?token=${encodeURIComponent(token)}`

  return (
    <div className="w-full aspect-square bg-gray-950 rounded-xl overflow-hidden border border-gray-800 flex items-center justify-center">
      {offline ? (
        <div className="text-center text-gray-600 space-y-3 p-6">
          <CameraOff className="mx-auto opacity-40" size={36} />
          <div>
            <p className="text-sm font-medium">Live feed unavailable</p>
            <p className="text-xs opacity-60 mt-0.5">Start intruder_detection.py to enable stream</p>
          </div>
          <button
            onClick={() => { setOffline(false); setKey(k => k + 1) }}
            className="flex items-center gap-1.5 mx-auto text-xs text-cyan-400 hover:text-cyan-300 transition-colors"
          >
            <RefreshCw size={12} />
            Retry
          </button>
        </div>
      ) : (
        <img
          key={key}
          src={streamUrl}
          alt="Live feed"
          className="w-full h-full object-cover"
          onError={() => setOffline(true)}
        />
      )}
    </div>
  )
}
