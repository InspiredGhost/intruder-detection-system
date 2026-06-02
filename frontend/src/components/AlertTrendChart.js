import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
function formatHour(iso) {
    try {
        const [, timePart] = iso.split('T');
        return `${timePart}:00`;
    }
    catch {
        return iso;
    }
}
export default function AlertTrendChart({ stats }) {
    const data = (stats?.hourly_24h ?? []).map(h => ({
        hour: formatHour(h.hour),
        alerts: h.count,
    }));
    return (_jsxs("div", { className: "bg-white border border-gray-200 rounded-xl p-5 shadow-sm", children: [_jsxs("div", { className: "flex items-center justify-between mb-4", children: [_jsxs("div", { children: [_jsx("h3", { className: "text-tut-teal font-semibold text-sm", children: "Alert Trend" }), _jsx("p", { className: "text-gray-400 text-xs mt-0.5", children: "Last 24 hours" })] }), _jsx("span", { className: "text-xs text-gray-500 bg-slate-100 border border-gray-200 px-2.5 py-1 rounded-md font-medium", children: "Hourly" })] }), data.length === 0 ? (_jsx("div", { className: "h-44 flex items-center justify-center text-gray-400 text-sm", children: "No data yet" })) : (_jsx(ResponsiveContainer, { width: "100%", height: 180, children: _jsxs(LineChart, { data: data, margin: { top: 4, right: 8, left: -20, bottom: 0 }, children: [_jsx(CartesianGrid, { strokeDasharray: "3 3", stroke: "#e5e7eb" }), _jsx(XAxis, { dataKey: "hour", tick: { fill: '#9ca3af', fontSize: 11 }, tickLine: false, axisLine: false, interval: "preserveStartEnd" }), _jsx(YAxis, { tick: { fill: '#9ca3af', fontSize: 11 }, tickLine: false, axisLine: false, allowDecimals: false }), _jsx(Tooltip, { contentStyle: { background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 12, boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }, labelStyle: { color: '#355458', fontWeight: 600 }, itemStyle: { color: '#005596' } }), _jsx(Line, { type: "monotone", dataKey: "alerts", stroke: "#005596", strokeWidth: 2.5, dot: { fill: '#005596', r: 3, strokeWidth: 0 }, activeDot: { r: 5, fill: '#fdb813', stroke: '#005596', strokeWidth: 2 } })] }) }))] }));
}
