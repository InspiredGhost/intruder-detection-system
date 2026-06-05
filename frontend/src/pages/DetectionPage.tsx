import { Camera, Cpu, MonitorPlay, Play, Square, Upload } from 'lucide-react'
import { useState } from 'react'
import AudioDetect from '../components/AudioDetect'
import CctvManager from '../components/CctvManager'
import DeviceSelector from '../components/DeviceSelector'
import LiveCameraDetect from '../components/LiveCameraDetect'
import UploadVideoDetect from '../components/UploadVideoDetect'

type Tab = 'live' | 'upload' | 'cctv' | 'devices'

const TABS: { id: Tab; label: string; icon: typeof Camera }[] = [
  { id: 'live',    label: 'Live Detection', icon: Camera },
  { id: 'upload',  label: 'Upload Video',   icon: Upload },
  { id: 'cctv',   label: 'CCTV Streams',   icon: MonitorPlay },
  { id: 'devices', label: 'Devices',        icon: Cpu },
]

export default function DetectionPage() {
  const [tab, setTab]           = useState<Tab>('live')
  const [isRunning, setIsRunning] = useState(false)

  function handleTabChange(id: Tab) {
    // Stop detection when switching away from live tab
    if (id !== 'live') setIsRunning(false)
    setTab(id)
  }

  return (
    <div className="p-6 space-y-6">

      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-tut-teal">Detection</h1>
        <p className="text-gray-400 text-sm mt-0.5">Real-time audio-visual intrusion detection</p>
      </div>

      {/* Tab bar + start/stop button */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex gap-1 bg-white border border-gray-200 rounded-xl p-1 shadow-sm">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => handleTabChange(id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                tab === id
                  ? 'bg-tut-blue text-white shadow-sm'
                  : 'text-gray-500 hover:text-tut-teal hover:bg-slate-50'
              }`}
            >
              <Icon size={15} />
              {label}
            </button>
          ))}
        </div>

        {/* Single start/stop for live tab */}
        {tab === 'live' && (
          <button
            onClick={() => setIsRunning(r => !r)}
            className={`flex items-center gap-2 font-semibold text-sm px-5 py-2.5 rounded-xl shadow-sm transition-colors ${
              isRunning
                ? 'bg-tut-red hover:bg-red-700 text-white'
                : 'bg-tut-teal hover:bg-tut-blue text-white'
            }`}
          >
            {isRunning ? <><Square size={15} /> Stop Detection</> : <><Play size={15} /> Start Detection</>}
          </button>
        )}
      </div>

      {/* Tab content */}
      <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">

        {tab === 'live' && (
          <div className="space-y-5">
            <p className="text-gray-400 text-xs">
              Face recognition and audio analysis run simultaneously. Unknown faces and intrusion sounds trigger alerts.
            </p>

            {/* Side-by-side: camera left, audio right */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-start">
              <LiveCameraDetect isRunning={isRunning} />
              <AudioDetect isRunning={isRunning} />
            </div>
          </div>
        )}

        {tab === 'upload' && (
          <div className="space-y-3">
            <div>
              <h2 className="text-tut-teal font-semibold text-sm">Upload Video for Detection</h2>
              <p className="text-gray-400 text-xs mt-0.5">
                Upload a recorded video file. Frames are extracted at 1fps and analysed for faces.
              </p>
            </div>
            <UploadVideoDetect />
          </div>
        )}

        {tab === 'cctv' && (
          <div className="space-y-3">
            <div>
              <h2 className="text-tut-teal font-semibold text-sm">CCTV Camera Streams</h2>
              <p className="text-gray-400 text-xs mt-0.5">
                Register IP cameras by URL. HTTP MJPEG streams are previewed directly in the browser.
              </p>
            </div>
            <CctvManager />
          </div>
        )}

        {tab === 'devices' && (
          <div className="space-y-3">
            <DeviceSelector />
          </div>
        )}
      </div>
    </div>
  )
}
