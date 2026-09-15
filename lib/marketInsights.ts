export interface HeadlineStat {
  label: string
  value: string
  deltaLabel: string
  deltaDirection: 'up' | 'down'
}

export const MARKET_HEADLINE_STATS: HeadlineStat[] = [
  { label: 'Average Rent (All Types)', value: 'ETB 18,750', deltaLabel: '6.0% vs last 6 months', deltaDirection: 'up' },
  { label: 'Average Rent (2-Bed)', value: 'ETB 17,200', deltaLabel: '5.8% vs last 6 months', deltaDirection: 'up' },
  { label: 'Average Rent (3-Bed)', value: 'ETB 23,600', deltaLabel: '7.2% vs last 6 months', deltaDirection: 'up' },
  { label: 'Active Demand Requests', value: '1,245', deltaLabel: '2.1% vs last 6 months', deltaDirection: 'down' },
]

/** Rent Trend (All Types) — average asking rent by unit size, last 6 months. */
export const RENT_TREND = [
  { month: 'Jan', '1-Bed': 9800, '2-Bed': 13200, '3-Bed': 16500 },
  { month: 'Feb', '1-Bed': 10100, '2-Bed': 13600, '3-Bed': 17100 },
  { month: 'Mar', '1-Bed': 10400, '2-Bed': 14300, '3-Bed': 18400 },
  { month: 'Apr', '1-Bed': 10900, '2-Bed': 14900, '3-Bed': 19200 },
  { month: 'May', '1-Bed': 11400, '2-Bed': 15600, '3-Bed': 20800 },
  { month: 'Jun', '1-Bed': 11800, '2-Bed': 17200, '3-Bed': 22600 },
]

export const RENT_TREND_SERIES = [
  { key: '3-Bed', color: '#EFC94C' },
  { key: '2-Bed', color: '#B8451F' },
  { key: '1-Bed', color: '#3D8FA0' },
] as const

/** Demand vs Supply — active rental requests vs. active listings, by month. */
export const DEMAND_VS_SUPPLY = [
  { month: 'Jan', Demand: 11400, Supply: 6100 },
  { month: 'Feb', Demand: 8700, Supply: 4900 },
  { month: 'Mar', Demand: 10200, Supply: 5600 },
  { month: 'Apr', Demand: 12300, Supply: 6900 },
  { month: 'May', Demand: 13100, Supply: 7500 },
]

export const POPULAR_NEIGHBORHOODS = [
  { name: 'Bole', pct: 82 },
  { name: 'CMC', pct: 67 },
  { name: 'Kazanchis', pct: 58 },
  { name: 'Saris', pct: 42 },
  { name: 'Yeka', pct: 33 },
]

export const PROPERTY_TYPE_DISTRIBUTION = [
  { name: 'Apartment', pct: 42, color: '#B8451F' },
  { name: 'Condo', pct: 26, color: '#EFC94C' },
  { name: 'House', pct: 20, color: '#2A2521' },
  { name: 'Studio', pct: 8, color: '#3D8FA0' },
  { name: 'Other', pct: 4, color: '#EAE0CC' },
]

export const INSIGHTS_TABS = ['Overview', 'Financials', 'Demand', 'Supply', 'Neighborhoods'] as const
export type InsightsTab = (typeof INSIGHTS_TABS)[number]
