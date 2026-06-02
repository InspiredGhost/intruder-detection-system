import type { LucideIcon } from 'lucide-react'

interface Props {
  label: string
  value: string | number
  icon: LucideIcon
  color?: 'cyan' | 'red' | 'green' | 'amber' | 'blue' | 'gold' | 'teal'
  sub?: string
}

const COLORS: Record<string, { icon: string; value: string }> = {
  blue:  { icon: 'text-tut-blue bg-tut-blue/10 border-tut-blue/20',  value: 'text-tut-blue'  },
  cyan:  { icon: 'text-tut-blue bg-tut-blue/10 border-tut-blue/20',  value: 'text-tut-blue'  },
  gold:  { icon: 'text-tut-gold bg-tut-gold/10 border-tut-gold/20',  value: 'text-tut-teal'  },
  amber: { icon: 'text-tut-gold bg-tut-gold/10 border-tut-gold/20',  value: 'text-tut-teal'  },
  red:   { icon: 'text-tut-red  bg-tut-red/10  border-tut-red/20',   value: 'text-tut-red'   },
  teal:  { icon: 'text-tut-teal bg-tut-teal/10 border-tut-teal/20',  value: 'text-tut-teal'  },
  green: { icon: 'text-green-600 bg-green-50 border-green-200',       value: 'text-green-700' },
}

export default function StatCard({ label, value, icon: Icon, color = 'blue', sub }: Props) {
  const scheme = COLORS[color] ?? COLORS.blue
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5 flex items-start gap-4 shadow-sm hover:shadow-md transition-shadow">
      <div className={`w-11 h-11 rounded-xl border-2 flex items-center justify-center shrink-0 ${scheme.icon}`}>
        <Icon size={20} />
      </div>
      <div className="min-w-0">
        <p className="text-gray-400 text-xs font-semibold uppercase tracking-wider">{label}</p>
        <p className={`text-2xl font-bold mt-0.5 leading-tight ${scheme.value}`}>{value}</p>
        {sub && <p className="text-gray-400 text-xs mt-0.5">{sub}</p>}
      </div>
    </div>
  )
}
