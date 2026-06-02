import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
const COLOR = {
    audio: '#fdb813', // TUT gold
    video: '#005596', // TUT blue
    both: '#d7292f', // TUT red
};
export default function SourceChart({ stats }) {
    const raw = stats?.by_source ?? {};
    const data = ['audio', 'video', 'both'].map(source => ({
        source,
        count: raw[source] ?? 0,
    }));
    return (_jsxs("div", { className: "bg-white border border-gray-200 rounded-xl p-5 shadow-sm", children: [_jsxs("div", { className: "mb-4", children: [_jsx("h3", { className: "text-tut-teal font-semibold text-sm", children: "Detection Source" }), _jsx("p", { className: "text-gray-400 text-xs mt-0.5", children: "By modality" })] }), _jsx(ResponsiveContainer, { width: "100%", height: 150, children: _jsxs(BarChart, { data: data, margin: { top: 4, right: 8, left: -20, bottom: 0 }, children: [_jsx(CartesianGrid, { strokeDasharray: "3 3", stroke: "#e5e7eb", vertical: false }), _jsx(XAxis, { dataKey: "source", tick: { fill: '#9ca3af', fontSize: 11 }, tickLine: false, axisLine: false }), _jsx(YAxis, { tick: { fill: '#9ca3af', fontSize: 11 }, tickLine: false, axisLine: false, allowDecimals: false }), _jsx(Tooltip, { contentStyle: { background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 12, boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }, labelStyle: { color: '#355458', fontWeight: 600 }, cursor: { fill: '#00559608' } }), _jsx(Bar, { dataKey: "count", radius: [5, 5, 0, 0], children: data.map((d) => (_jsx(Cell, { fill: COLOR[d.source] ?? '#9ca3af' }, d.source))) })] }) }), _jsx("div", { className: "flex items-center gap-4 mt-3 justify-center", children: data.map(d => (_jsxs("div", { className: "flex items-center gap-1.5", children: [_jsx("span", { className: "w-2.5 h-2.5 rounded-sm", style: { background: COLOR[d.source] } }), _jsx("span", { className: "text-xs text-gray-500 capitalize", children: d.source })] }, d.source))) })] }));
}
