import { XMLParser } from 'fast-xml-parser'
import { PayrollEventItemLineType } from './types'

type XmlRecord = Record<string, unknown>

export interface ParsedEsocialItem {
  lineType: PayrollEventItemLineType
  rubricCode: string | null
  rubricTable: string | null
  rubricNature: string | null
  description: string | null
  referenceValue: number | null
  quantity: number | null
  factor: number | null
  amount: number
  rawPayload: XmlRecord
}

export interface ParsedEsocialEvent {
  eventId: string | null
  eventType: string
  eventName: string
  employerRegistration: string | null
  periodCompetence: string | null
  paymentDate: string | null
  workerCpf: string | null
  workerName: string | null
  workerRegistration: string | null
  workerCategory: string | null
  grossAmount: number
  deductionsAmount: number
  netAmount: number
  inssEmployeeAmount: number
  irrfAmount: number
  fgtsAmount: number
  employerInssAmount: number
  otherAmount: number
  items: ParsedEsocialItem[]
  eventPayload: XmlRecord
  parsedPayload: XmlRecord
  errors: string[]
  warnings: string[]
}

const EVENT_TYPE_BY_NODE: Record<string, string> = {
  evtRemun: 'S-1200',
  evtRmnRPPS: 'S-1202',
  evtBenPrRP: 'S-1207',
  evtPgtos: 'S-1210',
  evtDeslig: 'S-2299',
  evtTSVTermino: 'S-2399',
  evtBasesTrab: 'S-5001',
  evtIrrfBenef: 'S-5002',
  evtCS: 'S-5011'
}

const EVENT_NAME_BY_TYPE: Record<string, string> = {
  'S-1200': 'Remuneração de trabalhador',
  'S-1202': 'Remuneração de servidor RPPS',
  'S-1207': 'Benefícios previdenciários',
  'S-1210': 'Pagamentos de rendimentos do trabalho',
  'S-2299': 'Desligamento',
  'S-2399': 'Término de trabalhador sem vínculo',
  'S-5001': 'Bases por trabalhador',
  'S-5002': 'IRRF por trabalhador',
  'S-5011': 'Contribuições sociais consolidadas',
  ESOCIAL: 'Evento eSocial'
}

function asRecord(value: unknown): XmlRecord | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as XmlRecord : null
}

function asArray(value: unknown): unknown[] {
  if (value === null || value === undefined) return []
  return Array.isArray(value) ? value : [value]
}

function textValue(value: unknown): string | null {
  if (value === null || value === undefined) return null
  if (typeof value === 'string') return value.trim() || null
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  const record = asRecord(value)
  if (record) return textValue(record['#text'])
  return null
}

function normalizeNumber(value: unknown): number | null {
  const text = textValue(value)
  if (!text) return null
  const normalized = text.includes(',') ? text.replace(/\./g, '').replace(',', '.') : text
  const parsed = Number(normalized)
  return Number.isFinite(parsed) ? parsed : null
}

function roundCurrency(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100
}

function normalizeDocument(value: string | null): string | null {
  if (!value) return null
  const digits = value.replace(/\D/g, '')
  return digits.length > 0 ? digits : null
}

function firstDirectText(record: XmlRecord, names: string[]): string | null {
  for (const name of names) {
    const value = textValue(record[name])
    if (value) return value
  }
  return null
}

function firstTextDeep(value: unknown, names: Set<string>): string | null {
  const record = asRecord(value)
  if (record) {
    for (const [key, child] of Object.entries(record)) {
      if (names.has(key)) {
        const text = textValue(child)
        if (text) return text
      }
      const nested = firstTextDeep(child, names)
      if (nested) return nested
    }
    return null
  }

  if (Array.isArray(value)) {
    for (const child of value) {
      const nested = firstTextDeep(child, names)
      if (nested) return nested
    }
  }
  return null
}

function collectNumbersDeep(value: unknown, names: Set<string>): number[] {
  const values: number[] = []
  const record = asRecord(value)
  if (record) {
    for (const [key, child] of Object.entries(record)) {
      if (names.has(key)) {
        const parsed = normalizeNumber(child)
        if (parsed !== null) values.push(parsed)
      }
      values.push(...collectNumbersDeep(child, names))
    }
    return values
  }

  if (Array.isArray(value)) {
    for (const child of value) {
      values.push(...collectNumbersDeep(child, names))
    }
  }
  return values
}

function sumNumbersDeep(value: unknown, names: string[]): number {
  return roundCurrency(collectNumbersDeep(value, new Set(names)).reduce((sum, current) => sum + current, 0))
}

function collectRecordsByNodeName(value: unknown, names: Set<string>, output: XmlRecord[] = []): XmlRecord[] {
  const record = asRecord(value)
  if (record) {
    for (const [key, child] of Object.entries(record)) {
      if (names.has(key)) {
        for (const item of asArray(child)) {
          const itemRecord = asRecord(item)
          if (itemRecord) output.push(itemRecord)
        }
      }
      collectRecordsByNodeName(child, names, output)
    }
    return output
  }

  if (Array.isArray(value)) {
    for (const child of value) {
      collectRecordsByNodeName(child, names, output)
    }
  }
  return output
}

function findEventNode(value: unknown): { nodeName: string; node: XmlRecord } | null {
  const record = asRecord(value)
  if (record) {
    for (const [key, child] of Object.entries(record)) {
      const childRecord = asRecord(child)
      if (childRecord && key.startsWith('evt')) return { nodeName: key, node: childRecord }
      const nested = findEventNode(child)
      if (nested) return nested
    }
    return null
  }

  if (Array.isArray(value)) {
    for (const child of value) {
      const nested = findEventNode(child)
      if (nested) return nested
    }
  }
  return null
}

function competenceFirstDay(value: string | null): string | null {
  if (!value) return null
  const match = value.match(/^(\d{4})-(\d{2})/)
  if (!match) return null
  return `${match[1]}-${match[2]}-01`
}

function dateOnly(value: string | null): string | null {
  if (!value) return null
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})/)
  return match ? `${match[1]}-${match[2]}-${match[3]}` : null
}

function lineTypeFromItem(item: XmlRecord): PayrollEventItemLineType {
  const type = firstDirectText(item, ['tpRubr', 'tipoRubr'])
  if (type === '1') return 'EARNING'
  if (type === '2') return 'DEDUCTION'
  if (type === '3' || type === '4') return 'INFORMATIVE'
  if (firstDirectText(item, ['vrDesc', 'vlrDesc'])) return 'DEDUCTION'
  return 'UNKNOWN'
}

function parseItem(item: XmlRecord): ParsedEsocialItem | null {
  const amount = normalizeNumber(item.vrRubr) ?? normalizeNumber(item.vrVerba) ?? normalizeNumber(item.vrDesc) ?? normalizeNumber(item.valor)
  if (amount === null) return null

  return {
    lineType: lineTypeFromItem(item),
    rubricCode: firstDirectText(item, ['codRubr', 'codRubrica', 'ideRubrica']),
    rubricTable: firstDirectText(item, ['ideTabRubr', 'tabRubr']),
    rubricNature: firstDirectText(item, ['natRubr', 'codIncCP', 'codIncIRRF', 'codIncFGTS']),
    description: firstDirectText(item, ['dscRubr', 'descricao', 'descRubr']),
    referenceValue: normalizeNumber(item.vrVrRubr) ?? normalizeNumber(item.vrRef),
    quantity: normalizeNumber(item.qtdRubr) ?? normalizeNumber(item.qtdDiasTrab),
    factor: normalizeNumber(item.fatorRubr),
    amount: roundCurrency(amount),
    rawPayload: item
  }
}

export function parseEsocialXml(xmlText: string): ParsedEsocialEvent {
  const errors: string[] = []
  const warnings: string[] = []
  let parsedPayload: XmlRecord = {}

  try {
    const parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: '@_',
      removeNSPrefix: true,
      trimValues: true,
      parseTagValue: false,
      parseAttributeValue: false
    })
    const parsed = parser.parse(xmlText)
    parsedPayload = asRecord(parsed) || {}
  } catch (error) {
    return {
      eventId: null,
      eventType: 'ESOCIAL',
      eventName: EVENT_NAME_BY_TYPE.ESOCIAL,
      employerRegistration: null,
      periodCompetence: null,
      paymentDate: null,
      workerCpf: null,
      workerName: null,
      workerRegistration: null,
      workerCategory: null,
      grossAmount: 0,
      deductionsAmount: 0,
      netAmount: 0,
      inssEmployeeAmount: 0,
      irrfAmount: 0,
      fgtsAmount: 0,
      employerInssAmount: 0,
      otherAmount: 0,
      items: [],
      eventPayload: {},
      parsedPayload: {},
      errors: [error instanceof Error ? error.message : 'XML do eSocial inválido.'],
      warnings: []
    }
  }

  const event = findEventNode(parsedPayload)
  if (!event) {
    errors.push('Nenhum nó de evento eSocial encontrado no XML.')
  }

  const eventPayload = event?.node || parsedPayload
  const eventType = event ? EVENT_TYPE_BY_NODE[event.nodeName] || 'ESOCIAL' : 'ESOCIAL'
  const eventName = EVENT_NAME_BY_TYPE[eventType] || event?.nodeName || EVENT_NAME_BY_TYPE.ESOCIAL
  const eventId = event ? textValue(event.node['@_Id']) || textValue(event.node['@_id']) : null
  if (!eventId) warnings.push('ID do evento não identificado no XML.')

  const employerRegistration = normalizeDocument(firstTextDeep(eventPayload, new Set(['nrInsc'])))
  const periodCompetence = competenceFirstDay(
    firstTextDeep(eventPayload, new Set(['perApur', 'perRef', 'perAnt', 'perApu']))
  )
  const paymentDate = dateOnly(firstTextDeep(eventPayload, new Set(['dtPgto', 'dtDeslig', 'dtTerm', 'dtIniAfast'])))
  const workerCpf = normalizeDocument(firstTextDeep(eventPayload, new Set(['cpfTrab', 'cpfBenef', 'cpfDep'])))
  const workerName = firstTextDeep(eventPayload, new Set(['nmTrab', 'nmBenefic', 'nmBenef', 'nomeTrab']))
  const workerRegistration = firstTextDeep(eventPayload, new Set(['matricula', 'codCategTrab']))
  const workerCategory = firstTextDeep(eventPayload, new Set(['codCateg']))

  if (!periodCompetence) warnings.push('Competência não identificada automaticamente.')
  if (!workerCpf && !['S-5011'].includes(eventType)) warnings.push('CPF do trabalhador/beneficiário não identificado automaticamente.')

  const itemNodes = collectRecordsByNodeName(eventPayload, new Set(['itensRemun', 'detVerbas']))
  const items = itemNodes.map(parseItem).filter((item): item is ParsedEsocialItem => Boolean(item))

  const grossAmount = roundCurrency(items
    .filter((item) => item.lineType === 'EARNING' || item.lineType === 'UNKNOWN')
    .reduce((sum, item) => sum + item.amount, 0))
  const deductionsAmount = roundCurrency(items
    .filter((item) => item.lineType === 'DEDUCTION')
    .reduce((sum, item) => sum + item.amount, 0))
  const otherAmount = roundCurrency(items
    .filter((item) => item.lineType === 'INFORMATIVE')
    .reduce((sum, item) => sum + item.amount, 0))

  const netFromXml = sumNumbersDeep(eventPayload, ['vrLiq', 'vrLiqPgto', 'vrLiqApur'])
  const netAmount = netFromXml > 0 ? netFromXml : roundCurrency(Math.max(0, grossAmount - deductionsAmount))

  return {
    eventId,
    eventType,
    eventName,
    employerRegistration,
    periodCompetence,
    paymentDate,
    workerCpf,
    workerName,
    workerRegistration,
    workerCategory,
    grossAmount,
    deductionsAmount,
    netAmount,
    inssEmployeeAmount: sumNumbersDeep(eventPayload, ['vrCpSeg', 'vrDescSeg', 'vrCpSegTerc']),
    irrfAmount: sumNumbersDeep(eventPayload, ['vrIRRF', 'vlrIRRF', 'vrIrrf']),
    fgtsAmount: sumNumbersDeep(eventPayload, ['vrFGTS', 'vlrFGTS', 'vrFgts']),
    employerInssAmount: sumNumbersDeep(eventPayload, ['vrCpPat', 'vrPatronal', 'vrContrib']),
    otherAmount,
    items,
    eventPayload,
    parsedPayload,
    errors,
    warnings
  }
}
