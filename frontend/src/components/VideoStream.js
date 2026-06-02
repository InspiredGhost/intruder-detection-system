import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { CameraOff, RefreshCw } from 'lucide-react';
import { useState } from 'react';
export default function VideoStream() {
    const [offline, setOffline] = useState(false);
    const [key, setKey] = useState(0);
    const token = localStorage.getItem('token') ?? '';
    const streamUrl = `/stream?token=${encodeURIComponent(token)}`;
    return (_jsx("div", { className: "w-full aspect-square bg-gray-950 rounded-xl overflow-hidden border border-gray-800 flex items-center justify-center", children: offline ? (_jsxs("div", { className: "text-center text-gray-600 space-y-3 p-6", children: [_jsx(CameraOff, { className: "mx-auto opacity-40", size: 36 }), _jsxs("div", { children: [_jsx("p", { className: "text-sm font-medium", children: "Live feed unavailable" }), _jsx("p", { className: "text-xs opacity-60 mt-0.5", children: "Start intruder_detection.py to enable stream" })] }), _jsxs("button", { onClick: () => { setOffline(false); setKey(k => k + 1); }, className: "flex items-center gap-1.5 mx-auto text-xs text-cyan-400 hover:text-cyan-300 transition-colors", children: [_jsx(RefreshCw, { size: 12 }), "Retry"] })] })) : (_jsx("img", { src: streamUrl, alt: "Live feed", className: "w-full h-full object-cover", onError: () => setOffline(true) }, key)) }));
}
