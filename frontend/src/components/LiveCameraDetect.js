import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import axios from 'axios';
import { AlertTriangle, CameraOff, Loader2, ShieldAlert, Square, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import CameraView from './CameraView';
function authHeaders() {
    const token = localStorage.getItem('token');
    return token ? { Authorization: `Bearer ${token}` } : {};
}
const SAFE = new Set(['normal', 'normalvideos', 'friendly']);
const ALERT_COOLDOWN_MS = 10000; // one alert per 10 s max
function detectionBadge(type) {
    return SAFE.has(type.toLowerCase())
        ? 'text-green-700 border-green-200 bg-green-50'
        : 'text-tut-red border-tut-red/20 bg-tut-red/10';
}
export default function LiveCameraDetect() {
    const cameraRef = useRef(null);
    const intervalRef = useRef(null);
    const lastAlertRef = useRef(0);
    const [detection, setDetection] = useState(null);
    const [intruderAlert, setIntruderAlert] = useState(false);
    const [popup, setPopup] = useState(null);
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
                const isIntruder = data.type.toLowerCase() === 'intruder';
                setIntruderAlert(isIntruder);
                // Fire alert + show popup for any intruder detection, with cooldown to avoid spam
                if (isIntruder) {
                    const now = Date.now();
                    if (now - lastAlertRef.current >= ALERT_COOLDOWN_MS) {
                        lastAlertRef.current = now;
                        const frameUrl = base64 ? `data:image/jpeg;base64,${base64}` : undefined;
                        setPopup({
                            frameUrl: frameUrl ?? null,
                            confidence: data.confidence,
                            timestamp: data.timestamp,
                        });
                        await axios.post('/predict', {
                            type: 'intruder',
                            confidence: data.confidence,
                            source: 'video',
                            timestamp: data.timestamp,
                            frame_url: frameUrl,
                            detected_name: 'Unknown',
                        }, { headers: authHeaders() });
                    }
                }
            }
            catch { /* ignore single-frame errors */ }
        }, 2000);
        return () => { if (intervalRef.current)
            clearInterval(intervalRef.current); };
    }, [isRunning]);
    const overlayLabel = detection
        ? (() => {
            if (detection.detected_name && detection.detected_name !== 'Unknown') {
                return `${detection.detected_name} — ${(detection.confidence * 100).toFixed(0)}%`;
            }
            if (detection.type === 'intruder')
                return `UNKNOWN INTRUDER — ${(detection.confidence * 100).toFixed(0)}%`;
            return `${detection.type.toUpperCase()} — ${(detection.confidence * 100).toFixed(0)}%`;
        })()
        : undefined;
    return (_jsxs("div", { className: "space-y-4", children: [popup && (_jsx("div", { className: "fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm", onClick: () => setPopup(null), children: _jsxs("div", { className: "bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden border-2 border-tut-red/40", onClick: e => e.stopPropagation(), children: [_jsxs("div", { className: "bg-tut-red px-5 py-4 flex items-center justify-between", children: [_jsxs("div", { className: "flex items-center gap-3", children: [_jsx(ShieldAlert, { size: 22, className: "text-white" }), _jsxs("div", { children: [_jsx("p", { className: "text-white font-bold text-base leading-tight", children: "INTRUDER DETECTED" }), _jsx("p", { className: "text-white/70 text-xs mt-0.5", children: new Date(popup.timestamp).toLocaleTimeString() })] })] }), _jsx("button", { onClick: () => setPopup(null), className: "text-white/70 hover:text-white p-1.5 rounded-lg hover:bg-white/10 transition-colors", children: _jsx(X, { size: 18 }) })] }), popup.frameUrl ? (_jsx("div", { className: "bg-gray-950", children: _jsx("img", { src: popup.frameUrl, alt: "Intruder", className: "w-full max-h-64 object-contain" }) })) : (_jsx("div", { className: "bg-gray-950 h-32 flex items-center justify-center", children: _jsx("p", { className: "text-gray-500 text-sm", children: "No image captured" }) })), _jsxs("div", { className: "px-5 py-4 space-y-3", children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsx("span", { className: "text-gray-500 text-sm", children: "Person" }), _jsx("span", { className: "text-tut-red font-semibold text-sm", children: "Unknown \u2014 Not enrolled" })] }), _jsxs("div", { className: "flex items-center justify-between", children: [_jsx("span", { className: "text-gray-500 text-sm", children: "Confidence" }), _jsxs("div", { className: "flex items-center gap-2", children: [_jsx("div", { className: "w-24 bg-gray-100 rounded-full h-1.5", children: _jsx("div", { className: "h-1.5 rounded-full bg-tut-red", style: { width: `${(popup.confidence * 100).toFixed(0)}%` } }) }), _jsxs("span", { className: "text-tut-red font-bold text-sm tabular-nums", children: [(popup.confidence * 100).toFixed(0), "%"] })] })] }), _jsxs("div", { className: "flex items-center justify-between", children: [_jsx("span", { className: "text-gray-500 text-sm", children: "Alert saved" }), _jsx("span", { className: "text-green-600 text-sm font-medium", children: "\u2713 Recorded" })] })] }), _jsx("div", { className: "px-5 pb-5", children: _jsx("button", { onClick: () => setPopup(null), className: "w-full bg-tut-red hover:bg-red-700 text-white font-semibold py-2.5 rounded-xl text-sm transition-colors", children: "Dismiss" }) })] }) })), intruderAlert && (_jsxs("div", { className: "flex items-center gap-3 bg-tut-red text-white text-sm font-semibold px-4 py-3 rounded-xl shadow-lg animate-pulse", children: [_jsx(AlertTriangle, { size: 18 }), "UNKNOWN INTRUDER DETECTED \u2014 Alert sent"] })), _jsx(CameraView, { ref: cameraRef, active: isRunning, overlayLabel: overlayLabel, overlayColor: detection ? detectionBadge(detection.type) : undefined }), _jsxs("div", { className: "flex items-start gap-4 flex-wrap", children: [_jsx("div", { className: "flex items-center gap-3", children: isRunning ? (_jsxs(_Fragment, { children: [_jsxs("div", { className: "flex items-center gap-2 text-xs text-tut-blue font-medium bg-tut-blue/10 border border-tut-blue/20 px-3 py-2 rounded-lg", children: [_jsx(Loader2, { size: 13, className: "animate-spin" }), "Detecting \u2014 every 2 s"] }), _jsxs("button", { onClick: () => { setIsRunning(false); setDetection(null); setIntruderAlert(false); }, className: "flex items-center gap-2 bg-tut-red/10 hover:bg-tut-red/20 border border-tut-red/20 text-tut-red font-semibold text-sm px-4 py-2 rounded-lg transition-colors", children: [_jsx(Square, { size: 13 }), "Stop"] })] })) : (_jsxs("button", { onClick: () => setIsRunning(true), className: "flex items-center gap-2 bg-tut-blue hover:bg-[#004a80] text-white font-semibold text-sm px-5 py-2.5 rounded-lg transition-colors shadow-sm", children: [_jsx(CameraOff, { size: 16 }), "Restart Detection"] })) }), detection && (_jsxs("div", { className: `flex items-center gap-3 border rounded-xl px-4 py-2 flex-1 min-w-0 ${intruderAlert ? 'bg-tut-red/5 border-tut-red/20' : 'bg-slate-50 border-gray-200'}`, children: [_jsxs("div", { className: "shrink-0", children: [_jsx("p", { className: "text-gray-400 text-[10px] uppercase tracking-wide font-semibold mb-0.5", children: "Status" }), _jsx("span", { className: `inline-block px-2.5 py-0.5 rounded-md border text-xs font-semibold capitalize ${detectionBadge(detection.type)}`, children: intruderAlert ? 'Unknown Intruder' : detection.detected_name ?? detection.type })] }), _jsxs("div", { className: "flex-1 min-w-0", children: [_jsx("p", { className: "text-gray-400 text-[10px] uppercase tracking-wide font-semibold mb-1", children: "Confidence" }), _jsxs("div", { className: "flex items-center gap-2", children: [_jsx("div", { className: "flex-1 bg-gray-200 rounded-full h-1.5", children: _jsx("div", { className: `h-1.5 rounded-full ${intruderAlert ? 'bg-tut-red' : 'bg-tut-blue'}`, style: { width: `${(detection.confidence * 100).toFixed(0)}%` } }) }), _jsxs("span", { className: "text-tut-teal text-xs font-bold tabular-nums shrink-0", children: [(detection.confidence * 100).toFixed(1), "%"] })] })] }), _jsxs("div", { className: "shrink-0", children: [_jsx("p", { className: "text-gray-400 text-[10px] uppercase tracking-wide font-semibold mb-0.5", children: "Source" }), _jsx("p", { className: "text-tut-teal font-semibold text-xs capitalize", children: detection.source })] })] }))] })] }));
}
