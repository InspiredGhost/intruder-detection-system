import { Activity, Bell, Camera, LayoutDashboard, LogOut, Mic, Video } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'

const NAV = [
  { icon: LayoutDashboard, label: 'Dashboard', path: '/dashboard' },
  { icon: Video,           label: 'Detection', path: '/detection' },
  { icon: Bell,            label: 'Alerts',    path: '/alerts' },
]

interface ActiveDevices {
  camera: string
  mic: string
}

export default function Sidebar() {
  const location = useLocation()
  const navigate  = useNavigate()
  const [active, setActive] = useState<ActiveDevices>({ camera: '—', mic: '—' })

  // Fetch current device names from backend config on mount
  useEffect(() => {
    const token = localStorage.getItem('token')
    if (!token) return
    fetch('/devices', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then((data: {
        cameras: { index: number; name: string }[]
        microphones: { index: number; name: string }[]
        current: { camera_index: number; audio_device: number }
      }) => {
        const cam = data.cameras.find(c => c.index === data.current.camera_index)
        const mic = data.microphones.find(m => m.index === data.current.audio_device)
        setActive({
          camera: cam?.name ?? `Camera ${data.current.camera_index}`,
          mic:    mic?.name ?? `Device ${data.current.audio_device}`,
        })
      })
      .catch(() => {})
  }, [location.pathname]) // re-fetch when user navigates back (e.g. after saving in /detection)

  function logout() {
    localStorage.removeItem('token')
    navigate('/login')
  }

  return (
    <aside className="w-64 shrink-0 flex flex-col bg-tut-blue h-screen shadow-2xl">

      {/* TUT Logo — white background so the logo is always legible */}
      <div className="flex flex-col items-center justify-center px-4 pt-5 pb-4 border-b border-white/10">
        <div className="bg-white rounded-xl px-4 py-2.5 w-full flex items-center justify-center">
          <img
            src="https://www.tut.ac.za/media/tshwane-interim/site-assets/images/tut-logo.svg"
            alt="Tshwane University of Technology"
            className="h-12 w-auto object-contain"
            onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none' }}
          />
        </div>
      </div>

      {/* App name strip */}
      <div className="px-5 py-3 border-b border-white/10 bg-white/5">
        <p className="text-white font-bold text-xs leading-snug tracking-wide">Audio-Visual Intruder Detection System</p>
      </div>

      {/* Nav links */}
      <nav className="flex-1 px-3 py-5 space-y-1">
        {NAV.map(({ icon: Icon, label, path }) => {
          const active = location.pathname === path
          return (
            <Link
              key={path}
              to={path}
              className={`flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
                active
                  ? 'bg-tut-gold text-tut-teal shadow-md font-semibold'
                  : 'text-white/70 hover:text-white hover:bg-white/10'
              }`}
            >
              <Icon size={18} />
              {label}
            </Link>
          )
        })}
      </nav>

      {/* Active devices — read-only display */}
      <div className="px-3 pb-3 space-y-2">
        <p className="text-white/40 text-xs font-semibold uppercase tracking-widest px-1">Active Devices</p>

        {/* Camera */}
        <div className="flex items-start gap-2.5 bg-white/10 border border-white/10 rounded-xl px-3 py-2.5">
          <Camera size={14} className="text-tut-gold mt-0.5 shrink-0" />
          <div className="min-w-0">
            <p className="text-white/50 text-[10px] font-semibold uppercase tracking-wide leading-none mb-0.5">Camera</p>
            <p className="text-white text-xs font-medium truncate" title={active.camera}>{active.camera}</p>
          </div>
        </div>

        {/* Microphone */}
        <div className="flex items-start gap-2.5 bg-white/10 border border-white/10 rounded-xl px-3 py-2.5">
          <Mic size={14} className="text-tut-gold mt-0.5 shrink-0" />
          <div className="min-w-0">
            <p className="text-white/50 text-[10px] font-semibold uppercase tracking-wide leading-none mb-0.5">Microphone</p>
            <p className="text-white text-xs font-medium truncate" title={active.mic}>{active.mic}</p>
          </div>
        </div>

        <p className="text-white/30 text-[10px] text-center pt-0.5">
          Change in Detection → Devices
        </p>
      </div>

      {/* System status */}
      <div className="px-3 pb-3">
        <div className="flex items-center justify-between px-4 py-2.5 rounded-xl bg-white/10 border border-white/10">
          <div className="flex items-center gap-2">
            <Activity size={13} className="text-tut-gold" />
            <span className="text-xs text-white/60 font-medium">System Status</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
            <span className="text-xs text-green-300 font-medium">Online</span>
          </div>
        </div>
      </div>

      {/* Sign out */}
      <div className="px-3 pb-5">
        <button
          onClick={logout}
          className="flex items-center gap-3 w-full px-4 py-2.5 rounded-lg text-sm font-medium text-white/60 hover:text-white hover:bg-white/10 transition-colors"
        >
          <LogOut size={18} />
          Sign Out
        </button>
      </div>
    </aside>
  )
}
