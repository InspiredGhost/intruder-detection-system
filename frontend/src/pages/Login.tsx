import axios from 'axios'
import { Eye, EyeOff } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

export default function Login() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPwd, setShowPwd] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const form = new URLSearchParams()
      form.append('username', username)
      form.append('password', password)
      const { data } = await axios.post('/auth/token', form, {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      })
      localStorage.setItem('token', data.access_token)
      navigate('/dashboard')
    } catch {
      setError('Invalid username or password.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-tut-blue flex items-center justify-center px-4">

      <div className="w-full max-w-sm">
        {/* TUT Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="bg-white rounded-2xl px-6 py-3 mb-4 flex items-center justify-center">
            <img
              src="https://www.tut.ac.za/media/tshwane-interim/site-assets/images/tut-logo.svg"
              alt="Tshwane University of Technology"
              className="h-16 w-auto object-contain"
              onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none' }}
            />
          </div>
          <h1 className="text-lg font-bold text-white text-center leading-snug">Audio-Visual Intruder Detection System</h1>
        </div>

        {/* Login card */}
        <div className="bg-white rounded-2xl shadow-2xl p-8">
          <h2 className="text-tut-teal font-bold text-lg mb-1">Sign In</h2>
          <p className="text-gray-400 text-sm mb-6">Enter your credentials to access the dashboard</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs text-gray-500 font-semibold uppercase tracking-wide mb-1.5">
                Username
              </label>
              <input
                type="text"
                value={username}
                onChange={e => setUsername(e.target.value)}
                required
                autoComplete="username"
                className="w-full bg-slate-50 border border-gray-200 text-tut-teal rounded-xl px-4 py-3 text-sm outline-none focus:border-tut-blue focus:ring-2 focus:ring-tut-blue/10 transition-colors"
                placeholder="admin"
              />
            </div>

            <div>
              <label className="block text-xs text-gray-500 font-semibold uppercase tracking-wide mb-1.5">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPwd ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  className="w-full bg-slate-50 border border-gray-200 text-tut-teal rounded-xl px-4 py-3 pr-11 text-sm outline-none focus:border-tut-blue focus:ring-2 focus:ring-tut-blue/10 transition-colors"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPwd(p => !p)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-tut-teal transition-colors"
                >
                  {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {error && (
              <div className="text-tut-red text-sm bg-tut-red/5 border border-tut-red/20 rounded-xl px-4 py-3">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-tut-blue hover:bg-[#004a80] disabled:opacity-50 text-white font-bold rounded-xl py-3 text-sm transition-colors mt-2 shadow-md"
            >
              {loading ? 'Signing in…' : 'Sign In'}
            </button>
          </form>
        </div>

        <p className="text-white/40 text-xs text-center mt-6">
          Tshwane University of Technology — Final Year Project
        </p>
      </div>
    </div>
  )
}
