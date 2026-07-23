'use client'

import React from 'react'
import { AlertCircle, AlertTriangle } from 'lucide-react'

interface AccountingAlertsProps {
  alerts: string[]
}

export function AccountingAlerts({ alerts }: AccountingAlertsProps) {
  if (alerts.length === 0) {
    return (
      <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex gap-2.5 items-start shadow-sm h-full">
        <CheckCircleIcon className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
        <div className="text-xs text-green-800 leading-normal">
          <strong className="block font-bold mb-0.5 text-green-900">Nenhuma irregularidade detectada</strong>
          <p className="font-normal">O período ativo está saudável: lançamentos balanceados, sem rascunhos pendentes e sem divergências patrimoniais.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex gap-2.5 items-start shadow-sm h-full overflow-y-auto max-h-[160px] scrollbar-thin scrollbar-thumb-amber-200">
      <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
      <div className="space-y-1.5 flex-1 text-xs text-amber-850">
        <strong className="block font-bold text-amber-900">Auditoria Operacional & Pendências ({alerts.length})</strong>
        <ul className="list-disc list-inside space-y-1 font-medium leading-relaxed">
          {alerts.map((alert, idx) => (
            <li key={idx} className="marker:text-amber-500">{alert}</li>
          ))}
        </ul>
      </div>
    </div>
  )
}

function CheckCircleIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={2}
      stroke="currentColor"
      {...props}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
    </svg>
  )
}
