import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'
import type { Stats } from '../types'

// TUT brand palette extended with complementary shades
const PALETTE = ['#005596', '#fdb813', '#d7292f', '#355458', '#0077cc', '#e8a00a', '#ff5057', '#4a7a80']

interface Props {
  stats: Stats | null
}

export default function AlertTypeChart({ stats }: Props) {
  const raw = stats?.by_type ?? {}
  const data = Object.entries(raw)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)

  const total = data.reduce((s, d) => s + d.value, 0)

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
      <div className="mb-4">
        <h3 className="text-tut-teal font-semibold text-sm">Alert Types</h3>
        <p className="text-gray-400 text-xs mt-0.5">Distribution</p>
      </div>

      {data.length === 0 ? (
        <div className="h-44 flex items-center justify-center text-gray-400 text-sm">
          No data yet
        </div>
      ) : (
        <div className="flex items-center gap-4">
          <ResponsiveContainer width={140} height={140}>
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius={42}
                outerRadius={64}
                paddingAngle={2}
                dataKey="value"
              >
                {data.map((_, i) => (
                  <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 12, boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}
                itemStyle={{ color: '#355458' }}
              />
            </PieChart>
          </ResponsiveContainer>

          <ul className="flex-1 space-y-2 min-w-0">
            {data.slice(0, 6).map((d, i) => (
              <li key={d.name} className="flex items-center gap-2 text-xs">
                <span
                  className="w-2.5 h-2.5 rounded-sm shrink-0"
                  style={{ background: PALETTE[i % PALETTE.length] }}
                />
                <span className="text-tut-teal capitalize truncate flex-1 font-medium">{d.name}</span>
                <span className="text-gray-400 tabular-nums font-semibold">
                  {total > 0 ? Math.round((d.value / total) * 100) : 0}%
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
