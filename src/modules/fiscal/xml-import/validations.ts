import { z } from 'zod'

export const previewFiscalXmlSchema = z.object({
  xmlText: z.string().trim().min(1, 'Cole ou envie o conteúdo do XML.'),
  fileName: z.string().trim().max(255).optional().or(z.literal(''))
})

const confirmItemSchema = z.object({
  lineNumber: z.number().int().min(1).optional(),
  description: z.string().trim().min(1, 'Descrição obrigatória.').max(300),
  itemType: z.enum(['PRODUCT', 'SERVICE', 'FREIGHT', 'ASSET', 'OTHER']).default('PRODUCT'),
  quantity: z.number().min(0.0001, 'Quantidade deve ser maior que zero.'),
  unit: z.string().trim().max(10).optional().or(z.literal('')),
  unitPrice: z.number().min(0).optional(),
  totalAmount: z.number().min(0.01, 'O total do item deve ser maior que zero.'),
  ncm: z.string().trim().max(20).optional().or(z.literal('')),
  cfop: z.string().trim().max(10).optional().or(z.literal('')),
  icmsAmount: z.number().min(0).optional(),
  ipiAmount: z.number().min(0).optional(),
  pisAmount: z.number().min(0).optional(),
  cofinsAmount: z.number().min(0).optional(),
  issAmount: z.number().min(0).optional()
})

export const confirmFiscalXmlImportSchema = z.object({
  xmlImportId: z.string().guid('ID de importação inválido.'),
  accessKey: z.string().trim().max(60).optional().or(z.literal('')),
  documentNumber: z.string().trim().max(30).optional().or(z.literal('')),
  series: z.string().trim().max(10).optional().or(z.literal('')),
  issueDate: z.string().min(1, 'Informe a data de emissão.'),
  operationDate: z.string().min(1, 'Informe a data de operação.'),
  emitCnpj: z.string().trim().min(11, 'CNPJ/CPF do emitente inválido.').max(20),
  emitName: z.string().trim().min(1, 'Informe o nome/razão social do emitente.').max(200),
  destCnpj: z.string().trim().max(20).optional().or(z.literal('')),
  destCpf: z.string().trim().max(20).optional().or(z.literal('')),
  destName: z.string().trim().max(200).optional().or(z.literal('')),
  documentAmount: z.number().min(0.01, 'O valor total deve ser maior que zero.'),
  merchandiseAmount: z.number().min(0).optional(),
  freightAmount: z.number().min(0).optional(),
  insuranceAmount: z.number().min(0).optional(),
  discountAmount: z.number().min(0).optional(),
  otherExpensesAmount: z.number().min(0).optional(),
  icmsBase: z.number().min(0).optional(),
  icmsAmount: z.number().min(0).optional(),
  pisAmount: z.number().min(0).optional(),
  cofinsAmount: z.number().min(0).optional(),
  ipiAmount: z.number().min(0).optional(),
  issBase: z.number().min(0).optional(),
  issAmount: z.number().min(0).optional(),
  notes: z.string().trim().max(1000).optional().or(z.literal('')),
  items: z.array(confirmItemSchema).min(1, 'O documento precisa de pelo menos 1 item.')
})

export const rejectFiscalXmlImportSchema = z.object({
  xmlImportId: z.string().guid('ID de importação inválido.'),
  reason: z.string().trim().max(500).optional().or(z.literal(''))
})

export const bulkImportFiscalXmlSchema = z.object({
  files: z
    .array(
      z.object({
        fileName: z.string().trim().min(1).max(255),
        xmlText: z.string().trim().min(1, 'Arquivo XML vazio.')
      })
    )
    .min(1, 'Selecione ao menos 1 arquivo.')
    .max(30, 'Máximo de 30 arquivos por lote.')
})

export type PreviewFiscalXmlInput = z.infer<typeof previewFiscalXmlSchema>
export type ConfirmFiscalXmlImportInput = z.infer<typeof confirmFiscalXmlImportSchema>
export type RejectFiscalXmlImportInput = z.infer<typeof rejectFiscalXmlImportSchema>
export type BulkImportFiscalXmlInput = z.infer<typeof bulkImportFiscalXmlSchema>
