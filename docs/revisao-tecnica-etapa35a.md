# Revisao Tecnica Pos-Implementacao - Etapa 35A

**Data:** 2026-07-21  
**Escopo:** revisao tecnica da Etapa 35A - Cadastros Fiscais Estruturantes.  
**Importante:** esta revisao nao reimplementou a 35A, nao criou roadmap novo, nao mexeu em folha e nao reescreveu contabilidade.

## 1. Build

Resultado final:

```bash
npm run build
```

**Passou.**

Observacoes:
- A primeira tentativa de build ficou presa em timeout enquanto havia cache `.next/dev` corrompido e processos Node/Turbopack ativos.
- O erro complementar de `npx tsc --noEmit` apontava para `.next/dev/types/validator.ts`, arquivo gerado e truncado.
- O cache `.next` foi limpo como artefato gerado. Depois disso:
  - `npx tsc --noEmit` passou.
  - `npm run build` passou.
- Build final: Next.js 16.2.10, compilacao OK, TypeScript OK, 11 paginas estaticas geradas e rotas novas da 35A presentes no route manifest.

## 2. Migration 35A

Arquivo revisado:

`db/migrations/erp_schema_v2_8_35a_fiscal_structuring_foundation.sql`

Resultado geral: **segura e aderente ao escopo**, com correcoes pontuais aplicadas.

Validacoes:
- Migration e aditiva.
- Usa `create table if not exists` e `add column if not exists`.
- Nao cria FK obrigatoria sobre os textos legados de NCM/CFOP/CST/CEST.
- Nao cria `fiscal_document_item_taxes`, `tax_reform_rates`, `tax_types` em banco nem CBS/IBS/IS fora de comentarios de escopo.
- `establishments` foi estendida, nao duplicada como `fiscal_establishments`.
- `companies` recebeu CNAE principal/secundarios.
- `items` recebeu CEST, GTIN, natureza fiscal padrao e uso fiscal.
- RLS das tabelas tenant-owned segue `can_read_company`/`can_write_company`/`can_admin_company`.
- Tabelas referenciais nacionais sao somente leitura para `authenticated`.

Correcoes feitas na migration:
- Adicionados checks em `pis_cofins_recovery_settings` para impedir configuracao habilitada com aliquotas zero.
- Adicionado indice funcional unico em `tax_situation_codes` usando `coalesce(regime, '')`, fechando a brecha de duplicidade quando `regime` e `NULL`.
- Adicionado indice funcional unico em `municipal_service_codes` usando `coalesce(municipality_code, '')`, fechando a brecha de duplicidade para codigos nacionais/genericos.
- Ajustado indice de `partner_item_mappings` para unicidade apenas de mapeamento ativo, permitindo historico inativo.
- Adicionado indice unico parcial para impedir duas pendencias abertas do mesmo tipo para o mesmo item fiscal.

Pendencia de implantacao:
- Se a v2.8 ja tiver sido aplicada em algum banco, essas mudancas de migration precisam ser espelhadas em uma migration incremental curta. Se ainda nao foi aplicada, o arquivo v2.8 revisado ja esta pronto.

## 3. `calculation_mode`

Resultado: **funcional**.

Validacoes:
- `assertAutomaticCalculationAllowed()` existe em `src/modules/tax-assessments/actions.ts`.
- `calculateTaxAssessmentAction()` chama o gate antes de gerar linhas automaticas.
- `calculateIncomeTaxAssessmentAction()` tambem chama o gate, cobrindo IRPJ/CSLL.
- Ajustes e linhas manuais (`MANUAL_ADJUSTMENT`) continuam em actions separadas e nao sao bloqueados pelo modo manual.
- `AUTO` preserva o fluxo anterior de calculo.
- Mensagem de bloqueio usa codigo `CALCULATION_MODE_MANUAL` e explica a acao esperada.

Conclusao: o campo deixou de ser cosmetico.

## 4. PIS/COFINS Hardcoded

Resultado: **corrigido e endurecido**.

Validacoes:
- `PIS_RECOVERABLE_RATE` e `COFINS_RECOVERABLE_RATE` nao existem mais.
- Nao ha `0.0165`, `0.076`, `1.65` ou `7.6` em codigo ativo.
- Importacao XML so recalcula PIS/COFINS quando existe `pis_cofins_recovery_settings` habilitada e a empresa esta em `LUCRO_REAL`.
- Sem configuracao, o XML e importado com os valores originais e recebe warning no preview.
- Lucro Presumido e Simples nao recebem credito automatico indevido.

Correcoes feitas:
- Removido o pre-preenchimento visual de 1,65%/7,6% no painel de configuracao; sem settings salvas, os campos iniciam em zero.
- Adicionada validacao client-side e server-side: se o recalcule estiver habilitado, PIS e COFINS precisam ter aliquota positiva.
- Adicionados checks equivalentes na migration.

## 5. Matching Item XML -> Produto

Resultado: **conceito correto, com bugs pontuais corrigidos**.

Validacoes:
- NF-e extrai `cProd` como `supplierProductCode`.
- Matching automatico e conservador: so usa `partner_item_mappings` ativo por empresa + parceiro + codigo do fornecedor.
- Sem mapeamento forte, o item fica sem `item_id` e cai em `fiscal_document_item_review_issues`.
- Tela `/fiscal/revisao-itens` permite vincular produto existente, criar produto e ignorar pendencia.
- Ao vincular manualmente, o mapeamento e gravado para proximas importacoes.

Correcoes feitas:
- O auto-match agora valida que o `item_id` vindo do mapeamento pertence a empresa ativa antes de vincular.
- Updates em `fiscal_document_items` passaram a filtrar `company_id`.
- Inserts/updates da fila de revisao agora checam erro; antes podiam falhar silenciosamente.
- Atualizacao final de `fiscal_xml_imports` agora checa erro; antes uma falha poderia deixar importacao em estado inconsistente.
- Vínculo manual agora confirma que o item fiscal foi realmente atualizado antes de marcar a pendencia como resolvida.
- Atualizacoes de pendencia e mapeamento ganharam filtros de `company_id`.
- A action valida que o parceiro guardado nos detalhes da pendencia pertence a empresa ativa antes de criar/atualizar mapeamento.

Pendencia residual:
- Nao ha transacao atomica envolvendo documento, itens, issues e status do import. O codigo agora tenta limpar o documento criado quando uma etapa critica falha, mas a solucao transacional real dependeria de RPC ou transaction helper no banco.

## 6. Registry `TaxType`

Resultado: **adequado para 35A**.

Validacoes:
- Registry central existe em `src/modules/taxes/tax-types.ts`.
- Nao altera enum PostgreSQL.
- Nao adiciona CBS/IBS/IS como tributos reais.
- `ASSESSABLE_TAX_TYPE_VALUES` e `DOCUMENT_ACCOUNTED_TAX_TYPES` ja derivam do registry.
- Nenhum calculo fiscal foi redirecionado para novo comportamento por causa do registry.

Conclusao: consolidacao parcial e segura.

## 7. Seguranca Multiempresa

Resultado: **boa, com endurecimentos aplicados**.

Validacoes:
- Tabelas novas tenant-owned carregam `workspace_id` e `company_id`.
- Listagens filtram por `company_id`.
- Writes usam `context.workspaceId` e `context.companyId`.
- RLS segue o padrao do projeto.
- Produtos/naturezas fiscais/estabelecimentos sao validados contra a empresa ativa nas actions revisadas.

Correcoes feitas:
- Filtros de `company_id` adicionados a updates de item fiscal, pendencia, mapeamento e cleanup de documento importado.
- Validacao de item mapeado e parceiro da pendencia contra empresa ativa.
- Checagem de erro em writes que antes eram fire-and-forget.

Pendencia residual:
- O banco ainda nao impede, por FK composta ou trigger, que uma linha tenant-owned referencie outro registro de empresa diferente. As actions cobrem isso nos fluxos revisados, mas uma defesa 100% em banco exigiria constraints compostas/triggers em etapa posterior.

## 8. Rotas e Testes Minimos

Validados por build/manifest:
- `/fiscal/cadastros`
- `/fiscal/cadastros/estabelecimentos`
- `/fiscal/cadastros/estabelecimentos/novo`
- `/fiscal/cadastros/estabelecimentos/[id]/editar`
- `/fiscal/cadastros/tabelas-nacionais`
- `/fiscal/revisao-itens`
- `/fiscal/configuracoes-tributarias`
- `/cadastros/itens`
- `/cadastros/empresas/[id]/editar`

Smoke HTTP em servidor local de producao:
- `next start` em porta local temporaria subiu corretamente.
- Sem sessao autenticada, `/fiscal/cadastros`, `/fiscal/cadastros/estabelecimentos`, `/fiscal/cadastros/tabelas-nacionais` e `/fiscal/revisao-itens` responderam `307`, coerente com rotas protegidas por middleware/auth.

Validados por leitura tecnica:
- Importacao XML sem configuracao de PIS/COFINS nao recalcula credito.
- Importacao XML com mapeamento ativo tenta vinculo conservador.
- Item sem mapeamento cai em fila de revisao.
- `MANUAL` bloqueia calculo automatico e preserva lancamentos manuais.

Nao executado nesta revisao:
- Navegacao real em browser autenticado.
- Importacao real de XML contra Supabase.
- Escrita real em banco.

Motivo: a revisao foi feita por build/typecheck/leitura estatica e nao havia garantia de ambiente de dados isolado para smoke test destrutivo/semidestrutivo.

## 9. Correcoes Feitas

Arquivos alterados nesta revisao:
- `src/modules/fiscal/pis-cofins-recovery/validations.ts`
- `src/modules/fiscal/pis-cofins-recovery/components/pis-cofins-recovery-panel.tsx`
- `src/modules/fiscal/item-matching/actions.ts`
- `src/modules/fiscal/xml-import/actions.ts`
- `db/migrations/erp_schema_v2_8_35a_fiscal_structuring_foundation.sql`
- `docs/revisao-tecnica-etapa35a.md`
- `DEVELOPMENT_LOG.md`

## 10. Riscos Restantes

1. Se v2.8 ja foi aplicada em banco, os ajustes de constraints/indices precisam de migration incremental.
2. Faltam testes automatizados do fluxo XML -> item -> fila -> vinculo -> proxima importacao.
3. Faltam testes de banco/RLS para impedir referencias cruzadas de empresa em nivel de schema.
4. Tabelas nacionais estao vazias por design; a etapa de importacao versionada ainda precisa acontecer.
5. A garantia transacional do import XML ainda e parcial.

## 11. Conclusao

A Etapa 35A esta tecnicamente consistente com o escopo fechado e o build final passa. Os bugs encontrados foram pontuais e corrigidos nesta revisao. A principal cautela agora e operacional: confirmar se a v2.8 ainda nao foi aplicada; se ja foi, criar uma migration incremental pequena com os checks/indices adicionados aqui.
