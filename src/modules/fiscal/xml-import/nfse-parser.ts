import { XMLParser } from 'fast-xml-parser'
import { ParsedNfeResult, ParsedNfeItem } from './nfe-parser'

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

/**
 * Busca em profundidade (case-insensitive) pela primeira tag cujo nome bate com um dos
 * aliases informados, em qualquer nível do XML já parseado — necessário porque NFS-e NÃO
 * tem um layout nacional único (varia por município/versão do ABRASF), então o mesmo campo
 * pode aparecer em caminhos de aninhamento diferentes conforme a prefeitura. Retorna o
 * valor bruto (string/número) da primeira ocorrência encontrada, ou null.
 */
function findDeep(obj: any, aliases: string[], depth = 0): unknown {
  if (obj === null || obj === undefined || depth > 12) return null
  if (typeof obj !== 'object') return null

  const lowerAliases = aliases.map((a) => a.toLowerCase())
  for (const key of Object.keys(obj)) {
    if (lowerAliases.includes(key.toLowerCase())) {
      const val = obj[key]
      if (typeof val === 'object' && val !== null && '#text' in val) return val['#text']
      if (typeof val !== 'object') return val
    }
  }
  for (const key of Object.keys(obj)) {
    const val = obj[key]
    if (val && typeof val === 'object') {
      const found = findDeep(Array.isArray(val) ? val[0] : val, aliases, depth + 1)
      if (found !== null) return found
    }
  }
  return null
}

/**
 * Parser inicial e TOLERANTE de NFS-e (Nota Fiscal de Serviços Eletrônica), Etapa 32D.
 * NFS-e NÃO tem um XSD nacional único — cada município (ou o padrão ABRASF v1/v2 que a
 * maioria segue livremente) define seu próprio layout. Em vez de fingir suporte completo a
 * um layout específico, este parser faz busca tolerante por nomes de tag comuns entre
 * prefeituras (Numero, CodigoVerificacao, PrestadorServico/Cnpj, TomadorServico/Cnpj,
 * ValorServicos, ValorIss, Discriminacao...) em qualquer profundidade do XML. Campos não
 * localizados viram warnings claros — nunca inventa valor. Sempre exige revisão manual
 * pela tela de 1 arquivo antes de confirmar (não é indicado para importação em lote sem
 * checar o resultado primeiro).
 */
export function parseNfseXml(xmlText: string): ParsedNfeResult {
  const errors: string[] = []
  const warnings: string[] = ['NFS-e não tem layout nacional único — os campos abaixo foram localizados por busca tolerante de nome de tag. Revise cuidadosamente antes de confirmar.']

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
    return empty
  }

  const numero = str(findDeep(parsed, ['Numero', 'NumeroNfse']))
  const codigoVerificacao = str(findDeep(parsed, ['CodigoVerificacao']))
  const dataEmissao = str(findDeep(parsed, ['DataEmissao', 'DataEmissaoNfse', 'DataEmissaoRps']))
  const discriminacao = str(findDeep(parsed, ['Discriminacao']))

  const prestadorCnpj = str(findDeep(parsed, ['Cnpj']))
  const prestadorNome = str(findDeep(parsed, ['RazaoSocialPrestador', 'RazaoSocial', 'NomeFantasia']))
  const prestadorMunicipio = str(findDeep(parsed, ['Municipio', 'CodigoMunicipio']))

  const valorServicos = num(findDeep(parsed, ['ValorServicos']))
  const valorIss = num(findDeep(parsed, ['ValorIss']))
  const valorPis = num(findDeep(parsed, ['ValorPis']))
  const valorCofins = num(findDeep(parsed, ['ValorCofins']))
  const aliquotaIss = num(findDeep(parsed, ['Aliquota']))

  if (!numero) warnings.push('Número da NFS-e não localizado por busca tolerante — preencha manualmente.')
  if (!prestadorCnpj) warnings.push('CNPJ do prestador não localizado — preencha manualmente antes de confirmar.')
  if (valorServicos === null) warnings.push('Valor dos serviços não localizado — preencha manualmente.')

  const item: ParsedNfeItem = {
    lineNumber: 1,
    description: discriminacao || 'Serviço prestado (descrição não localizada no XML)',
    supplierProductCode: null,
    ncm: null,
    cest: null,
    cfop: null,
    unit: null,
    quantity: 1,
    unitPrice: valorServicos,
    totalAmount: valorServicos ?? 0,
    cstIcms: null, csosn: null, icmsBase: null, icmsRate: null, icmsAmount: null,
    cstIpi: null, ipiBase: null, ipiRate: null, ipiAmount: null,
    cstPis: null, pisBase: null, pisRate: null, pisAmount: valorPis,
    cstCofins: null, cofinsBase: null, cofinsRate: null, cofinsAmount: valorCofins,
    issBase: valorServicos,
    issRate: aliquotaIss,
    issAmount: valorIss
  }

  const result: ParsedNfeResult = {
    ok: false,
    errors,
    warnings,
    accessKey: codigoVerificacao,
    documentNumber: numero,
    series: null,
    issueDate: extractDatePart(dataEmissao) || (dataEmissao ? dataEmissao.slice(0, 10) : null),
    operationDate: extractDatePart(dataEmissao) || (dataEmissao ? dataEmissao.slice(0, 10) : null),
    naturezaOperacao: 'Prestação de serviço (NFS-e)',
    emitCnpj: prestadorCnpj,
    emitName: prestadorNome,
    emitIe: null,
    emitCity: prestadorMunicipio,
    emitState: null,
    destCnpj: str(findDeep(parsed, ['CnpjTomador'])) || null,
    destCpf: str(findDeep(parsed, ['CpfTomador'])) || null,
    destName: str(findDeep(parsed, ['RazaoSocialTomador'])),
    totalAmount: valorServicos,
    merchandiseAmount: null,
    freightAmount: null,
    insuranceAmount: null,
    discountAmount: null,
    otherExpensesAmount: null,
    icmsBase: null,
    icmsAmount: null,
    ipiAmount: null,
    pisAmount: valorPis,
    pisBase: null,
    cofinsAmount: valorCofins,
    cofinsBase: null,
    issBase: valorServicos,
    issRate: aliquotaIss,
    issAmount: valorIss,
    items: [item]
  }

  if (!result.documentNumber) errors.push('Número da NFS-e não encontrado (obrigatório).')
  if (!result.issueDate) errors.push('Data de emissão não encontrada (obrigatório).')
  if (!result.emitCnpj) errors.push('CNPJ do prestador não encontrado (obrigatório).')
  if (result.totalAmount === null) errors.push('Valor dos serviços não encontrado (obrigatório).')

  result.ok = errors.length === 0
  return result
}
