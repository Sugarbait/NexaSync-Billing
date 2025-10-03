'use client'

import React from 'react'
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell
} from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'

interface MonthlyTrend {
  month: string
  twilioSMS: number
  twilioVoice: number
  retellAI: number
  total: number
}

interface AnalyticsChartsProps {
  monthlyTrends: MonthlyTrend[]
  currentMonthBreakdown: {
    twilioSMS: number
    twilioVoice: number
    retellAI: number
  }
}

export function AnalyticsCharts({ monthlyTrends, currentMonthBreakdown }: AnalyticsChartsProps) {
  // Color scheme from CareXPS
  const COLORS = {
    primary: '#3B82F6',
    success: '#10B981',
    warning: '#F59E0B',
    danger: '#EF4444',
    purple: '#8B5CF6'
  }

  // Prepare pie chart data
  const pieData = [
    { name: 'Twilio SMS', value: currentMonthBreakdown.twilioSMS, color: COLORS.primary },
    { name: 'Twilio Voice', value: currentMonthBreakdown.twilioVoice, color: COLORS.purple },
    { name: 'Retell AI', value: currentMonthBreakdown.retellAI, color: COLORS.success }
  ].filter(item => item.value > 0)

  // Custom tooltip
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-gray-800 border border-gray-700 rounded-lg shadow-lg p-3">
          <p className="text-sm font-medium text-gray-100">
            {payload[0].payload.month || payload[0].name}
          </p>
          {payload.map((entry: any, index: number) => (
            <p key={index} className="text-xs text-gray-400">
              <span style={{ color: entry.color }}>{entry.name}:</span> ${entry.value.toFixed(2)} CAD
            </p>
          ))}
        </div>
      )
    }
    return null
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
      {/* Revenue Trends Bar Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Revenue Trends (Last 6 Months)</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={monthlyTrends} style={{ backgroundColor: 'transparent' }}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.1} stroke="#374151" />
              <XAxis
                dataKey="month"
                tick={{ fontSize: 12, fill: '#9CA3AF' }}
                stroke="#6B7280"
              />
              <YAxis
                tick={{ fontSize: 12, fill: '#9CA3AF' }}
                stroke="#6B7280"
                tickFormatter={(value) => `$${value}`}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend
                wrapperStyle={{ fontSize: '12px', color: '#9CA3AF' }}
              />
              <Bar
                dataKey="twilioSMS"
                stackId="a"
                fill={COLORS.primary}
                name="Twilio SMS"
                radius={[0, 0, 0, 0]}
              />
              <Bar
                dataKey="twilioVoice"
                stackId="a"
                fill={COLORS.purple}
                name="Twilio Voice"
                radius={[0, 0, 0, 0]}
              />
              <Bar
                dataKey="retellAI"
                stackId="a"
                fill={COLORS.success}
                name="Retell AI"
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Cost Distribution Pie Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Cost Distribution (Current Month)</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart style={{ backgroundColor: 'transparent' }}>
              <Pie
                data={pieData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={(props: any) => `${props.name}: ${(props.percent * 100).toFixed(0)}%`}
                outerRadius={100}
                fill="#8884d8"
                dataKey="value"
              >
                {pieData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
            </PieChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Revenue Trend Line Chart */}
      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle>Revenue Growth Trend</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={monthlyTrends} style={{ backgroundColor: 'transparent' }}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.1} stroke="#374151" />
              <XAxis
                dataKey="month"
                tick={{ fontSize: 12, fill: '#9CA3AF' }}
                stroke="#6B7280"
              />
              <YAxis
                tick={{ fontSize: 12, fill: '#9CA3AF' }}
                stroke="#6B7280"
                tickFormatter={(value) => `$${value}`}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ fontSize: '12px', color: '#9CA3AF' }} />
              <Line
                type="monotone"
                dataKey="total"
                stroke={COLORS.primary}
                strokeWidth={3}
                dot={{ fill: COLORS.primary, r: 4 }}
                activeDot={{ r: 6 }}
                name="Total Revenue"
              />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  )
}
