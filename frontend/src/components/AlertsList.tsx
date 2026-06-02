import type { Alert } from '../types'

interface Props {
  alerts: Alert[]
}

const SOURCE_LABEL: Record<string, string> = {
  audio: 'Audio',
  video: 'Video',
  both: 'Audio+Video',
}

const TYPE_COLOR: Record<string, string> = {
  normal: 'bg-green-800 text-green-200',
  gunshot: 'bg-red-800 text-red-200',
}

function typeColor(type: string) {
  return TYPE_COLOR[type] ?? 'bg-yellow-800 text-yellow-200'
}

function formatTime(iso: string) {
  try {
    return new Date(iso).toLocaleTimeString()
  } catch {
    return iso
  }
}

export default function AlertsList({ alerts }: Props) {
  if (alerts.length === 0) {
    return <p className="text-gray-500 text-sm text-center py-8">No alerts yet.</p>
  }

  return (
    <ul className="space-y-2 max-h-[520px] overflow-y-auto pr-1">
      {alerts.map(alert => (
        <li
          key={alert.id}
          className="flex items-start justify-between gap-3 bg-gray-700/50 rounded-lg px-4 py-3 text-sm"
        >
          <div className="flex flex-col gap-1 min-w-0">
            <span className={`inline-block px-2 py-0.5 rounded text-xs font-bold w-fit ${typeColor(alert.type)}`}>
              {alert.type.toUpperCase()}
            </span>
            <span className="text-gray-300 truncate">
              {SOURCE_LABEL[alert.source]} — {(alert.confidence * 100).toFixed(0)}% confidence
            </span>
          </div>
          <span className="text-gray-500 whitespace-nowrap">{formatTime(alert.timestamp)}</span>
        </li>
      ))}
    </ul>
  )
}
