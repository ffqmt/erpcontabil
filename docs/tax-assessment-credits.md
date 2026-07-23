# Créditos Tributários, Saldos e Ajustes em Apurações Fiscais

Etapa 24 do roadmap (`docs/erp-master-plan.md`). Trata o achado B1 da auditoria das Etapas
19–22 (`docs/audit-fiscal-tax-assets.md`): `tax_assessments.credit_amount` já entrava na
fórmula de `payable_amount`, mas não havia caminho de aplicação (UI/action) para gravá-lo de
forma auditável. Esta etapa fecha esse gap dentro do escopo interno atual — **não** é um
motor de cálculo tributário legal completo (ver seção Limitações).

## Fórmula Final

```
gross_balance =
    debit_amount
  - credit_amount
  - retained_amount
  - previous_balance_amount
  + adjustment_amount
  + fine_amount
  + interest_amount

se gross_balance >= 0:
  payable_amount = gross_balance
  next_balance_amount = 0

se gross_balance < 0:
  payable_amount = 0
  next_balance_amount = abs(gross_balance)
```

`adjustment_amount` é sempre **derivado**, nunca digitado diretamente: é a diferença entre a
soma das linhas manuais `ADJUSTMENT_POSITIVE` e `ADJUSTMENT_NEGATIVE` em
`tax_assessment_lines`. `debit_amount`, `credit_amount` e `retained_amount` também são
sempre derivados — somam todas as linhas do tipo correspondente, automáticas e manuais
juntas. Só `fine_amount`, `interest_amount` e `previous_balance_amount` continuam sendo
campos diretos da apuração (não linhas), pois representam valores únicos por apuração, não
uma composição de múltiplas origens.

**Correção de fórmula em relação às Etapas 19–22**: até esta etapa, `previous_balance_amount`
era **somado** ao valor a recolher — o que estava errado, já que nada preenchia esse campo na
prática e o bug nunca se manifestou. Um saldo credor do período anterior deve **reduzir** o
valor a recolher deste período (é crédito acumulado), por isso passou a ser subtraído.

Todo o cálculo acontece em `recomputeAssessmentTotals()`
(`src/modules/tax-assessments/actions.ts`), chamado por toda action que altera linhas ou os
3 campos diretos — nunca há um caminho de escrita que deixe `payable_amount`/
`next_balance_amount` desatualizados em relação às linhas/campos atuais.

## Como Créditos Automáticos de Documentos São Calculados

Ao **calcular/recalcular** uma apuração (`calculateTaxAssessmentAction`), o sistema busca
documentos fiscais `BOOKED` da competência exata e gera linhas `DEBIT`/`CREDIT` automáticas
(`source_type='FISCAL_DOCUMENT'` ou `'FISCAL_ITEM'`):

- **Débito**: documentos de **saída** (`direction='OUT'`, venda/serviço prestado) — o
  tributo destacado no cabeçalho é devido pela própria empresa.
- **Crédito**: documentos de **entrada** (`direction='IN'`, compra/serviço tomado) — só para
  **ICMS, IPI, PIS, COFINS**. **ISS nunca gera crédito automático** (regra explícita desta
  etapa — quem precisar modelar um caso de ISS creditável faz isso via linha manual).

ICMS/PIS/COFINS usam os campos de cabeçalho já existentes em `fiscal_documents`
(`icms_amount`/`pis_amount`/`cofins_amount`). **IPI é tratado à parte**: `fiscal_documents`
não tem coluna de cabeçalho para IPI (só existe em `fiscal_document_items.ipi_amount`, desde
a v1.4) — por isso o IPI é agregado somando os itens de cada documento BOOKED da competência.

Documentos `DRAFT`/`VALIDATED`/`CANCELLED` nunca entram (só `BOOKED`). Não há cálculo de
elegibilidade legal (CST/CFOP/NCM) — o valor já destacado no documento/item é usado
diretamente, exatamente como veio digitado.

## Como Créditos Manuais São Lançados

Qualquer linha que a fórmula automática não cobre (crédito de PER/DCOMP, crédito
extemporâneo, correção de apuração anterior, retenção não capturada automaticamente, etc.)
entra via `addTaxAssessmentManualLineAction`, com `source_type='MANUAL_ADJUSTMENT'` e um dos
5 tipos: `CREDIT`, `DEBIT`, `RETENTION`, `ADJUSTMENT_POSITIVE`, `ADJUSTMENT_NEGATIVE`.
Exige descrição (obrigatória), valor > 0, base/alíquota opcionais, observação opcional
(`notes`, coluna nova da v1.5). Linhas manuais **nunca são apagadas** por
`calculateTaxAssessmentAction` — só as automáticas (`FISCAL_DOCUMENT`/`FISCAL_ITEM`/
`RETENTION`) são substituídas a cada recálculo. Editar/remover uma linha manual
(`updateTaxAssessmentManualLineAction`/`deleteTaxAssessmentManualLineAction`) só é permitido
para linhas com `source_type='MANUAL_ADJUSTMENT'` — tentar editar uma linha automática
retorna erro.

## Como o Saldo Anterior é Informado

`updateTaxAssessmentPreviousBalanceAction` grava `tax_assessments.previous_balance_amount`
diretamente (não é uma linha — é um valor único por apuração, decisão documentada no
cabeçalho de `erp_schema_v1_5_tax_credits.sql`). Exige valor ≥ 0 e status editável. Entra na
fórmula como redutor do valor a recolher, antes de determinar `payable_amount`.

## Como o Saldo a Transportar é Calculado

Quando `gross_balance < 0`, `payable_amount` é travado em `0` e `next_balance_amount` recebe
`abs(gross_balance)` — nenhuma obrigação de pagamento é gerada (bloqueado explicitamente, ver
abaixo) e nenhum lançamento contábil de imposto a recolher é permitido. O saldo a transportar
fica só registrado na apuração; **não há automação** que o carregue como
`previous_balance_amount` da apuração do mês seguinte — isso continua sendo lançado
manualmente ao criar a próxima apuração (decisão consciente: automatizar isso exigiria uma
apuração "mãe/filha" com sequência garantida, fora do escopo desta etapa).

## Como Obrigações Vinculadas Bloqueiam Recálculo Inseguro

Duas camadas de proteção:
1. `generateObligationFromAssessmentAction` só aceita apuração `CLOSED` (regra já corrigida
   na auditoria da Etapa 23) e agora também exige `payable_amount > 0` — apuração fechada com
   saldo credor não gera guia de pagamento (mensagem: "Apuração sem valor a recolher.").
2. `calculateTaxAssessmentAction`, `addTaxAssessmentManualLineAction`,
   `updateTaxAssessmentManualLineAction`, `deleteTaxAssessmentManualLineAction` e
   `updateTaxAssessmentPreviousBalanceAction` todos checam `assessment.obligation_id` e
   bloqueiam com a mensagem "Esta apuração já possui obrigação gerada. Cancele ou revise a
   obrigação antes de recalcular." — hoje tecnicamente inalcançável (só apurações `CLOSED`
   têm `obligation_id`, e `CLOSED` já bloqueia edição pelo status), mas mantido como defesa
   em profundidade contra mudança futura de regra.

## Como Apuração CLOSED Bloqueia Alterações

Todas as actions de edição (`calculateTaxAssessmentAction`, linhas manuais, saldo anterior,
`adjustTaxAssessmentAction`) usam `EDITABLE_ASSESSMENT_STATUSES = ['DRAFT', 'CALCULATED',
'REVIEWED']` — `CLOSED` e `CANCELLED` nunca passam. `closeTaxAssessmentAction` roda
`recomputeAssessmentTotals()` uma última vez antes de gravar `status='CLOSED'`, garantindo
que os totais fechados refletem exatamente as linhas/campos vigentes no momento do
fechamento.

## Como a Contabilização Usa o `payable_amount` Final

`accountTaxAssessmentAction` (Etapa 21, já existente) usa `assessment.payable_amount` — que
agora reflete a fórmula corrigida com créditos/saldo anterior. Se `payable_amount <= 0`
("Apuração sem valor a recolher."), a contabilização é bloqueada — nenhum lançamento de
imposto a recolher é gerado para uma apuração com saldo credor, alinhado com a mesma regra
aplicada à geração de obrigação.

## Limitações (fora do escopo desta etapa, deliberadamente)

- **Cálculo tributário legal completo**: não há motor de regras por regime (Simples/Lucro
  Presumido/Lucro Real), nem validação de elegibilidade de crédito por CST/CFOP/NCM — o
  sistema só soma o que já está destacado nos documentos ou lançado manualmente.
- **SPED/EFD** (ICMS/IPI, Contribuições, ECD, ECF): nenhuma geração de arquivo.
- **CIAP** (Controle de Crédito de ICMS do Ativo Permanente): não implementado — créditos de
  ICMS sobre ativo imobilizado não têm o parcelamento em 48 meses exigido legalmente; se
  lançados, entram como um crédito manual único, sem o controle de apropriação mensal.
  Esta é a lacuna mais relevante para um escritório que já opera com bens sujeitos a CIAP.
- **PER/DCOMP e compensações federais reais**: um crédito lançado manualmente aqui não gera
  nenhuma declaração ou protocolo — é só um registro contábil/fiscal interno.
- **Transporte automático de saldo entre competências**: ver seção acima — é manual por
  decisão de escopo.
- **Integração SEFAZ/importação XML**: fora do escopo desde a Etapa 19, inalterado.

## Como Testar

Pré-requisitos: aplicar `erp_schema_v1_5_tax_credits.sql` e rodar
`seed_demo_fiscal_tax_assets.sql` (ordem completa em `db/README.md`).

1. **Apuração com valor a recolher**: acesse a apuração PIS de demonstração (competência
   01/2025) — já `CLOSED` com `payable_amount = R$ 26,00`, sem lançamento. Teste
   `accountTaxAssessmentAction` (rota `/fiscal/apuracoes/[id]`, formulário de
   contabilização) selecionando 2 contas — deve gerar um lançamento POSTED de R$ 26,00.
2. **Apuração com saldo credor**: acesse a apuração COFINS de demonstração — `CLOSED`,
   `payable_amount = R$ 0,00`, `next_balance_amount = R$ 480,00`. Confirme que o card "Saldo
   a Transportar" aparece em destaque no lugar do card "A Recolher", e que o botão de
   contabilização recusa com "Apuração sem valor a recolher."
3. **Ajuste manual**: crie uma nova apuração ICMS (ou use a `DRAFT` de demonstração), clique
   em "Calcular" para gerar as linhas automáticas, depois adicione uma linha manual (Crédito,
   Débito, Retenção, Ajuste + ou Ajuste -) pelo formulário na página de detalhe — confirme
   que os totais (cards) mudam imediatamente após salvar, sem precisar clicar em "Calcular"
   de novo. Clique em "Recalcular" depois e confirme que a linha manual continua lá.
4. **Obrigação gerada bloqueando recálculo**: gere uma obrigação a partir da apuração ISS de
   demonstração (já `CLOSED`) e tente adicionar uma linha manual ou recalcular — deve
   bloquear com "Esta apuração já possui obrigação gerada...".
5. **Contabilização**: ver item 1 — confirme que período fechado bloqueia
   (`accounting_periods` com status diferente de `OPEN`/`REOPENED`) e que contas
   inativas/sintéticas/de outra empresa são recusadas.
6. **Tentativa de alterar CLOSED**: em qualquer apuração `CLOSED`, confirme que o formulário
   de linha manual e o formulário de saldo anterior somem da tela (não são renderizados —
   `editable=false` na página `/fiscal/apuracoes/[id]`), e que chamar as actions diretamente
   (ex.: via curl/console) retorna `INVALID_STATUS`.
