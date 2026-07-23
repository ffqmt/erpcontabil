# Implementação Etapa 35B.1-A — Motor Operacional Fiscal (Natureza + Regras de Importação)

**Data:** 2026-07-22
**Escopo:** fundação técnica da 35B.1, conforme `docs/especificacao-fluxo-fiscal-operacional-35b1.md`. Rodada de implementação controlada — não é a 35B.1 inteira.
**Fora de escopo (confirmado não tocado):** Painel Fiscal único, redesenho grande de sidebar, consolidação visual de `/fiscal/pendencias` e `/fiscal/revisao-itens`, UX final de pendências, Reforma Tributária/CBS/IBS/IS, SPED, folha. Fica para a 35B.1-B.

---

## 1. Objetivo

Dar efeito real à Natureza Fiscal (deixar de ser rótulo), separar CFOP de origem (XML) do
CFOP de escrituração, criar e aplicar Regras de Importação XML na gravação do documento, e
fazer a apuração automática considerar só documentos prontos — com o motivo de cada exclusão
sempre registrado, nunca silencioso.

## 2. Migration `erp_schema_v2_10_35b1a_fiscal_operation_engine.sql`

Aditiva, idempotente. Blocos:

1. **`fiscal_operation_natures`** ganha 18 colunas de comportamento (`operation_kind`,
   `applicable_document_types`, `fiscal_purpose`, `default_bookkeeping_cfop`,
   `default_tax_situation`, tratamentos de ICMS/ICMS-ST/IPI/PIS-COFINS/ISS, `difal_applicable`,
   `expected_retentions`, `generates_credit`, `enters_tax_assessment`, `triggers_accounting`,
   `suggested_accounting_rule_id`, `requires_product`, `requires_ncm`, `item_nature_default`) —
   todas com default seguro (`enters_tax_assessment`/`triggers_accounting` default `true`
   preservam o comportamento anterior; as demais default `false`/`null`). Naturezas já
   cadastradas continuam funcionando exatamente como antes até alguém editar os novos campos.
2. **`fiscal_document_items.xml_cfop`** (novo, nullable) — CFOP de origem do XML, preenchido só
   na importação, nunca editado depois.
3. **`fiscal_import_classification_rules`** (nova tabela) — regras de classificação na
   importação de XML, RLS padrão do projeto.
4. **`fiscal_document_validation_issues`** — check constraint de `issue_type` alargado
   (drop+recreate idempotente) para incluir `BOOKKEEPING_CFOP_MISSING`.
5. **Seed mínimo**: 12 CFOPs comuns em `cfop_codes`, CST-ICMS/CSOSN/CST-PIS/CST-COFINS comuns
   em `tax_situation_codes` — só código/descrição, nenhuma alíquota.

Naturezas Fiscais padrão **não** foram inseridas na migration — `fiscal_operation_natures` é
por empresa (`unique(company_id, code)`), sem contexto de empresa na migration. Em vez disso,
`seedDefaultFiscalNaturesAction()` (`src/modules/registrations/fiscal-natures/actions.ts`) cria
as 10 naturezas padrão para a empresa ativa, sob demanda (botão "Criar Naturezas Fiscais
Padrão" em `/cadastros/naturezas-fiscais`), idempotente por `(company_id, code)`.

## 3. Campos novos de Natureza Fiscal

`src/modules/registrations/fiscal-natures/{types,labels,validations,actions}.ts` e
`components/fiscal-nature-form.tsx` foram atualizados para listar/criar/editar/persistir os 18
campos novos, organizados em 4 seções no formulário (Identificação, Motor Operacional,
Tratamento Tributário, Comportamento Operacional) — todos opcionais, selects/checkboxes
simples, sem UI complexa. `fiscal-nature-list.tsx` ganhou uma linha de contexto compacta
(tipo de operação + CFOP sugerido, quando preenchidos).

## 4. `xml_cfop` x `cfop`

- **`xml_cfop`**: gravado sempre que o item vem de XML, com o CFOP exatamente como leu do
  documento — nunca mais tocado depois.
- **`cfop`**: continua sendo o CFOP de **escrituração**. A partir desta etapa, a importação de
  XML **não copia mais** o CFOP do emitente para este campo automaticamente — só é preenchido
  quando uma Regra de Importação resolveu (`bookkeeping_cfop` da regra). Sem regra, fica em
  branco e a pendência `BOOKKEEPING_CFOP_MISSING` assume, mostrando o `xml_cfop` de origem na
  mensagem. Documentos manuais continuam preenchendo `cfop` diretamente (sem XML, sem
  `xml_cfop`).
- Isso resolve o falso-positivo estrutural descrito na especificação (§1.4): antes, o
  `CFOP_DIRECTION_MISMATCH` comparava o CFOP do **emitente** contra a direção do
  **destinatário** — que quase sempre "não bate" por definição (CFOP de saída do fornecedor vs.
  CFOP de entrada do comprador são famílias diferentes). Agora `CFOP_DIRECTION_MISMATCH` só
  compara `cfop` (escrituração, resolvido pela regra ou pelo usuário) contra a direção — nunca
  mais `xml_cfop`.

## 5. Regras de Importação XML

Novo módulo `src/modules/fiscal/import-classification-rules/{types,matcher,queries,validations,actions}.ts`
+ `components/{rule-list,rule-form}.tsx` + rota `/fiscal/configuracoes/regras-importacao`
(lista/criar/editar/ativar-desativar/remover).

### 5.1 Motor de casamento (`matcher.ts`)

Mesmo espírito das Regras Contábeis Fiscais (32C) — condição nula é coringa — mas com
condições de **valor único** (não arrays), conforme escopo fechado. Ordem de desempate
**explicitamente pedida nesta subetapa**: `priority` menor ganha primeiro; especificidade (nº
de condições preenchidas que casaram) só desempata quando a `priority` é igual. Isso é o
**inverso** da ordem usada pelas Regras Contábeis Fiscais (lá especificidade vem primeiro,
`priority` desempata) — documentado aqui para não ser confundido com bug de cópia malfeita.

Condições suportadas e funcionando hoje: parceiro, CNPJ do emitente, CFOP do XML (prefixo),
NCM (prefixo), CEST, código do produto no fornecedor, descrição do item (contém), tipo de
documento, direção, valor mínimo/máximo do item.

**Limitação documentada:** `origin_state`, `destination_state` e `municipality_code` existem
na tabela e no formulário, mas **não têm efeito ainda** — o parser/`HeaderInput`/`ItemInput`
usados na gravação da importação (`src/modules/fiscal/xml-import/actions.ts`) ainda não
propagam UF/município do XML até o ponto onde o motor roda. Regras que dependam só dessas
condições nunca vão casar nesta subetapa. Fica para uma etapa futura (threading desses campos
pelo parser → `HeaderInput` → contexto de match).

**Decisão de design sobre `item_id`:** a especificação lista `item_id` como condição. Mas na
importação de XML o item interno ainda não é conhecido no momento do match (é exatamente o que
a ação `create_partner_item_mapping` pode resolver) — se `item_id` fosse tratado como condição
de entrada, uma regra com esse campo preenchido **nunca casaria** neste fluxo, e a ação de
mapeamento seria inalcançável. Por isso `item_id` foi implementado como campo de **ação**
apenas (o produto interno alvo do mapeamento), não como filtro de correspondência —
documentado em `matcher.ts` no próprio código.

### 5.2 Ações aplicadas

Ao casar, a regra pode aplicar: Natureza Fiscal do documento, CFOP de escrituração do item,
CST/CSOSN do item (heurística: código de 3 dígitos → `csosn`, senão → `cst_icms` — CSOSN
nacional sempre tem 3 dígitos, CST-ICMS sempre 2), tipo de item (`item_type`), e criar/
atualizar `partner_item_mappings` (quando `create_partner_item_mapping=true`, há código do
fornecedor no item e um produto-alvo configurado na regra).

`generates_credit`/`expected_retentions` da regra são calculados pelo motor
(`buildRuleApplication`) mas **não são persistidos em nenhum campo do documento nesta
subetapa** — não há coluna adequada em `fiscal_documents`/`fiscal_document_items` para isso
(diferente de CFOP/CST, que já existiam). Limitação documentada, candidata a campo dedicado ou
a uso futuro dentro do Painel Fiscal (35B.1-B).

### 5.3 Onde entra no fluxo

`writeFiscalDocumentFromImport` (`xml-import/actions.ts`) busca as regras ativas da empresa
**antes** de gravar o documento, casa cada item, e já grava `fiscal_operation_nature_id` no
cabeçalho e `xml_cfop`/`cfop`/`cst_icms`|`csosn`/`item_type` por item usando o resultado —
sem passo manual separado. Isso também fechou uma lacuna que já existia antes desta subetapa:
o insert do cabeçalho **nunca** preenchia `fiscal_operation_nature_id` para documentos
importados por XML (sempre ficava `null`), mesmo quando o formulário de natureza já existia.

## 6. Mudanças em pendências (`validation-issues`)

- **`BOOKKEEPING_CFOP_MISSING`** (novo tipo): item exige CFOP, não tem `cfop` mas tem
  `xml_cfop` — mensagem cita o CFOP original do XML. `CFOP_MISSING` (existente) passou a só
  disparar quando **nem** `cfop` **nem** `xml_cfop` existem (documento manual sem nenhum CFOP
  informado).
- `CFOP_DIRECTION_MISMATCH`: mensagem agora deixa explícito "CFOP de **escrituração**" para não
  confundir com o CFOP de origem.
- `FISCAL_NATURE_MISSING`: mensagem trocada para "Escolha a Natureza Fiscal desta operação para
  o sistema sugerir CFOP, CST e tributos automaticamente."
- `ITEM_WITHOUT_PRODUCT` (fila de revisão, 35A): mensagem trocada para "Este item do fornecedor
  ainda não está ligado a um produto seu — depois de vincular uma vez, a próxima compra do
  mesmo fornecedor já reconhece sozinha."
- `TAX_SITUATION_CODE_MISSING`: quando a Natureza Fiscal do documento tem
  `default_tax_situation` preenchido, a mensagem passa a incluir "Sugestão da Natureza Fiscal:
  {código}."
- `NCM_MISSING`: **decisão de design importante** — `requires_ncm` da Natureza Fiscal nasce com
  `default false` em toda natureza (inclusive as já cadastradas). Tratar `false` como "suprimir
  o aviso" desligaria o aviso de NCM para quase todo documento sem ninguém ter configurado nada
  para isso. Em vez de suprimir, `requires_ncm` foi implementado como **aditivo**: quando
  `true`, força a exigência mesmo para tipos de item que não exigiriam por padrão; a regra
  original (PRODUCT/ASSET exigem NCM, SERVICE/FREIGHT não) continua sendo o filtro principal.
  Isso já satisfazia a segunda frase do item 6.5 da especificação (SERVICE/FREIGHT nunca
  exigem) desde a 35B; a primeira frase (`requires_ncm=false` suprime) foi reinterpretada como
  acima e está documentada aqui para não ser lida como divergência não-intencional.

## 7. Apuração só com documentos prontos

`src/modules/tax-assessments/actions.ts` ganhou `getReadyDocumentsForAssessment(db, companyId,
competence)`: para a competência da apuração, seleciona documentos `BOOKED`, `tax_status !=
IGNORED`, com `fiscal_operation_nature_id` preenchido e cuja Natureza não tenha
`enters_tax_assessment=false`, e então remove os que tiverem pendência `CRITICAL` aberta
(reaproveita `listFiscalPendencies`, não duplica lógica de detecção). `generateAutomaticLines`
passou a receber esse conjunto pronto (`readyIds`) e filtrar por ele em vez de somar todo
documento `BOOKED` da competência sem checar nada — fecha a lacuna descrita na especificação
(§1.3: apuração "confia e reza" em vez de "valida e confia").

Chamado em `calculateTaxAssessmentAction` (branch ICMS/ISS/IPI/retenções — o único que soma por
documento; SIMPLES é por receita agregada e IRPJ/CSLL por DRE, nenhum dos dois muda). Os
documentos excluídos e o motivo (`sem Natureza Fiscal` / `Natureza não entra na apuração` /
`pendência crítica aberta`) são gravados em `calculation_memory.excludedDocuments` da apuração,
e a mensagem de retorno da action avisa quantos ficaram de fora. **A UI de apuração ainda não
tem uma seção dedicada para exibir isso** (fica em `calculation_memory`, acessível via a
apuração) — construir essa seção visual é trabalho da 35B.1-B, não desta subetapa; a exclusão
nunca é silenciosa (sempre registrada), mas também não é auto-explicativa na tela ainda.

## 8. Seed mínimo

Ver Seção 2, bloco 5 da migration. CFOPs/CST/CSOSN/CST-PIS/CST-COFINS mais comuns, só código e
descrição — nenhuma alíquota. Naturezas Fiscais padrão via `seedDefaultFiscalNaturesAction()`
(por empresa, sob demanda).

## 9. Limitações (resumo)

- `origin_state`/`destination_state`/`municipality_code`/`cest` nas Regras de Importação: campo
  existe, mas sem efeito na importação de XML até o parser propagar esses dados (não
  implementado nesta subetapa).
- `generates_credit`/`expected_retentions` de uma regra casada não são persistidos em nenhum
  campo do documento — só influenciam o resultado do motor de match, sem efeito posterior
  ainda.
- Painel visual "documentos fora da apuração e por quê" não existe — dado disponível em
  `calculation_memory`, sem tela dedicada.
- `requires_product` da Natureza Fiscal existe no cadastro mas não é usado para suprimir/exigir
  a pendência de item sem produto (fica em código separado, `item-matching`, não tocado nesta
  subetapa).
- Reclassificação retroativa de documentos já importados não existe — regras/naturezas só
  afetam importações novas a partir de agora.

## 10. Próximo passo: 35B.1-B

Consolidar `/fiscal/pendencias` e `/fiscal/revisao-itens` num Painel Fiscal único com abas,
simplificar a sidebar de verdade (não só adicionar uma entrada), redesenhar a UX de pendências
com botões de ação de um clique, e construir a seção visual de "documentos fora da apuração e
por quê" usando o `calculation_memory.excludedDocuments` que esta subetapa já grava.
