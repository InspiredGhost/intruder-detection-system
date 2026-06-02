import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import axios from 'axios';
import { Camera, Plus, Trash2, Wifi, WifiOff } from 'lucide-react';
import { useEffect, useState } from 'react';
function authHeaders() {
    const token = localStorage.getItem('token');
    return token ? { Authorization: `Bearer ${token}` } : {};
}
function isHttpStream(url) {
    return url.startsWith('http://') || url.startsWith('https://');
}
export default function CctvManager() {
    const [cameras, setCameras] = useState([]);
    const [name, setName] = useState('');
    const [url, setUrl] = useState('');
    const [adding, setAdding] = useState(false);
    const [error, setError] = useState('');
    const [showForm, setShowForm] = useState(false);
    useEffect(() => {
        axios.get('/cameras', { headers: authHeaders() })
            .then(r => setCameras(Array.isArray(r.data) ? r.data : []))
            .catch(() => { });
    }, []);
    async function addCamera() {
        if (!name.trim() || !url.trim())
            return;
        setAdding(true);
        setError('');
        try {
            const { data } = await axios.post('/cameras', { name, url }, { headers: authHeaders() });
            setCameras(prev => [...prev, data]);
            setName('');
            setUrl('');
            setShowForm(false);
        }
        catch {
            setError('Failed to add camera.');
        }
        finally {
            setAdding(false);
        }
    }
    async function deleteCamera(id) {
        try {
            await axios.delete(`/cameras/${id}`, { headers: authHeaders() });
            setCameras(prev => prev.filter(c => c.id !== id));
        }
        catch {
            // ignore
        }
    }
    return (_jsxs("div", { className: "space-y-4", children: [!showForm ? (_jsxs("button", { onClick: () => setShowForm(true), className: "flex items-center gap-2 bg-cyan-500 hover:bg-cyan-400 text-gray-950 font-semibold text-sm px-5 py-2.5 rounded-lg transition-colors", children: [_jsx(Plus, { size: 16 }), "Add CCTV Camera"] })) : (_jsxs("div", { className: "bg-gray-900 border border-gray-800 rounded-xl p-4 space-y-3", children: [_jsx("p", { className: "text-white font-medium text-sm", children: "New Camera" }), _jsxs("div", { className: "grid grid-cols-2 gap-3", children: [_jsxs("div", { children: [_jsx("label", { className: "text-xs text-gray-500 mb-1 block", children: "Camera Name" }), _jsx("input", { value: name, onChange: e => setName(e.target.value), placeholder: "Front Gate", className: "w-full bg-gray-800 border border-gray-700 text-white text-sm rounded-lg px-3 py-2 outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/20" })] }), _jsxs("div", { children: [_jsx("label", { className: "text-xs text-gray-500 mb-1 block", children: "Stream URL" }), _jsx("input", { value: url, onChange: e => setUrl(e.target.value), placeholder: "http://192.168.1.x/stream or rtsp://...", className: "w-full bg-gray-800 border border-gray-700 text-white text-sm rounded-lg px-3 py-2 outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/20" })] })] }), error && _jsx("p", { className: "text-red-400 text-xs", children: error }), _jsxs("div", { className: "flex gap-2", children: [_jsx("button", { onClick: addCamera, disabled: adding || !name.trim() || !url.trim(), className: "bg-cyan-500 hover:bg-cyan-400 disabled:opacity-50 text-gray-950 font-semibold text-sm px-4 py-2 rounded-lg transition-colors", children: adding ? 'Adding…' : 'Add Camera' }), _jsx("button", { onClick: () => { setShowForm(false); setError(''); }, className: "text-gray-400 hover:text-white text-sm px-4 py-2 rounded-lg hover:bg-gray-800 transition-colors", children: "Cancel" })] })] })), cameras.length === 0 ? (_jsxs("div", { className: "flex flex-col items-center gap-3 py-14 text-gray-600", children: [_jsx(Camera, { size: 40, className: "opacity-40" }), _jsx("p", { className: "text-sm", children: "No cameras registered yet." }), _jsx("p", { className: "text-xs text-gray-700", children: "Add an HTTP MJPEG or RTSP stream URL above." })] })) : (_jsx("div", { className: "grid grid-cols-1 sm:grid-cols-2 gap-4", children: cameras.map(cam => (_jsxs("div", { className: "bg-gray-900 border border-gray-800 rounded-xl overflow-hidden", children: [_jsxs("div", { className: "aspect-video bg-gray-950 flex items-center justify-center relative", children: [isHttpStream(cam.url) ? (_jsx("img", { src: cam.url, alt: cam.name, className: "w-full h-full object-cover", onError: e => { e.target.style.display = 'none'; } })) : (_jsxs("div", { className: "flex flex-col items-center gap-2 text-gray-600", children: [_jsx(WifiOff, { size: 32, className: "opacity-40" }), _jsx("p", { className: "text-xs text-center px-4", children: "RTSP stream \u2014 use the detector client to connect" })] })), _jsxs("div", { className: "absolute top-2 right-2 flex items-center gap-1.5 bg-gray-900/80 rounded-full px-2 py-1 text-xs", children: [_jsx(Wifi, { size: 10, className: "text-green-400" }), _jsx("span", { className: "text-gray-400", children: "Active" })] })] }), _jsxs("div", { className: "px-4 py-3 flex items-center justify-between", children: [_jsxs("div", { className: "min-w-0", children: [_jsx("p", { className: "text-white text-sm font-medium truncate", children: cam.name }), _jsx("p", { className: "text-gray-600 text-xs truncate mt-0.5", children: cam.url })] }), _jsx("button", { onClick: () => deleteCamera(cam.id), className: "shrink-0 ml-3 text-gray-600 hover:text-red-400 transition-colors p-1.5 rounded-lg hover:bg-red-500/10", children: _jsx(Trash2, { size: 14 }) })] })] }, cam.id))) }))] }));
}
