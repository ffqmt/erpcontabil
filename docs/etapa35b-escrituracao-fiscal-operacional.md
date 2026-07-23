# Etapa 35B — Escrituração Fiscal Operacional

**Data:** 2026-07-22
**Escopo:** pedido explícito da 35B, em cima da 35A já concluída e validada (`docs/consolidacao-roadmap-fiscal-reforma-35a.md`, `docs/etapa35a-cadastros-fiscais-estruturantes.md`, `docs/revisao-tecnica-etapa35a.md`, `docs/qa-etapa35a-cadastros-fiscais.md`).
**Fora de escopo (confirmado não tocado):** Reforma Tributária real (CBS/IBS/Imposto Seletivo), `fiscal_document_item_taxes`, `tax_reform_rates`, tabela `tax_types` em banco, SPED/EFD/ECD/ECF, emissão fiscal/webservice SEFAZ, folha, lint global, refactor grande fora do escopo, decisões da 35A não foram reabertas.

---

## 1. Objetivo

Transformar o fiscal de "conjunto de telas que geram lançamento a partir de XML" em uma
operação de escrituração diária com central de pendências, status de apuração consistente,
validações leves não-bloqueantes e revisão operacional antes de contabilizar/apurar.

## 2. Central de Pendências Fiscais (`/fiscal/pendencias`)

Nova rota, adicionada à sidebar em **Fiscal — Escrituração & Operação**, logo depois de
"Revisão de Itens".

### 2.1 Design: motor híbrido (dinâmico + persistido)

A central combina três fontes (`src/modules/fiscal/validation-issues/queries.ts`):

1. **`fiscal_document_item_review_issues`** (35A) — item sem produto vinculado / match de
   baixa confiança. Reaproveitada como está, sem duplicar schema.
2. **Candidatos dinâmicos** (`rules.ts`) — calculados a cada leitura a partir do estado ATUAL
   do documento: CFOP ausente, CFOP incompatível com a direção, NCM ausente, CST/CSOSN
   ausente, natureza fiscal ausente, parceiro ausente, documento sem itens, não contabilizado,
   não apurado, estabelecimento ausente (quando a empresa tem mais de um), NFS-e sem
   retenção detectada, CT-e sem PIS/COFINS extraído. **Nada disso é persistido por padrão** —
   se a condição não existe mais (ex.: usuário preencheu o CFOP), a pendência simplesmente
   para de aparecer, sem precisar de nenhuma limpeza.
3. **Overrides persistidos em `fiscal_document_validation_issues`** (nova tabela, migration
   v2.9) — só ganham uma linha quando o usuário clica **"Ignorar"** ou **"Marcar resolvida"**
   para um candidato dinâmico específico. Uma vez ignorada/resolvida, aquela combinação exata
   de (documento, item, tipo de pendência) fica suprimida permanentemente — não há
   "reabertura automática" se a condição voltar a ocorrer. Isso é uma decisão consciente: o
   usuário decidiu explicitamente que aquele caso está tratado.

Não foi criada uma tabela paralela para "item sem produto" — a `fiscal_document_item_review_issues`
da 35A continua sendo a fonte única para esse tipo, só passou a aparecer também dentro da
central unificada.

### 2.2 Severidades

`CRITICAL` / `WARNING` / `INFO`, atribuídas por tipo de pendência (ver tabela no `rules.ts` e
`labels.ts`). Critério aplicado: `NO_ITEMS` é `CRITICAL` (documento estruturalmente quebrado);
`NOT_ACCOUNTED`/`NOT_ASSESSED` são `INFO` (lembrete de fluxo operacional, não problema de
dado); os demais (CFOP, NCM, CST/CSOSN, natureza, parceiro, estabelecimento, NFS-e, CT-e) são
`WARNING`. Nenhuma pendência bloqueia contabilização, apuração ou importação — são avisos,
não travas.

### 2.3 Tela

- 4 cards de contador (Críticas / Avisos / Informativas / Documentos afetados), sempre
  calculados sobre o total de pendências **abertas**, independente do filtro de status/severidade
  aplicado na tabela (evita o card zerar quando o usuário filtra por "Resolvidas").
- Filtros de servidor (competência, tipo de documento, direção, parceiro) — disparam nova
  busca via `router.push`, mesmo padrão já usado em `/fiscal/documentos`.
- Filtros client-side instantâneos (severidade, status, tipo de pendência, origem XML/manual)
  — aplicados sobre o mesmo array já carregado, sem nova ida ao servidor.
- Tabela: documento, parceiro, emissão, tipo, direção, pendência (com descrição), severidade,
  ação sugerida (link direto — abrir documento / revisar item / ir para contabilizar / ir para
  apuração), status, e ações (Marcar resolvida / Ignorar, só para pendências dinâmicas abertas;
  pendências de item sem produto usam o fluxo já existente em `/fiscal/revisao-itens`).

## 3. Transição automática de `tax_status` para `ASSESSED`

**Decisão de arquitetura importante:** não foi criada a tabela `tax_assessment_document_links`
sugerida como opção. A tabela `tax_assessment_lines` (existente desde `erp_schema_v1_1.sql`) já
tem `tax_assessment_id` + `fiscal_document_id` por linha e já é populada/limpa a cada
cálculo/recálculo de apuração (`calculateTaxAssessmentAction`) — ela **já é** o vínculo
documento↔apuração persistido que faltava usar. Criar uma segunda tabela só para isso
duplicaria o dado e arriscaria os dois ficarem dessincronizados.

Implementado em `src/modules/tax-assessments/actions.ts`:

- `syncFiscalDocumentTaxStatus(db, companyId, fiscalDocumentIds)` — para cada documento da
  lista, verifica se ele ainda tem ao menos uma linha em `tax_assessment_lines` cujo
  `tax_assessments.status != 'CANCELLED'`. Se sim, `tax_status = 'ASSESSED'`; se não,
  `tax_status = 'NOT_ASSESSED'`. Documentos com `tax_status = 'IGNORED'` (documento cancelado,
  ver `fiscal/actions.ts`) nunca são tocados — cancelamento de documento é uma decisão mais
  forte que apuração/desapuração.
- Chamada em `calculateTaxAssessmentAction` (branch ICMS/ISS/IPI/retenções): captura os
  documentos vinculados a esta apuração **antes** de limpar as linhas, soma com os documentos
  recém-vinculados **depois** de recalcular, e sincroniza a união — cobre tanto "documento
  passou a ser apurado" quanto "documento saiu do novo resultado".
- Chamada em `cancelTaxAssessmentAction`: ao cancelar, os documentos que só estavam
  `ASSESSED` por causa desta apuração voltam para `NOT_ASSESSED` (a menos que outra apuração
  ativa ainda os referencie).
- **Não** aplicado a IRPJ/CSLL (`calculateIncomeTaxAssessmentAction`) nem ao Simples Nacional:
  essas apurações são baseadas em resultado contábil/receita agregada, não em linhas por
  documento — nunca preenchem `fiscal_document_id` em `tax_assessment_lines`, então não há o
  que sincronizar.
- `revalidateAssessments()` passou a também revalidar `/fiscal/documentos` e
  `/fiscal/pendencias`, já que calcular/cancelar apuração pode mudar `tax_status` de documentos.

O vínculo documento→apuração já era exibido no detalhe do documento pela aba **"Apuração
Tributária"** (`getFiscalDocumentTaxAssessmentLines`, existente desde a Etapa 32C.6/34A) — não
foi necessário criar UI nova para isso, só corrigir o dado que faltava (`tax_status`).

## 4. Validações leves (não-bloqueantes)

Implementadas em `src/modules/fiscal/validation-issues/rules.ts`, aplicadas por item e por
documento:

| Regra | Condição | Severidade |
|---|---|---|
| CFOP ausente | item não-serviço sem CFOP | WARNING |
| CFOP x direção | CFOP começa com 1/2/3 (entrada) num documento OUT, ou 5/6/7 (saída) num documento IN | WARNING |
| NCM ausente | item não-serviço sem NCM | WARNING |
| CST/CSOSN ausente | item PRODUCT sem `cst_icms` nem `csosn` | WARNING |
| Natureza fiscal ausente | `fiscal_operation_nature_id` nulo | WARNING |
| Parceiro ausente | `partner_id` nulo | WARNING |
| Documento sem itens | zero linhas em `fiscal_document_items` | CRITICAL |
| Estabelecimento ausente | `establishment_id` nulo e empresa tem mais de 1 estabelecimento ativo | WARNING |
| Não contabilizado | `accounting_status = NOT_ACCOUNTED` e status != DRAFT | INFO |
| Não apurado | `tax_status = NOT_ASSESSED`, status = BOOKED, e há ICMS/ISS/IPI > 0 | INFO |

Nenhuma validação altera CFOP/NCM/CST automaticamente nem bloqueia importação, contabilização
ou apuração — são só avisos com ação sugerida.

**Decisão consciente de escopo:** "documento com tributos possivelmente incompletos" (item
citado na consolidação, sem regra detalhada) não virou uma heurística própria — o risco de
falso-positivo (ex.: operação isenta/imune legitimamente sem tributo) era maior que o
benefício. As regras de CST/CFOP/NCM já cobrem os sinais mais confiáveis de dado incompleto.

## 5. NFS-e e CT-e — feedback operacional

- **NFS-e:** o parser (`nfse-parser.ts`) já é tolerante por design (layout não-nacional) e
  sempre gera um aviso de revisão manual no preview. A 35B adiciona a pendência
  `NFSE_RETENTION_REVIEW` na central: toda NFS-e sem nenhuma linha em
  `fiscal_document_retentions` recebe o aviso "NFS-e importada por parser tolerante. Revise
  manualmente ISS/INSS/IRRF/PIS/COFINS/CSLL retidos." Assim que o usuário lançar ao menos uma
  retenção para aquele documento, o aviso some sozinho (é dinâmico, não precisa ser resolvido
  manualmente).
- **CT-e:** o parser (`cte-parser.ts`) nunca extrai PIS/COFINS (não há esses campos no XML de
  CT-e do jeito como o parser está feito hoje). A pendência `CTE_PIS_COFINS_NOT_EXTRACTED`
  aparece para todo CT-e/CT-e OS sem PIS/COFINS no cabeçalho, com o texto "CT-e importado com
  ICMS extraído. Revise PIS/COFINS quando aplicável." — sem fingir suporte completo.

## 6. Retenções no lançamento manual

A action `upsertFiscalDocumentRetentionsAction` (substituição total da lista de retenções de
um documento) **já existia** em `src/modules/fiscal/actions.ts` — vinha de uma etapa anterior
— mas não tinha nenhum formulário: `FiscalTaxSummary` só exibia retenções em modo leitura. A
35B fecha essa lacuna com `FiscalDocumentRetentionsForm` (novo componente), uma tabela editável
de retenções (ISS/INSS/IRRF/PIS/COFINS/CSLL·PCC — os tipos que a action já aceitava), inserida
na aba "Tributos" do documento fiscal quando ele ainda está editável. Nenhuma mudança de
backend foi necessária.

## 7. Listagem e detalhe do documento fiscal

- `listFiscalDocuments` agora calcula `open_pendency_count` / `has_no_product_pendency` /
  `has_xml_warning_pendency` por documento (reaproveitando o mesmo motor de regras da central,
  sem duplicar lógica) e aceita os filtros `hasPendencies`, `notAccounted`, `notAssessed`,
  `noProduct`, `hasXmlWarnings`.
- `FiscalDocumentList` ganhou uma linha de chips de filtro rápido para esses 5 casos.
- `FiscalDocumentCard` ganhou badges compactos: "Não contabilizado", "Não apurado" e "N
  pendência(s)" quando aplicável, além do badge de duplicidade que já existia.
- O detalhe do documento (`/fiscal/documentos/[id]`) ganhou uma aba **"Pendências"** (com
  indicador visual quando há pendência aberta), mostrando a lista de pendências abertas
  daquele documento específico com os mesmos botões Resolvida/Ignorar da central, e um link
  direto para "Ver central de pendências".

## 8. Migration `erp_schema_v2_9_35b_escrituracao_fiscal_operacional.sql`

Aditiva, idempotente. Único bloco novo: `fiscal_document_validation_issues` (RLS via
`can_read_company`/`can_write_company`, mesmo padrão de todas as tabelas tenant-owned do
projeto). Campos: `workspace_id`, `company_id`, `fiscal_document_id`,
`fiscal_document_item_id` (nullable), `issue_type`, `severity`, `message`, `source`, `status`,
`details`, `resolved_at`, `resolved_by`, timestamps. Índice funcional (`coalesce`) como
backstop de integridade — a aplicação sempre faz select-then-insert/update explícito (mesmo
motivo da 35A: o shorthand de upsert do Supabase não casa com índice parcial/funcional).

Nenhuma tabela da 35A foi alterada ou removida.

## 9. Limitações e decisões conscientes

- Pendências dinâmicas ignoradas/resolvidas não reabrem automaticamente se a condição
  recorrer — é uma escolha deliberada (ver §2.1), documentada aqui para não ser confundida com
  bug.
- A central de pendências e a listagem de documentos rodam o motor de regras sobre todos os
  documentos não-cancelados da empresa a cada carregamento (sem paginação/cache) — aceitável
  para o volume de dados de um único escritório contábil, mas não foi otimizado para grandes
  volumes; se o volume crescer muito, isso é candidato a um índice/materialização futura.
- "Documento com tributos possivelmente incompletos" não virou regra própria (ver §4).
- Retenções manuais cobrem os tipos que a action já aceitava (`ISS`, `INSS_RETIDO`, `IRRF`,
  `PIS`, `COFINS`, `PCC`) — o schema de validação não foi alterado para não abrir uma frente de
  risco fora do pedido.
- Nenhuma migração retroativa: documentos antigos só passam a ter pendências computadas na
  próxima leitura da central/listagem; nada foi alterado em massa no banco.

## 10. Próximas etapas

- **35B.1 (se necessário):** materializar/paginar a central de pendências caso o volume de
  documentos cresça a ponto de o cálculo dinâmico a cada leitura pesar.
- **35C — Reforma Tributária Base:** `fiscal_document_item_taxes`, `tax_reform_rates`,
  catálogo `tax_types` em banco, CBS/IBS/Imposto Seletivo.
