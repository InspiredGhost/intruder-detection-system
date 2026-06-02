import { Fragment as _Fragment, jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import './index.css';
import { CameraProvider } from './components/CameraContext';
import Layout from './components/Layout';
import AlertsPage from './pages/AlertsPage';
import Dashboard from './pages/Dashboard';
import DetectionPage from './pages/DetectionPage';
import Login from './pages/Login';
function PrivateRoute({ children }) {
    return localStorage.getItem('token') ? _jsx(_Fragment, { children: children }) : _jsx(Navigate, { to: "/login", replace: true });
}
ReactDOM.createRoot(document.getElementById('root')).render(_jsx(React.StrictMode, { children: _jsx(CameraProvider, { children: _jsx(BrowserRouter, { children: _jsxs(Routes, { children: [_jsx(Route, { path: "/login", element: _jsx(Login, {}) }), _jsxs(Route, { element: _jsx(PrivateRoute, { children: _jsx(Layout, {}) }), children: [_jsx(Route, { path: "/dashboard", element: _jsx(Dashboard, {}) }), _jsx(Route, { path: "/detection", element: _jsx(DetectionPage, {}) }), _jsx(Route, { path: "/alerts", element: _jsx(AlertsPage, {}) })] }), _jsx(Route, { path: "*", element: _jsx(Navigate, { to: "/dashboard", replace: true }) })] }) }) }) }));
