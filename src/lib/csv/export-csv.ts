export type CsvFieldType = string | number | boolean | null | undefined

/**
 * Escapa um campo individual de CSV seguindo o padrão RFC 4180:
 * Envolve em aspas se contiver ponto e vírgula (;), aspas duplas (") ou quebras de linha (\n / \r).
 * Dobra as aspas internas.
 */
export function escapeCSVField(val: CsvFieldType): string {
  if (val === null || val === undefined) {
    return ''
  }

  // Converte para string
  const strVal = String(val)

  // Verifica caracteres especiais que exigem envelopamento em aspas
  const hasDelimiter = strVal.includes(';')
  const hasQuotes = strVal.includes('"')
  const hasLineBreaks = strVal.includes('\n') || strVal.includes('\r')

  if (hasDelimiter || hasQuotes || hasLineBreaks) {
    // Dobra as aspas internas e envolve em aspas duplas
    return `"${strVal.replace(/"/g, '""')}"`
  }

  return strVal
}

/**
 * Converte um valor numérico para o formato de moeda brasileiro no CSV:
 * - Sem o símbolo "R$"
 * - Usando vírgula como separador decimal
 * - Sinal negativo para valores negativos (ex: -1234,56)
 */
export function formatCsvCurrency(amount: number | string | null | undefined): string {
  if (amount === null || amount === undefined || amount === '') {
    return '0,00'
  }
  
  const num = typeof amount === 'string' ? parseFloat(amount) : amount
  if (isNaN(num)) return '0,00'
  
  // Formata com 2 casas decimais e usa ponto para a conversão de substituição posterior
  const fixed = num.toFixed(2)
  return fixed.replace('.', ',')
}

/**
 * Constrói uma string de conteúdo CSV a partir de um array de linhas (objetos).
 * Adiciona o caractere BOM UTF-8 no início do arquivo.
 */
export function buildCsv(
  rows: Record<string, CsvFieldType>[],
  headers: { key: string; label: string }[]
): string {
  const delimiter = ';'
  const BOM = '\uFEFF'
  
  // 1. Gera cabeçalho
  const headerLine = headers.map(h => escapeCSVField(h.label)).join(delimiter)
  
  // 2. Gera linhas de dados
  const dataLines = rows.map((row) => {
    return headers.map((h) => {
      const val = row[h.key]
      return escapeCSVField(val)
    }).join(delimiter)
  })

  // 3. Junta tudo com quebra de linha padrão Windows (CRLF) para melhor suporte no Excel
  return BOM + [headerLine, ...dataLines].join('\r\n')
}

/**
 * Efetua o download do arquivo CSV no navegador do usuário usando Blob e URL.createObjectURL.
 */
export function downloadCsv(filename: string, csvContent: string): void {
  if (typeof window === 'undefined') return

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  
  const link = document.createElement('a')
  link.setAttribute('href', url)
  link.setAttribute('download', filename)
  link.style.visibility = 'hidden'
  
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  
  // Revoga a URL criada para liberar espaço em memória
  URL.revokeObjectURL(url)
}
