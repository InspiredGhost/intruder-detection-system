import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import axios from 'axios';
import { Cpu, Mic, RefreshCw, Save, Video } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
function authHeaders() {
    const token = localStorage.getItem('token');
    return token ? { Authorization: `Bearer ${token}` } : {};
}
export default function DeviceSelector() {
    const [devices, setDevices] = useState(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [camera, setCamera] = useState(0);
    const [audioDevice, setAudioDevice] = useState(4);
    const [saved, setSaved] = useState(false);
    const [error, setError] = useState('');
    const load = useCallback(async () => {
        setLoading(true);
        try {
            const { data } = await axios.get('/devices', { headers: authHeaders() });
            setDevices(data);
            setCamera(data.current.camera_index);
            setAudioDevice(data.current.audio_device);
            setError('');
        }
        catch {
            setError('Could not load devices.');
        }
        finally {
            setLoading(false);
        }
    }, []);
    useEffect(() => { load(); }, [load]);
    const save = async () => {
        setSaving(true);
        setSaved(false);
        try {
            await axios.post('/devices/config', { camera_index: camera, audio_device: audioDevice }, { headers: authHeaders() });
            setSaved(true);
            setTimeout(() => setSaved(false), 6000);
        }
        catch {
            setError('Failed to save config.');
        }
        finally {
            setSaving(false);
        }
    };
    if (loading)
        return _jsx("p", { className: "text-gray-400 text-sm py-4", children: "Scanning for devices\u2026" });
    return (_jsxs("div", { className: "space-y-5", children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsxs("div", { children: [_jsx("h2", { className: "text-tut-teal font-semibold text-sm", children: "Device Configuration" }), _jsx("p", { className: "text-gray-400 text-xs mt-0.5", children: "Select the camera and microphone used by the detection system" })] }), _jsx("button", { onClick: load, className: "text-gray-400 hover:text-tut-blue p-1.5 rounded-lg hover:bg-tut-blue/10 transition-colors", title: "Refresh device list", children: _jsx(RefreshCw, { size: 14 }) })] }), error && (_jsx("p", { className: "text-tut-red text-xs bg-tut-red/5 border border-tut-red/20 rounded-lg px-3 py-2", children: error })), _jsxs("div", { className: "grid grid-cols-1 md:grid-cols-2 gap-4", children: [_jsxs("div", { className: "bg-slate-50 border border-gray-200 rounded-xl p-4 space-y-3", children: [_jsxs("div", { className: "flex items-center gap-2 text-tut-blue", children: [_jsx(Video, { size: 16 }), _jsx("span", { className: "text-sm font-semibold text-tut-teal", children: "Camera" })] }), (devices?.cameras.length ?? 0) === 0 ? (_jsx("p", { className: "text-gray-400 text-xs", children: "No cameras found" })) : (_jsx("select", { value: camera, onChange: e => setCamera(Number(e.target.value)), className: "w-full bg-white border border-gray-200 text-tut-teal text-sm rounded-lg px-3 py-2 outline-none focus:border-tut-blue shadow-sm", children: devices?.cameras.map(c => (_jsx("option", { value: c.index, children: c.name }, c.index))) })), _jsxs("p", { className: "text-gray-400 text-xs flex items-center gap-1", children: [_jsx(Cpu, { size: 11 }), "Active: Camera ", camera] })] }), _jsxs("div", { className: "bg-slate-50 border border-gray-200 rounded-xl p-4 space-y-3", children: [_jsxs("div", { className: "flex items-center gap-2", children: [_jsx(Mic, { size: 16, className: "text-tut-gold" }), _jsx("span", { className: "text-sm font-semibold text-tut-teal", children: "Microphone" })] }), (devices?.microphones.length ?? 0) === 0 ? (_jsx("p", { className: "text-gray-400 text-xs", children: "No microphones found" })) : (_jsx("select", { value: audioDevice, onChange: e => setAudioDevice(Number(e.target.value)), className: "w-full bg-white border border-gray-200 text-tut-teal text-sm rounded-lg px-3 py-2 outline-none focus:border-tut-blue shadow-sm", children: devices?.microphones.map(m => (_jsx("option", { value: m.index, children: m.name }, m.index))) })), _jsxs("p", { className: "text-gray-400 text-xs flex items-center gap-1", children: [_jsx(Cpu, { size: 11 }), "Active: Device ", audioDevice] })] })] }), _jsxs("div", { className: "flex items-center gap-3 flex-wrap", children: [_jsxs("button", { onClick: save, disabled: saving, className: "flex items-center gap-2 bg-tut-blue hover:bg-[#004a80] disabled:opacity-50 text-white font-semibold px-4 py-2 rounded-lg text-sm transition-colors shadow-sm", children: [_jsx(Save, { size: 14 }), saving ? 'Saving…' : 'Save & Apply'] }), saved && (_jsxs("p", { className: "text-tut-teal text-xs bg-tut-gold/10 border border-tut-gold/30 rounded-lg px-3 py-2", children: ["Saved \u2014 restart the system (", _jsx("code", { className: "font-mono", children: "Ctrl+C" }), " then ", _jsx("code", { className: "font-mono", children: "python start.py" }), ") to apply"] }))] })] }));
}
