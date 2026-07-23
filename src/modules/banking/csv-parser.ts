import { ParsedCsvResult } from './types'

const EXPECTED_HEADERS = ['date', 'description', 'amount', 'document_number', 'balance']

/**
 * Aliases de cabeçalho reconhecidos por campo interno, em ordem de prioridade (primeiro
 * alias encontrado no cabeçalho vence). Cobre o formato original em inglês ("date",
 * "description", ...) e o formato brasileiro/Itaú pedido na Etapa 30A ("Data",
 * "Complemento Histórico", "Valor", ...) — "Cód. Conta Débito"/"Cód. Conta Crédito" do
 * Itaú são códigos internos do banco, não mapeados para nenhum campo interno (ignorados).
 */
const HEADER_ALIASES: Record<'date' | 'description' | 'amount' | 'documentNumber' | 'balance', string[]> = {
  date: ['date', 'data'],
  description: ['description', 'complemento historico', 'descricao', 'historico'],
  amount: ['amount', 'valor'],
  documentNumber: ['document_number', 'documento', 'numero documento', 'num documento', 'cod historico', 'codigo historico'],
  balance: ['balance', 'saldo']
}

/**
 * Normaliza um cabeçalho para comparação tolerante a acentos/pontuação: minúsculas, sem
 * diacríticos (Cód./Débito -> cod/debito), pontuação virando espaço, espaços colapsados.
 */
function normalizeHeaderField(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ')
}

function findHeaderIndex(normalizedHeaderFields: string[], aliases: string[]): number {
  for (const alias of aliases) {
    const idx = normalizedHeaderFields.indexOf(alias)
    if (idx >= 0) return idx
  }
  return -1
}

/**
 * Divide uma linha de CSV respeitando campos entre aspas duplas (com "" como escape de
 * aspa literal), suportando tanto vírgula quanto ponto e vírgula como delimitador —
 * detectado automaticamente pela linha de cabeçalho.
 */
function splitCsvLine(line: string, delimiter: string): string[] {
  const fields: string[] = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const char = line[i]

    if (inQuotes) {
      if (char === '"') {
        if (line[i + 1] === '"') {
          current += '"'
          i++
        } else {
          inQuotes = false
        }
      } else {
        current += char
      }
    } else if (char === '"') {
      inQuotes = true
    } else if (char === delimiter) {
      fields.push(current.trim())
      current = ''
    } else {
      current += char
    }
  }
  fields.push(current.trim())
  return fields
}

/**
 * Normaliza um valor monetário aceitando vírgula OU ponto como separador decimal
 * (heurística simples, conforme pedido — não cobre milhar com múltiplos formatos
 * ambíguos): se houver os dois separadores, o ÚLTIMO encontrado é tratado como decimal e
 * o outro é removido (assumido como separador de milhar); se houver só vírgula, ela vira
 * o separador decimal; se houver só ponto, é mantido como está.
 */
function normalizeAmount(raw: string): number | null {
  let s = raw.trim().replace(/\s/g, '')
  if (!s) return null

  const lastComma = s.lastIndexOf(',')
  const lastDot = s.lastIndexOf('.')

  if (lastComma !== -1 && lastDot !== -1) {
    if (lastComma > lastDot) {
      s = s.replace(/\./g, '').replace(',', '.')
    } else {
      s = s.replace(/,/g, '')
    }
  } else if (lastComma !== -1) {
    s = s.replace(',', '.')
  }

  const num = Number(s)
  return Number.isFinite(num) ? num : null
}

/**
 * Normaliza uma data aceitando ISO (YYYY-MM-DD) ou formato brasileiro (DD/MM/YYYY).
 * Retorna sempre YYYY-MM-DD, ou null se não reconhecer o formato.
 */
function normalizeDate(raw: string): string | null {
  const s = raw.trim()

  const isoMatch = s.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (isoMatch) {
    const [, year, month, day] = isoMatch
    const date = new Date(`${year}-${month}-${day}T00:00:00`)
    if (!isNaN(date.getTime())) return `${year}-${month}-${day}`
    return null
  }

  const brMatch = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
  if (brMatch) {
    const [, day, month, year] = brMatch
    const date = new Date(`${year}-${month}-${day}T00:00:00`)
    if (!isNaN(date.getTime())) return `${year}-${month}-${day}`
    return null
  }

  return null
}

/**
 * Faz o parsing de um extrato bancário em texto CSV. Reconhece 2 formatos de cabeçalho:
 * o original em inglês (date/description/amount/document_number/balance) e o brasileiro/
 * Itaú (Data/Complemento Histórico/Valor/Cód. Histórico), detectados por alias tolerante a
 * acentuação/pontuação (ver HEADER_ALIASES) — a ordem das colunas é livre em ambos, desde
 * que a primeira linha seja um cabeçalho reconhecível. Não acessa banco de dados — puro,
 * testável isoladamente.
 */
export function parseBankStatementCsv(csvText: string): ParsedCsvResult {
  // Remove BOM (comum em exportações de bancos brasileiros em Excel/Windows-1252 salvo como UTF-8).
  const cleanText = csvText.charCodeAt(0) === 0xfeff ? csvText.slice(1) : csvText

  const lines = cleanText
    .split(/\r\n|\r|\n/)
    .map((l) => l)
    .filter((l) => l.trim().length > 0)

  if (lines.length === 0) {
    return { validRows: [], invalidRows: [], totalLines: 0 }
  }

  const delimiter = lines[0].includes(';') && !lines[0].includes(',') ? ';' : ','
  const rawHeaderFields = splitCsvLine(lines[0], delimiter)
  const headerFields = rawHeaderFields.map((h) => normalizeHeaderField(h))

  const dateIdx = findHeaderIndex(headerFields, HEADER_ALIASES.date)
  const descriptionIdx = findHeaderIndex(headerFields, HEADER_ALIASES.description)
  const amountIdx = findHeaderIndex(headerFields, HEADER_ALIASES.amount)
  const documentNumberIdx = findHeaderIndex(headerFields, HEADER_ALIASES.documentNumber)
  const balanceIdx = findHeaderIndex(headerFields, HEADER_ALIASES.balance)

  const missingRequired: string[] = []
  if (dateIdx < 0) missingRequired.push('date/data')
  if (descriptionIdx < 0) missingRequired.push('description/histórico')
  if (amountIdx < 0) missingRequired.push('amount/valor')

  if (missingRequired.length > 0) {
    return {
      validRows: [],
      invalidRows: [
        {
          lineNumber: 1,
          raw: lines[0],
          error: `Cabeçalho inválido — colunas obrigatórias ausentes: ${missingRequired.join(', ')}. Esperado ao menos: ${EXPECTED_HEADERS.slice(0, 3).join(', ')} (ou os equivalentes em português: Data, Complemento Histórico, Valor).`
        }
      ],
      totalLines: lines.length - 1
    }
  }

  const dataLines = lines.slice(1)
  const validRows: ParsedCsvResult['validRows'] = []
  const invalidRows: ParsedCsvResult['invalidRows'] = []

  dataLines.forEach((line, idx) => {
    const lineNumber = idx + 2 // +1 pelo cabeçalho, +1 por índice base 1
    const fields = splitCsvLine(line, delimiter)

    const rawDate = fields[dateIdx]?.trim() || ''
    const rawDescription = fields[descriptionIdx]?.trim() || ''
    const rawAmount = fields[amountIdx]?.trim() || ''
    const rawDocumentNumber = documentNumberIdx >= 0 ? fields[documentNumberIdx]?.trim() : ''
    const rawBalance = balanceIdx >= 0 ? fields[balanceIdx]?.trim() : ''

    const entryDate = normalizeDate(rawDate)
    if (!entryDate) {
      invalidRows.push({ lineNumber, raw: line, error: `Data inválida: "${rawDate}" (use YYYY-MM-DD ou DD/MM/YYYY).` })
      return
    }

    if (!rawDescription) {
      invalidRows.push({ lineNumber, raw: line, error: 'Descrição vazia.' })
      return
    }

    const amount = normalizeAmount(rawAmount)
    if (amount === null) {
      invalidRows.push({ lineNumber, raw: line, error: `Valor inválido: "${rawAmount}".` })
      return
    }
    if (amount === 0) {
      invalidRows.push({ lineNumber, raw: line, error: 'Valor igual a zero não é uma movimentação válida.' })
      return
    }

    let balance: number | undefined
    if (rawBalance) {
      const parsedBalance = normalizeAmount(rawBalance)
      if (parsedBalance !== null) balance = parsedBalance
    }

    validRows.push({
      lineNumber,
      raw: line,
      entryDate,
      description: rawDescription,
      documentNumber: rawDocumentNumber || undefined,
      amount,
      balance
    })
  })

  return { validRows, invalidRows, totalLines: dataLines.length }
}
