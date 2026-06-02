import { jsx as _jsx } from "react/jsx-runtime";
import { createContext, useContext, useEffect, useState } from 'react';
const CameraContext = createContext({
    devices: [],
    setDevices: () => { },
    selectedDeviceId: '',
    setSelectedDeviceId: () => { },
});
export function CameraProvider({ children }) {
    const [devices, setDevices] = useState([]);
    const [selectedDeviceId, setSelectedDeviceId] = useState('');
    useEffect(() => {
        async function enumerate() {
            try {
                // Brief getUserMedia to trigger the permission prompt so labels are populated
                const tmp = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
                tmp.getTracks().forEach(t => t.stop());
            }
            catch {
                // Permission denied — enumerateDevices will still return devices, just without labels
            }
            try {
                const all = await navigator.mediaDevices.enumerateDevices();
                const videoDevices = all
                    .filter(d => d.kind === 'videoinput')
                    .map((d, i) => ({ deviceId: d.deviceId, label: d.label || `Camera ${i + 1}` }));
                setDevices(videoDevices);
                if (videoDevices.length > 0)
                    setSelectedDeviceId(videoDevices[0].deviceId);
            }
            catch { /* ignore */ }
        }
        enumerate();
    }, []);
    return (_jsx(CameraContext.Provider, { value: { devices, setDevices, selectedDeviceId, setSelectedDeviceId }, children: children }));
}
export function useCameraContext() {
    return useContext(CameraContext);
}
