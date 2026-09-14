'use client'

import { motion } from 'framer-motion'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { RENT_TREND, RENT_TREND_SERIES } from '@/lib/marketInsights'

function formatEtb(n: number) {
  return n >= 1000 ? `${Math.round(n / 1000)}K` : `${n}`
}

export default function RentTrendChart() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0, transition: { duration: 0.4 } }}
      className="rounded-lg border border-charcoal/10 bg-white p-5 shadow-stamp"
    >
      <div className="flex items-center justify-between">
        <h2 className="font-display text-lg font-semibold text-charcoal">Rent Trend (All Types)</h2>
        <div className="flex gap-3 text-xs text-charcoal/60">
          {RENT_TREND_SERIES.map((s) => (
            <span key={s.key} className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: s.color }} />
              {s.key}
            </span>
          ))}
        </div>
      </div>

      <div className="mt-4 h-64">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={RENT_TREND} margin={{ top: 4, right: 8, bottom: 0, left: -12 }}>
            <CartesianGrid stroke="#EAE0CC" strokeDasharray="4 4" vertical={false} />
            <XAxis dataKey="month" tick={{ fontSize: 12, fill: '#2A2521', opacity: 0.6 }} axisLine={false} tickLine={false} />
            <YAxis
              tickFormatter={(v) => formatEtb(v as number)}
              tick={{ fontSize: 12, fill: '#2A2521', opacity: 0.6 }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              formatter={(value: number) => [`ETB ${value.toLocaleString('en-US')}`, undefined]}
              contentStyle={{ borderRadius: 8, borderColor: '#EAE0CC', fontSize: 13 }}
            />
            {RENT_TREND_SERIES.map((s) => (
              <Line
                key={s.key}
                type="monotone"
                dataKey={s.key}
                stroke={s.color}
                strokeWidth={2.5}
                dot={false}
                activeDot={{ r: 4 }}
                animationDuration={900}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </motion.div>
  )
}
