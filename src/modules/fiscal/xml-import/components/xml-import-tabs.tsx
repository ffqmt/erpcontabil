'use client'

import React, { useState } from 'react'
import { XmlImportForm } from './xml-import-form'
import { BulkXmlImportForm } from './bulk-xml-import-form'

const tabClass = (active: boolean) =>
  `px-4 py-2 text-sm font-semibold rounded-lg transition-colors cursor-pointer ${
    active ? 'bg-emerald-600 text-white shadow-sm' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
  }`

export function XmlImportTabs() {
  const [mode, setMode] = useState<'single' | 'bulk'>('single')

  return (
    <div className="space-y-6">
      <div className="flex gap-2">
        <button type="button" className={tabClass(mode === 'single')} onClick={() => setMode('single')}>
          1 arquivo (com revisão)
        </button>
        <button type="button" className={tabClass(mode === 'bulk')} onClick={() => setMode('bulk')}>
          Vários arquivos (em lote)
        </button>
      </div>
      {mode === 'single' ? <XmlImportForm /> : <BulkXmlImportForm />}
    </div>
  )
}
