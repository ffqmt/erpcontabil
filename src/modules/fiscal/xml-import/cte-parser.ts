import { XMLParser } from 'fast-xml-parser'
import { ParsedNfeResult, ParsedNfeItem } from './nfe-parser'

function toArray<T>(value: T | T[] | undefined | null): T[] {
  if (value === undefined || value === null) return []
  return Array.isArray(value) ? value : [value]
}

function num(value: unknown): number | null {
  if (value === undefined || value === null || value === '') return null
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

function str(value: unknown): string | null {
  if (value === undefined || value === null) return null
  const s = String(value).trim()
  return s.length > 0 ? s : null
}

function extractDatePart(dateTimeStr: string | null): string | null {
  if (!dateTimeStr) return null
  const m = dateTimeStr.match(/^(\d{4}-\d{2}-\d{2})/)
  return m ? m[1] : null
}

function regexFallbackAccessKey(xmlText: string): string | null {
  const m = xmlText.match(/Id="(?:CTe|cte)(\d{44})"/)
  return m ? m[1] : null
}

/**
 * Parser inicial de CT-e (Conhecimento de Transporte Eletrônico, modelo 57), Etapa 32D.
 * CT-e tem estrutura nacional padronizada (cteProc > CTe > infCte), então o parser é
 * estrutural como o de NF-e — mas cobre só os campos mínimos pedidos (chave, número,
 * série, emissão, emitente, tomador, valor da prestação, ICMS, CFOP, natureza da
 * operação). Não há <det> de itens em CT-e (é um serviço de transporte, não uma venda de
 * mercadorias) — o parser sintetiza 1 "item" representando o serviço de transporte
 * prestado, para reaproveitar a mesma gravação de fiscal_document_items já usada por NF-e.
 * Nunca lança exceção — erros viram `errors[]`, mesmo padrão do parser de NF-e.
 */
export function parseCteXml(xmlText: string): ParsedNfeResult {
  const errors: string[] = []
  const warnings: string[] = []

  const empty: ParsedNfeResult = {
    ok: false, errors, warnings, accessKey: null, documentNumber: null, series: null,
    issueDate: null, operationDate: null, naturezaOperacao: null, emitCnpj: null, emitName: null,
    emitIe: null, emitCity: null, emitState: null, destCnpj: null, destCpf: null, destName: null,
    totalAmount: null, merchandiseAmount: null, freightAmount: null, insuranceAmount: null,
    discountAmount: null, otherExpensesAmount: null, icmsBase: null, icmsAmount: null, ipiAmount: null,
    pisAmount: null, pisBase: null, cofinsAmount: null, cofinsBase: null,
    issBase: null, issRate: null, issAmount: null, items: []
  }

  const cleanText = xmlText.charCodeAt(0) === 0xfeff ? xmlText.slice(1) : xmlText
  if (!cleanText || !cleanText.trim()) {
    errors.push('Conteúdo XML vazio.')
    return empty
  }

  let parsed: any
  try {
    const xmlParser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_', parseTagValue: false, parseAttributeValue: false, trimValues: true })
    parsed = xmlParser.parse(cleanText)
  } catch (e: any) {
    errors.push(`XML malformado: ${e?.message || 'erro desconhecido ao parsear.'}`)
    const accessKey = regexFallbackAccessKey(cleanText)
    if (accessKey) {
      warnings.push('XML malformado, mas a chave de acesso foi recuperada por reconhecimento de padrão. Revise os demais campos manualmente.')
      return { ...empty, accessKey }
    }
    return empty
  }

  const cte = parsed?.cteProc?.CTe ?? parsed?.CTe
  const infCte = cte?.infCte
  if (!infCte) {
    errors.push('Estrutura de CT-e não reconhecida — a tag <infCte> não foi encontrada no XML.')
    const accessKey = regexFallbackAccessKey(cleanText)
    return accessKey ? { ...empty, accessKey, warnings: [...warnings, 'Apenas a chave de acesso pôde ser recuperada por reconhecimento de padrão.'] } : empty
  }

  const idAttr = str(infCte['@_Id'])
  const accessKey = idAttr ? idAttr.replace(/^(CTe|cte)/, '') : regexFallbackAccessKey(cleanText)
  if (!accessKey || accessKey.length !== 44) {
    warnings.push('Chave de acesso ausente ou com tamanho inesperado (esperado 44 dígitos) — revise manualmente antes de confirmar.')
  }

  const ide = infCte.ide || {}
  const emit = infCte.emit || {}
  const enderEmit = emit.enderEmit || {}
  const vPrest = infCte.vPrest || {}
  const imp = infCte.imp || {}

  // Tomador do serviço: ide.toma indica qual grupo (0=remetente,1=expedidor,2=recebedor,
  // 3=destinatário,4=outro) é o tomador — cobrimos os 2 casos mais comuns (remetente/
  // destinatário) e caímos para "outro" com aviso quando não identificado, em vez de
  // arriscar um mapeamento errado.
  const tomaCode = str(ide?.toma?.['#text'] ?? ide?.toma)
  let tomador: any = null
  let tomadorLabel = ''
  if (tomaCode === '0') { tomador = infCte.rem; tomadorLabel = 'remetente' }
  else if (tomaCode === '3') { tomador = infCte.dest; tomadorLabel = 'destinatário' }
  else if (tomaCode === '1') { tomador = infCte.exped; tomadorLabel = 'expedidor' }
  else if (tomaCode === '2') { tomador = infCte.receb; tomadorLabel = 'recebedor' }
  else {
    tomador = infCte.dest || infCte.rem
    tomadorLabel = infCte.dest ? 'destinatário (assumido — tag toma não reconhecida)' : 'remetente (assumido — tag toma não reconhecida)'
    warnings.push('Não foi possível identificar com certeza o tomador do serviço (tag <toma> não reconhecida) — revise o cliente antes de confirmar.')
  }
  if (!tomador) warnings.push('Tomador do serviço não encontrado no XML — revise manualmente.')

  const icmsGroup = imp?.ICMS || {}
  const icmsKeys = Object.keys(icmsGroup)
  const icmsChild = icmsKeys.length > 0 ? icmsGroup[icmsKeys[0]] : {}

  const totalAmount = num(vPrest.vTPrest)
  const item: ParsedNfeItem = {
    lineNumber: 1,
    description: `Serviço de Transporte — ${str(ide.xMunIni) || ''} → ${str(ide.xMunFim) || ''}`.trim(),
    supplierProductCode: null,
    ncm: null,
    cest: null,
    cfop: str(ide.CFOP),
    unit: null,
    quantity: 1,
    unitPrice: totalAmount,
    totalAmount: totalAmount ?? 0,
    cstIcms: str(icmsChild?.CST),
    csosn: str(icmsChild?.CSOSN),
    icmsBase: num(icmsChild?.vBC),
    icmsRate: num(icmsChild?.pICMS),
    icmsAmount: num(icmsChild?.vICMS),
    cstIpi: null, ipiBase: null, ipiRate: null, ipiAmount: null,
    cstPis: null, pisBase: null, pisRate: null, pisAmount: null,
    cstCofins: null, cofinsBase: null, cofinsRate: null, cofinsAmount: null,
    issBase: null, issRate: null, issAmount: null
  }

  const result: ParsedNfeResult = {
    ok: errors.length === 0,
    errors,
    warnings,
    accessKey: accessKey || null,
    documentNumber: str(ide.nCT),
    series: str(ide.serie),
    issueDate: extractDatePart(str(ide.dhEmi)),
    operationDate: extractDatePart(str(ide.dhEmi)),
    naturezaOperacao: str(ide.natOp) ? `${str(ide.natOp)} (tomador: ${tomadorLabel})` : `Prestação de serviço de transporte (tomador: ${tomadorLabel})`,
    emitCnpj: str(emit.CNPJ),
    emitName: str(emit.xNome),
    emitIe: str(emit.IE),
    emitCity: str(enderEmit.xMun),
    emitState: str(enderEmit.UF),
    destCnpj: str(tomador?.CNPJ),
    destCpf: str(tomador?.CPF),
    destName: str(tomador?.xNome),
    totalAmount,
    merchandiseAmount: null,
    freightAmount: totalAmount,
    insuranceAmount: null,
    discountAmount: null,
    otherExpensesAmount: null,
    icmsBase: num(icmsChild?.vBC),
    icmsAmount: num(icmsChild?.vICMS),
    ipiAmount: null,
    pisAmount: null,
    pisBase: null,
    cofinsAmount: null,
    cofinsBase: null,
    issBase: null,
    issRate: null,
    issAmount: null,
    items: [item]
  }

  if (!result.documentNumber) errors.push('Número do CT-e (nCT) não encontrado.')
  if (!result.issueDate) errors.push('Data de emissão (dhEmi) não encontrada.')
  if (!result.emitCnpj) errors.push('CNPJ do emitente não encontrado.')
  if (result.totalAmount === null) errors.push('Valor da prestação (vTPrest) não encontrado.')

  result.ok = errors.length === 0
  return result
}
