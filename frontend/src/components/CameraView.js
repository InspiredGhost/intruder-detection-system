import { jsx as _jsx, Fragment as _Fragment, jsxs as _jsxs } from "react/jsx-runtime";
import axios from 'axios';
import { CameraOff, Loader2 } from 'lucide-react';
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { useCameraContext } from './CameraContext';
function authHeaders() {
    const token = localStorage.getItem('token');
    return token ? { Authorization: `Bearer ${token}` } : {};
}
function drawBoxes(canvas, boxes) {
    const ctx = canvas.getContext('2d');
    if (!ctx)
        return;
    // Match canvas resolution to its CSS display size
    const { width, height } = canvas.getBoundingClientRect();
    canvas.width = width;
    canvas.height = height;
    ctx.clearRect(0, 0, width, height);
    for (const box of boxes) {
        const x = box.x1 * width;
        const y = box.y1 * height;
        const w = (box.x2 - box.x1) * width;
        const h = (box.y2 - box.y1) * height;
        // Box stroke
        ctx.strokeStyle = box.color;
        ctx.lineWidth = 2;
        ctx.strokeRect(x, y, w, h);
        // Label pill background
        const label = `${box.label} ${(box.confidence * 100).toFixed(0)}%`;
        ctx.font = 'bold 11px system-ui, sans-serif';
        const textW = ctx.measureText(label).width + 8;
        const pillH = 18;
        const pillY = y > pillH + 2 ? y - pillH - 2 : y + 2;
        ctx.fillStyle = box.color;
        ctx.beginPath();
        ctx.roundRect(x, pillY, textW, pillH, 4);
        ctx.fill();
        // Label text
        ctx.fillStyle = '#fff';
        ctx.fillText(label, x + 4, pillY + 13);
    }
}
const CameraView = forwardRef(({ active = false, autoStart = false, overlayLabel, overlayColor }, ref) => {
    const { selectedDeviceId } = useCameraContext();
    const videoRef = useRef(null);
    const canvasRef = useRef(null); // frame capture (hidden)
    const boxCanvasRef = useRef(null); // bounding box overlay
    const streamRef = useRef(null);
    const [live, setLive] = useState(false);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    useImperativeHandle(ref, () => ({
        captureFrame() {
            const video = videoRef.current;
            const canvas = canvasRef.current;
            if (!video || !canvas || video.readyState < 2)
                return null;
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            canvas.getContext('2d')?.drawImage(video, 0, 0);
            return canvas.toDataURL('image/jpeg', 0.7).split(',')[1];
        },
    }));
    const shouldRun = autoStart || active;
    // Start / stop camera stream
    useEffect(() => {
        if (!shouldRun) {
            streamRef.current?.getTracks().forEach(t => t.stop());
            streamRef.current = null;
            if (videoRef.current)
                videoRef.current.srcObject = null;
            setLive(false);
            // Clear boxes
            const bc = boxCanvasRef.current;
            if (bc)
                bc.getContext('2d')?.clearRect(0, 0, bc.width, bc.height);
            return;
        }
        let cancelled = false;
        setLoading(true);
        setError('');
        const constraints = {
            video: selectedDeviceId ? { deviceId: { exact: selectedDeviceId } } : true,
            audio: false,
        };
        navigator.mediaDevices.getUserMedia(constraints)
            .then(stream => {
            if (cancelled) {
                stream.getTracks().forEach(t => t.stop());
                return;
            }
            streamRef.current = stream;
            if (videoRef.current)
                videoRef.current.srcObject = stream;
            setLive(true);
            setLoading(false);
        })
            .catch(() => {
            if (!cancelled) {
                setError('Camera access denied.');
                setLoading(false);
            }
        });
        return () => {
            cancelled = true;
            streamRef.current?.getTracks().forEach(t => t.stop());
            streamRef.current = null;
            setLive(false);
        };
    }, [shouldRun, selectedDeviceId]);
    // Bounding-box detection loop — runs every 1.5 s while live
    useEffect(() => {
        if (!live)
            return;
        async function detect() {
            const video = videoRef.current;
            const canvas = canvasRef.current;
            const bc = boxCanvasRef.current;
            if (!video || !canvas || !bc || video.readyState < 2)
                return;
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            canvas.getContext('2d')?.drawImage(video, 0, 0);
            const base64 = canvas.toDataURL('image/jpeg', 0.6).split(',')[1];
            try {
                const { data } = await axios.post('/webcam/boxes', { frame_b64: base64 }, { headers: authHeaders() });
                drawBoxes(bc, data.boxes);
            }
            catch { /* ignore — keep previous boxes */ }
        }
        detect(); // run immediately on mount
        const id = setInterval(detect, 1500);
        return () => clearInterval(id);
    }, [live]);
    return (_jsxs("div", { className: "w-full max-w-[260px] aspect-square bg-gray-950 rounded-xl overflow-hidden border border-gray-800 relative flex items-center justify-center", children: [!live && (_jsx("div", { className: "flex flex-col items-center gap-2 text-gray-600 p-4 text-center", children: loading ? (_jsxs(_Fragment, { children: [_jsx(Loader2, { size: 28, className: "opacity-40 animate-spin" }), _jsx("p", { className: "text-xs", children: "Starting camera\u2026" })] })) : error ? (_jsxs(_Fragment, { children: [_jsx(CameraOff, { size: 28, className: "text-red-500/60" }), _jsx("p", { className: "text-xs text-red-400", children: error })] })) : (_jsxs(_Fragment, { children: [_jsx(CameraOff, { size: 28, className: "opacity-40" }), _jsx("p", { className: "text-xs", children: "Camera not started" })] })) })), _jsx("video", { ref: videoRef, autoPlay: true, playsInline: true, muted: true, className: `w-full h-full object-cover ${live ? '' : 'hidden'}` }), _jsx("canvas", { ref: boxCanvasRef, className: "absolute inset-0 w-full h-full pointer-events-none" }), _jsx("canvas", { ref: canvasRef, className: "hidden" }), overlayLabel && live && (_jsx("div", { className: `absolute bottom-2 left-2 px-2.5 py-1 rounded-lg border text-xs font-semibold backdrop-blur-sm ${overlayColor}`, children: overlayLabel }))] }));
});
CameraView.displayName = 'CameraView';
export default CameraView;
