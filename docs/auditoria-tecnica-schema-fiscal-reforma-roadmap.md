# Auditoria Tecnica do Schema Fiscal e Roadmap da Reforma Tributaria

**Data:** 2026-07-21  
**Tipo:** validacao tecnica de arquitetura, schema e codigo.  
**Escopo:** nenhuma migration foi criada, nenhum modulo da 35A foi implementado e nenhuma regra contabil/folha foi reescrita.

## 1. Build Inicial

Comando executado:

```bash
npm run build
```

Resultado: **passou**.

Observacoes relevantes:
- Next.js 16.2.10 com Turbopack compilou com sucesso.
- TypeScript concluiu sem erro.
- 12 paginas estaticas foram geradas.
- Nao houve erro de build nem warning relevante no output do comando.
- Nao foi necessario corrigir codigo para o build inicial.

## 2. Confirmacao dos Achados do Claude

Os achados tecnicos centrais do documento `docs/arquitetura-fiscal-erp-contabil-reforma-tributaria-roadmap.md` foram confirmados.

| Achado | Validacao tecnica |
|---|---|
| CBS/IBS/IS inexistentes | Confirmado. Nao ha modelagem real em `src/` nem nas migrations; as ocorrencias relevantes ficam em docs/logs. |
| `calculation_mode` morto | Confirmado. O campo e exibido, validado e persistido, mas o motor de calculo nao le o valor. |
| XML nao preenche `item_id` | Confirmado. O importador de XML nao tenta casar item com catalogo. |
| `establishment_id` morto | Confirmado no codigo de aplicacao. Ha referencia tipada/coluna, mas nao ha CRUD nem fluxo operacional. |
| CFOP/NCM/CEST/CST/CSOSN como texto livre | Confirmado. Nao existem tabelas referenciais para esses codigos. |
| PIS/COFINS recuperavel hardcoded | Confirmado em `src/modules/fiscal/xml-import/actions.ts`. |
| v2.7 anti-duplicidade | Confirmado. A migration existe e faz sentido, mas pode falhar se houver duplicatas `APPLIED` pre-existentes. |

Correcao/nuance importante: o backend de documento fiscal aceita `itemId` em itens manuais, mas o formulario atual de item fiscal nao expoe claramente um seletor de produto do catalogo. Na pratica, o vinculo existe no schema/actions, mas ainda nao virou uma jornada operacional consistente.

## 3. Decisao Recomendada para Tributos por Item

Recomendacao: **abordagem hibrida, com tabela filha normalizada como fonte de verdade para novos tributos**.

Nao recomendo adicionar apenas colunas fixas de CBS/IBS/IS em `fiscal_document_items`. Isso preservaria o estilo antigo, mas criaria explosao de colunas para base, aliquota, valor, credito, debito, reducao, classificacao, UF, municipio e memorias de calculo. A Reforma Tributaria aumenta a dimensionalidade do tributo por item; forcar isso no modelo de colunas fixas tende a gerar retrabalho.

Modelo recomendado:
- Manter as colunas atuais de `fiscal_document_items` para compatibilidade legada e leitura simples de ICMS/IPI/PIS/COFINS/ISS ja existentes.
- Criar em 35C a tabela `fiscal_document_item_taxes` para CBS/IBS/IS e, gradualmente, para espelhar tambem tributos legados quando houver refactor controlado.
- Definir regra clara: quando houver linhas em `fiscal_document_item_taxes`, elas sao a fonte autoritativa do detalhe tributario do item; as colunas fixas viram snapshot/compatibilidade.
- Evitar novas colunas fixas de Reforma em `fiscal_document_items`, salvo agregados documentais muito bem justificados por performance.

Campos minimos recomendados para `fiscal_document_item_taxes`:
- `id`
- `workspace_id`
- `company_id`
- `fiscal_document_id`
- `fiscal_document_item_id`
- `tax_type`
- `tax_scope` (`FEDERAL`, `STATE`, `MUNICIPAL`, `SHARED`, `OTHER`)
- `jurisdiction_uf`
- `jurisdiction_municipality_id`
- `tax_situation_code`
- `tax_classification_code`
- `base_amount`
- `rate`
- `effective_rate`
- `reduction_rate`
- `amount`
- `credit_amount`
- `debit_amount`
- `credit_presumed_amount`
- `is_credit_eligible`
- `source` (`XML`, `MANUAL`, `RULE`, `IMPORT_ADJUSTMENT`)
- `parser_version`
- `calculation_memory`
- `raw_data`
- `created_at`
- `updated_at`

Motivos da decisao:
- Parser XML: grupos tributarios por item mapeiam melhor para linhas normalizadas.
- Apuracao: somas por tributo, escopo, classificacao, credito/debito e jurisdicao ficam diretas.
- Contabilizacao composta: regras podem buscar valores filtrados por `tax_type`/`tax_scope`, sem criar um `value_base` novo para cada combinacao possivel.
- Relatorios/livros fiscais: facilita pivots e validacoes por codigo de classificacao.
- Reforma: suporta convivencia de ICMS/PIS/COFINS/ISS com CBS/IBS/IS durante a transicao.
- Migracao: e aditiva e nao quebra documentos antigos.
- RLS: segue o padrao multi-tenant atual com `workspace_id` e `company_id`.

## 4. Decisao Recomendada para `tax_regime_rates`

O padrao de `tax_regime_rates` e bom: vigencia, regime, tributo e natureza fiscal opcional. Esse desenho deve inspirar a Reforma.

Porem, **nao recomendo transformar a tabela atual em tabela universal de CBS/IBS/IS sem redesenho**. Hoje ela esta calibrada para IRPJ/CSLL/SIMPLES, com campos como `presumption_rate`, `additional_rate` e `additional_threshold_monthly`. Para IBS/CBS/IS, seriam necessarias dimensoes novas:
- UF.
- Municipio.
- Tipo de ente ou escopo do tributo.
- Codigo de situacao/classificacao tributaria.
- Regime especifico/diferenciado.
- Reducao de base.
- Aliquota nominal.
- Aliquota efetiva.
- Percentual de transicao por ano.
- Credito presumido.
- Regras de credito.

Recomendacao para 35C:
- Manter `tax_regime_rates` para IRPJ/CSLL/SIMPLES no curto prazo.
- Criar uma tabela nova, preferencialmente `tax_rate_rules` ou `tax_reform_rates`, para regras de CBS/IBS/IS.
- Reaproveitar o algoritmo conceitual de resolucao efetiva: mais especifico primeiro, depois vigencia mais recente.
- Se no futuro fizer sentido unificar, migrar com calma para uma tabela generica de regras tributarias, nao por acumulacao de colunas nullable em `tax_regime_rates`.

Campos minimos sugeridos para 35C:
- `id`
- `workspace_id`
- `company_id`
- `tax_type`
- `tax_scope`
- `tax_regime`
- `fiscal_operation_nature_id`
- `tax_classification_code_id`
- `jurisdiction_uf`
- `jurisdiction_municipality_id`
- `operation_direction`
- `nominal_rate`
- `effective_rate`
- `reduction_rate`
- `credit_presumed_rate`
- `transition_year`
- `valid_from`
- `valid_until`
- `active`
- `metadata`
- `created_at`
- `updated_at`

## 5. Decisao Recomendada para `TaxType`

Hoje `TaxType` esta espalhado em multiplas fontes:
- Enum PostgreSQL `tax_type` criado/estendido nas migrations fiscais.
- `TaxType` em `src/modules/fiscal/types.ts`.
- `TaxType` em `src/modules/tax-assessments/types.ts`.
- Zod enums em `src/modules/tax-assessments/validations.ts`.
- Zod enum de retencoes em `src/modules/fiscal/validations.ts`.
- CHECK constraint de `company_tax_assessment_settings`.
- `ASSESSABLE_TAX_TYPE_VALUES` e `DOCUMENT_ACCOUNTED_TAX_TYPES` em `src/modules/tax-assessments/settings/options.ts`.
- `RegimeRateTaxType` em `src/modules/tax-assessments/regime-rates/types.ts`.
- Mapas de calculo como `HEADER_TAX_FIELD` e `CREDIT_ELIGIBLE_TAX_TYPES`.
- `FiscalAccountingRuleLineValueBase` em regras contabeis fiscais.

Divergencias atuais:
- PIS/COFINS existem no enum geral, mas nao entram em `company_tax_assessment_settings`.
- IRPJ/CSLL entram em apuracao/configuracao, mas nao entram no enum de retencoes fiscais.
- `tax_regime_rates` aceita apenas IRPJ/CSLL/SIMPLES.
- O motor de apuracao so tem campos automaticos de cabecalho para ISS/ICMS e credito para ICMS/IPI.

Recomendacao:
- Em 35A, criar uma fonte central TypeScript de metadados tributarios, por exemplo `src/modules/taxes/tax-types.ts`, sem trocar o schema ainda.
- Essa fonte deve expor codigo, rotulo, categoria, se e apuravel, se e contabilizado por documento, se pode ser retencao, modo default de calculo, se exige configuracao de aliquota e se pertence a Reforma.
- Em 35C, criar tabela catalogo `tax_types` para novos modelos normalizados.
- Manter o enum PostgreSQL existente no curto prazo para evitar uma migration grande e arriscada.
- Novas tabelas, como `fiscal_document_item_taxes` e `tax_reform_rates`, devem preferir FK/codigo para `tax_types` em vez de depender apenas do enum antigo.

## 6. Analise do `calculation_mode`

O campo existe em `company_tax_assessment_settings`, e:
- E criado pela migration `erp_schema_v2_5_tax_assessment_settings.sql`.
- Aceita `AUTO` ou `MANUAL`.
- E lido por queries de configuracao.
- E validado por Zod.
- E editavel na tela `/fiscal/configuracoes-tributarias`.
- E persistido pelas actions de configuracao.

O problema: o motor de calculo nao usa esse valor. `calculateTaxAssessmentAction`, `calculateIncomeTaxAssessmentAction` e os fluxos auxiliares verificam `enabled` e `account_assessment`, mas nao gateiam calculo por `calculation_mode`.

Decisao recomendada:
1. **Implementar efeito real no inicio da 35A**: quando `calculation_mode = MANUAL`, a action automatica nao deve gerar/recalcular linhas automaticas; deve bloquear com mensagem clara ou apenas permitir linhas manuais, conforme UX decidida.
2. Se essa implementacao nao entrar imediatamente, **ocultar ou desabilitar o controle na UI** ate ele ter efeito real.
3. Nao remover o campo agora, porque ele e conceitualmente util para retencoes e tributos sem motor automatico.
4. Nao manter apenas documentado, porque controle visual sem efeito induz erro operacional.

## 7. Analise do `item_id` de XML

`fiscal_document_items.item_id` existe e referencia `items.id`. As actions de item fiscal aceitam `itemId`, mas o importador XML nao preenche esse campo.

No importador:
- NF-e, CT-e e NFS-e geram itens avulsos.
- `writeFiscalDocumentFromImport` insere linhas sem `item_id`.
- O preview de XML permite revisar NCM/CFOP e valores, mas nao vincular item ao catalogo.
- Nao existe estrategia de matching por produto, fornecedor ou codigo externo.

Campos hoje disponiveis para matching:
- No catalogo `items`: `code`, `name`, `description`, `item_type`, `unit`, `ncm`, `service_code`.
- No item fiscal importado: descricao, unidade, NCM, CFOP, CEST e valores tributarios conforme o parser.
- Nao ha EAN/GTIN no catalogo.
- Nao ha supplier code por parceiro.
- Nao ha tabela de mapeamento produto do fornecedor -> item interno.

Estrategia segura para 35A:
- Criar matching automatico conservador apenas quando houver chave forte: mapeamento fornecedor + codigo do produto na XML, ou codigo interno exatamente igual com NCM/unidade compativeis.
- Criar fila de revisao para itens sem match ou com match fraco.
- Permitir vinculo manual do item XML ao catalogo.
- Permitir criacao assistida de produto a partir do item importado.
- Persistir mapeamento por parceiro para que a segunda importacao do mesmo fornecedor seja automatica.

Tabela recomendada para o mapeamento:
- `partner_item_mappings`
- unique parcial por `company_id`, `partner_id`, `supplier_product_code` quando ativo.
- Campos de auditoria com descricao/unidade/NCM capturados da XML para revisao futura.

## 8. Analise do `establishment_id`

`fiscal_documents.establishment_id` aparece nos tipos e a migration fiscal referencia `establishments(id)` tambem em apuracoes, mas nao ha fluxo operacional correspondente.

Resultado da auditoria:
- Nao encontrei CRUD de estabelecimentos no modulo de cadastros.
- Nao encontrei formulario fiscal escrevendo `establishment_id`.
- Nao encontrei query fiscal usando `establishment_id` como filtro operacional.
- Inscricao estadual e municipal existem em `companies`, mas apenas no nivel da empresa.

Recomendacao:
- **Nao remover** `establishment_id`.
- Implementar estabelecimentos reais em 35A, pois empresas multi-IE/multi-UF e transportadoras precisam disso.
- Antes da migration, reconciliar o nome da tabela: como o schema referencia `establishments`, a preferencia tecnica e usar/estender `establishments` se ela existir no ambiente alvo, em vez de criar uma tabela paralela `fiscal_establishments`.
- Se a tabela nao existir de fato no banco alvo, criar uma migration idempotente que garanta a tabela e seus campos fiscais.

Campos minimos:
- `id`
- `workspace_id`
- `company_id`
- `code`
- `name`
- `cnpj`
- `state_registration`
- `municipal_registration`
- `state`
- `city`
- `municipality_code`
- `address_line`
- `active`
- timestamps

## 9. Analise dos Codigos Fiscais como Texto Livre

Codigos hoje em texto livre:
- `items.ncm`
- `items.service_code`
- `fiscal_document_items.ncm`
- `fiscal_document_items.cest`
- `fiscal_document_items.cfop`
- `fiscal_document_items.service_code`
- `fiscal_document_items.cst_icms`
- `fiscal_document_items.csosn`
- `fiscal_document_items.cst_ipi`
- `fiscal_document_items.cst_pis`
- `fiscal_document_items.cst_cofins`
- `fiscal_accounting_rules.cfop`
- `fiscal_accounting_rules.cfops`
- `fiscal_accounting_rules.cfop_pattern`
- `fiscal_accounting_rules.cfop_patterns`

Tabelas ja existentes relacionadas:
- `items`, mas nao e tabela de codigo fiscal nacional.
- `fiscal_operation_natures`, mas e natureza operacional/gerencial, nao CFOP/NCM/CST.
- Nao ha `ncm_codes`, `cfop_codes`, `cest_codes`, `tax_situation_codes` ou `municipal_service_codes`.

Recomendacao para 35A:
- Criar tabelas referenciais oficiais/semioficiais, preferencialmente somente leitura para usuario comum.
- Nao transformar todos os campos legados em FK obrigatoria na primeira migration, para nao quebrar dados antigos nem XMLs com codigos inconsistentes.
- Usar as tabelas para validacao, autocomplete, enriquecimento e geracao de pendencias fiscais.
- Manter regras contabeis por string de CFOP inicialmente, mas trocar UI para selecionar codigos validados.

Impacto:
- Regras contabeis continuam funcionando por codigo textual.
- Apuracao ganha base para validar elegibilidade/creditos no futuro.
- A Reforma ganha fundacao para `cClassTrib` e CST IBS/CBS sem repetir o problema de texto livre.

## 10. Localizacao do Hardcode PIS/COFINS

Arquivo: `src/modules/fiscal/xml-import/actions.ts`.

Pontos encontrados:
- `PIS_RECOVERABLE_RATE = 0.0165`
- `COFINS_RECOVERABLE_RATE = 0.076`
- Funcao `applyRecoverablePisCofinsForInboundNfe`
- Escrita de `pis_rate: 1.65`
- Escrita de `cofins_rate: 7.6`

Impacto:
- Entrada NF-e recebe calculo de PIS/COFINS recuperavel com aliquota fixa.
- Nao ha verificacao de regime tributario da empresa.
- Nao ha verificacao de natureza fiscal, CST, CFOP, NCM, uso/consumo, revenda ou item do catalogo.
- O comportamento e perigoso para empresas fora do Lucro Real nao cumulativo.
- Esse e exatamente o padrao que nao deve ser repetido em CBS/IBS/IS.

Solucao recomendada:
- Remover fallback hardcoded.
- Usar configuracao explicita por empresa/regime/natureza/item.
- Se nao houver configuracao, nao calcular credito automaticamente; importar o XML e gerar aviso/pendencia.
- Para 35A, pode-se usar uma tabela especifica de regras de recuperabilidade (`tax_credit_rules`/`tax_recoverability_rules`) ou uma extensao controlada de regra de aliquota. Minha preferencia e uma regra propria de recuperabilidade, porque credito depende de operacao/item, nao apenas de aliquota.
- `tax_regime_rates` pode servir como inspiracao de vigencia e especificidade, mas nao deve virar o unico lugar para regras de credito.

## 11. Proposta de Migrations Futuras - 35A

Primeira migration recomendada: `erp_schema_v2_8_35a_fiscal_structuring_foundation.sql`.

Ela deve ser aditiva e nao bloquear dados legados. Proposta:

### `ncm_codes`
- Campos: `code`, `description`, `valid_from`, `valid_until`, `active`, `source_version`, timestamps.
- Indices: unique em `code`; indice em `active`.
- RLS: leitura global para usuarios autenticados; escrita apenas admin/sistema.
- Popular inicialmente por script/importacao oficial versionada.
- UI: consulta/autocomplete e tela referencial simples.

### `cest_codes`
- Campos: `code`, `ncm_code`, `segment`, `description`, `valid_from`, `valid_until`, `active`, `source_version`.
- Indices: unique em `code`; indice em `ncm_code`.
- RLS: leitura global; escrita admin/sistema.
- UI: referencial, nao CRUD pesado.

### `cfop_codes`
- Campos: `code`, `description`, `direction`, `operation_scope`, `valid_from`, `valid_until`, `active`.
- Indices: unique em `code`; indice em `direction`.
- RLS: leitura global; escrita admin/sistema.
- UI: referencial/autocomplete e filtro nas regras contabeis.

### `tax_situation_codes`
- Campos: `tax_family`, `code`, `description`, `regime`, `credit_allowed`, `valid_from`, `valid_until`, `active`.
- Unique: `tax_family`, `code`, `regime`.
- RLS: leitura global; escrita admin/sistema.
- UI: referencial.

### `municipal_service_codes`
- Campos: `municipality_code`, `national_service_code`, `municipal_service_code`, `description`, `valid_from`, `valid_until`, `active`.
- Unique: municipio + codigo municipal.
- RLS: leitura global; escrita admin/sistema.
- UI: referencial com filtro por municipio.

### `companies`
- Adicionar `main_cnae`.
- Adicionar `secondary_cnaes` como array ou tabela filha se for necessario auditar vigencia.
- UI: cadastro da empresa.

### `establishments`
- Preferir estender/garantir `establishments`, nao criar tabela paralela, porque `fiscal_documents.establishment_id` ja referencia esse nome.
- Campos fiscais minimos: CNPJ, IE, IM, UF, municipio, codigo municipal, endereco, ativo.
- Indices: `company_id`, `cnpj`, `state`, `municipality_code`.
- RLS: mesmo padrao de `companies`/cadastros por workspace.
- UI: CRUD simples em Cadastros, seletor no documento fiscal.

### `items`
- Adicionar `cest`.
- Adicionar `gtin`/`ean`.
- Adicionar `default_fiscal_operation_nature_id`.
- Adicionar classificacao fiscal operacional, por exemplo `fiscal_item_usage` (`RESALE`, `INPUT`, `FIXED_ASSET`, `USE_CONSUMPTION`, `SERVICE`, `OTHER`).
- Nao adicionar CFOP padrao como regra universal, porque CFOP depende da operacao.
- UI: enriquecer cadastro de produtos/servicos.

### `partner_item_mappings`
- Campos: `workspace_id`, `company_id`, `partner_id`, `item_id`, `supplier_product_code`, `supplier_description`, `supplier_unit`, `supplier_ncm`, `supplier_gtin`, `confidence`, `source`, `active`, timestamps.
- Unique: `company_id`, `partner_id`, `supplier_product_code` quando ativo.
- RLS: tenant-owned.
- UI: gerenciado pela fila de revisao, com ajuste manual.

### `fiscal_document_item_review_issues`
- Campos: `workspace_id`, `company_id`, `fiscal_document_id`, `fiscal_document_item_id`, `issue_type`, `severity`, `status`, `suggested_item_id`, `details`, timestamps.
- Indices: `company_id/status`, `fiscal_document_id`, `fiscal_document_item_id`.
- RLS: tenant-owned.
- UI: fila de revisao fiscal de itens importados.

## 12. Proposta de Migrations Futuras - 35C

### `tax_types`
- Catalogo central de tributos.
- Campos: `code`, `label`, `category`, `is_assessable`, `is_document_accounted`, `is_retention`, `default_calculation_mode`, `requires_rate_rule`, `is_tax_reform`, `active`.
- Popular com tributos atuais e, quando iniciar 35C, CBS/IBS/IS.
- Usar como FK/codigo em novas tabelas; manter enum legado por compatibilidade.

### `tax_reform_classification_codes`
- Campos: `code`, `situation_code`, `description`, `tax_family`, `credit_allowed`, `credit_presumed_allowed`, `reduction_allowed`, `legal_reference`, `valid_from`, `valid_until`, `source_version`, `raw_data`, `active`.
- Alimentar por importacao versionada de tabelas oficiais.

### `tax_reform_rates` ou `tax_rate_rules`
- Campos minimos listados na secao 4.
- Deve resolver vigencia, localidade, regime, classificacao e transicao.
- Deve bloquear calculo quando nao houver regra aplicavel, em vez de usar fallback fixo.

### `fiscal_document_item_taxes`
- Tabela filha normalizada recomendada na secao 3.
- Indices:
  - `company_id`, `fiscal_document_id`
  - `company_id`, `tax_type`, `tax_scope`
  - `fiscal_document_item_id`
  - `tax_classification_code`
  - `jurisdiction_uf`, `jurisdiction_municipality_id`
- RLS: mesmas politicas tenant-owned do documento fiscal.

### Regras contabeis CBS/IBS/IS
- Evitar criar apenas `CBS_AMOUNT`, `IBS_UF_AMOUNT`, `IBS_MUN_AMOUNT`, `IS_AMOUNT` se a tabela filha existir.
- Melhor caminho: adicionar `value_base` generico, como `ITEM_TAX_AMOUNT`, `ITEM_TAX_CREDIT_AMOUNT` e `ITEM_TAX_DEBIT_AMOUNT`, com filtros na linha da regra (`tax_type`, `tax_scope`, `tax_classification_code`).
- Isso reduz explosao de enums e permite novos tributos sem nova lista de bases contabeis.

### Apuracao
- Estender `tax_assessment_lines.source_type` para distinguir origem `FISCAL_ITEM_TAX`.
- Manter apuracao por tributo, mas somar debitos/creditos a partir de `fiscal_document_item_taxes`.

## 13. Riscos Tecnicos

- Adicionar CBS/IBS/IS em colunas fixas tende a gerar retrabalho alto.
- Usar `tax_regime_rates` como tabela universal pode virar uma tabela com muitas colunas nullable e sem semantica clara.
- Manter `calculation_mode` visivel sem efeito gera erro operacional.
- Corrigir PIS/COFINS recuperavel sem regra de configuracao pode trocar um hardcode por outro.
- Criar FKs obrigatorias para NCM/CFOP/CST na primeira etapa pode quebrar historico e XMLs reais inconsistentes.
- Migration v2.7 pode falhar em producao se ainda houver mais de uma aplicacao `APPLIED` por documento.
- Sem testes de parser, apuracao e contabilizacao, a 35C ficara arriscada demais.

## 14. Testes Minimos Recomendados

Antes da 35C, recomendo uma suite minima em camadas:

| Area | Tipo recomendado | Objetivo |
|---|---|---|
| NF-e entrada | unitario + integracao | Parser, preview, persistencia de documento/itens/tributos. |
| NF-e saida | unitario + integracao | Direcao, parceiro, impostos de saida e contabilizacao. |
| CT-e | unitario | Garantir ICMS atual e preparar PIS/COFINS quando implementado. |
| NFS-e | unitario com fixtures variadas | Proteger parser tolerante e retencoes futuras. |
| Contabilizacao fiscal multi-linha | integracao | Regra, aplicacao, journal entry e protecao anti-duplicidade. |
| Estorno/regeracao | integracao | Status `REVERSED`, nova aplicacao e vinculos contabeis. |
| Apuracao | integracao | Linhas, ajustes, fechamento e contabilizacao. |
| IRPJ/CSLL | unitario + integracao | Presumido/Real, vigencia e guarda de Simples. |
| Item XML -> produto | unitario + E2E leve | Matching conservador, fila de revisao e vinculo manual. |
| Tributos por item | unitario + integracao | Normalizacao, soma por tributo/escopo e fallback legado. |
| Build | CI | `npm run build` obrigatorio a cada etapa. |

Playwright/E2E deve cobrir apenas os fluxos principais:
- importar XML;
- confirmar documento;
- revisar item sem produto;
- contabilizar;
- estornar;
- apurar.

## 15. Ordem Tecnica Recomendada

1. Garantir v2.7 em producao com dry-run de duplicatas e procedimento de estorno, sem limpeza destrutiva direta.
2. Corrigir o problema operacional do `calculation_mode`: implementar efeito real ou ocultar/desabilitar na UI.
3. Remover hardcode de PIS/COFINS recuperavel, bloqueando calculo sem configuracao explicita.
4. Criar a primeira migration 35A aditiva com codigos fiscais referenciais, CNAE, estabelecimentos, extensoes de `items`, mapeamento item-fornecedor e fila de pendencias.
5. Implementar UI de classificacao/revisao de item importado.
6. Centralizar metadados de `TaxType` em TS antes de adicionar novos tributos.
7. Criar testes minimos de parser, contabilizacao e apuracao.
8. Iniciar 35C com `tax_types`, classificacoes da Reforma, regras de aliquota/vigencia e `fiscal_document_item_taxes`.

## v2.7 e Integridade Anti-Duplicidade

Migration localizada: `db/migrations/erp_schema_v2_7_fix_duplicate_fiscal_accounting_race.sql`.

Indice criado:
- `uq_fiscal_accounting_applications_active_per_document`
- Tabela: `fiscal_accounting_applications`
- Coluna: `fiscal_document_id`
- Condicao: `where status = 'APPLIED'`

Validacao:
- O indice faz sentido para impedir mais de uma contabilizacao fiscal ativa por documento.
- Permite historico de aplicacoes revertidas.
- Pode falhar se a base ja tiver duplicatas `APPLIED`.

Scripts operacionais encontrados:
- `db/migrations/erp_ops_limpar_contabilizacoes_fiscais_duplicadas.sql`
- `db/migrations/erp_ops_pos_estorno_marcar_duplicata_revertida.sql`

Procedimento recomendado antes de producao:
1. Fazer backup/snapshot.
2. Rodar diagnostico em modo dry-run.
3. Se houver duplicatas em draft, limpar apenas depois de revisar o output.
4. Se houver duplicatas postadas, estornar via aplicacao e depois marcar a aplicacao antiga como `REVERSED` com o script pos-estorno.
5. Repetir dry-run ate zerar duplicatas ativas.
6. Aplicar v2.7.
7. Confirmar existencia do indice e rodar smoke test de contabilizacao fiscal.

Nao executei limpeza real.

## Referencias Oficiais Consultadas

- Lei Complementar 214/2025, Planalto: https://www.planalto.gov.br/ccivil_03/leis/lcp/lcp214.htm
- Emenda Constitucional 132/2023, Planalto: https://www.planalto.gov.br/ccivil_03/constituicao/emendas/emc/emc132.htm
- Portal NF-e, Nota Tecnica 2025.002: https://www.nfe.fazenda.gov.br/portal/listaConteudo.aspx?tipoConteudo=04BIflQt1aY%3D
- Portal NF-e, Informe Tecnico 2025.002: https://www.nfe.fazenda.gov.br/portal/listaConteudo.aspx?tipoConteudo=hXzemuyNHW4%3D
