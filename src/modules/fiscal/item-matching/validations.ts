import { z } from 'zod'

export const linkReviewIssueToItemSchema = z.object({
  issueId: z.string().guid(),
  itemId: z.string().guid()
})

export const createItemAndResolveReviewIssueSchema = z.object({
  issueId: z.string().guid(),
  code: z.string().trim().min(1, 'Informe um código para o produto.').max(60),
  name: z.string().trim().min(1, 'Informe um nome para o produto.').max(150),
  itemType: z.enum(['PRODUCT', 'SERVICE', 'BOTH']).default('PRODUCT'),
  unit: z.string().trim().max(20).optional().or(z.literal('')),
  ncm: z.string().trim().max(20).optional().or(z.literal(''))
})

export const ignoreReviewIssueSchema = z.object({
  issueId: z.string().guid()
})
