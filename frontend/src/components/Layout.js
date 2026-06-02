import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
export default function Layout() {
    return (_jsxs("div", { className: "flex h-screen bg-slate-100 overflow-hidden", children: [_jsx(Sidebar, {}), _jsx("main", { className: "flex-1 overflow-y-auto", children: _jsx(Outlet, {}) })] }));
}
