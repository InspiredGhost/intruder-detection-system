import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import axios from 'axios';
import { CheckCircle, FileVideo, Loader2, UploadCloud, XCircle } from 'lucide-react';
import { useRef, useState } from 'react';
function authHeaders() {
    const token = localStorage.getItem('token');
    return token ? { Authorization: `Bearer ${token}` } : {};
}
const TYPE_COLOR = {
    normal: 'bg-green-500/10 text-green-400 border-green-500/20',
    normalvideos: 'bg-green-500/10 text-green-400 border-green-500/20',
};
function typeColor(type) {
    return TYPE_COLOR[type.toLowerCase()] ?? 'bg-red-500/10 text-red-400 border-red-500/20';
}
export default function UploadVideoDetect() {
    const [file, setFile] = useState(null);
    const [results, setResults] = useState(null);
    const [loading, setLoading] = useState(false);
    const [progress, setProgress] = useState(0);
    const [error, setError] = useState('');
    const [totalFrames, setTotalFrames] = useState(0);
    const inputRef = useRef(null);
    const [dragging, setDragging] = useState(false);
    function handleFile(f) {
        setFile(f);
        setResults(null);
        setError('');
    }
    function onDrop(e) {
        e.preventDefault();
        setDragging(false);
        const f = e.dataTransfer.files[0];
        if (f?.type.startsWith('video/'))
            handleFile(f);
    }
    async function handleUpload() {
        if (!file)
            return;
        setLoading(true);
        setProgress(0);
        setError('');
        const formData = new FormData();
        formData.append('file', file);
        try {
            const { data } = await axios.post('/upload-video', formData, {
                headers: { ...authHeaders(), 'Content-Type': 'multipart/form-data' },
                onUploadProgress: e => setProgress(Math.round(((e.loaded ?? 0) / (e.total ?? 1)) * 100)),
            });
            setResults(data.detections);
            setTotalFrames(data.total_frames);
            if (data.note)
                setError(data.note);
        }
        catch (e) {
            setError(axios.isAxiosError(e) ? (e.response?.data?.detail ?? 'Upload failed') : 'Upload failed');
        }
        finally {
            setLoading(false);
        }
    }
    const threats = results?.filter(d => !['normal', 'normalvideos'].includes(d.type.toLowerCase())) ?? [];
    return (_jsxs("div", { className: "space-y-4", children: [_jsxs("div", { onDrop: onDrop, onDragOver: e => { e.preventDefault(); setDragging(true); }, onDragLeave: () => setDragging(false), onClick: () => inputRef.current?.click(), className: `border-2 border-dashed rounded-xl p-10 flex flex-col items-center gap-3 cursor-pointer transition-colors ${dragging ? 'border-cyan-400 bg-cyan-500/5' : 'border-gray-700 hover:border-gray-600 bg-gray-900/50'}`, children: [_jsx("input", { ref: inputRef, type: "file", accept: "video/*", className: "hidden", onChange: e => e.target.files?.[0] && handleFile(e.target.files[0]) }), file ? (_jsxs(_Fragment, { children: [_jsx(FileVideo, { size: 36, className: "text-cyan-400" }), _jsxs("div", { className: "text-center", children: [_jsx("p", { className: "text-white font-medium text-sm", children: file.name }), _jsxs("p", { className: "text-gray-500 text-xs mt-0.5", children: [(file.size / 1024 / 1024).toFixed(1), " MB"] })] })] })) : (_jsxs(_Fragment, { children: [_jsx(UploadCloud, { size: 36, className: "text-gray-600" }), _jsxs("div", { className: "text-center", children: [_jsx("p", { className: "text-gray-400 text-sm font-medium", children: "Drop a video file here" }), _jsx("p", { className: "text-gray-600 text-xs mt-0.5", children: "or click to browse \u2014 MP4, AVI, MOV, MKV" })] })] }))] }), file && (_jsxs("button", { onClick: handleUpload, disabled: loading, className: "flex items-center gap-2 bg-cyan-500 hover:bg-cyan-400 disabled:opacity-50 text-gray-950 font-semibold text-sm px-6 py-2.5 rounded-lg transition-colors", children: [loading ? _jsx(Loader2, { size: 16, className: "animate-spin" }) : _jsx(UploadCloud, { size: 16 }), loading ? `Uploading… ${progress}%` : 'Upload & Detect'] })), error && (_jsx("p", { className: "text-amber-400 text-sm bg-amber-500/10 border border-amber-500/20 rounded-lg px-4 py-2", children: error })), results && (_jsxs("div", { className: "space-y-3", children: [_jsxs("div", { className: "bg-gray-900 border border-gray-800 rounded-xl p-4", children: [_jsx("p", { className: "text-xs text-gray-500 uppercase tracking-wide mb-3 font-medium", children: "Analysis Summary" }), _jsxs("div", { className: "grid grid-cols-3 gap-4", children: [_jsxs("div", { children: [_jsx("p", { className: "text-gray-600 text-xs mb-1", children: "Frames Scanned" }), _jsx("p", { className: "text-white font-bold text-lg", children: totalFrames })] }), _jsxs("div", { children: [_jsx("p", { className: "text-gray-600 text-xs mb-1", children: "Detections" }), _jsx("p", { className: "text-white font-bold text-lg", children: results.length })] }), _jsxs("div", { children: [_jsx("p", { className: "text-gray-600 text-xs mb-1", children: "Threats Found" }), _jsx("p", { className: `font-bold text-lg ${threats.length > 0 ? 'text-red-400' : 'text-green-400'}`, children: threats.length })] })] })] }), _jsxs("div", { className: "bg-gray-900 border border-gray-800 rounded-xl p-4", children: [_jsxs("p", { className: "text-xs text-gray-500 uppercase tracking-wide mb-3 font-medium", children: ["Detection Timeline (", results.length, " frames)"] }), _jsx("ul", { className: "space-y-1.5 max-h-72 overflow-y-auto pr-1", children: results.map((d, i) => {
                                    const isNormal = ['normal', 'normalvideos'].includes(d.type.toLowerCase());
                                    return (_jsxs("li", { className: "flex items-center gap-3 text-xs", children: [isNormal
                                                ? _jsx(CheckCircle, { size: 14, className: "text-green-500 shrink-0" })
                                                : _jsx(XCircle, { size: 14, className: "text-red-400 shrink-0" }), _jsxs("span", { className: "text-gray-500 tabular-nums w-20 shrink-0", children: ["Frame ", d.frame_index ?? i] }), _jsx("span", { className: `px-2 py-0.5 rounded border text-xs font-medium capitalize ${typeColor(d.type)}`, children: d.type }), _jsxs("span", { className: "text-gray-600 ml-auto tabular-nums", children: [(d.confidence * 100).toFixed(1), "%"] })] }, i));
                                }) })] })] }))] }));
}
