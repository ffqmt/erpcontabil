'use client'

import React, { useState } from 'react'

export interface FiscalDocumentTab {
  key: string
  label: string
  content: React.ReactNode
  badge?: React.ReactNode
}

interface FiscalDocumentTabsProps {
  tabs: FiscalDocumentTab[]
}

export function FiscalDocumentTabs({ tabs }: FiscalDocumentTabsProps) {
  const [active, setActive] = useState(tabs[0]?.key)

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-1 border-b border-gray-200">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActive(tab.key)}
            className={`inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-t-lg border-b-2 -mb-px transition-colors cursor-pointer ${
              active === tab.key
                ? 'border-emerald-600 text-emerald-700 bg-emerald-50/50'
                : 'border-transparent text-gray-500 hover:text-gray-800 hover:bg-gray-50'
            }`}
          >
            {tab.label}
            {tab.badge}
          </button>
        ))}
      </div>
      <div>
        {tabs.map((tab) => (
          <div key={tab.key} className={tab.key === active ? 'block' : 'hidden'}>
            {tab.content}
          </div>
        ))}
      </div>
    </div>
  )
}
