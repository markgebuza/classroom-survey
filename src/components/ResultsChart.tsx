import { Bar, BarChart, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { ChartRow } from '../lib/results'

const ROW_HEIGHT = 52

/** Horizontal bar chart. Purely visual: the same numbers are listed as text next to it. */
export default function ResultsChart({ rows }: { rows: ChartRow[] }) {
  const max = Math.max(1, ...rows.map((r) => r.count))
  return (
    <div aria-hidden="true" style={{ height: rows.length * ROW_HEIGHT + 24 }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rows} layout="vertical" margin={{ top: 4, right: 96, bottom: 4, left: 8 }}>
          <XAxis type="number" domain={[0, max]} allowDecimals={false} hide />
          <YAxis
            type="category"
            dataKey="label"
            width={140}
            tick={{ fill: '#0f172a', fontSize: 14 }}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip
            formatter={(_value, _name, item) => [(item.payload as ChartRow).display, 'Answers']}
            labelFormatter={(_label, payload) =>
              (payload?.[0]?.payload as ChartRow | undefined)?.fullLabel ?? ''
            }
          />
          <Bar dataKey="count" fill="#1d4ed8" isAnimationActive={false} barSize={28}>
            <LabelList dataKey="display" position="right" fill="#0f172a" fontSize={14} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
