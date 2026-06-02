import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'

export interface VideoDevice {
  deviceId: string
  label: string
}

interface CameraContextValue {
  devices: VideoDevice[]
  setDevices: (d: VideoDevice[]) => void
  selectedDeviceId: string
  setSelectedDeviceId: (id: string) => void
}

const CameraContext = createContext<CameraContextValue>({
  devices: [],
  setDevices: () => {},
  selectedDeviceId: '',
  setSelectedDeviceId: () => {},
})

export function CameraProvider({ children }: { children: ReactNode }) {
  const [devices, setDevices]                   = useState<VideoDevice[]>([])
  const [selectedDeviceId, setSelectedDeviceId] = useState('')

  useEffect(() => {
    async function enumerate() {
      try {
        // Brief getUserMedia to trigger the permission prompt so labels are populated
        const tmp = await navigator.mediaDevices.getUserMedia({ video: true, audio: false })
        tmp.getTracks().forEach(t => t.stop())
      } catch {
        // Permission denied — enumerateDevices will still return devices, just without labels
      }
      try {
        const all = await navigator.mediaDevices.enumerateDevices()
        const videoDevices = all
          .filter(d => d.kind === 'videoinput')
          .map((d, i) => ({ deviceId: d.deviceId, label: d.label || `Camera ${i + 1}` }))
        setDevices(videoDevices)
        if (videoDevices.length > 0) setSelectedDeviceId(videoDevices[0].deviceId)
      } catch { /* ignore */ }
    }
    enumerate()
  }, [])

  return (
    <CameraContext.Provider value={{ devices, setDevices, selectedDeviceId, setSelectedDeviceId }}>
      {children}
    </CameraContext.Provider>
  )
}

export function useCameraContext() {
  return useContext(CameraContext)
}
