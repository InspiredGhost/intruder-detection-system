import type { Alert } from '../types'

interface Props {
  latest: Alert | null
}

const NORMAL_TYPES = new Set(['normal'])

export default function StatusIndicator({ latest }: Props) {
  const isAlert = latest && !NORMAL_TYPES.has(latest.type)

  return (
    <div
      className={`flex items-center gap-3 px-5 py-3 rounded-xl font-semibold text-sm ${
        isAlert ? 'bg-red-900/50 text-red-300 border border-red-700' : 'bg-green-900/50 text-green-300 border border-green-700'
      }`}
    >
      <span className={`w-3 h-3 rounded-full animate-pulse ${isAlert ? 'bg-red-400' : 'bg-green-400'}`} />
      {isAlert ? (
        <span>ALERT — {latest!.type.toUpperCase()} ({(latest!.confidence * 100).toFixed(0)}% conf)</span>
      ) : (
        <span>ALL CLEAR</span>
      )}
    </div>
  )
}
