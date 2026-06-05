import { Camera, Cpu, MonitorPlay, Upload } from 'lucide-react'
import { useState } from 'react'
import AudioDetect from '../components/AudioDetect'
import CctvManager from '../components/CctvManager'
import DeviceSelector from '../components/DeviceSelector'
import LiveCameraDetect from '../components/LiveCameraDetect'
import UploadVideoDetect from '../components/UploadVideoDetect'

type Tab = 'live' | 'upload' | 'cctv' | 'devices'

const TABS: { id: Tab; label: string; icon: typeof Camera }[] = [
  { id: 'live',    label: 'Live Camera',   icon: Camera },
  { id: 'upload',  label: 'Upload Video',  icon: Upload },
  { id: 'cctv',   label: 'CCTV Streams',  icon: MonitorPlay },
  { id: 'devices', label: 'Devices',       icon: Cpu },
]

export default function DetectionPage() {
  const [tab, setTab] = useState<Tab>('live')

  return (
    <div className="p-6 space-y-6">

      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-tut-teal">Detection</h1>
        <p className="text-gray-400 text-sm mt-0.5">Run detection from any video source</p>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 bg-white border border-gray-200 rounded-xl p-1 w-fit shadow-sm">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
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

      {/* Tab content */}
      <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
        {tab === 'live' && (
          <div className="space-y-4">
            <div>
              <h2 className="text-tut-teal font-semibold text-sm">Live Camera Detection</h2>
              <p className="text-gray-400 text-xs mt-0.5">
                Face recognition runs every 2 seconds. Unknown faces trigger an intruder alert.
              </p>
            </div>
            <LiveCameraDetect />
            <AudioDetect />
          </div>
        )}

        {tab === 'upload' && (
          <div className="space-y-3">
            <div>
              <h2 className="text-tut-teal font-semibold text-sm">Upload Video for Detection</h2>
              <p className="text-gray-400 text-xs mt-0.5">
                Upload a recorded video file. The backend extracts frames at 1fps and runs
                YOLOv8 detection on each. Threats are stored as alerts automatically.
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
                RTSP streams require the detector client (intruder_detection.py) to process and forward frames.
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
