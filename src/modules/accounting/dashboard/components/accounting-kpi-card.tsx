'use client'

import React from 'react'

interface AccountingKpiCardProps {
  title: string
  value: string | number
  subtext?: string
  icon?: React.ComponentType<any>
  theme?: 'green' | 'red' | 'blue' | 'gray' | 'purple'
}

export function AccountingKpiCard({
  title,
  value,
  subtext,
  icon: Icon,
  theme = 'gray'
}: AccountingKpiCardProps) {
  const getThemeClasses = () => {
    switch (theme) {
      case 'green':
        return {
          iconBg: 'bg-green-50 text-green-700 border border-green-100',
          card: 'border-green-200 bg-green-50/5'
        }
      case 'red':
        return {
          iconBg: 'bg-red-50 text-red-700 border border-red-100',
          card: 'border-red-200 bg-red-50/5'
        }
      case 'blue':
        return {
          iconBg: 'bg-blue-50 text-blue-700 border border-blue-100',
          card: 'border-blue-200 bg-blue-50/5'
        }
      case 'purple':
        return {
          iconBg: 'bg-purple-50 text-purple-700 border border-purple-100',
          card: 'border-purple-200 bg-purple-50/5'
        }
      default:
        return {
          iconBg: 'bg-gray-50 text-gray-500 border border-gray-200',
          card: 'border-gray-200'
        }
    }
  }

  const classes = getThemeClasses()

  return (
    <div className={`bg-white p-5 border rounded-xl shadow-sm flex items-start justify-between gap-4 transition-all hover:shadow-md ${classes.card}`}>
      <div className="space-y-2">
        <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block">
          {title}
        </span>
        <h4 className="text-xl font-bold text-gray-800 tracking-tight">
          {value}
        </h4>
        {subtext && (
          <span className="text-[10px] text-gray-400 block font-medium">
            {subtext}
          </span>
        )}
      </div>

      {Icon && (
        <div className={`p-2.5 rounded-lg ${classes.iconBg}`}>
          <Icon className="w-5 h-5" />
        </div>
      )}
    </div>
  )
}
