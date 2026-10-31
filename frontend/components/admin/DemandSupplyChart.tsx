'use client'

import { motion } from 'framer-motion'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { DEMAND_VS_SUPPLY } from '@/lib/marketInsights'

function formatEtb(n: number) {
  return n >= 1000 ? `${Math.round(n / 1000)}K` : `${n}`
}

export default function DemandSupplyChart() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0, transition: { duration: 0.4, delay: 0.1 } }}
      className="rounded-lg border border-charcoal/10 bg-white p-5 shadow-stamp"
    >
      <div className="flex items-center justify-between">
        <h2 className="font-display text-lg font-semibold text-charcoal">Demand vs Supply</h2>
        <div className="flex gap-3 text-xs text-charcoal/60">
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-rust" />
            Demand
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-sand" />
            Supply
          </span>
        </div>
      </div>

      <div className="mt-4 h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={DEMAND_VS_SUPPLY} margin={{ top: 4, right: 8, bottom: 0, left: -12 }} barGap={4}>
            <CartesianGrid stroke="#EAE0CC" strokeDasharray="4 4" vertical={false} />
            <XAxis dataKey="month" tick={{ fontSize: 12, fill: '#2A2521', opacity: 0.6 }} axisLine={false} tickLine={false} />
            <YAxis
              tickFormatter={(v) => formatEtb(v as number)}
              tick={{ fontSize: 12, fill: '#2A2521', opacity: 0.6 }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              formatter={(value: number) => [`${value.toLocaleString('en-US')}`, undefined]}
              contentStyle={{ borderRadius: 8, borderColor: '#EAE0CC', fontSize: 13 }}
            />
            <Bar dataKey="Demand" fill="#B8451F" radius={[3, 3, 0, 0]} animationDuration={900} />
            <Bar dataKey="Supply" fill="#EAE0CC" radius={[3, 3, 0, 0]} animationDuration={900} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </motion.div>
  )
}
