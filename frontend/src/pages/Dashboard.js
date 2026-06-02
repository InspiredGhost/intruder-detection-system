import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import axios from 'axios';
import { Activity, AlertTriangle, Camera, Shield } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AlertTrendChart from '../components/AlertTrendChart';
import AlertTypeChart from '../components/AlertTypeChart';
import SourceChart from '../components/SourceChart';
import StatCard from '../components/StatCard';
import CameraView from '../components/CameraView';
const POLL_INTERVAL_MS = 5000;
function authHeaders() {
    const token = localStorage.getItem('token');
    return token ? { Authorization: `Bearer ${token}` } : {};
}
function buildWsUrl(path) {
    const token = localStorage.getItem('token') ?? '';
    const proto = window.location.protocol === 'https:' ? 'wss' : 'ws';
    return `${proto}://${window.location.host}${path}?token=${encodeURIComponent(token)}`;
}
function formatTime(iso) {
    try {
        return new Date(iso).toLocaleTimeString();
    }
    catch {
        return iso;
    }
}
const TYPE_BADGE = {
    normal: 'bg-green-50   text-green-700  border-green-200',
    normalvideos: 'bg-green-50   text-green-700  border-green-200',
    gunshot: 'bg-tut-red/10 text-tut-red    border-tut-red/20',
};
function typeBadge(t) {
    return TYPE_BADGE[t.toLowerCase()] ?? 'bg-tut-gold/10 text-tut-teal border-tut-gold/30';
}
export default function Dashboard() {
    const [alerts, setAlerts] = useState([]);
    const [stats, setStats] = useState(null);
    const [toast, setToast] = useState(null);
    const [error, setError] = useState('');
    const navigate = useNavigate();
    const intervalRef = useRef(null);
    const wsRef = useRef(null);
    const toastTimer = useRef(null);
    // Stable ref so the WS handler can call fetchData without stale closure
    const fetchDataRef = useRef(() => { });
    const fetchData = useCallback(async () => {
        try {
            const [alertsRes, statsRes] = await Promise.all([
                axios.get('/alerts', { headers: authHeaders() }),
                axios.get('/stats', { headers: authHeaders() }),
            ]);
            setAlerts(alertsRes.data);
            setStats(statsRes.data);
            setError('');
        }
        catch (err) {
            if (axios.isAxiosError(err) && err.response?.status === 401) {
                localStorage.removeItem('token');
                navigate('/login');
            }
            else {
                setError('Could not reach the API.');
            }
        }
    }, [navigate]);
    // Keep the ref up-to-date so the WS handler always calls the latest version
    useEffect(() => { fetchDataRef.current = fetchData; }, [fetchData]);
    useEffect(() => {
        fetchData();
        intervalRef.current = setInterval(fetchData, POLL_INTERVAL_MS);
        return () => { if (intervalRef.current)
            clearInterval(intervalRef.current); };
    }, [fetchData]);
    useEffect(() => {
        let reconnectTimer = null;
        let destroyed = false;
        function connect() {
            if (destroyed)
                return;
            const ws = new WebSocket(buildWsUrl('/ws/alerts'));
            wsRef.current = ws;
            ws.onopen = () => {
                // Clear any pending reconnect when connection succeeds
                if (reconnectTimer) {
                    clearTimeout(reconnectTimer);
                    reconnectTimer = null;
                }
            };
            ws.onmessage = (event) => {
                try {
                    const alert = JSON.parse(event.data);
                    // Prepend new alert instantly — no wait for next poll
                    setAlerts(prev => [alert, ...prev].slice(0, 100));
                    // Also refresh stat counters & chart data straight away
                    fetchDataRef.current();
                    if (!['normal', 'normalvideos'].includes(alert.type.toLowerCase())) {
                        const msg = `${alert.type.toUpperCase()} detected (${(alert.confidence * 100).toFixed(0)}% conf)`;
                        setToast(msg);
                        if (toastTimer.current)
                            clearTimeout(toastTimer.current);
                        toastTimer.current = setTimeout(() => setToast(null), 5000);
                        if (Notification.permission === 'granted')
                            new Notification('SentinelAI Alert', { body: msg });
                    }
                }
                catch { /* ignore malformed frame */ }
            };
            ws.onerror = () => ws.close();
            ws.onclose = () => {
                if (!destroyed)
                    reconnectTimer = setTimeout(connect, 3000);
            };
        }
        if (Notification.permission === 'default')
            Notification.requestPermission();
        connect();
        return () => {
            destroyed = true;
            if (reconnectTimer)
                clearTimeout(reconnectTimer);
            wsRef.current?.close();
        };
    }, []); // stable — fetchDataRef is a ref, not a dep
    const latest = alerts[0] ?? null;
    const isAlert = latest && !['normal', 'normalvideos'].includes(latest.type.toLowerCase());
    const threatsToday = alerts.filter(a => {
        const today = new Date().toDateString();
        return new Date(a.timestamp).toDateString() === today && !['normal', 'normalvideos'].includes(a.type.toLowerCase());
    }).length;
    const detectionRate = alerts.length > 0
        ? Math.round((alerts.filter(a => !['normal', 'normalvideos'].includes(a.type.toLowerCase())).length / alerts.length) * 100)
        : 0;
    return (_jsxs("div", { className: "p-6 space-y-6", children: [toast && (_jsxs("div", { className: "fixed top-5 right-5 z-50 bg-tut-red text-white text-sm font-semibold px-5 py-3 rounded-xl shadow-2xl flex items-center gap-2.5", children: [_jsx(AlertTriangle, { size: 16 }), toast] })), _jsxs("div", { className: "flex items-center justify-between", children: [_jsxs("div", { children: [_jsx("h1", { className: "text-xl font-bold text-tut-teal", children: "Dashboard" }), _jsx("p", { className: "text-gray-400 text-sm mt-0.5", children: "Real-time security monitoring" })] }), _jsxs("div", { className: `flex items-center gap-2.5 px-4 py-2 rounded-xl border text-sm font-semibold ${isAlert
                            ? 'bg-tut-red/10 border-tut-red/30 text-tut-red'
                            : 'bg-green-50 border-green-200 text-green-700'}`, children: [_jsx("span", { className: `w-2 h-2 rounded-full animate-pulse ${isAlert ? 'bg-tut-red' : 'bg-green-500'}` }), isAlert ? `ALERT — ${latest.type.toUpperCase()}` : 'ALL CLEAR'] })] }), error && (_jsx("div", { className: "text-tut-red text-sm bg-tut-red/5 border border-tut-red/20 rounded-xl px-4 py-3", children: error })), _jsxs("div", { className: "grid grid-cols-2 xl:grid-cols-4 gap-4", children: [_jsx(StatCard, { label: "Total Alerts", value: stats?.total ?? alerts.length, icon: Activity, color: "cyan", sub: "All time" }), _jsx(StatCard, { label: "Threats Today", value: threatsToday, icon: AlertTriangle, color: threatsToday > 0 ? 'red' : 'green', sub: "Non-normal events" }), _jsx(StatCard, { label: "Detection Rate", value: `${detectionRate}%`, icon: Shield, color: "amber", sub: "Threats / total alerts" }), _jsx(StatCard, { label: "Cameras Online", value: stats?.cameras_online ?? 0, icon: Camera, color: "cyan", sub: "Registered CCTV" })] }), _jsxs("div", { className: "grid grid-cols-1 lg:grid-cols-3 gap-4", children: [_jsx("div", { className: "lg:col-span-2", children: _jsx(AlertTrendChart, { stats: stats }) }), _jsx(AlertTypeChart, { stats: stats })] }), _jsxs("div", { className: "grid grid-cols-1 lg:grid-cols-3 gap-4", children: [_jsxs("div", { className: "lg:col-span-2 space-y-4", children: [_jsxs("div", { className: "bg-white border border-gray-200 rounded-xl p-4 shadow-sm", children: [_jsxs("div", { className: "flex items-center justify-between mb-3", children: [_jsx("h2", { className: "text-tut-teal font-semibold text-sm", children: "Live Feed" }), _jsxs("span", { className: "flex items-center gap-1.5 text-xs text-green-600 font-medium bg-green-50 border border-green-200 px-2.5 py-1 rounded-full", children: [_jsx("span", { className: "w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" }), "LIVE"] })] }), _jsx(CameraView, { autoStart: true })] }), _jsx(SourceChart, { stats: stats })] }), _jsxs("div", { className: "bg-white border border-gray-200 rounded-xl p-4 shadow-sm flex flex-col", children: [_jsxs("div", { className: "flex items-center justify-between mb-3 pb-3 border-b border-gray-100", children: [_jsx("h2", { className: "text-tut-teal font-semibold text-sm", children: "Recent Alerts" }), _jsxs("span", { className: "text-xs text-gray-400 bg-slate-100 px-2 py-1 rounded-md border border-gray-200", children: [alerts.length, " total"] })] }), _jsxs("ul", { className: "space-y-2 overflow-y-auto flex-1 pr-0.5", style: { maxHeight: 400 }, children: [alerts.length === 0 && (_jsx("p", { className: "text-gray-400 text-sm text-center py-8", children: "No alerts yet." })), alerts.map(a => (_jsxs("li", { className: "flex items-start justify-between gap-2 bg-slate-50 border border-gray-100 rounded-lg px-3 py-2.5 text-xs hover:border-gray-200 transition-colors", children: [_jsxs("div", { className: "space-y-1 min-w-0", children: [_jsx("span", { className: `inline-block px-2 py-0.5 rounded-md border text-xs font-semibold capitalize ${typeBadge(a.type)}`, children: a.type }), _jsxs("p", { className: "text-gray-400 truncate", children: [a.source, " \u2014 ", (a.confidence * 100).toFixed(0), "% conf"] })] }), _jsx("span", { className: "text-gray-400 whitespace-nowrap shrink-0", children: formatTime(a.timestamp) })] }, a.id)))] })] })] })] }));
}
