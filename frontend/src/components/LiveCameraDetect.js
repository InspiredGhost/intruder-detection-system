import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import axios from 'axios';
import { CameraOff, Loader2, Square } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import CameraView from './CameraView';
function authHeaders() {
    const token = localStorage.getItem('token');
    return token ? { Authorization: `Bearer ${token}` } : {};
}
const NORMAL = new Set(['normal', 'normalvideos']);
function detectionBadge(type) {
    return NORMAL.has(type.toLowerCase())
        ? 'text-green-700 border-green-200 bg-green-50'
        : 'text-tut-red border-tut-red/20 bg-tut-red/10';
}
export default function LiveCameraDetect() {
    const cameraRef = useRef(null);
    const intervalRef = useRef(null);
    const [detection, setDetection] = useState(null);
    // Auto-start detection immediately on mount
    const [isRunning, setIsRunning] = useState(true);
    useEffect(() => {
        if (!isRunning)
            return;
        intervalRef.current = setInterval(async () => {
            const base64 = cameraRef.current?.captureFrame();
            if (!base64)
                return;
            try {
                const { data } = await axios.post('/webcam/detect', { frame_b64: base64 }, { headers: authHeaders() });
                setDetection(data);
                if (!NORMAL.has(data.type.toLowerCase()) && data.confidence > 0.5) {
                    // Capture the current frame so it is saved with the alert
                    const raw = cameraRef.current?.captureFrame();
                    const frameUrl = raw ? `data:image/jpeg;base64,${raw}` : undefined;
                    await axios.post('/predict', {
                        type: data.type,
                        confidence: data.confidence,
                        source: 'video',
                        timestamp: data.timestamp,
                        frame_url: frameUrl,
                    }, { headers: authHeaders() });
                }
            }
            catch { /* ignore single-frame errors */ }
        }, 2000);
        return () => { if (intervalRef.current)
            clearInterval(intervalRef.current); };
    }, [isRunning]);
    return (_jsx("div", { className: "space-y-4", children: _jsxs("div", { className: "flex gap-6 items-start flex-wrap", children: [_jsx(CameraView, { ref: cameraRef, active: isRunning, overlayLabel: detection
                        ? `${detection.type.toUpperCase()} — ${(detection.confidence * 100).toFixed(0)}%`
                        : undefined, overlayColor: detection ? detectionBadge(detection.type) : undefined }), _jsxs("div", { className: "flex-1 min-w-48 space-y-4", children: [_jsx("div", { className: "flex items-center gap-3 flex-wrap", children: isRunning ? (_jsxs(_Fragment, { children: [_jsxs("div", { className: "flex items-center gap-2 text-xs text-tut-blue font-medium bg-tut-blue/10 border border-tut-blue/20 px-3 py-2 rounded-lg", children: [_jsx(Loader2, { size: 13, className: "animate-spin" }), "Detecting \u2014 every 2 s"] }), _jsxs("button", { onClick: () => { setIsRunning(false); setDetection(null); }, className: "flex items-center gap-2 bg-tut-red/10 hover:bg-tut-red/20 border border-tut-red/20 text-tut-red font-semibold text-sm px-4 py-2 rounded-lg transition-colors", children: [_jsx(Square, { size: 13 }), "Stop"] })] })) : (_jsxs("button", { onClick: () => setIsRunning(true), className: "flex items-center gap-2 bg-tut-blue hover:bg-[#004a80] text-white font-semibold text-sm px-5 py-2.5 rounded-lg transition-colors shadow-sm", children: [_jsx(CameraOff, { size: 16 }), "Restart Detection"] })) }), detection && (_jsxs("div", { className: "bg-slate-50 border border-gray-200 rounded-xl p-4", children: [_jsx("p", { className: "text-xs text-gray-400 uppercase tracking-wider mb-3 font-semibold", children: "Last Detection" }), _jsxs("div", { className: "grid grid-cols-1 gap-3", children: [_jsxs("div", { children: [_jsx("p", { className: "text-gray-400 text-xs mb-0.5", children: "Type" }), _jsx("span", { className: `inline-block px-2.5 py-0.5 rounded-md border text-xs font-semibold capitalize ${detectionBadge(detection.type)}`, children: detection.type })] }), _jsxs("div", { children: [_jsx("p", { className: "text-gray-400 text-xs mb-1", children: "Confidence" }), _jsxs("div", { className: "flex items-center gap-2", children: [_jsx("div", { className: "flex-1 bg-gray-200 rounded-full h-1.5", children: _jsx("div", { className: "h-1.5 rounded-full bg-tut-blue", style: { width: `${(detection.confidence * 100).toFixed(0)}%` } }) }), _jsxs("span", { className: "text-tut-teal text-xs font-bold tabular-nums", children: [(detection.confidence * 100).toFixed(1), "%"] })] })] }), _jsxs("div", { children: [_jsx("p", { className: "text-gray-400 text-xs mb-0.5", children: "Source" }), _jsx("p", { className: "text-tut-teal font-semibold text-sm capitalize", children: detection.source })] })] }), detection.note && (_jsx("p", { className: "text-tut-teal text-xs mt-3 bg-tut-gold/10 border border-tut-gold/30 rounded-lg px-3 py-2", children: detection.note }))] }))] })] }) }));
}
