import axios from 'axios'
import { CheckCircle, FileVideo, Loader2, UploadCloud, XCircle } from 'lucide-react'
import { useRef, useState } from 'react'
import type { DetectionResult } from '../types'

function authHeaders() {
  const token = localStorage.getItem('token')
  return token ? { Authorization: `Bearer ${token}` } : {}
}

const TYPE_COLOR: Record<string, string> = {
  normal: 'bg-green-500/10 text-green-400 border-green-500/20',
  normalvideos: 'bg-green-500/10 text-green-400 border-green-500/20',
}

function typeColor(type: string) {
  return TYPE_COLOR[type.toLowerCase()] ?? 'bg-red-500/10 text-red-400 border-red-500/20'
}

export default function UploadVideoDetect() {
  const [file, setFile] = useState<File | null>(null)
  const [results, setResults] = useState<DetectionResult[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState('')
  const [totalFrames, setTotalFrames] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)

  function handleFile(f: File) {
    setFile(f)
    setResults(null)
    setError('')
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragging(false)
    const f = e.dataTransfer.files[0]
    if (f?.type.startsWith('video/')) handleFile(f)
  }

  async function handleUpload() {
    if (!file) return
    setLoading(true)
    setProgress(0)
    setError('')
    const formData = new FormData()
    formData.append('file', file)
    try {
      const { data } = await axios.post<{ detections: DetectionResult[]; total_frames: number; note?: string }>(
        '/upload-video',
        formData,
        {
          headers: { ...authHeaders(), 'Content-Type': 'multipart/form-data' },
          onUploadProgress: e => setProgress(Math.round(((e.loaded ?? 0) / (e.total ?? 1)) * 100)),
        },
      )
      setResults(data.detections)
      setTotalFrames(data.total_frames)
      if (data.note) setError(data.note)
    } catch (e: unknown) {
      setError(axios.isAxiosError(e) ? (e.response?.data?.detail ?? 'Upload failed') : 'Upload failed')
    } finally {
      setLoading(false)
    }
  }

  const threats = results?.filter(d => !['normal', 'normalvideos'].includes(d.type.toLowerCase())) ?? []

  return (
    <div className="space-y-4">
      {/* Drop zone */}
      <div
        onDrop={onDrop}
        onDragOver={e => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onClick={() => inputRef.current?.click()}
        className={`border-2 border-dashed rounded-xl p-10 flex flex-col items-center gap-3 cursor-pointer transition-colors ${
          dragging ? 'border-cyan-400 bg-cyan-500/5' : 'border-gray-700 hover:border-gray-600 bg-gray-900/50'
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          accept="video/*"
          className="hidden"
          onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])}
        />
        {file ? (
          <>
            <FileVideo size={36} className="text-cyan-400" />
            <div className="text-center">
              <p className="text-white font-medium text-sm">{file.name}</p>
              <p className="text-gray-500 text-xs mt-0.5">{(file.size / 1024 / 1024).toFixed(1)} MB</p>
            </div>
          </>
        ) : (
          <>
            <UploadCloud size={36} className="text-gray-600" />
            <div className="text-center">
              <p className="text-gray-400 text-sm font-medium">Drop a video file here</p>
              <p className="text-gray-600 text-xs mt-0.5">or click to browse — MP4, AVI, MOV, MKV</p>
            </div>
          </>
        )}
      </div>

      {/* Upload button */}
      {file && (
        <button
          onClick={handleUpload}
          disabled={loading}
          className="flex items-center gap-2 bg-cyan-500 hover:bg-cyan-400 disabled:opacity-50 text-gray-950 font-semibold text-sm px-6 py-2.5 rounded-lg transition-colors"
        >
          {loading ? <Loader2 size={16} className="animate-spin" /> : <UploadCloud size={16} />}
          {loading ? `Uploading… ${progress}%` : 'Upload & Detect'}
        </button>
      )}

      {error && (
        <p className="text-amber-400 text-sm bg-amber-500/10 border border-amber-500/20 rounded-lg px-4 py-2">
          {error}
        </p>
      )}

      {/* Results */}
      {results && (
        <div className="space-y-3">
          {/* Summary */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <p className="text-xs text-gray-500 uppercase tracking-wide mb-3 font-medium">Analysis Summary</p>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <p className="text-gray-600 text-xs mb-1">Frames Scanned</p>
                <p className="text-white font-bold text-lg">{totalFrames}</p>
              </div>
              <div>
                <p className="text-gray-600 text-xs mb-1">Detections</p>
                <p className="text-white font-bold text-lg">{results.length}</p>
              </div>
              <div>
                <p className="text-gray-600 text-xs mb-1">Threats Found</p>
                <p className={`font-bold text-lg ${threats.length > 0 ? 'text-red-400' : 'text-green-400'}`}>
                  {threats.length}
                </p>
              </div>
            </div>
          </div>

          {/* Frame-by-frame list */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <p className="text-xs text-gray-500 uppercase tracking-wide mb-3 font-medium">
              Detection Timeline ({results.length} frames)
            </p>
            <ul className="space-y-1.5 max-h-72 overflow-y-auto pr-1">
              {results.map((d, i) => {
                const isNormal = ['normal', 'normalvideos'].includes(d.type.toLowerCase())
                return (
                  <li key={i} className="flex items-center gap-3 text-xs">
                    {isNormal
                      ? <CheckCircle size={14} className="text-green-500 shrink-0" />
                      : <XCircle size={14} className="text-red-400 shrink-0" />
                    }
                    <span className="text-gray-500 tabular-nums w-20 shrink-0">
                      Frame {d.frame_index ?? i}
                    </span>
                    <span className={`px-2 py-0.5 rounded border text-xs font-medium capitalize ${typeColor(d.type)}`}>
                      {d.type}
                    </span>
                    <span className="text-gray-600 ml-auto tabular-nums">
                      {(d.confidence * 100).toFixed(1)}%
                    </span>
                  </li>
                )
              })}
            </ul>
          </div>
        </div>
      )}
    </div>
  )
}
