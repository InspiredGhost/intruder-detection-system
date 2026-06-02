import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
const NORMAL_TYPES = new Set(['normal']);
export default function StatusIndicator({ latest }) {
    const isAlert = latest && !NORMAL_TYPES.has(latest.type);
    return (_jsxs("div", { className: `flex items-center gap-3 px-5 py-3 rounded-xl font-semibold text-sm ${isAlert ? 'bg-red-900/50 text-red-300 border border-red-700' : 'bg-green-900/50 text-green-300 border border-green-700'}`, children: [_jsx("span", { className: `w-3 h-3 rounded-full animate-pulse ${isAlert ? 'bg-red-400' : 'bg-green-400'}` }), isAlert ? (_jsxs("span", { children: ["ALERT \u2014 ", latest.type.toUpperCase(), " (", (latest.confidence * 100).toFixed(0), "% conf)"] })) : (_jsx("span", { children: "ALL CLEAR" }))] }));
}
