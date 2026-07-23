import React from 'react'
import { Sidebar } from './sidebar'
import { Topbar } from './topbar'

interface AppShellProps {
  workspaceName: string
  companyId: string
  legalName: string
  competence: string
  periodStatus: string
  userName: string
  userEmail: string
  companies: { id: string; legal_name: string }[]
  children: React.ReactNode
}

export function AppShell({
  workspaceName,
  companyId,
  legalName,
  competence,
  periodStatus,
  userName,
  userEmail,
  companies,
  children
}: AppShellProps) {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col font-sans">
      {/* Sidebar Fixa Lateral */}
      <Sidebar workspaceName={workspaceName} />

      <div className="flex-1 flex flex-col">
        {/* Topbar de Ações e Switchers */}
        <Topbar
          companyId={companyId}
          legalName={legalName}
          competence={competence}
          periodStatus={periodStatus}
          userName={userName}
          userEmail={userEmail}
          companies={companies}
        />

        {/* Área de Conteúdo Principal */}
        <main className="ml-64 p-6 flex-1 bg-gray-50 animate-fade-in print:ml-0 print:p-0 print:bg-white">
          {children}
        </main>
      </div>
    </div>
  )
}
