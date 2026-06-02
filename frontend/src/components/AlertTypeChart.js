import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
// TUT brand palette extended with complementary shades
const PALETTE = ['#005596', '#fdb813', '#d7292f', '#355458', '#0077cc', '#e8a00a', '#ff5057', '#4a7a80'];
export default function AlertTypeChart({ stats }) {
    const raw = stats?.by_type ?? {};
    const data = Object.entries(raw)
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value);
    const total = data.reduce((s, d) => s + d.value, 0);
    return (_jsxs("div", { className: "bg-white border border-gray-200 rounded-xl p-5 shadow-sm", children: [_jsxs("div", { className: "mb-4", children: [_jsx("h3", { className: "text-tut-teal font-semibold text-sm", children: "Alert Types" }), _jsx("p", { className: "text-gray-400 text-xs mt-0.5", children: "Distribution" })] }), data.length === 0 ? (_jsx("div", { className: "h-44 flex items-center justify-center text-gray-400 text-sm", children: "No data yet" })) : (_jsxs("div", { className: "flex items-center gap-4", children: [_jsx(ResponsiveContainer, { width: 140, height: 140, children: _jsxs(PieChart, { children: [_jsx(Pie, { data: data, cx: "50%", cy: "50%", innerRadius: 42, outerRadius: 64, paddingAngle: 2, dataKey: "value", children: data.map((_, i) => (_jsx(Cell, { fill: PALETTE[i % PALETTE.length] }, i))) }), _jsx(Tooltip, { contentStyle: { background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 12, boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }, itemStyle: { color: '#355458' } })] }) }), _jsx("ul", { className: "flex-1 space-y-2 min-w-0", children: data.slice(0, 6).map((d, i) => (_jsxs("li", { className: "flex items-center gap-2 text-xs", children: [_jsx("span", { className: "w-2.5 h-2.5 rounded-sm shrink-0", style: { background: PALETTE[i % PALETTE.length] } }), _jsx("span", { className: "text-tut-teal capitalize truncate flex-1 font-medium", children: d.name }), _jsxs("span", { className: "text-gray-400 tabular-nums font-semibold", children: [total > 0 ? Math.round((d.value / total) * 100) : 0, "%"] })] }, d.name))) })] }))] }));
}
