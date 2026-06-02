import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
const SOURCE_LABEL = {
    audio: 'Audio',
    video: 'Video',
    both: 'Audio+Video',
};
const TYPE_COLOR = {
    normal: 'bg-green-800 text-green-200',
    gunshot: 'bg-red-800 text-red-200',
};
function typeColor(type) {
    return TYPE_COLOR[type] ?? 'bg-yellow-800 text-yellow-200';
}
function formatTime(iso) {
    try {
        return new Date(iso).toLocaleTimeString();
    }
    catch {
        return iso;
    }
}
export default function AlertsList({ alerts }) {
    if (alerts.length === 0) {
        return _jsx("p", { className: "text-gray-500 text-sm text-center py-8", children: "No alerts yet." });
    }
    return (_jsx("ul", { className: "space-y-2 max-h-[520px] overflow-y-auto pr-1", children: alerts.map(alert => (_jsxs("li", { className: "flex items-start justify-between gap-3 bg-gray-700/50 rounded-lg px-4 py-3 text-sm", children: [_jsxs("div", { className: "flex flex-col gap-1 min-w-0", children: [_jsx("span", { className: `inline-block px-2 py-0.5 rounded text-xs font-bold w-fit ${typeColor(alert.type)}`, children: alert.type.toUpperCase() }), _jsxs("span", { className: "text-gray-300 truncate", children: [SOURCE_LABEL[alert.source], " \u2014 ", (alert.confidence * 100).toFixed(0), "% confidence"] })] }), _jsx("span", { className: "text-gray-500 whitespace-nowrap", children: formatTime(alert.timestamp) })] }, alert.id))) }));
}
