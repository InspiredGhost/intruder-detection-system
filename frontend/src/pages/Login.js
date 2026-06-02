import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import axios from 'axios';
import { Eye, EyeOff } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
export default function Login() {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [showPwd, setShowPwd] = useState(false);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();
    async function handleSubmit(e) {
        e.preventDefault();
        setError('');
        setLoading(true);
        try {
            const form = new URLSearchParams();
            form.append('username', username);
            form.append('password', password);
            const { data } = await axios.post('/auth/token', form, {
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            });
            localStorage.setItem('token', data.access_token);
            navigate('/dashboard');
        }
        catch {
            setError('Invalid username or password.');
        }
        finally {
            setLoading(false);
        }
    }
    return (_jsx("div", { className: "min-h-screen bg-tut-blue flex items-center justify-center px-4", children: _jsxs("div", { className: "w-full max-w-sm", children: [_jsxs("div", { className: "flex flex-col items-center mb-8", children: [_jsx("div", { className: "bg-white rounded-2xl px-6 py-3 mb-4 flex items-center justify-center", children: _jsx("img", { src: "https://www.tut.ac.za/media/tshwane-interim/site-assets/images/tut-logo.svg", alt: "Tshwane University of Technology", className: "h-16 w-auto object-contain", onError: e => { e.currentTarget.style.display = 'none'; } }) }), _jsx("h1", { className: "text-lg font-bold text-white text-center leading-snug", children: "Audio-Visual Intruder Detection System" })] }), _jsxs("div", { className: "bg-white rounded-2xl shadow-2xl p-8", children: [_jsx("h2", { className: "text-tut-teal font-bold text-lg mb-1", children: "Sign In" }), _jsx("p", { className: "text-gray-400 text-sm mb-6", children: "Enter your credentials to access the dashboard" }), _jsxs("form", { onSubmit: handleSubmit, className: "space-y-4", children: [_jsxs("div", { children: [_jsx("label", { className: "block text-xs text-gray-500 font-semibold uppercase tracking-wide mb-1.5", children: "Username" }), _jsx("input", { type: "text", value: username, onChange: e => setUsername(e.target.value), required: true, autoComplete: "username", className: "w-full bg-slate-50 border border-gray-200 text-tut-teal rounded-xl px-4 py-3 text-sm outline-none focus:border-tut-blue focus:ring-2 focus:ring-tut-blue/10 transition-colors", placeholder: "admin" })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-xs text-gray-500 font-semibold uppercase tracking-wide mb-1.5", children: "Password" }), _jsxs("div", { className: "relative", children: [_jsx("input", { type: showPwd ? 'text' : 'password', value: password, onChange: e => setPassword(e.target.value), required: true, autoComplete: "current-password", className: "w-full bg-slate-50 border border-gray-200 text-tut-teal rounded-xl px-4 py-3 pr-11 text-sm outline-none focus:border-tut-blue focus:ring-2 focus:ring-tut-blue/10 transition-colors", placeholder: "\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022" }), _jsx("button", { type: "button", onClick: () => setShowPwd(p => !p), className: "absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-tut-teal transition-colors", children: showPwd ? _jsx(EyeOff, { size: 16 }) : _jsx(Eye, { size: 16 }) })] })] }), error && (_jsx("div", { className: "text-tut-red text-sm bg-tut-red/5 border border-tut-red/20 rounded-xl px-4 py-3", children: error })), _jsx("button", { type: "submit", disabled: loading, className: "w-full bg-tut-blue hover:bg-[#004a80] disabled:opacity-50 text-white font-bold rounded-xl py-3 text-sm transition-colors mt-2 shadow-md", children: loading ? 'Signing in…' : 'Sign In' })] })] }), _jsx("p", { className: "text-white/40 text-xs text-center mt-6", children: "Tshwane University of Technology \u2014 Final Year Project" })] }) }));
}
