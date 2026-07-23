import { z } from 'zod'

export const closeIncomeStatementSchema = z.object({
  equityResultAccountId: z.string({
    message: 'A conta de destino do Patrimônio Líquido é obrigatória.'
  }).guid({
    message: 'ID da conta destino inválido.'
  }),
  confirm: z.boolean({
    message: 'É necessário confirmar o fechamento.'
  }).refine(val => val === true, {
    message: 'Você precisa marcar a caixa de confirmação operacional.'
  })
})

export type CloseIncomeStatementInput = z.infer<typeof closeIncomeStatementSchema>
