import { XMLParser } from 'fast-xml-parser'

export interface ParsedNfeItem {
  lineNumber: number
  description: string
  /** Etapa 35A: cProd — código do produto no cadastro do FORNECEDOR (emitente), usado como chave forte de matching item-de-XML -> catálogo interno via partner_item_mappings. Null quando o parser não é schema-aware (CT-e sintetiza item, NFS-e não tem conceito de produto). */
  supplierProductCode: string | null
  ncm: string | null
  cest: string | null
  cfop: string | null
  unit: string | null
  quantity: number
  unitPrice: number | null
  totalAmount: number
  cstIcms: string | null
  csosn: string | null
  icmsBase: number | null
  icmsRate: number | null
  icmsAmount: number | null
  cstIpi: string | null
  ipiBase: number | null
  ipiRate: number | null
  ipiAmount: number | null
  cstPis: string | null
  pisBase: number | null
  pisRate: number | null
  pisAmount: number | null
  cstCofins: string | null
  cofinsBase: number | null
  cofinsRate: number | null
  cofinsAmount: number | null
  // Só usados por NFS-e (Etapa 32D) — NF-e/CT-e deixam null.
  issBase: number | null
  issRate: number | null
  issAmount: number | null
}

export interface ParsedNfeResult {
  ok: boolean
  errors: string[]
  warnings: string[]
  accessKey: string | null
  documentNumber: string | null
  series: string | null
  issueDate: string | null
  operationDate: string | null
  naturezaOperacao: string | null
  emitCnpj: string | null
  emitName: string | null
  emitIe: string | null
  emitCity: string | null
  emitState: string | null
  destCnpj: string | null
  destCpf: string | null
  destName: string | null
  totalAmount: number | null
  merchandiseAmount: number | null
  freightAmount: number | null
  insuranceAmount: number | null
  discountAmount: number | null
  otherExpensesAmount: number | null
  icmsBase: number | null
  icmsAmount: number | null
  ipiAmount: number | null
  pisAmount: number | null
  pisBase: number | null
  cofinsAmount: number | null
  cofinsBase: number | null
  // Só usados por NFS-e (Etapa 32D) — NF-e/CT-e deixam null.
  issBase: number | null
  issRate: number | null
  issAmount: number | null
  items: ParsedNfeItem[]
}

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

// O grupo ICMS/PIS/COFINS/IPI da NF-e tem exatamente 1 filho, cujo nome varia conforme o
// CST/CSOSN (ex.: ICMS00, ICMS20, ICMS60, ICMSSN101...ICMSSN900) — sempre pegamos o único
// filho existente, sem precisar enumerar todos os nomes possíveis.
function firstChild(group: any): any {
  if (!group || typeof group !== 'object') return null
  const keys = Object.keys(group)
  if (keys.length === 0) return null
  return group[keys[0]]
}

function extractDatePart(dateTimeStr: string | null): string | null {
  if (!dateTimeStr) return null
  const m = dateTimeStr.match(/^(\d{4}-\d{2}-\d{2})/)
  return m ? m[1] : null
}

// Fallback por regex quando o parser DOM falha (XML malformado/parcial) — mesma estratégia
// de robustez do protótipo legado sistema.html (parseXMLToDoc), adaptada para Node.
function regexFallbackAccessKey(xmlText: string): string | null {
  const m = xmlText.match(/Id="(?:NFe|nfe)(\d{44})"/)
  return m ? m[1] : null
}

/**
 * Faz o parsing de um XML de NF-e (modelo 55, layout 4.00) para o formato interno usado na
 * prévia de importação. Puro — não acessa banco de dados, testável isoladamente. Nunca
 * lança exceção: erros de parsing viram `errors` no resultado, para a UI mostrar de forma
 * amigável em vez de quebrar a página.
 */
export function parseNfeXml(xmlText: string): ParsedNfeResult {
  const errors: string[] = []
  const warnings: string[] = []

  const empty: ParsedNfeResult = {
    ok: false,
    errors,
    warnings,
    accessKey: null,
    documentNumber: null,
    series: null,
    issueDate: null,
    operationDate: null,
    naturezaOperacao: null,
    emitCnpj: null,
    emitName: null,
    emitIe: null,
    emitCity: null,
    emitState: null,
    destCnpj: null,
    destCpf: null,
    destName: null,
    totalAmount: null,
    merchandiseAmount: null,
    freightAmount: null,
    insuranceAmount: null,
    discountAmount: null,
    otherExpensesAmount: null,
    icmsBase: null,
    icmsAmount: null,
    ipiAmount: null,
    pisAmount: null,
    pisBase: null,
    cofinsAmount: null,
    cofinsBase: null,
    issBase: null,
    issRate: null,
    issAmount: null,
    items: []
  }

  // Remove BOM, se houver (mesmo cuidado já aplicado ao importador de CSV bancário, Etapa 30A).
  const cleanText = xmlText.charCodeAt(0) === 0xfeff ? xmlText.slice(1) : xmlText

  if (!cleanText || !cleanText.trim()) {
    errors.push('Conteúdo XML vazio.')
    return empty
  }

  let parsed: any
  try {
    const xmlParser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: '@_',
      parseTagValue: false,
      parseAttributeValue: false,
      trimValues: true
    })
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

  // nfeProc (XML "completo", com protocolo de autorização) ou NFe "solto" (só a nota).
  const nfe = parsed?.nfeProc?.NFe ?? parsed?.NFe
  const infNFe = nfe?.infNFe
  if (!infNFe) {
    errors.push('Estrutura de NF-e não reconhecida — a tag <infNFe> não foi encontrada no XML.')
    const accessKey = regexFallbackAccessKey(cleanText)
    return accessKey ? { ...empty, accessKey, warnings: [...warnings, 'Apenas a chave de acesso pôde ser recuperada por reconhecimento de padrão.'] } : empty
  }

  const idAttr = str(infNFe['@_Id'])
  const accessKey = idAttr ? idAttr.replace(/^(NFe|nfe)/, '') : regexFallbackAccessKey(cleanText)
  if (!accessKey || accessKey.length !== 44) {
    warnings.push('Chave de acesso ausente ou com tamanho inesperado (esperado 44 dígitos) — revise manualmente antes de confirmar.')
  }

  const ide = infNFe.ide || {}
  const emit = infNFe.emit || {}
  const dest = infNFe.dest || {}
  const total = infNFe.total?.ICMSTot || {}

  const enderEmit = emit.enderEmit || {}

  const items: ParsedNfeItem[] = toArray(infNFe.det).map((det: any, idx: number) => {
    const prod = det.prod || {}
    const imposto = det.imposto || {}

    const icmsChild = firstChild(imposto.ICMS) || {}
    const ipiChild = firstChild(imposto.IPI?.IPITrib ? { IPITrib: imposto.IPI.IPITrib } : imposto.IPI) || {}
    const pisChild = firstChild(imposto.PIS) || {}
    const cofinsChild = firstChild(imposto.COFINS) || {}

    return {
      lineNumber: num(det['@_nItem']) ?? idx + 1,
      description: str(prod.xProd) || `Item ${idx + 1}`,
      supplierProductCode: str(prod.cProd),
      ncm: str(prod.NCM),
      cest: str(prod.CEST),
      cfop: str(prod.CFOP),
      unit: str(prod.uCom),
      quantity: num(prod.qCom) ?? 0,
      unitPrice: num(prod.vUnCom),
      totalAmount: num(prod.vProd) ?? 0,
      cstIcms: str(icmsChild.CST),
      csosn: str(icmsChild.CSOSN),
      icmsBase: num(icmsChild.vBC),
      icmsRate: num(icmsChild.pICMS),
      icmsAmount: num(icmsChild.vICMS),
      cstIpi: str(ipiChild.CST),
      ipiBase: num(ipiChild.vBC),
      ipiRate: num(ipiChild.pIPI),
      ipiAmount: num(ipiChild.vIPI),
      cstPis: str(pisChild.CST),
      pisBase: num(pisChild.vBC),
      pisRate: num(pisChild.pPIS),
      pisAmount: num(pisChild.vPIS),
      cstCofins: str(cofinsChild.CST),
      cofinsBase: num(cofinsChild.vBC),
      cofinsRate: num(cofinsChild.pCOFINS),
      cofinsAmount: num(cofinsChild.vCOFINS),
      issBase: null,
      issRate: null,
      issAmount: null
    }
  })

  if (items.length === 0) {
    warnings.push('Nenhum item (<det>) encontrado no XML — a nota será importada só com o cabeçalho.')
  }

  const result: ParsedNfeResult = {
    ok: errors.length === 0,
    errors,
    warnings,
    accessKey: accessKey || null,
    documentNumber: str(ide.nNF),
    series: str(ide.serie),
    issueDate: extractDatePart(str(ide.dhEmi) || str(ide.dEmi)),
    operationDate: extractDatePart(str(ide.dhSaiEnt) || str(ide.dSaiEnt)) || extractDatePart(str(ide.dhEmi) || str(ide.dEmi)),
    naturezaOperacao: str(ide.natOp),
    emitCnpj: str(emit.CNPJ),
    emitName: str(emit.xNome),
    emitIe: str(emit.IE),
    emitCity: str(enderEmit.xMun),
    emitState: str(enderEmit.UF),
    destCnpj: str(dest.CNPJ),
    destCpf: str(dest.CPF),
    destName: str(dest.xNome),
    totalAmount: num(total.vNF),
    merchandiseAmount: num(total.vProd),
    freightAmount: num(total.vFrete),
    insuranceAmount: num(total.vSeg),
    discountAmount: num(total.vDesc),
    otherExpensesAmount: num(total.vOutro),
    icmsBase: num(total.vBC),
    icmsAmount: num(total.vICMS),
    ipiAmount: num(total.vIPI),
    pisAmount: num(total.vPIS),
    pisBase: null,
    cofinsAmount: num(total.vCOFINS),
    cofinsBase: null,
    issBase: null,
    issRate: null,
    issAmount: null,
    items
  }

  if (!result.documentNumber) errors.push('Número do documento (nNF) não encontrado.')
  if (!result.issueDate) errors.push('Data de emissão (dhEmi) não encontrada.')
  if (!result.emitCnpj) errors.push('CNPJ do emitente não encontrado.')
  if (result.totalAmount === null) errors.push('Valor total da nota (vNF) não encontrado.')

  result.ok = errors.length === 0
  return result
}
