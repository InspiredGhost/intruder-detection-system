import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import axios from 'axios';
import { Camera, Trash2, Upload, UserCheck, UserPlus, X } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
function authHeaders() {
    const token = localStorage.getItem('token');
    return token ? { Authorization: `Bearer ${token}` } : {};
}
function mediaUrl(url) {
    const token = localStorage.getItem('token') ?? '';
    return `${url}?token=${encodeURIComponent(token)}`;
}
export default function EnrollPage() {
    const [faces, setFaces] = useState([]);
    const [loading, setLoading] = useState(true);
    const [name, setName] = useState('');
    const [photoB64, setPhotoB64] = useState(null);
    const [preview, setPreview] = useState(null);
    const [enrolling, setEnrolling] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [camActive, setCamActive] = useState(false);
    const [deleting, setDeleting] = useState(null);
    const videoRef = useRef(null);
    const streamRef = useRef(null);
    const fileRef = useRef(null);
    const navigate = useNavigate();
    const fetchFaces = useCallback(async () => {
        setLoading(true);
        try {
            const { data } = await axios.get('/faces', { headers: authHeaders() });
            setFaces(data);
        }
        catch (err) {
            if (axios.isAxiosError(err) && err.response?.status === 401) {
                localStorage.removeItem('token');
                navigate('/login');
            }
        }
        finally {
            setLoading(false);
        }
    }, [navigate]);
    useEffect(() => { fetchFaces(); }, [fetchFaces]);
    // Stop webcam when component unmounts
    useEffect(() => () => stopCam(), []);
    function stopCam() {
        streamRef.current?.getTracks().forEach(t => t.stop());
        streamRef.current = null;
        setCamActive(false);
    }
    // Attach stream to video element once it mounts (camActive makes it appear)
    useEffect(() => {
        if (camActive && videoRef.current && streamRef.current) {
            videoRef.current.srcObject = streamRef.current;
        }
    }, [camActive]);
    async function startCam() {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: true });
            streamRef.current = stream;
            setPhotoB64(null);
            setPreview(null);
            setCamActive(true); // triggers useEffect above to wire up srcObject
        }
        catch {
            setError('Could not access webcam. Please allow camera permission or use file upload.');
        }
    }
    function captureFromCam() {
        if (!videoRef.current)
            return;
        const canvas = document.createElement('canvas');
        canvas.width = videoRef.current.videoWidth;
        canvas.height = videoRef.current.videoHeight;
        canvas.getContext('2d').drawImage(videoRef.current, 0, 0);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
        const b64 = dataUrl.split(',')[1];
        setPhotoB64(b64);
        setPreview(dataUrl);
        stopCam();
    }
    function handleFileChange(e) {
        const file = e.target.files?.[0];
        if (!file)
            return;
        const reader = new FileReader();
        reader.onload = ev => {
            const dataUrl = ev.target?.result;
            const b64 = dataUrl.split(',')[1];
            setPhotoB64(b64);
            setPreview(dataUrl);
        };
        reader.readAsDataURL(file);
        stopCam();
    }
    function clearPhoto() {
        setPhotoB64(null);
        setPreview(null);
        if (fileRef.current)
            fileRef.current.value = '';
        stopCam();
    }
    async function handleEnroll(e) {
        e.preventDefault();
        setError('');
        setSuccess('');
        if (!name.trim()) {
            setError('Please enter a name.');
            return;
        }
        if (!photoB64) {
            setError('Please provide a photo.');
            return;
        }
        setEnrolling(true);
        try {
            await axios.post('/faces', { name: name.trim(), photo_b64: photoB64 }, { headers: authHeaders() });
            setSuccess(`${name.trim()} enrolled successfully.`);
            setName('');
            setPhotoB64(null);
            setPreview(null);
            if (fileRef.current)
                fileRef.current.value = '';
            await fetchFaces();
        }
        catch (err) {
            if (axios.isAxiosError(err)) {
                setError(err.response?.data?.detail ?? 'Enrollment failed.');
            }
            else {
                setError('Enrollment failed.');
            }
        }
        finally {
            setEnrolling(false);
        }
    }
    async function handleDelete(id, faceName) {
        if (!window.confirm(`Remove ${faceName} from the friendly list?`))
            return;
        setDeleting(id);
        try {
            await axios.delete(`/faces/${id}`, { headers: authHeaders() });
            setFaces(prev => prev.filter(f => f.id !== id));
        }
        catch {
            setError('Could not delete face.');
        }
        finally {
            setDeleting(null);
        }
    }
    return (_jsxs("div", { className: "p-6 space-y-6", children: [_jsxs("div", { children: [_jsx("h1", { className: "text-xl font-bold text-tut-teal", children: "Face Enrolment" }), _jsx("p", { className: "text-gray-400 text-sm mt-0.5", children: "Register friendly people. Any unrecognised face triggers an intruder alert." })] }), _jsxs("div", { className: "grid grid-cols-1 lg:grid-cols-2 gap-6", children: [_jsxs("div", { className: "bg-white border border-gray-200 rounded-xl shadow-sm p-6 space-y-5", children: [_jsxs("div", { className: "flex items-center gap-2.5", children: [_jsx(UserPlus, { size: 18, className: "text-tut-teal" }), _jsx("h2", { className: "font-semibold text-tut-teal text-sm", children: "Add a person" })] }), _jsxs("form", { onSubmit: handleEnroll, className: "space-y-4", children: [_jsxs("div", { children: [_jsx("label", { className: "block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5", children: "Full Name" }), _jsx("input", { type: "text", value: name, onChange: e => setName(e.target.value), placeholder: "e.g. Desmond Makhubela", className: "w-full border border-gray-200 rounded-lg px-3.5 py-2.5 text-sm text-tut-teal outline-none focus:border-tut-blue focus:ring-2 focus:ring-tut-blue/10 transition-all" })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5", children: "Photo" }), preview ? (_jsxs("div", { className: "relative", children: [_jsx("img", { src: preview, alt: "Preview", className: "w-full max-h-56 object-cover rounded-xl border border-gray-200" }), _jsx("button", { type: "button", onClick: clearPhoto, className: "absolute top-2 right-2 bg-white border border-gray-200 rounded-full p-1.5 shadow hover:bg-gray-50 transition-colors", children: _jsx(X, { size: 14, className: "text-gray-500" }) })] })) : camActive ? (_jsxs("div", { className: "relative", children: [_jsx("video", { ref: videoRef, autoPlay: true, playsInline: true, muted: true, className: "w-full rounded-xl border border-gray-200 bg-black", style: { maxHeight: 224 } }), _jsxs("button", { type: "button", onClick: captureFromCam, className: "mt-2 w-full flex items-center justify-center gap-2 bg-tut-blue hover:bg-[#004a80] text-white font-semibold text-sm px-4 py-2.5 rounded-lg transition-colors", children: [_jsx(Camera, { size: 15 }), "Capture Photo"] }), _jsx("button", { type: "button", onClick: stopCam, className: "mt-1.5 w-full text-xs text-gray-400 hover:text-gray-600 transition-colors", children: "Cancel" })] })) : (_jsxs("div", { className: "flex gap-3", children: [_jsxs("button", { type: "button", onClick: startCam, className: "flex-1 flex items-center justify-center gap-2 border-2 border-dashed border-gray-200 hover:border-tut-blue rounded-xl py-8 text-sm text-gray-400 hover:text-tut-blue transition-colors", children: [_jsx(Camera, { size: 18 }), "Use Webcam"] }), _jsxs("button", { type: "button", onClick: () => fileRef.current?.click(), className: "flex-1 flex items-center justify-center gap-2 border-2 border-dashed border-gray-200 hover:border-tut-blue rounded-xl py-8 text-sm text-gray-400 hover:text-tut-blue transition-colors", children: [_jsx(Upload, { size: 18 }), "Upload Photo"] }), _jsx("input", { ref: fileRef, type: "file", accept: "image/*", className: "hidden", onChange: handleFileChange })] }))] }), error && (_jsx("p", { className: "text-tut-red text-xs bg-tut-red/5 border border-tut-red/20 rounded-lg px-3 py-2", children: error })), success && (_jsx("p", { className: "text-green-700 text-xs bg-green-50 border border-green-200 rounded-lg px-3 py-2", children: success })), _jsxs("button", { type: "submit", disabled: enrolling || !name.trim() || !photoB64, className: "w-full flex items-center justify-center gap-2 bg-tut-teal hover:bg-tut-blue text-white font-semibold text-sm px-5 py-3 rounded-lg transition-colors shadow-sm disabled:opacity-40 disabled:cursor-not-allowed", children: [_jsx(UserCheck, { size: 16 }), enrolling ? 'Enrolling…' : 'Enrol as Friendly'] })] })] }), _jsxs("div", { className: "bg-white border border-gray-200 rounded-xl shadow-sm p-6 space-y-4", children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsxs("div", { className: "flex items-center gap-2.5", children: [_jsx(UserCheck, { size: 18, className: "text-tut-teal" }), _jsx("h2", { className: "font-semibold text-tut-teal text-sm", children: "Friendly persons" })] }), _jsxs("span", { className: "text-xs text-gray-400 bg-slate-100 px-2.5 py-1 rounded-md border border-gray-200", children: [faces.length, " enrolled"] })] }), loading && (_jsx("p", { className: "text-gray-400 text-sm text-center py-10", children: "Loading\u2026" })), !loading && faces.length === 0 && (_jsxs("div", { className: "text-center py-12 space-y-2", children: [_jsx(UserPlus, { size: 32, className: "text-gray-200 mx-auto" }), _jsx("p", { className: "text-gray-400 text-sm", children: "No faces enrolled yet." }), _jsx("p", { className: "text-gray-300 text-xs", children: "Every detected face will trigger an alert until you enrol someone." })] })), _jsx("ul", { className: "space-y-3 overflow-y-auto", style: { maxHeight: 480 }, children: faces.map(f => (_jsxs("li", { className: "flex items-center gap-3 bg-slate-50 border border-gray-100 rounded-xl px-3 py-3 hover:border-gray-200 transition-colors", children: [f.photo_url ? (_jsx("img", { src: mediaUrl(f.photo_url), alt: f.name, className: "w-12 h-12 rounded-full object-cover border border-gray-200 shrink-0" })) : (_jsx("div", { className: "w-12 h-12 rounded-full bg-tut-teal/10 border border-tut-teal/20 flex items-center justify-center shrink-0", children: _jsx("span", { className: "text-tut-teal font-bold text-lg uppercase", children: f.name[0] }) })), _jsxs("div", { className: "flex-1 min-w-0", children: [_jsx("p", { className: "text-tut-teal font-semibold text-sm truncate", children: f.name }), _jsx("span", { className: "inline-block mt-0.5 text-[10px] font-semibold text-green-700 bg-green-50 border border-green-200 px-2 py-0.5 rounded-md", children: "Friendly" })] }), _jsx("button", { onClick: () => handleDelete(f.id, f.name), disabled: deleting === f.id, className: "text-gray-300 hover:text-tut-red p-2 rounded-lg hover:bg-tut-red/5 transition-colors disabled:opacity-40", title: "Remove", children: _jsx(Trash2, { size: 15 }) })] }, f.id))) })] })] })] }));
}
