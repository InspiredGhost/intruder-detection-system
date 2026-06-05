import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import axios from 'axios';
import { Filter, RefreshCw, Trash2, X } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
function authHeaders() {
    const token = localStorage.getItem('token');
    return token ? { Authorization: `Bearer ${token}` } : {};
}
function formatDateTime(iso) {
    try {
        return new Date(iso).toLocaleString();
    }
    catch {
        return iso;
    }
}
const SOURCE_LABEL = {
    audio: 'Audio',
    video: 'Video',
    both: 'Audio+Video',
};
const TYPE_BADGE = {
    normal: 'bg-green-50   text-green-700  border-green-200',
    normalvideos: 'bg-green-50   text-green-700  border-green-200',
    gunshot: 'bg-tut-red/10 text-tut-red    border-tut-red/20',
};
function typeBadge(t) {
    return TYPE_BADGE[t.toLowerCase()] ?? 'bg-tut-gold/10 text-tut-teal border-tut-gold/30';
}
const SOURCE_BADGE = {
    audio: 'bg-tut-gold/10 text-tut-teal  border-tut-gold/30',
    video: 'bg-tut-blue/10 text-tut-blue  border-tut-blue/20',
    both: 'bg-tut-red/10  text-tut-red   border-tut-red/20',
};
export default function AlertsPage() {
    const [alerts, setAlerts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [clearing, setClearing] = useState(false);
    const [error, setError] = useState('');
    const [typeFilter, setTypeFilter] = useState('all');
    const [sourceFilter, setSourceFilter] = useState('all');
    const [selectedAlert, setSelectedAlert] = useState(null);
    const navigate = useNavigate();
    const token = localStorage.getItem('token') ?? '';
    const fetchAlerts = useCallback(async () => {
        setLoading(true);
        try {
            const { data } = await axios.get('/alerts?limit=200', { headers: authHeaders() });
            setAlerts(data);
            setError('');
        }
        catch (err) {
            if (axios.isAxiosError(err) && err.response?.status === 401) {
                localStorage.removeItem('token');
                navigate('/login');
            }
            else {
                setError('Could not load alerts.');
            }
        }
        finally {
            setLoading(false);
        }
    }, [navigate]);
    useEffect(() => { fetchAlerts(); }, [fetchAlerts]);
    const clearAlerts = async () => {
        if (!window.confirm('Delete ALL alerts and saved media files? This cannot be undone.'))
            return;
        setClearing(true);
        try {
            await axios.delete('/alerts', { headers: authHeaders() });
            setAlerts([]);
            setError('');
        }
        catch {
            setError('Failed to clear alerts.');
        }
        finally {
            setClearing(false);
        }
    };
    const allTypes = Array.from(new Set(alerts.map(a => a.type)));
    const allSources = Array.from(new Set(alerts.map(a => a.source)));
    const filtered = alerts.filter(a => (typeFilter === 'all' || a.type === typeFilter) &&
        (sourceFilter === 'all' || a.source === sourceFilter));
    const threatCount = filtered.filter(a => !['normal', 'normalvideos'].includes(a.type.toLowerCase())).length;
    const avgConf = filtered.length > 0
        ? (filtered.reduce((s, a) => s + a.confidence, 0) / filtered.length * 100).toFixed(0)
        : '0';
    return (_jsxs("div", { className: "p-6 space-y-6", children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsxs("div", { children: [_jsx("h1", { className: "text-xl font-bold text-tut-teal", children: "Alerts" }), _jsx("p", { className: "text-gray-400 text-sm mt-0.5", children: "Full detection history" })] }), _jsxs("div", { className: "flex items-center gap-2", children: [_jsxs("button", { onClick: fetchAlerts, disabled: loading, className: "flex items-center gap-2 text-sm text-gray-500 hover:text-tut-blue bg-white hover:bg-slate-50 border border-gray-200 px-3.5 py-2 rounded-lg transition-colors shadow-sm", children: [_jsx(RefreshCw, { size: 14, className: loading ? 'animate-spin' : '' }), "Refresh"] }), _jsxs("button", { onClick: clearAlerts, disabled: clearing || alerts.length === 0, className: "flex items-center gap-2 text-sm text-tut-red hover:text-white bg-white hover:bg-tut-red border border-tut-red/30 hover:border-tut-red px-3.5 py-2 rounded-lg transition-colors shadow-sm disabled:opacity-40 disabled:cursor-not-allowed", children: [_jsx(Trash2, { size: 14 }), clearing ? 'Clearing…' : 'Clear All'] })] })] }), error && (_jsx("div", { className: "text-tut-red text-sm bg-tut-red/5 border border-tut-red/20 rounded-xl px-4 py-3", children: error })), _jsxs("div", { className: "grid grid-cols-3 gap-4", children: [_jsxs("div", { className: "bg-white border border-gray-200 rounded-xl p-4 text-center shadow-sm", children: [_jsx("p", { className: "text-2xl font-bold text-tut-blue", children: filtered.length }), _jsx("p", { className: "text-gray-400 text-xs mt-1 font-medium uppercase tracking-wide", children: "Total (filtered)" })] }), _jsxs("div", { className: "bg-white border border-gray-200 rounded-xl p-4 text-center shadow-sm", children: [_jsx("p", { className: `text-2xl font-bold ${threatCount > 0 ? 'text-tut-red' : 'text-green-600'}`, children: threatCount }), _jsx("p", { className: "text-gray-400 text-xs mt-1 font-medium uppercase tracking-wide", children: "Threats" })] }), _jsxs("div", { className: "bg-white border border-gray-200 rounded-xl p-4 text-center shadow-sm", children: [_jsxs("p", { className: "text-2xl font-bold text-tut-teal", children: [avgConf, "%"] }), _jsx("p", { className: "text-gray-400 text-xs mt-1 font-medium uppercase tracking-wide", children: "Avg Confidence" })] })] }), _jsxs("div", { className: "flex items-center gap-3 flex-wrap", children: [_jsxs("div", { className: "flex items-center gap-2 text-gray-400 text-sm font-medium", children: [_jsx(Filter, { size: 14 }), "Filters:"] }), _jsxs("select", { value: typeFilter, onChange: e => setTypeFilter(e.target.value), className: "bg-white border border-gray-200 text-tut-teal text-sm rounded-lg px-3 py-2 outline-none focus:border-tut-blue shadow-sm", children: [_jsx("option", { value: "all", children: "All Types" }), allTypes.map(t => _jsx("option", { value: t, children: t }, t))] }), _jsxs("select", { value: sourceFilter, onChange: e => setSourceFilter(e.target.value), className: "bg-white border border-gray-200 text-tut-teal text-sm rounded-lg px-3 py-2 outline-none focus:border-tut-blue shadow-sm", children: [_jsx("option", { value: "all", children: "All Sources" }), allSources.map(s => _jsx("option", { value: s, children: SOURCE_LABEL[s] ?? s }, s))] })] }), _jsx("div", { className: "bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm", children: _jsxs("table", { className: "w-full text-sm", children: [_jsx("thead", { children: _jsxs("tr", { className: "border-b border-gray-100 bg-slate-50 text-gray-400 text-xs uppercase tracking-wider", children: [_jsx("th", { className: "text-left px-5 py-3.5 font-semibold", children: "Type" }), _jsx("th", { className: "text-left px-5 py-3.5 font-semibold", children: "Person" }), _jsx("th", { className: "text-left px-5 py-3.5 font-semibold", children: "Source" }), _jsx("th", { className: "text-left px-5 py-3.5 font-semibold", children: "Confidence" }), _jsx("th", { className: "text-left px-5 py-3.5 font-semibold", children: "Timestamp" })] }) }), _jsxs("tbody", { children: [loading && (_jsx("tr", { children: _jsx("td", { colSpan: 5, className: "text-center text-gray-400 py-12", children: "Loading\u2026" }) })), !loading && filtered.length === 0 && (_jsx("tr", { children: _jsx("td", { colSpan: 5, className: "text-center text-gray-400 py-12", children: "No alerts match the current filters." }) })), filtered.map((a, i) => (_jsxs("tr", { onClick: () => setSelectedAlert(a), className: `border-b border-gray-100 hover:bg-tut-blue/5 transition-colors cursor-pointer ${i === filtered.length - 1 ? 'border-b-0' : ''}`, children: [_jsx("td", { className: "px-5 py-3", children: _jsx("span", { className: `inline-block px-2.5 py-0.5 rounded-md border text-xs font-semibold capitalize ${typeBadge(a.type)}`, children: a.type }) }), _jsx("td", { className: "px-5 py-3", children: a.detected_name ? (_jsx("span", { className: `inline-block px-2.5 py-0.5 rounded-md border text-xs font-semibold ${a.detected_name === 'Unknown'
                                                    ? 'bg-tut-red/10 text-tut-red border-tut-red/20'
                                                    : 'bg-green-50 text-green-700 border-green-200'}`, children: a.detected_name })) : (_jsx("span", { className: "text-gray-300 text-xs", children: "\u2014" })) }), _jsx("td", { className: "px-5 py-3", children: _jsx("span", { className: `inline-block px-2.5 py-0.5 rounded-md border text-xs font-medium ${SOURCE_BADGE[a.source] ?? 'bg-gray-50 text-gray-500 border-gray-200'}`, children: SOURCE_LABEL[a.source] ?? a.source }) }), _jsx("td", { className: "px-5 py-3", children: _jsxs("div", { className: "flex items-center gap-2", children: [_jsx("div", { className: "w-20 bg-gray-100 rounded-full h-1.5", children: _jsx("div", { className: "h-1.5 rounded-full bg-tut-blue", style: { width: `${(a.confidence * 100).toFixed(0)}%` } }) }), _jsxs("span", { className: "text-gray-500 tabular-nums text-xs font-medium", children: [(a.confidence * 100).toFixed(1), "%"] })] }) }), _jsx("td", { className: "px-5 py-3 text-gray-400 tabular-nums text-xs", children: formatDateTime(a.timestamp) })] }, a.id)))] })] }) }), selectedAlert !== null && (_jsx("div", { className: "fixed inset-0 bg-tut-teal/30 backdrop-blur-sm flex items-center justify-center z-50", onClick: () => setSelectedAlert(null), children: _jsxs("div", { className: "bg-white rounded-2xl shadow-2xl p-6 max-w-2xl w-full mx-4 border border-gray-200", onClick: e => e.stopPropagation(), children: [_jsxs("div", { className: "flex items-center justify-between mb-4 pb-3 border-b border-gray-100", children: [_jsx("h2", { className: "text-tut-teal font-bold text-base", children: "Alert Detail" }), _jsx("button", { onClick: () => setSelectedAlert(null), className: "text-gray-400 hover:text-tut-teal p-1.5 rounded-lg hover:bg-slate-100 transition-colors", children: _jsx(X, { size: 16 }) })] }), _jsx("p", { className: "text-gray-400 text-xs mb-4", children: formatDateTime(selectedAlert.timestamp) }), _jsxs("div", { className: "flex items-center gap-2 mb-4 flex-wrap", children: [_jsx("span", { className: `inline-block px-2.5 py-0.5 rounded-md border text-xs font-semibold capitalize ${typeBadge(selectedAlert.type)}`, children: selectedAlert.type }), _jsx("span", { className: `inline-block px-2.5 py-0.5 rounded-md border text-xs font-medium ${SOURCE_BADGE[selectedAlert.source] ?? 'bg-gray-50 text-gray-500 border-gray-200'}`, children: SOURCE_LABEL[selectedAlert.source] ?? selectedAlert.source }), selectedAlert.detected_name && (_jsx("span", { className: `inline-block px-2.5 py-0.5 rounded-md border text-xs font-semibold ${selectedAlert.detected_name === 'Unknown'
                                        ? 'bg-tut-red/10 text-tut-red border-tut-red/20'
                                        : 'bg-green-50 text-green-700 border-green-200'}`, children: selectedAlert.detected_name === 'Unknown' ? 'Unknown Intruder' : selectedAlert.detected_name }))] }), _jsxs("div", { className: "mb-4", children: [_jsxs("div", { className: "flex items-center justify-between mb-1.5", children: [_jsx("span", { className: "text-gray-400 text-xs font-medium", children: "Confidence" }), _jsxs("span", { className: "text-tut-teal text-xs font-bold tabular-nums", children: [(selectedAlert.confidence * 100).toFixed(1), "%"] })] }), _jsx("div", { className: "w-full bg-gray-100 rounded-full h-2", children: _jsx("div", { className: "h-2 rounded-full bg-tut-blue", style: { width: `${(selectedAlert.confidence * 100).toFixed(0)}%` } }) })] }), selectedAlert.frame_file && (_jsxs("div", { className: "mt-2", children: [selectedAlert.detected_name === 'Unknown' && (_jsxs("p", { className: "text-xs font-semibold text-tut-red uppercase tracking-wide mb-1.5 flex items-center gap-1.5", children: [_jsx("span", { className: "w-2 h-2 rounded-full bg-tut-red inline-block" }), "Intruder \u2014 captured photo"] })), _jsx("img", { src: `/alerts/media/${selectedAlert.frame_file}?token=${token}`, className: "w-full rounded-xl max-h-72 object-contain border border-gray-100 bg-gray-50", alt: selectedAlert.detected_name === 'Unknown' ? 'Intruder face' : 'Alert frame' })] })), selectedAlert.audio_file && (_jsxs("div", { className: "mt-4", children: [_jsx("p", { className: "text-gray-400 text-xs font-medium mb-2 uppercase tracking-wide", children: "Recorded audio (5s)" }), _jsx("audio", { controls: true, src: `/alerts/media/${selectedAlert.audio_file}?token=${token}`, className: "w-full" })] })), _jsx("div", { className: "mt-5 flex justify-end", children: _jsx("button", { onClick: () => setSelectedAlert(null), className: "bg-tut-blue hover:bg-[#004a80] text-white font-semibold px-5 py-2 rounded-lg text-sm transition-colors", children: "Close" }) })] }) }))] }));
}
