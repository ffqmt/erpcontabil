import React from 'react'
import { XmlImportTabs } from '@/modules/fiscal/xml-import/components/xml-import-tabs'
import { FileUp } from 'lucide-react'

export default function ImportarXmlFiscalPage() {
  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center gap-3 border-b border-gray-200 pb-4">
        <div className="p-2.5 bg-indigo-50 text-indigo-700 rounded-lg border border-indigo-100">
          <FileUp className="w-6 h-6" />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-gray-800 tracking-tight">Importar XML Fiscal (NF-e/CT-e/NFS-e)</h2>
          <p className="text-sm text-gray-500">Envie ou cole XMLs fiscais de entrada ou saída, ou selecione vários arquivos para importar em lote.</p>
        </div>
      </div>
      <XmlImportTabs />
    </div>
  )
}
