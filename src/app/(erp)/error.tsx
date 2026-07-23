'use client'

import React from 'react'
import { AlertTriangle } from 'lucide-react'

// Etapa 29B (regra C.5): quando getCurrentContext() lança um erro controlado — sessão
// ausente, profile não vinculado, usuário sem nenhuma empresa permitida — este boundary
// mostra uma mensagem amigável em vez do overlay de erro padrão do Next.js. Convenção de
// arquivo do App Router: error.tsx precisa ser Client Component.
export default function ErpError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
      <div className="max-w-lg w-full bg-white border border-red-200 rounded-xl shadow-sm p-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-red-50 text-red-600 rounded-lg border border-red-100">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <h2 className="text-lg font-bold text-gray-800">Não foi possível carregar seu contexto</h2>
        </div>
        <p className="text-sm text-gray-600 leading-relaxed">{error.message}</p>
        <div className="flex gap-3 pt-2">
          <button
            onClick={() => reset()}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-lg cursor-pointer"
          >
            Tentar novamente
          </button>
          <a
            href="/login"
            className="px-4 py-2 border border-gray-200 text-gray-600 hover:bg-gray-50 text-sm font-semibold rounded-lg"
          >
            Voltar ao login
          </a>
        </div>
      </div>
    </div>
  )
}
