import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { Camera, Cpu, MonitorPlay, Play, Square, Upload } from 'lucide-react';
import { useState } from 'react';
import AudioDetect from '../components/AudioDetect';
import CctvManager from '../components/CctvManager';
import DeviceSelector from '../components/DeviceSelector';
import LiveCameraDetect from '../components/LiveCameraDetect';
import UploadVideoDetect from '../components/UploadVideoDetect';
const TABS = [
    { id: 'live', label: 'Live Detection', icon: Camera },
    { id: 'upload', label: 'Upload Video', icon: Upload },
    { id: 'cctv', label: 'CCTV Streams', icon: MonitorPlay },
    { id: 'devices', label: 'Devices', icon: Cpu },
];
export default function DetectionPage() {
    const [tab, setTab] = useState('live');
    const [isRunning, setIsRunning] = useState(false);
    function handleTabChange(id) {
        // Stop detection when switching away from live tab
        if (id !== 'live')
            setIsRunning(false);
        setTab(id);
    }
    return (_jsxs("div", { className: "p-6 space-y-6", children: [_jsxs("div", { children: [_jsx("h1", { className: "text-xl font-bold text-tut-teal", children: "Detection" }), _jsx("p", { className: "text-gray-400 text-sm mt-0.5", children: "Real-time audio-visual intrusion detection" })] }), _jsxs("div", { className: "flex items-center justify-between flex-wrap gap-3", children: [_jsx("div", { className: "flex gap-1 bg-white border border-gray-200 rounded-xl p-1 shadow-sm", children: TABS.map(({ id, label, icon: Icon }) => (_jsxs("button", { onClick: () => handleTabChange(id), className: `flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${tab === id
                                ? 'bg-tut-blue text-white shadow-sm'
                                : 'text-gray-500 hover:text-tut-teal hover:bg-slate-50'}`, children: [_jsx(Icon, { size: 15 }), label] }, id))) }), tab === 'live' && (_jsx("button", { onClick: () => setIsRunning(r => !r), className: `flex items-center gap-2 font-semibold text-sm px-5 py-2.5 rounded-xl shadow-sm transition-colors ${isRunning
                            ? 'bg-tut-red hover:bg-red-700 text-white'
                            : 'bg-tut-teal hover:bg-tut-blue text-white'}`, children: isRunning ? _jsxs(_Fragment, { children: [_jsx(Square, { size: 15 }), " Stop Detection"] }) : _jsxs(_Fragment, { children: [_jsx(Play, { size: 15 }), " Start Detection"] }) }))] }), _jsxs("div", { className: "bg-white border border-gray-200 rounded-xl p-6 shadow-sm", children: [tab === 'live' && (_jsxs("div", { className: "space-y-5", children: [_jsx("p", { className: "text-gray-400 text-xs", children: "Face recognition and audio analysis run simultaneously. Unknown faces and intrusion sounds trigger alerts." }), _jsxs("div", { className: "grid grid-cols-1 lg:grid-cols-2 gap-5 items-start", children: [_jsx(LiveCameraDetect, { isRunning: isRunning }), _jsx(AudioDetect, { isRunning: isRunning })] })] })), tab === 'upload' && (_jsxs("div", { className: "space-y-3", children: [_jsxs("div", { children: [_jsx("h2", { className: "text-tut-teal font-semibold text-sm", children: "Upload Video for Detection" }), _jsx("p", { className: "text-gray-400 text-xs mt-0.5", children: "Upload a recorded video file. Frames are extracted at 1fps and analysed for faces." })] }), _jsx(UploadVideoDetect, {})] })), tab === 'cctv' && (_jsxs("div", { className: "space-y-3", children: [_jsxs("div", { children: [_jsx("h2", { className: "text-tut-teal font-semibold text-sm", children: "CCTV Camera Streams" }), _jsx("p", { className: "text-gray-400 text-xs mt-0.5", children: "Register IP cameras by URL. HTTP MJPEG streams are previewed directly in the browser." })] }), _jsx(CctvManager, {})] })), tab === 'devices' && (_jsx("div", { className: "space-y-3", children: _jsx(DeviceSelector, {}) }))] })] }));
}
