import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { Stats } from '../types'

const COLOR: Record<string, string> = {
  audio: '#fdb813',   // TUT gold
  video: '#005596',   // TUT blue
  both:  '#d7292f',   // TUT red
}

interface Props {
  stats: Stats | null
}

export default function SourceChart({ stats }: Props) {
  const raw = stats?.by_source ?? {}
  const data = ['audio', 'video', 'both'].map(source => ({
    source,
    count: raw[source] ?? 0,
  }))

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
      <div className="mb-4">
        <h3 className="text-tut-teal font-semibold text-sm">Detection Source</h3>
        <p className="text-gray-400 text-xs mt-0.5">By modality</p>
      </div>

      <ResponsiveContainer width="100%" height={150}>
        <BarChart data={data} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
          <XAxis
            dataKey="source"
            tick={{ fill: '#9ca3af', fontSize: 11 }}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            tick={{ fill: '#9ca3af', fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            allowDecimals={false}
          />
          <Tooltip
            contentStyle={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 12, boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}
            labelStyle={{ color: '#355458', fontWeight: 600 }}
            cursor={{ fill: '#00559608' }}
          />
          <Bar dataKey="count" radius={[5, 5, 0, 0]}>
            {data.map((d) => (
              <Cell key={d.source} fill={COLOR[d.source] ?? '#9ca3af'} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      {/* Legend */}
      <div className="flex items-center gap-4 mt-3 justify-center">
        {data.map(d => (
          <div key={d.source} className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm" style={{ background: COLOR[d.source] }} />
            <span className="text-xs text-gray-500 capitalize">{d.source}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
