import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Camera, Cpu, MonitorPlay, Upload } from 'lucide-react';
import { useState } from 'react';
import CctvManager from '../components/CctvManager';
import DeviceSelector from '../components/DeviceSelector';
import LiveCameraDetect from '../components/LiveCameraDetect';
import UploadVideoDetect from '../components/UploadVideoDetect';
const TABS = [
    { id: 'live', label: 'Live Camera', icon: Camera },
    { id: 'upload', label: 'Upload Video', icon: Upload },
    { id: 'cctv', label: 'CCTV Streams', icon: MonitorPlay },
    { id: 'devices', label: 'Devices', icon: Cpu },
];
export default function DetectionPage() {
    const [tab, setTab] = useState('live');
    return (_jsxs("div", { className: "p-6 space-y-6", children: [_jsxs("div", { children: [_jsx("h1", { className: "text-xl font-bold text-tut-teal", children: "Detection" }), _jsx("p", { className: "text-gray-400 text-sm mt-0.5", children: "Run detection from any video source" })] }), _jsx("div", { className: "flex gap-1 bg-white border border-gray-200 rounded-xl p-1 w-fit shadow-sm", children: TABS.map(({ id, label, icon: Icon }) => (_jsxs("button", { onClick: () => setTab(id), className: `flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${tab === id
                        ? 'bg-tut-blue text-white shadow-sm'
                        : 'text-gray-500 hover:text-tut-teal hover:bg-slate-50'}`, children: [_jsx(Icon, { size: 15 }), label] }, id))) }), _jsxs("div", { className: "bg-white border border-gray-200 rounded-xl p-6 shadow-sm", children: [tab === 'live' && (_jsxs("div", { className: "space-y-3", children: [_jsxs("div", { children: [_jsx("h2", { className: "text-tut-teal font-semibold text-sm", children: "Live Camera Detection" }), _jsx("p", { className: "text-gray-400 text-xs mt-0.5", children: "Uses your device's webcam. Frames are analyzed every 2 seconds using YOLOv8. Threats are automatically saved as alerts." })] }), _jsx(LiveCameraDetect, {})] })), tab === 'upload' && (_jsxs("div", { className: "space-y-3", children: [_jsxs("div", { children: [_jsx("h2", { className: "text-tut-teal font-semibold text-sm", children: "Upload Video for Detection" }), _jsx("p", { className: "text-gray-400 text-xs mt-0.5", children: "Upload a recorded video file. The backend extracts frames at 1fps and runs YOLOv8 detection on each. Threats are stored as alerts automatically." })] }), _jsx(UploadVideoDetect, {})] })), tab === 'cctv' && (_jsxs("div", { className: "space-y-3", children: [_jsxs("div", { children: [_jsx("h2", { className: "text-tut-teal font-semibold text-sm", children: "CCTV Camera Streams" }), _jsx("p", { className: "text-gray-400 text-xs mt-0.5", children: "Register IP cameras by URL. HTTP MJPEG streams are previewed directly in the browser. RTSP streams require the detector client (intruder_detection.py) to process and forward frames." })] }), _jsx(CctvManager, {})] })), tab === 'devices' && (_jsx("div", { className: "space-y-3", children: _jsx(DeviceSelector, {}) }))] })] }));
}
