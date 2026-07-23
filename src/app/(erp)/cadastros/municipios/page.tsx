import React from 'react'
import { getMunicipalities, getStates } from '@/modules/registrations/locations/queries'
import { MapPin, AlertCircle, Info } from 'lucide-react'

export const dynamic = 'force-dynamic'

export default async function MunicipalitiesPage() {
  let errorMsg: string | null = null
  let municipalities: Awaited<ReturnType<typeof getMunicipalities>> = []
  let statesCount = 0

  try {
    const [muns, states] = await Promise.all([getMunicipalities(), getStates()])
    municipalities = muns
    statesCount = states.length
  } catch (error: any) {
    errorMsg = error.message || 'Falha ao carregar municípios.'
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 border-b border-gray-200 pb-4">
        <div className="p-2.5 bg-indigo-50 text-indigo-700 rounded-lg border border-indigo-100">
          <MapPin className="w-6 h-6" />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-gray-800 tracking-tight">Municípios/UF</h2>
          <p className="text-sm text-gray-500">Catálogo de referência global, somente leitura ({statesCount} UF, {municipalities.length} municípios seedados).</p>
        </div>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex gap-2.5 items-start">
        <Info className="w-4.5 h-4.5 text-blue-600 flex-shrink-0 mt-0.5" />
        <p className="text-xs text-blue-800 leading-relaxed">
          Catálogo mínimo de referência (10 municípios) para os seletores de endereço em Parceiros. Não é obrigatório: o campo de Município em outros cadastros aceita texto livre. Sem CRUD nesta etapa — expansão via seed/migração.
        </p>
      </div>

      {errorMsg ? (
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-red-800 flex gap-3">
          <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5 text-red-650" />
          <p className="text-sm">{errorMsg}</p>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wider">
              <tr>
                <th className="text-left px-4 py-3 font-semibold">Município</th>
                <th className="text-left px-4 py-3 font-semibold">UF</th>
                <th className="text-left px-4 py-3 font-semibold">Código IBGE</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {municipalities.map((m) => (
                <tr key={m.id}>
                  <td className="px-4 py-2.5 font-medium text-gray-800">{m.name}</td>
                  <td className="px-4 py-2.5 text-gray-500 font-mono">{m.uf}</td>
                  <td className="px-4 py-2.5 text-gray-400 font-mono">{m.ibge_code || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
