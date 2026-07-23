import React from 'react'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getCurrentContext } from '@/lib/context/current-context'
import {
  getFiscalDocumentById,
  getFiscalDocumentTaxAssessmentLines,
  getFiscalDocumentFixedAssets,
  getFiscalXmlImportForDocument
} from '@/modules/fiscal/queries'
import { getAccounts } from '@/modules/accounting/accounts/queries'
import { listCostCentersForClassification } from '@/modules/banking/queries'
import { listAssetCategories } from '@/modules/assets/queries'
import { findFiscalAccountingRuleForDocument, getFiscalAccountingApplications } from '@/modules/fiscal/accounting-rules/queries'
import { listFiscalPendencies } from '@/modules/fiscal/validation-issues/queries'
import { FiscalDocumentPendenciesPanel } from '@/modules/fiscal/validation-issues/components/fiscal-document-pendencies-panel'
import { FiscalDocumentStatusBadge } from '@/modules/fiscal/components/fiscal-document-status-badge'
import { FiscalDocumentWorkflowActions } from '@/modules/fiscal/components/fiscal-document-workflow-actions'
import { FiscalDocumentItemForm } from '@/modules/fiscal/components/fiscal-document-item-form'
import { FiscalTaxSummary } from '@/modules/fiscal/components/fiscal-tax-summary'
import { FiscalDocumentRetentionsForm } from '@/modules/fiscal/components/fiscal-document-retentions-form'
import { FiscalDocumentAccountingForm } from '@/modules/fiscal/components/fiscal-document-accounting-form'
import { FiscalDocumentTabs } from '@/modules/fiscal/components/fiscal-document-tabs'
import { CreateAssetFromItemForm } from '@/modules/fiscal/components/create-asset-from-item-form'
import {
  formatCurrencyBRL,
  formatDateBR,
  FISCAL_DOCUMENT_TYPE_LABELS,
  FISCAL_DOCUMENT_ACCOUNTING_STATUS_LABELS,
  FISCAL_DOCUMENT_TAX_STATUS_LABELS,
  EDITABLE_FISCAL_STATUSES
} from '@/modules/fiscal/utils'
import { FileText, Landmark, Boxes, FileStack } from 'lucide-react'

export const dynamic = 'force-dynamic'

export default async function FiscalDocumentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const context = await getCurrentContext()

  const doc = await getFiscalDocumentById(id, context.companyId)
  if (!doc) notFound()

  const [chartAccounts, costCenters, applications, taxAssessmentLines, fixedAssets, xmlImport, assetCategories, pendencies] = await Promise.all([
    getAccounts(context.companyId),
    listCostCentersForClassification(context.companyId),
    getFiscalAccountingApplications(id, context.companyId),
    getFiscalDocumentTaxAssessmentLines(id, context.companyId),
    getFiscalDocumentFixedAssets(id, context.companyId),
    getFiscalXmlImportForDocument(id, context.companyId),
    listAssetCategories(context.companyId),
    listFiscalPendencies(context.companyId, { fiscalDocumentId: id })
  ])
  const openPendenciesCount = pendencies.filter((p) => p.status === 'OPEN').length

  const suggestion = doc.accounting_status === 'ACCOUNTED' ? null : await findFiscalAccountingRuleForDocument(id, context.companyId)

  const editable = (EDITABLE_FISCAL_STATUSES as readonly string[]).includes(doc.status)

  const linkedItemIds = new Set(fixedAssets.map((a: any) => a.fiscal_document_item_id).filter(Boolean))
  const pendingAssetItems = (doc.items || []).filter((it) => it.item_type === 'ASSET' && !linkedItemIds.has(it.id))

  const accountingBadge =
    doc.accounting_status === 'ACCOUNTED' ? (
      <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
    ) : doc.accounting_status === 'ACCOUNTING_ERROR' ? (
      <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
    ) : (
      <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
    )

  const accountingStatusColor =
    doc.accounting_status === 'ACCOUNTED' ? 'bg-green-50 text-green-700 border-green-200'
      : doc.accounting_status === 'ACCOUNTING_ERROR' ? 'bg-red-50 text-red-700 border-red-200'
      : 'bg-amber-50 text-amber-700 border-amber-200'

  const taxStatusColor =
    doc.tax_status === 'ASSESSED' ? 'bg-green-50 text-green-700 border-green-200'
      : doc.tax_status === 'IGNORED' ? 'bg-gray-100 text-gray-600 border-gray-200'
      : 'bg-amber-50 text-amber-700 border-amber-200'

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-start justify-between gap-4 border-b border-gray-200 pb-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-indigo-50 text-indigo-700 rounded-lg border border-indigo-100">
            <FileText className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-gray-800 tracking-tight">
              {FISCAL_DOCUMENT_TYPE_LABELS[doc.document_type]} {doc.number ? `nº ${doc.number}` : ''}
            </h2>
            <p className="text-sm text-gray-500">{doc.partner?.name || 'Parceiro não informado'}</p>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1.5">
          <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Status Fiscal</span>
          <FiscalDocumentStatusBadge status={doc.status} />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Rastro:</span>
        <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border ${accountingStatusColor}`}>
          Contábil: {FISCAL_DOCUMENT_ACCOUNTING_STATUS_LABELS[doc.accounting_status]}
        </span>
        <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border ${taxStatusColor}`}>
          Apuração: {FISCAL_DOCUMENT_TAX_STATUS_LABELS[doc.tax_status]}
        </span>
      </div>

      <FiscalDocumentWorkflowActions doc={doc} />

      <FiscalDocumentTabs
        tabs={[
          {
            key: 'documento',
            label: 'Documento',
            content: (
              <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-2">
                <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Dados do Documento</h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
                  <div><span className="text-[10px] text-gray-400 block">Emissão</span><span className="font-semibold text-gray-800">{formatDateBR(doc.issue_date)}</span></div>
                  <div><span className="text-[10px] text-gray-400 block">Operação</span><span className="font-semibold text-gray-800">{formatDateBR(doc.operation_date)}</span></div>
                  <div><span className="text-[10px] text-gray-400 block">Valor Total</span><span className="font-mono font-bold text-gray-800">{formatCurrencyBRL(doc.document_amount)}</span></div>
                  <div><span className="text-[10px] text-gray-400 block">Direção</span><span className="font-semibold text-gray-800">{doc.direction === 'IN' ? 'Entrada' : 'Saída'}</span></div>
                  <div><span className="text-[10px] text-gray-400 block">Parceiro</span><span className="font-semibold text-gray-800">{doc.partner?.name || '—'}</span></div>
                  <div><span className="text-[10px] text-gray-400 block">Natureza Fiscal</span><span className="font-semibold text-gray-800">{doc.fiscal_operation_nature ? `${doc.fiscal_operation_nature.code} — ${doc.fiscal_operation_nature.name}` : '—'}</span></div>
                  <div><span className="text-[10px] text-gray-400 block">Origem</span><span className="font-semibold text-gray-800">{doc.source}</span></div>
                  <div><span className="text-[10px] text-gray-400 block">Chave de Acesso</span><span className="font-mono text-[11px] text-gray-600">{doc.access_key || '—'}</span></div>
                </div>
                {doc.notes && <p className="text-xs text-gray-500 border-t border-gray-100 pt-2 mt-2">{doc.notes}</p>}
              </div>
            )
          },
          {
            key: 'pendencias',
            label: 'Pendências',
            badge: openPendenciesCount > 0 ? <span className="w-1.5 h-1.5 rounded-full bg-amber-500" /> : undefined,
            content: <FiscalDocumentPendenciesPanel pendencies={pendencies} />
          },
          { key: 'itens', label: 'Itens', content: <FiscalDocumentItemForm doc={doc} editable={editable} /> },
          {
            key: 'tributos',
            label: 'Tributos',
            content: (
              <div className="space-y-4">
                <FiscalTaxSummary doc={doc} />
                {editable && <FiscalDocumentRetentionsForm doc={doc} />}
              </div>
            )
          },
          {
            key: 'contabilidade',
            label: 'Contabilidade',
            badge: accountingBadge,
            content: <FiscalDocumentAccountingForm doc={doc} chartAccounts={chartAccounts} costCenters={costCenters} suggestion={suggestion} applications={applications} />
          },
          {
            key: 'apuracao',
            label: 'Apuração Tributária',
            content: (
              <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-3">
                <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
                  <Landmark className="w-3.5 h-3.5" />
                  Linhas de Apuração que Citam este Documento
                </h3>
                {taxAssessmentLines.length === 0 ? (
                  <p className="text-xs text-gray-400">Nenhuma linha de apuração tributária gerada a partir deste documento ainda.</p>
                ) : (
                  <div className="space-y-2">
                    {taxAssessmentLines.map((line: any) => (
                      <div key={line.id} className="border border-gray-100 rounded-lg p-3 text-xs flex items-center justify-between">
                        <div>
                          <span className="font-semibold text-gray-700">{line.tax_assessment?.tax_type}</span>
                          <span className="text-gray-400"> · {line.tax_assessment?.competence} · {line.description}</span>
                        </div>
                        <span className="font-mono font-bold text-gray-800">{formatCurrencyBRL(line.amount)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          },
          {
            key: 'patrimonio',
            label: 'Patrimônio',
            content: (
              <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-3">
                <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
                  <Boxes className="w-3.5 h-3.5" />
                  Bens Patrimoniais Criados a partir deste Documento
                </h3>
                {fixedAssets.length === 0 ? (
                  <p className="text-xs text-gray-400">Nenhum bem patrimonial vinculado a este documento ainda.</p>
                ) : (
                  <div className="space-y-2">
                    {fixedAssets.map((asset: any) => (
                      <Link key={asset.id} href={`/patrimonio/bens/${asset.id}`} className="block border border-gray-100 rounded-lg p-3 text-xs hover:border-emerald-300 transition-colors">
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-gray-700">{asset.code ? `${asset.code} — ` : ''}{asset.description}</span>
                          <span className="font-mono font-bold text-gray-800">{formatCurrencyBRL(asset.acquisition_amount)}</span>
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
                {pendingAssetItems.length > 0 && (
                  <div className="border-t border-gray-100 pt-3 space-y-2">
                    <h4 className="text-[11px] font-bold text-amber-700 uppercase tracking-wider">Itens Classificados como Ativo — Pendentes de Criar o Bem</h4>
                    {pendingAssetItems.map((it) => (
                      <CreateAssetFromItemForm key={it.id} item={it} categories={assetCategories} />
                    ))}
                  </div>
                )}
              </div>
            )
          },
          {
            key: 'xml',
            label: 'XML/Auditoria',
            content: (
              <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-2 text-xs">
                <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
                  <FileStack className="w-3.5 h-3.5" />
                  Origem e Auditoria
                </h3>
                {xmlImport ? (
                  <div className="grid grid-cols-2 gap-3">
                    <div><span className="text-[10px] text-gray-400 block">Arquivo</span><span className="font-semibold text-gray-800">{xmlImport.file_name || '—'}</span></div>
                    <div><span className="text-[10px] text-gray-400 block">Importado em</span><span className="font-semibold text-gray-800">{formatDateBR(xmlImport.created_at?.slice(0, 10))}</span></div>
                    <div><span className="text-[10px] text-gray-400 block">Status da Importação</span><span className="font-semibold text-gray-800">{xmlImport.import_status}</span></div>
                    <div><span className="text-[10px] text-gray-400 block">Hash</span><span className="font-mono text-[10px] text-gray-600 break-all">{xmlImport.import_hash}</span></div>
                    {xmlImport.parse_errors && (
                      <div className="col-span-2 bg-amber-50 border border-amber-200 rounded p-2 text-amber-700">
                        Avisos no momento da importação: {JSON.stringify(xmlImport.parse_errors)}
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-gray-400">Este documento não veio de uma importação de XML (origem: {doc.source}).</p>
                )}
                <div className="border-t border-gray-100 pt-2 grid grid-cols-2 gap-3">
                  <div><span className="text-[10px] text-gray-400 block">Chave de Acesso</span><span className="font-mono text-[11px] text-gray-600">{doc.access_key || '—'}</span></div>
                  <div><span className="text-[10px] text-gray-400 block">Criado em</span><span className="font-semibold text-gray-800">{formatDateBR(doc.created_at?.slice(0, 10))}</span></div>
                </div>
              </div>
            )
          }
        ]}
      />
    </div>
  )
}
