# Etapa 35A — Cadastros Fiscais Estruturantes

**Data:** 2026-07-21
**Escopo:** `docs/consolidacao-roadmap-fiscal-reforma-35a.md` (seção 4.1, "Obrigatório").
**Fora de escopo (confirmado não tocado):** CBS/IBS/Imposto Seletivo, cálculo/apuração da Reforma, `fiscal_document_item_taxes`, `tax_reform_rates`/`tax_rate_rules`, tabela `tax_types` em banco, troca do enum Postgres `tax_type`, SPED/EFD/ECD/ECF, emissão fiscal/webservice SEFAZ, folha, refactor global de lint, migração retroativa de documentos antigos.

---

## 1. Objetivo

Fechar a lacuna entre "sistema que gera lançamento a partir de XML" e "motor fiscal parametrizável": cadastros de código nacional, vínculo real item↔catálogo, eliminação de dois hardcodes de PIS/COFINS, correção do `calculation_mode` morto, estabelecimentos, CNAE, e reorganização da navegação — tudo isso sem tocar em Reforma Tributária (que é a Etapa 35C).

## 2. O que foi implementado

### 2.1 Correções de comportamento (sem schema)

- **`calculation_mode` deixou de ser cosmético.** `src/modules/tax-assessments/actions.ts` ganhou `assertAutomaticCalculationAllowed()`, chamada em `calculateTaxAssessmentAction` e `calculateIncomeTaxAssessmentAction`: quando o tributo está configurado como `MANUAL` para a empresa, o cálculo automático é bloqueado com mensagem clara (`CALCULATION_MODE_MANUAL`) e o usuário lança as linhas manualmente (fluxo que já existia e não dependia deste campo). Tributos em `AUTO` continuam idênticos a antes.
- **Hardcode de PIS/COFINS recuperável removido em DOIS pontos** (o segundo foi achado nesta própria implementação, não estava na consolidação original):
  1. `applyRecoverablePisCofinsForInboundNfe` (parser/importação) — antes recalculava sempre com 1,65%/7,60% fixos; agora só recalcula se houver `pis_cofins_recovery_settings` explícita e habilitada para a empresa (nova tabela, ver §2.2), e mesmo assim só quando a empresa está em Lucro Real. Sem configuração, o XML é importado com os valores como vieram, com aviso no preview.
  2. A gravação do **cabeçalho** do documento (`fiscal_documents.pis_rate`/`cofins_rate`) também escrevia 1,65/7,60 fixos, independente de qualquer configuração — corrigido para derivar a alíquota efetiva do valor realmente gravado (`valor / base de mercadoria`), nunca mais um número fixo no código.

### 2.2 Migration `erp_schema_v2_8_35a_fiscal_structuring_foundation.sql`

Aditiva, idempotente (`if not exists`/`add column if not exists` em tudo), não quebra dado legado:

| Tabela/Extensão | O que é |
|---|---|
| `pis_cofins_recovery_settings` | Configuração explícita por empresa (enabled, pis_rate, cofins_rate) que destrava o recálculo acima. |
| `establishments` (**estendida**, não recriada) | Já existia desde `erp_schema_v1_1.sql` — só faltava CRUD/UI. Adicionados: `code`, `name`, `municipality_code`, `address_line`. |
| `ncm_codes`, `cest_codes`, `cfop_codes`, `tax_situation_codes`, `municipal_service_codes` | Tabelas referenciais nacionais (leitura para todo usuário autenticado, escrita só via migração/service_role — mesmo padrão de `states`/`municipalities`). Começam vazias; alimentam autocomplete/validação, não são FK obrigatória sobre `fiscal_document_items` (que continua aceitando texto livre). |
| `partner_item_mappings` | Mapeamento fornecedor + código do produto do fornecedor → item interno. |
| `fiscal_document_item_review_issues` | Fila mínima de pendência de classificação de item (`ITEM_WITHOUT_PRODUCT`/`LOW_CONFIDENCE_MATCH`), escopo restrito a isso — a central de pendências completa é 35B. |
| `companies` (extensão) | `main_cnae`, `secondary_cnaes`. |
| `items` (extensão) | `cest`, `gtin`, `default_fiscal_operation_nature_id`, `fiscal_item_usage` (RESALE/INPUT/FIXED_ASSET/USE_CONSUMPTION/SERVICE/OTHER). |

**Nota técnica importante**: antes de escrever a migration, foi confirmado via investigação de schema que `establishments` **já existia** desde a base (`erp_schema_v1_1.sql`, fora de `db/migrations/`) — a migration estende essa tabela em vez de criar uma `fiscal_establishments` paralela, evitando duplicidade de conceito.

### 2.3 Registry central de `TaxType`

`src/modules/taxes/tax-types.ts` — metadados de todos os 12 tributos hoje existentes (código, categoria, se é apurável, se é contabilizado direto no documento, se é elegível a retenção, se é retenção pura, se tem cálculo automático, modo padrão, se exige configuração de alíquota, e um campo `isTaxReformTax` reservado — hoje `false` para todos). **Não altera o enum Postgres nem cria tabela de catálogo** — isso é 35C. `src/modules/tax-assessments/settings/options.ts` foi ajustado para derivar `ASSESSABLE_TAX_TYPE_VALUES`/`DOCUMENT_ACCOUNTED_TAX_TYPES` deste registry em vez de listas hardcoded separadas (primeiro passo de consolidação, sem mudar nenhum valor real).

### 2.4 Vínculo item de XML ↔ catálogo (matching conservador)

- Parser de NF-e (`nfe-parser.ts`) passou a extrair `cProd` (código do produto no cadastro do fornecedor) como `supplierProductCode` — campo novo, não existia antes.
- Na gravação do documento (`writeFiscalDocumentFromImport`), cada item importado é checado contra `partner_item_mappings` por (empresa, fornecedor, código do fornecedor) — **só é considerado match automático quando há mapeamento já confirmado**. Sem mapeamento, o item fica sem `item_id` e uma linha é criada em `fiscal_document_item_review_issues`.
- `supplierProductCode` é sempre re-derivado do `parsed_preview` guardado no servidor (nunca do formulário editável do cliente) — mesma defesa em profundidade já usada para CNPJ/direção nesta importação.
- Nova tela **`/fiscal/revisao-itens`** — fila estilo planilha (não modal por item): cada pendência mostra documento, parceiro, item, e permite vincular a um produto existente ou criar um produto novo e já vincular. Ao vincular, se havia código do fornecedor capturado, o mapeamento é gravado/atualizado para a próxima importação do mesmo fornecedor já casar sozinha.

### 2.5 Cadastros e navegação

- `/fiscal/cadastros` (novo hub), `/fiscal/cadastros/estabelecimentos` (CRUD completo: lista/criar/editar/ativar-inativar), `/fiscal/cadastros/tabelas-nacionais` (consulta com abas NCM/CEST/CFOP/CST-CSOSN/Serviço Municipal — tabelas começam vazias, telas já funcionam).
- `/cadastros/itens` estendido com CEST, GTIN, natureza fiscal padrão e uso fiscal (revenda/insumo/ativo/uso-consumo/serviço/outro) — sem CFOP padrão universal por item (depende da operação, não do produto).
- `/cadastros/empresas/[id]/editar` estendido com CNAE principal/secundários — sem rota nova.
- Sidebar Fiscal reorganizada em 3 grupos: **Escrituração & Operação** (Dashboard, Documentos, Importar XML, Revisão de Itens), **Apuração & Configurações** (Apurações, Regras Contábeis, Config. Tributárias), **Cadastros Fiscais** (hub, Estabelecimentos, Tabelas Nacionais).
- Tela de documento fiscal: badges de status (Fiscal/Contábil/Apuração) no cabeçalho; aba Itens agora mostra "Vinculado"/"Sem produto — revisar" com link direto para a fila.
- Painel de crédito de PIS/COFINS adicionado em `/fiscal/configuracoes-tributarias` (habilitar/desabilitar + alíquotas + aviso quando a empresa não é Lucro Real).

## 3. Limitações e decisões conscientes

- Tabelas nacionais (`ncm_codes` etc.) começam **vazias** — populá-las com a base oficial (import versionado) não fazia parte do escopo desta etapa; as telas já funcionam e aceitam consulta/uso assim que alimentadas.
- Matching automático de item é **conservador de propósito**: só confia em mapeamento já confirmado por fornecedor+código. Nenhuma heurística de similaridade de texto/NCM foi implementada — evita falso-positivo silencioso.
- `tax_status` do documento fiscal ainda não transiciona automaticamente para `ASSESSED` quando uma apuração de fato consome o documento (gap já conhecido da auditoria anterior) — mostrado honestamente como está, correção é Etapa 35B.
- Central de pendências fiscais **completa** (CFOP inválido, NCM inválido, não contabilizado, não apurado, avisos de parser) não foi construída — só a fila de classificação de item, que era o escopo fechado desta etapa.

## 4. Próximas etapas

- **35B** — Escrituração fiscal operacional: central de pendências completa, validação leve de CFOP/NCM/CST, transição de `tax_status`.
- **35C** — Reforma Tributária base: `fiscal_document_item_taxes`, `tax_reform_rates`, catálogo `tax_types` em banco, CBS/IBS/IS.
