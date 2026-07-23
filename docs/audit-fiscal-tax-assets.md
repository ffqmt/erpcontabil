# Auditoria a Frio — Etapas 19–22 (Fiscal/Tributário, Apurações, Obrigações, Patrimônio)

> **Follow-up (Etapa 24, 2026-07-11)**: o achado **B1** ("`credit_amount` lido pela fórmula
> mas sem caminho de aplicação") foi tratado na Etapa 24 — ver
> `docs/tax-assessment-credits.md`. Créditos automáticos de documentos de entrada
> (ICMS/IPI/PIS/COFINS), créditos/débitos/retenções/ajustes manuais, saldo credor anterior e
> saldo a transportar agora têm caminho completo de UI → action → schema. A mesma etapa
> também corrigiu um bug real de fórmula descoberto ao implementar o B1: `previous_balance_amount`
> estava sendo **somado** ao valor a recolher em vez de **subtraído** (nunca se manifestou
> porque nada preenchia esse campo até então). B2–B5 continuam pendentes, sem alteração.

Etapa 23 do roadmap (`docs/erp-master-plan.md`). Auditoria técnica e funcional rigorosa da
macro-entrega das Etapas 19–22, feita a frio (sessão separada da implementação), seguindo o
mesmo espírito da auditoria da Etapa 14 (`docs/audit-accounting-mvp.md`).

## 1. Resumo Executivo

A implementação das Etapas 19–22 é sólida na sua espinha dorsal: as 3 integrações
Fiscal/Apuração/Patrimônio → Contabilidade (`accountFiscalDocumentAction`,
`accountTaxAssessmentAction`, `postAssetDepreciationAction`) replicam corretamente o padrão
DRAFT→POSTED, validação de conta (empresa/ativa/analítica) e período aberto já estabelecido
desde a Etapa 6, sem nenhum caso de conta hardcoded ou bypass de RLS encontrado. Nenhum bug
crítico (build quebrado, corrupção de dados, vazamento multiempresa em leitura) foi
encontrado. Foram encontrados e corrigidos **3 achados ALTOS** (vazamento multiempresa em
escrita por falta de validação de FK, imutabilidade de bem patrimonial quebrada, obrigação
gerada de apuração ainda não fechada podendo dessincronizar) e **2 achados MÉDIOS**
(contador de obrigações vencidas estruturalmente sempre zero; inconsistência matemática num
registro do seed). Mais 4 achados de severidade BAIXA/Observação foram documentados sem
correção, por serem lacunas de funcionalidade (não defeitos) ou decisões arquiteturais que
mereceriam validação do time antes de mexer.

## 2. Veredito

**Aprovado com ressalvas.** Os 3 achados ALTOS e os 2 MÉDIOS já foram corrigidos nesta
própria auditoria (correções pontuais, sem reescrita de módulo). As ressalvas remanescentes
são achados documentados como pendência consciente (não bugs ativos): a fórmula de
apuração não modela créditos tributários (ICMS/PIS/COFINS não-cumulativos), a suíte de
testes RLS da Etapa 17 não cobre a única tabela genuinamente nova (`fiscal_document_retentions`),
e duas colunas de schema ficaram sem uso funcional (`municipality_id`,
`provision_journal_entry_id`). Nenhuma delas bloqueia o uso do que foi entregue.

## 3. Escopo Auditado

As 12 dimensões pedidas, cobrindo: `db/migrations/erp_schema_v1_4_fiscal_tax_assets.sql`,
`db/migrations/erp_rls_v1_4_fiscal_tax_assets.sql`, `db/seed/seed_demo_fiscal_tax_assets.sql`,
`src/modules/fiscal/**`, `src/modules/tax-assessments/**`, `src/modules/obligations/**`,
`src/modules/assets/**`, `erp_schema_v1_1.sql` (tabelas-base reaproveitadas), `erp_rls_v1.sql`
(policies genéricas reaproveitadas), `db/tests/README.md`, `db/README.md`,
`docs/erp-master-plan.md`, `DEVELOPMENT_LOG.md`, sidebar e `permissions.ts`.

## 4. Achados por Severidade

### Alto (corrigidos)

**A1 — Vazamento multiempresa em escrita: FKs opcionais aceitas sem validar `company_id`.**
`createFiscalDocumentAction`/`updateFiscalDocumentAction` validavam `partnerId` contra a
empresa ativa, mas não `fiscalOperationNatureId`. `createFiscalDocumentItemAction`/
`updateFiscalDocumentItemAction` não validavam `itemId`. `accountFiscalDocumentAction` não
validava `costCenterId`. Em todos os 3 casos, um cliente malicioso ou um bug de UI poderia
gravar uma referência de outra empresa (natureza fiscal, item de catálogo ou centro de
custo) num registro tenant-owned — não é um vazamento de leitura, mas é escrita cruzada
indevida.
*Corrigido*: as 3 actions agora fazem `SELECT ... WHERE id = ? AND company_id = ?` antes de
persistir, no mesmo padrão já usado para `partnerId`/contas contábeis em todo o resto do
código. Arquivo: `src/modules/fiscal/actions.ts`.

**A2 — Imutabilidade quebrada: bem patrimonial editável após depreciação já lançada.**
`updateFixedAssetAction` só bloqueava edição para bens `DISPOSED`/`SOLD`. Um bem `ACTIVE`
com depreciações já `CALCULATED` ou `POSTED` podia ter `acquisitionAmount`,
`residualAmount`, `usefulLifeMonths` ou `startDepreciationDate` alterados livremente — o que
corrompe silenciosamente a matemática de `accumulated_depreciation`/`net_book_value`
(calculados em `queries.ts` somando os lançamentos históricos, que passariam a não bater
mais com os novos parâmetros do bem) e o cálculo de futuras parcelas em
`generateAssetDepreciationsAction`.
*Corrigido*: `updateFixedAssetAction` agora conta depreciações não-canceladas do bem antes
de aceitar mudanças nesses 4 campos; se houver pelo menos uma, bloqueia com
`code: 'HAS_DEPRECIATIONS'` e orienta a dar baixa e cadastrar um novo bem. Demais campos
(conta contábil, centro de custo, tag, descrição) continuam editáveis livremente. Arquivo:
`src/modules/assets/actions.ts`.

**A3 — Obrigação gerada de apuração ainda `CALCULATED` podia dessincronizar do valor real.**
`generateObligationFromAssessmentAction` aceitava apurações em `CALCULATED` **ou** `CLOSED`.
Como `calculateTaxAssessmentAction` permite recalcular uma apuração `CALCULATED` quantas
vezes for preciso (recurso intencional, para ajustar antes de fechar), era possível: gerar a
obrigação com `payable_amount` = X, voltar e recalcular a apuração para um valor Y
diferente, e a obrigação já criada ficar com o valor X antigo — sem nenhum mecanismo de
resync entre as duas tabelas.
*Corrigido*: a geração de obrigação agora exige `status = 'CLOSED'` (que já é terminal para
`calculateTaxAssessmentAction` — recalcular uma apuração fechada é bloqueado). Isso também
alinha o código com o fluxo que já estava documentado como entrega ("fechar → gerar
obrigação → contabilizar"). Arquivos: `src/modules/obligations/actions.ts`,
`src/modules/tax-assessments/components/generate-obligation-button.tsx`.

### Médio (corrigidos)

**M1 — Contador de "obrigações vencidas" estruturalmente sempre zero.**
`obligations.status = 'OVERDUE'` é um valor de enum válido e o dashboard
(`getObligationsDashboard`) conta linhas com esse status literal — mas **nenhuma** Server
Action do módulo jamais escreve esse valor (não há job/cron nesta etapa, por decisão
explícita de escopo — Central de Pendências fica para depois). Na prática, fora da linha
seedada manualmente com esse status, toda obrigação vencida continuava aparecendo como
"Aberta"/"Gerada" indefinidamente, e o card do dashboard sempre mostraria 0 vencidas.
*Corrigido*: `isObligationOverdue(status, dueDate)` (novo helper em `utils.ts`) calcula
"vencida" em tempo de leitura — `due_date` no passado E status ainda `OPEN`/`GENERATED` —
sem exigir nenhuma transição de status armazenada. Usado em `getObligationsDashboard`
(contagem correta) e em `ObligationCard` (borda vermelha + selo "Vencida" mesmo quando o
status gravado ainda é "Aberta"/"Gerada"). Não foi criado nenhum job/trigger que escreva
`status = 'OVERDUE'` automaticamente — isso continua fora do escopo desta etapa
(explicitamente vetado: "não implementar Central de Pendências").

**M2 — Inconsistência matemática no seed: bem "totalmente depreciado" com saldo residual > 0 na prática.**
O bem `fa000000-...-0002` (`FULLY_DEPRECIATED`, aquisição R$12.000,00, residual R$0,00)
tinha uma única linha de depreciação de **R$ 100,00**, com `accumulated_amount_after`
gravado como R$12.000,00 (um valor de "instantâneo" que a aplicação não usa como fonte de
verdade). Como `attachAccumulatedDepreciation()` (`src/modules/assets/queries.ts`) calcula o
valor líquido contábil **somando** `asset_depreciations.accounting_amount`, este bem exibia
na prática `net_book_value` = R$ 11.900,00 — contradizendo o próprio status
"Totalmente Depreciado" mostrado ao lado.
*Corrigido*: `accounting_amount` do registro de seed ajustado para R$ 12.000,00 (lançamento
único representando o acumulado histórico de 120 meses, aceitável para dado de
demonstração). Arquivo: `db/seed/seed_demo_fiscal_tax_assets.sql`.

### Baixo / Observação (documentados, não corrigidos)

**B1 — `tax_assessments.credit_amount` é lido pela fórmula de apuração mas nunca é
gravável.** A fórmula em `calculateTaxAssessmentAction` (`debit - credit - retained +
adjustment + fine + interest + previousBalance`) já contempla `credit_amount`, mas nenhuma
action/formulário permite o usuário informá-lo — `adjustTaxAssessmentSchema` só expõe
`adjustmentAmount`/`fineAmount`/`interestAmount`/`previousBalanceAmount`. Isso significa que
tributos não-cumulativos com direito a crédito na apuração (ICMS entre estados,
PIS/COFINS não-cumulativo) não têm hoje como abater créditos de compra contra débitos de
venda dentro do motor de cálculo — só via `adjustmentAmount` genérico, sem rastreabilidade
de origem. Não corrigido nesta auditoria por ser lacuna de funcionalidade (exigiria novo
campo de formulário + decisão de UX), não defeito pontual — mas é o gap mais relevante para
uma futura Etapa de "apuração fiscal avançada".

**B2 — Unicidade de apuração não considera `regime`.** A constraint
`unique (company_id, competence, tax_type)` (`erp_schema_v1_1.sql`) não inclui a coluna
`regime`, adicionada só na v1.4. Na prática, uma empresa não pode ter duas apurações do
mesmo tributo/competência mesmo que sob regimes diferentes (ex.: mudança de regime tributário
no meio do ano, ou apuração por estabelecimento com regimes distintos). Cenário raro e não
coberto pelos dados de demonstração; alterar a constraint é uma migração de schema que
merece decisão própria do time, não uma correção pontual desta auditoria.

**B3 — `fiscal_documents.municipality_id` (coluna nova da v1.4) nunca é preenchida.**
Nenhum formulário ou action grava esse campo — é um hook de schema pronto para uma futura
feature de ISS por município de prestação, sem uso funcional hoje. Sem impacto (coluna
opcional, `null` é um valor válido), só registrado para não ser confundido com uma feature
já entregue.

**B4 — `obligations.provision_journal_entry_id` (coluna pré-existente da v1.1) nunca é
usada pela integração da Etapa 21.** A decisão de arquitetura desta rodada foi manter o
lançamento de provisão vinculado ao `tax_assessments.journal_entry_id` (a apuração é a fonte
de verdade), não ao `obligations.provision_journal_entry_id` que o schema original
antecipava. Architeturalmente consistente e documentado no `DEVELOPMENT_LOG.md`, mas deixa
essa coluna permanentemente morta sob o desenho atual — vale um comentário `comment on
column` numa migração futura para não confundir quem ler o schema puro.

**B5 — `markObligationPaidAction` não confere se o valor do lançamento vinculado bate com
`obligations.amount`.** Intencional (um pagamento pode legitimamente incluir juros/multa
diferentes do valor original da guia), mas não estava documentado em lugar nenhum antes
desta auditoria — registrado aqui para não ser lido como descuido numa releitura futura.

## 5. Achados Corrigidos Nesta Auditoria

| # | Achado | Severidade | Arquivo(s) |
|---|---|---|---|
| A1 | FKs opcionais sem validação de `company_id` (natureza fiscal, item, centro de custo) | Alto | `src/modules/fiscal/actions.ts` |
| A2 | Bem patrimonial editável após depreciação lançada | Alto | `src/modules/assets/actions.ts` |
| A3 | Obrigação gerável de apuração `CALCULATED` (não só `CLOSED`), risco de dessincronia | Alto | `src/modules/obligations/actions.ts`, `generate-obligation-button.tsx` |
| M1 | Contador "vencidas" estruturalmente sempre zero | Médio | `src/modules/obligations/{utils,queries}.ts`, `obligation-card.tsx` |
| M2 | Seed com bem "totalmente depreciado" matematicamente incoerente | Médio | `db/seed/seed_demo_fiscal_tax_assets.sql` |

## 6. Achados Pendentes (documentados, sem correção nesta rodada)

B1 (créditos tributários não modelados), B2 (unique constraint sem `regime`), B3
(`municipality_id` não usado), B4 (`provision_journal_entry_id` não usado), B5 (sem
conferência de valor no pagamento). Nenhum é bloqueador; todos registrados para decisão
futura do time, não para correção automática.

## 7. Validação das Integrações Contábeis

Todas as 6 integrações foram lidas linha a linha:

- **Fiscal → Contabilidade** (`accountFiscalDocumentAction`): exige `status='BOOKED'`,
  bloqueia recontabilização (`accounting_status='ACCOUNTED'`), valida conta
  débito≠crédito/empresa/ativa/analítica (agora também o centro de custo — ver A1), valida
  período aberto, gera DRAFT→POSTED, marca `journal_entry_id`+`accounting_status`. Em
  erro após a validação, marca `accounting_status='ACCOUNTING_ERROR'` (comportamento
  documentado, não um bug).
- **Fiscal → Apuração** (`calculateTaxAssessmentAction`): consome só documentos `BOOKED`
  da competência exata; `CANCELLED`/`DRAFT`/`VALIDATED` corretamente excluídos.
- **Apuração → Obrigação** (`generateObligationFromAssessmentAction`): agora exige `CLOSED`
  (ver A3); bloqueia geração duplicada via `assessment.obligation_id`.
- **Apuração → Contabilidade** (`accountTaxAssessmentAction`): exige `CLOSED`,
  `payable_amount > 0`, bloqueia recontabilização, mesma validação de conta/período.
- **Patrimônio → Contabilidade** (`postAssetDepreciationAction`): exige
  `status='CALCULATED'`, usa as contas do PRÓPRIO bem (não da categoria), mesma validação
  de período; **não revalida** se `expense_account_id`/`depreciation_account_id` continuam
  ativas/analíticas no momento da postagem (só eram validadas na criação/edição do bem) —
  gap menor, mesmo padrão ausente também no legado do módulo de Bancos; não corrigido por
  ser uma mudança de padrão que afetaria consistência entre módulos, fora do escopo pontual
  desta auditoria.
- **Fiscal ↔ Patrimônio**: vínculo informacional (`fixed_assets.fiscal_document_id`), sem
  lógica de negócio associada — nada a validar além de existir a FK.

## 8. Validação de Períodos Fechados

Confirmado nas 3 actions de contabilização: buscam `accounting_periods` pela competência,
retornam `PERIOD_NOT_FOUND` se ausente e `PERIOD_CLOSED` se o status não é `OPEN`/`REOPENED`
— reaproveitando exatamente o padrão de `src/modules/accounting/journal/actions.ts` desde a
Etapa 6, sem reimplementação divergente.

## 9. Validação de Multiempresa

Todas as actions revisadas usam `getCurrentContext()` e filtram `company_id` em toda
leitura/escrita relevante. O único desvio real encontrado (FKs opcionais sem validação
cruzada — A1) foi corrigido. Não foi encontrado nenhum vazamento de **leitura** entre
empresas (todas as queries de listagem/detalhe filtram `company_id` corretamente).

## 10. Validação de Patrimônio/Depreciação

Vida útil, valor residual < aquisição e `code` único por empresa já são impostos por
Zod + constraint de banco (`chk_fixed_assets_code_unique`). Depreciação linear confere com
`calculateMonthlyDepreciation`, respeita `start_depreciation_date`, não deprecia bem fora de
`ACTIVE` (reforçado por trigger de banco `trg_asset_depreciations_validate_company`,
independente da aplicação), não duplica competência (`unique(fixed_asset_id, competence)` no
schema), não ultrapassa o valor depreciável (capado em `remaining`), transita para
`FULLY_DEPRECIATED` automaticamente. Imutabilidade após depreciação corrigida em A2. Baixa
(`disposeFixedAssetAction`) registra data/motivo, não deleta o bem, e documenta
explicitamente que a contabilização de ganho/perda na baixa não é automática — consistente
com o que já havia sido comunicado na entrega original.

## 11. Validação de Seeds

`seed_demo_fiscal_tax_assets.sql` é idempotente (bloco de `DELETE` determinístico no início
+ `ON CONFLICT DO NOTHING` nas contas contábeis), usa exclusivamente workspace/empresa/
período/parceiros/itens já semeados nas etapas anteriores (nenhum dado novo de tenant
inventado), não lança em período fechado, todos os 4 lançamentos contábeis seguem o padrão
DRAFT→POSTED. Único problema real encontrado foi M2 (corrigido). Validado sintaticamente com
`pglast` após a correção.

## 12. Validação de RLS

`erp_rls_v1_4_fiscal_tax_assets.sql` cobre corretamente a única tabela genuinamente nova
(`fiscal_document_retentions`) com policy composta (company + status do documento pai).
Todas as demais tabelas estendidas continuam cobertas pelas policies genéricas de
`erp_rls_v1.sql`, que não mudam com a adição de colunas. A suíte de testes da Etapa 17
**não foi estendida nesta auditoria** para incluir um cenário dedicado a
`fiscal_document_retentions` — por ser uma policy não-genérica (a única desta rodada com
subquery), foi documentada como TODO explícito em `db/tests/README.md` em vez de escrita sem
poder validar sua correção contra um banco real. RLS continua não executada contra Supabase
real (mesma situação desde a Etapa 17).

## 13. Resultado do Build

`npm run build` — limpo, sem erros de TypeScript, todas as 48 rotas (17 novas das Etapas
19–22 incluídas) geradas com sucesso após as correções desta auditoria.

## 14. Recomendação Final

**Aprovado com ressalvas.** Corrigir os 5 achados Alto/Médio antes de continuar era o
critério de bloqueio — já feito nesta própria sessão. Os achados Baixo/Observação (B1–B5)
não bloqueiam uso nem a próxima etapa; ficam registrados para quando o time decidir investir
em apuração com créditos tributários (B1) ou revisar as colunas mortas de schema (B3/B4).
Próximo passo recomendado: nenhum módulo novo — as opções mais coerentes com o estado atual
são (a) execução real da suíte RLS (Etapa 17, ainda pendente, tarefa pequena e
independente), ou (b) tratar B1 (créditos tributários) como uma iteração focada dentro do
próprio módulo de Apurações, já que é o gap mais substancial encontrado nesta auditoria.
