# Consolidação do Roadmap Fiscal + Reforma Tributária — Escopo Fechado da Etapa 35A

**Data:** 2026-07-21
**Tipo:** Consolidação e decisão de escopo — nenhum código, migration ou RLS foi alterado nesta rodada.
**Insumos consolidados:**
- `docs/arquitetura-fiscal-erp-contabil-reforma-tributaria-roadmap.md` (arquitetura funcional, Claude)
- `docs/auditoria-tecnica-schema-fiscal-reforma-roadmap.md` (validação técnica de schema, Codex)
- `docs/ux-fluxo-operacional-fiscal-reforma-roadmap.md` (UX e fluxo operacional, Gemini)
- `docs/auditoria-estado-sistema-pos-contabil-fiscal.md` (auditoria geral anterior)
- `DEVELOPMENT_LOG.md` (histórico completo)

---

## 1. Contexto

Os três relatórios convergem no diagnóstico central: **o motor fiscal (regras contábeis, apuração, patrimônio) é maduro; o que falta é a camada de cadastro/governança fiscal** (códigos nacionais, catálogo de produto vinculado, estabelecimentos, CNAE) — exatamente o que a Reforma Tributária vai tornar mais urgente, não o que ela introduz de novo. Os três relatórios também confirmam, de forma independente, os mesmos achados técnicos (nenhuma modelagem de CBS/IBS/IS, `calculation_mode` morto, hardcode de PIS/COFINS, `establishment_id` vestigial, códigos fiscais como texto livre) — não há divergência factual entre eles, só divergência de **como resolver** alguns pontos de desenho, resolvida abaixo.

---

## 2. Síntese dos Diagnósticos

| Dimensão | Classificação | Base |
|---|---|---|
| XML/importação (NF-e) | **Pronto** | Parser estrutural completo, preview→confirmação, dedup por chave/hash |
| XML/importação (CT-e) | **Parcial** | Só ICMS extraído; PIS/COFINS existem na XML e são ignorados |
| XML/importação (NFS-e) | **Frágil** | Tolerante por design (sem XSD nacional); não extrai retenções |
| Documentos fiscais (CRUD/workflow) | **Pronto** | 5 status, cancelamento, 7 abas de detalhe |
| Lançamento manual | **Pronto** (com ressalva) | Funciona; falta retenções na criação inicial (Gemini) |
| Regras contábeis fiscais | **Pronto** | Multi-linha, multi-condição, especificidade, conta dinâmica de parceiro |
| Rastreabilidade fiscal→contábil | **Pronto** | Trilha imutável, índice único anti-duplicidade (v2.7) |
| Apuração tributária | **Pronto** (genérico) | 10 tipos de tributo no mesmo pipeline; IRPJ/CSLL com regime+vigência |
| Patrimônio | **Pronto** | Baixa com ganho/perda já implementada ponta a ponta |
| Cadastros fiscais (NCM/CFOP/CST/CEST) | **Inexistente** | Texto livre, sem tabela nacional nenhuma |
| Vínculo item↔catálogo | **Frágil** | Existe no schema, nunca preenchido via XML, sem tela |
| Estabelecimentos | **Inexistente** (coluna morta) | `establishment_id` referenciado no tipo, zero CRUD/uso |
| `calculation_mode` | **Crítico** (enganoso) | Editável na UI, não lido pelo motor — induz erro operacional |
| PIS/COFINS recuperável (import XML) | **Crítico** (risco fiscal) | Alíquota fixa no código, sem checar regime da empresa |
| Escrituração real (fluxo diário) | **Parcial** | Funciona para volume baixo/médio; sem central de pendências |
| Reforma Tributária (CBS/IBS/IS) | **Inexistente** | Zero ocorrência em `src/` — confirmado pelos três relatórios |

---

## 3. Decisões Fechadas

### 3.1 Tributos por item — **Decisão: híbrida, com `fiscal_document_item_taxes` adiada para 35C**
Adotada a recomendação técnica (Codex), que é mais detalhada e tecnicamente mais segura que a formulação original em aberto do documento de arquitetura:
- Colunas legadas de `fiscal_document_items` (ICMS/IPI/PIS/COFINS/ISS) **permanecem como estão** — não são tocadas na 35A, continuam sendo a leitura simples dos tributos atuais.
- `fiscal_document_item_taxes` (tabela filha normalizada, 1 linha por tributo por item) é a **fonte de verdade para CBS/IBS/IS** e, no futuro, pode espelhar também os tributos legados — mas **só é criada na 35C**, não na 35A.
- Regra de convivência definida desde já para evitar divergência futura: quando existir linha em `fiscal_document_item_taxes` para um tributo, ela é autoritativa; as colunas fixas legadas continuam valendo apenas para os tributos que elas já cobrem hoje. Não haverá sincronização bidirecional automática entre as duas representações — cada tributo mora em exatamente um lugar.
- **O que a 35A prepara para isso**: os cadastros de código fiscal nacional (`tax_situation_codes`, etc.) e o registry central de `TaxType` (ver 3.3) — que é exatamente o que `fiscal_document_item_taxes` vai referenciar por FK/código em vez de depender só do enum antigo.

### 3.2 `tax_regime_rates` vs. tabela específica da Reforma — **Decisão: NÃO estender `tax_regime_rates`, criar tabela nova em 35C**
Esta decisão **reverte a recomendação inicial do documento de arquitetura** (que sugeria estender `tax_regime_rates`) em favor da recomendação técnica mais criteriosa: `tax_regime_rates` fica **restrita a IRPJ/CSLL/SIMPLES**, como está hoje. Uma tabela nova (`tax_reform_rates` ou `tax_rate_rules`, nome a fechar na 35C) será criada especificamente para CBS/IBS/IS, porque a dimensionalidade é genuinamente diferente (UF, município, ano de transição, alíquota efetiva vs. nominal, redução de base, crédito presumido) — encaixar isso em `tax_regime_rates` produziria uma tabela com dezenas de colunas nullable sem semântica clara para quem só usa IRPJ/CSLL. O **algoritmo de resolução** (mais específico primeiro, depois vigência mais recente) é reaproveitado conceitualmente, não a tabela física.
- **Entra na 35A**: nada estrutural — só o registro desta decisão arquitetural, para não ser re-litigada em 35C.
- **Fica para 35C**: a tabela nova em si.

### 3.3 `TaxType` — **Decisão: registry TypeScript central na 35A, catálogo de banco só na 35C**
- **35A**: criar uma fonte central de metadados (`src/modules/taxes/tax-types.ts` ou equivalente) expondo, por tributo: código, rótulo, categoria, se é apurável, se é contabilizado por documento (caso PIS/COFINS), se pode ser retenção, modo de cálculo padrão, se exige configuração de alíquota, se pertence à Reforma. Isso não troca o enum Postgres nem qualquer schema — é puramente a consolidação das 4+ listas hoje replicadas (`TaxType` em dois módulos, enum Zod de apuração, enum Zod de retenções, CHECK de `company_tax_assessment_settings`, `ASSESSABLE_TAX_TYPE_VALUES`, mapas de cálculo `HEADER_TAX_FIELD`/`CREDIT_ELIGIBLE_TAX_TYPES`).
- **35C**: catálogo formal em tabela (`tax_types`), quando CBS/IBS/IS precisarem de fato entrar em produção — novas tabelas (`fiscal_document_item_taxes`, tabela de vigência da Reforma) referenciam esse catálogo por FK/código, não o enum antigo.
- **Risco de não fazer isso agora**: adicionar CBS/IBS/IS direto nas 4+ listas espalhadas repetiria a divergência que já existe hoje entre elas (ex.: PIS/COFINS fora de `company_tax_assessment_settings` por design, IRPJ/CSLL fora do enum de retenções) — só que com tributos que têm impacto legal imediato.

### 3.4 `calculation_mode` — **Decisão: implementar efeito real na 35A**
Confirmado pelos três relatórios como campo morto/enganoso. Decisão: **implementar o efeito real**, não apenas ocultar — é um fix pequeno e bem localizado (`assertTaxTypeAllowedForAssessment` e os pontos de disparo automático em `calculateTaxAssessmentAction`/`calculateIncomeTaxAssessmentAction`).
- **Comportamento definido**: quando `calculation_mode = MANUAL` para um tributo, a ação de cálculo automático não gera/recalcula linhas automáticas para aquele tributo — bloqueia com mensagem clara (equivalente ao já existente `RATE_NOT_CONFIGURED`/`NO_REVENUE`) e permite apenas lançamento manual de linha, que já existe e não depende deste campo.
- **Arquivos afetados**: `src/modules/tax-assessments/actions.ts` (pontos de disparo automático), telas `/fiscal/apuracoes/**` (mensagem de bloqueio quando MANUAL).
- **Teste mínimo**: apuração de um tributo com `calculation_mode=MANUAL` não deve gerar nenhuma linha automática ao calcular; apuração com `AUTO` continua idêntica ao comportamento atual.

### 3.5 PIS/COFINS hardcoded — **Decisão: remover, exigir configuração explícita, nunca adivinhar**
- Remover `PIS_RECOVERABLE_RATE = 0.0165` / `COFINS_RECOVERABLE_RATE = 0.076` e a função `applyRecoverablePisCofinsForInboundNfe` em `src/modules/fiscal/xml-import/actions.ts` como estão hoje (aplicação incondicional).
- Comportamento novo: se não houver configuração explícita de recuperabilidade para a empresa/regime, **o XML é importado normalmente com os valores como vieram**, sem recálculo, e o sistema gera um aviso/pendência ("PIS/COFINS recuperável não configurado para este regime — revisar manualmente") em vez de aplicar uma alíquota qualquer.
- Para Lucro Real: pode calcular automaticamente **se houver configuração explícita** cadastrada.
- Para Lucro Presumido/Simples: **não calcular crédito recuperável automaticamente** mesmo com configuração simplificada — esses regimes majoritariamente não têm direito ao crédito não-cumulativo da forma como o código assumia.
- **Decisão de forma**: não reaproveitar `tax_regime_rates` para isso (Codex está correto — crédito depende de operação/natureza do item, não é só uma alíquota por regime). Para a 35A, criar uma configuração mínima e explícita por empresa (pode ser um campo simples em `company_tax_assessment_settings` ou uma tabelinha dedicada bem pequena — decisão de implementação, não estrutural) apenas para destravar o hardcode; o desenho completo de regras de recuperabilidade por operação/item fica para etapa futura de contabilização composta (35D), quando `fiscal_document_item_taxes` já existir.

### 3.6 `item_id` de XML e vínculo produto — **Decisão: matching conservador + fila mínima na 35A**
- Criar `partner_item_mappings` (fornecedor + código do produto do fornecedor → item interno), com correspondência automática **só quando houver chave forte**: mapeamento já existente por parceiro, ou código interno idêntico com NCM/unidade compatíveis. Tudo que não bater com confiança alta cai em revisão.
- Vínculo manual do item XML ao catálogo sempre disponível.
- Criação assistida de produto novo a partir do item importado (quando não existe correspondente).
- **Escopo 35A**: mapeamento + fila mínima (`fiscal_document_item_review_issues`, escopo restrito a "item sem produto"/"match fraco"), como tabela editável estilo planilha (não modal por item, conforme Gemini). A central de pendências fiscais **completa** (CFOP inválido, NCM inválido, documento não contabilizado/apurado, avisos de parser, retenção ausente) fica para 35B.

### 3.7 Códigos fiscais como texto livre — **Decisão: criar tabelas referenciais, sem quebrar dados antigos**
- Criar `ncm_codes`, `cest_codes`, `cfop_codes`, `tax_situation_codes` (cobre CST ICMS/CSOSN/IPI/PIS/COFINS via coluna `tax_family`), `municipal_service_codes` — todas **referenciais** (leitura para todo usuário autenticado, escrita restrita a admin/sistema, população inicial por import versionado).
- **Não** transformar os campos legados de `fiscal_document_items`/`items` em FK obrigatória nesta migration — os campos de texto continuam existindo e aceitando o que já está lá; as novas tabelas alimentam autocomplete/validação/enriquecimento nas telas, e alimentam a geração de pendências (item com CFOP não encontrado na tabela, por exemplo), sem bloquear nada retroativamente.
- Regras contábeis fiscais continuam funcionando por string de CFOP como hoje — só a UI de cadastro passa a oferecer seleção validada.

### 3.8 Estabelecimentos — **Decisão: implementar na 35A, com checagem de nome de tabela antes da migration**
- Implementar de verdade — a coluna já existe e é relevante para empresas multi-UF/multi-IE (perfil real de transportadora já trabalhado nesta sessão).
- **Ponto técnico a verificar antes de escrever a migration** (Codex): `fiscal_documents.establishment_id` já referencia o nome `establishments` em comentário/tipo — checar se essa tabela já existe fisicamente no ambiente-alvo antes de decidir entre estender `establishments` ou criar uma tabela nova. Não criar uma `fiscal_establishments` paralela sem essa checagem.
- Campos mínimos: `id, workspace_id, company_id, code, name, cnpj, state_registration, municipal_registration, state, city, municipality_code, address_line, active, timestamps`.
- Documento fiscal ganha seletor de estabelecimento (opcional, sem quebrar documentos que não têm um definido); XML pode tentar sugerir o estabelecimento pelo CNPJ do emitente/destinatário quando a empresa tiver mais de um cadastrado, mas isso é um "nice to have" da 35A, não bloqueante.

### 3.9 CNAE e perfil fiscal — **Decisão: campos na empresa existente, sem tela nova**
- Adicionar `main_cnae` e `secondary_cnaes` (array simples) em `companies` — sem tabela filha própria por enquanto (não há necessidade de auditar vigência de CNAE nesta etapa).
- **Sem rota nova dedicada**: usar o formulário de edição de empresa já existente (`/cadastros/empresas/[id]/editar`), não criar `/fiscal/cadastros/empresa-perfil` como página separada — evita fragmentar um cadastro que já tem endereço próprio, mantendo o padrão "uma entidade, um formulário" já usado no resto do sistema.
- `company_profile` (enum solto TRANSPORTATION/TRADE/SERVICES/INDUSTRY/OTHER) permanece como está — não é substituído pelo CNAE, os dois convivem (CNAE é o código oficial; `company_profile` é a classificação interna já usada em outras regras).

### 3.10 Central de pendências fiscais — **Decisão: mínima na 35A, completa na 35B**
- **35A**: `fiscal_document_item_review_issues`, escopo restrito a pendências de classificação de item (`item sem produto`, `match de baixa confiança`), com lista/fila simples.
- **35B**: painel completo — item sem produto, CFOP inválido, NCM inválido, CST ausente, documento sem natureza fiscal, documento não contabilizado, documento não apurado, aviso de parser (NFS-e/CT-e tolerante), retenção possivelmente ausente.

---

## 4. Escopo Fechado da 35A

### 4.1 Obrigatório
1. Implementar efeito real de `calculation_mode` (gatear cálculo automático por tributo).
2. Remover hardcode de PIS/COFINS recuperável; exigir configuração explícita; nunca calcular com alíquota adivinhada; gerar aviso/pendência quando ausente.
3. Migration aditiva única (`erp_schema_v2_8_35a_fiscal_structuring_foundation.sql`) criando: `ncm_codes`, `cest_codes`, `cfop_codes`, `tax_situation_codes`, `municipal_service_codes`, `establishments` (ou extensão, conforme checagem prévia), `partner_item_mappings`, `fiscal_document_item_review_issues`, extensões em `companies` (CNAE) e `items` (CEST/GTIN/natureza fiscal padrão/`fiscal_item_usage`).
4. Vínculo item de XML ↔ catálogo: matching conservador + edição manual + criação assistida de produto.
5. Fila mínima de revisão de item importado (tabela estilo planilha).
6. Registry TypeScript central de metadados de `TaxType` (sem tocar enum Postgres).
7. Reorganização da sidebar Fiscal em 3 pilares (Escrituração & Operação / Apuração & Configurações / Cadastros Fiscais), incluindo a nova entrada "Cadastros Fiscais Base".
8. Ajustes mínimos na tela de documento fiscal: indicação de vínculo produto/status de classificação do item; badge de status (Fiscal/Contábil/Apuração) no cabeçalho.

### 4.2 Desejável, se couber
- Redesenho completo das 7→6 abas do documento fiscal (consolidar Tributos+Reforma e Apuração+Patrimônio) — só faz sentido pleno quando 35C adicionar conteúdo de Reforma; nesta etapa, adiantar a estrutura de abas é opcional.
- Banner mais proeminente de aviso de NFS-e/CT-e tolerante (hoje é texto discreto).
- Validação leve de CFOP (ex.: aviso se CFOP de saída aparece em documento de entrada).
- Retenções na tela de criação manual de documento (hoje só na edição).
- Início de uma suíte mínima de testes automatizados do pipeline fiscal (parser → documento → regra → apuração) — ver riscos.

### 4.3 Fora de Escopo (explicitamente)
- Cálculo ou apuração real de CBS/IBS/IS.
- `fiscal_document_item_taxes` (35C).
- `tax_reform_rates`/`tax_rate_rules` (35C).
- Catálogo `tax_types` em tabela de banco (35C — 35A só cria o registry TS).
- Troca do enum Postgres `tax_type` por catálogo.
- SPED/EFD/ECD/ECF e obrigações acessórias completas.
- Emissão fiscal / webservice SEFAZ.
- Folha de pagamento (qualquer trabalho).
- Refatoração global de lint (débito pré-existente, fora de escopo).
- Migração retroativa massiva de documentos antigos para as novas tabelas de código.
- Limpeza destrutiva de duplicatas do v2.7 dentro desta migration — isso é operacional, já coberto pelos scripts entregues nesta sessão (`erp_ops_limpar_contabilizacoes_fiscais_duplicadas.sql`, `erp_ops_pos_estorno_marcar_duplicata_revertida.sql`), e deve ser **executado antes** da 35A como pré-condição, não dentro dela.

---

## 5. Migrations Propostas (não aplicadas nesta rodada)

**Nome:** `erp_schema_v2_8_35a_fiscal_structuring_foundation.sql` — aditiva, idempotente, sem quebrar dados legados.

| Tabela | Campos principais | RLS | Observação |
|---|---|---|---|
| `ncm_codes` | `code` (unique), `description`, `valid_from`, `valid_until`, `active`, `source_version` | Leitura autenticada global; escrita admin/sistema | Popular por import versionado |
| `cest_codes` | `code` (unique), `ncm_code`, `segment`, `description`, `valid_from`, `valid_until`, `active`, `source_version` | Idem | — |
| `cfop_codes` | `code` (unique), `description`, `direction`, `operation_scope`, `valid_from`, `valid_until`, `active` | Idem | Usado em autocomplete + filtro de regra contábil |
| `tax_situation_codes` | `tax_family`, `code`, `description`, `regime`, `credit_allowed`, `valid_from`, `valid_until`, `active` (unique em `tax_family+code+regime`) | Idem | Cobre CST ICMS/CSOSN/IPI/PIS/COFINS |
| `municipal_service_codes` | `municipality_code`, `national_service_code` (LC 116), `municipal_service_code`, `description`, `valid_from`, `valid_until`, `active` (unique município+código) | Idem | — |
| `establishments` | `id, workspace_id, company_id, code, name, cnpj, state_registration, municipal_registration, state, city, municipality_code, address_line, active, timestamps` | Igual padrão de `companies`/cadastros, por workspace | **Checar existência prévia da tabela antes de migrar** |
| `partner_item_mappings` | `workspace_id, company_id, partner_id, item_id, supplier_product_code, supplier_description, supplier_unit, supplier_ncm, supplier_gtin, confidence, source, active, timestamps` (unique `company_id+partner_id+supplier_product_code` quando ativo) | Tenant-owned | Alimentado pela fila de revisão |
| `fiscal_document_item_review_issues` | `workspace_id, company_id, fiscal_document_id, fiscal_document_item_id, issue_type, severity, status, suggested_item_id, details, timestamps` | Tenant-owned | Escopo restrito a classificação de item nesta etapa |
| `companies` (extensão) | `main_cnae`, `secondary_cnaes` (array) | — | Sem tabela filha |
| `items` (extensão) | `cest`, `gtin`/`ean`, `default_fiscal_operation_nature_id`, `fiscal_item_usage` (`RESALE`/`INPUT`/`FIXED_ASSET`/`USE_CONSUMPTION`/`SERVICE`/`OTHER`) | — | Sem CFOP padrão universal (depende da operação) |

Todas as tabelas de código nacional levam índice único em `code` (ou combinação relevante) e índice em `active`; todas as tabelas tenant-owned seguem o padrão RLS já estabelecido (`can_read_company`/`can_write_company`/`can_admin_company`, conforme o caso).

---

## 6. Telas Propostas

| Rota | Objetivo | Observação |
|---|---|---|
| `/fiscal/cadastros` | Hub de cadastros fiscais | Novo — entrada única para as tabelas abaixo |
| `/fiscal/cadastros/estabelecimentos` | CRUD de estabelecimentos | Cartões com indicação Matriz/Filial |
| `/fiscal/cadastros/tabelas-nacionais` | Consulta/gestão de NCM, CEST, CFOP, CST/CSOSN, código de serviço | Tabela de consulta com busca por código/palavra-chave; não é CRUD pesado para o usuário comum |
| `/cadastros/itens` (existente, estendida) | Adicionar CEST, GTIN, natureza fiscal padrão, tipo de uso fiscal | Não criar rota nova — estender formulário existente |
| `/cadastros/empresas/[id]/editar` (existente, estendida) | Adicionar CNAE principal/secundários | Não criar rota nova |
| `/fiscal/revisao-itens` | Fila de vinculação item XML ↔ produto | Tabela editável estilo planilha, não modal; escopo mínimo nesta etapa (cresce em 35B) |
| `/fiscal/documentos/[id]` (existente, ajustada) | Badges de status (Fiscal/Contábil/Apuração) + indicação de item sem vínculo | Ajuste pontual, não o redesenho completo de abas |

Sidebar Fiscal reorganizada em 3 grupos (Escrituração & Operação / Apuração & Configurações / Cadastros Fiscais), incorporando as novas entradas.

---

## 7. Riscos

1. **Precondição bloqueante**: confirmar que a migration v2.7 (índice anti-duplicidade) está aplicada em produção e que duplicatas pré-existentes foram limpas via os scripts já entregues — os três relatórios convergem em que isso deve ser resolvido **antes** de somar mais complexidade ao módulo fiscal.
2. **Trocar um hardcode por outro**: ao remover a alíquota fixa de PIS/COFINS, o risco é criar uma configuração "boa o bastante por agora" que vire o próximo hardcode disfarçado — mitigado pela decisão explícita de bloquear e avisar quando não configurado, em vez de aplicar qualquer fallback.
3. **FK prematura demais**: se as novas tabelas de código nacional virarem FK obrigatória imediatamente sobre dados/XMLs antigos inconsistentes, documentos históricos podem quebrar — mitigado pela decisão de manter os campos legados como texto livre nesta etapa.
4. **Ambiguidade de nome de tabela (`establishments` vs `fiscal_establishments`)** — resolver com uma checagem técnica simples antes de escrever a migration, não depois.
5. **Ausência de testes automatizados** — a 35A introduz várias tabelas e um novo fluxo (matching de item) simultaneamente; sem ao menos um teste mínimo de regressão do pipeline fiscal, cada mudança futura (inclusive 35C) fica mais arriscada. Recomendado como item desejável, não bloqueante, desta etapa.
6. **Escopo "vazando" para a Reforma**: como o motivador da análise inteira é a Reforma, há risco de a implementação da 35A começar a antecipar tabelas/campos de CBS/IBS/IS "só para adiantar" — as decisões acima fecham isso explicitamente fora de escopo.

---

## 8. Prompt Final de Implementação — Etapa 35A

> Use este prompt para iniciar a implementação da 35A em uma sessão dedicada (não implementar nesta mesma rodada de consolidação).

```
Implemente a Etapa 35A (Cadastros Fiscais Estruturantes) do ERP Sela Sistem, seguindo
exatamente o escopo fechado em docs/consolidacao-roadmap-fiscal-reforma-35a.md — leia esse
documento e docs/arquitetura-fiscal-erp-contabil-reforma-tributaria-roadmap.md,
docs/auditoria-tecnica-schema-fiscal-reforma-roadmap.md e
docs/ux-fluxo-operacional-fiscal-reforma-roadmap.md antes de começar.

PRÉ-CONDIÇÃO (verificar antes de tocar em código):
- Confirmar que a migration erp_schema_v2_7_fix_duplicate_fiscal_accounting_race.sql está
  aplicada em produção e que não há mais de uma aplicação 'APPLIED' por documento fiscal em
  fiscal_accounting_applications (usar os scripts já existentes
  db/migrations/erp_ops_limpar_contabilizacoes_fiscais_duplicadas.sql e
  erp_ops_pos_estorno_marcar_duplicata_revertida.sql em modo dry-run primeiro). Se houver
  duplicata ativa, pare e reporte — não prossiga com a 35A sobre dado inconsistente.

ESCOPO OBRIGATÓRIO:
1. Corrigir `calculation_mode`: implementar efeito real (gatear cálculo automático de
   apuração por tributo quando MANUAL) em src/modules/tax-assessments/actions.ts.
2. Remover o hardcode de PIS/COFINS recuperável em
   src/modules/fiscal/xml-import/actions.ts (PIS_RECOVERABLE_RATE, COFINS_RECOVERABLE_RATE,
   applyRecoverablePisCofinsForInboundNfe). Substituir por configuração explícita por
   empresa/regime; se ausente, importar sem recálculo e gerar aviso/pendência, nunca
   adivinhar alíquota.
3. Antes de migrar `establishments`: checar via information_schema se essa tabela já existe
   no ambiente-alvo (fiscal_documents.establishment_id já referencia esse nome). Estender se
   existir; criar com o nome `establishments` (não `fiscal_establishments`) se não existir.
4. Criar migration aditiva única erp_schema_v2_8_35a_fiscal_structuring_foundation.sql com:
   ncm_codes, cest_codes, cfop_codes, tax_situation_codes, municipal_service_codes,
   establishments (conforme item 3), partner_item_mappings,
   fiscal_document_item_review_issues, extensão de companies (main_cnae,
   secondary_cnaes) e extensão de items (cest, gtin, default_fiscal_operation_nature_id,
   fiscal_item_usage). RLS e índices conforme a Seção 5 do documento de consolidação. Não
   criar fiscal_document_item_taxes, tax_reform_rates/tax_rate_rules nem tabela tax_types —
   isso é 35C.
5. Implementar matching conservador de item XML ↔ catálogo (partner_item_mappings) +
   vínculo manual + criação assistida de produto a partir do item importado.
6. Criar fila mínima de revisão (/fiscal/revisao-itens), tabela editável estilo planilha,
   escopo restrito a "item sem produto"/"match de baixa confiança" (não a central de
   pendências completa, que é 35B).
7. Criar registry TypeScript central de metadados de TaxType (ex.:
   src/modules/taxes/tax-types.ts) consolidando as listas hoje espalhadas — sem alterar o
   enum Postgres tax_type nem criar tabela de catálogo ainda.
8. Reorganizar a sidebar Fiscal em 3 grupos (Escrituração & Operação / Apuração &
   Configurações / Cadastros Fiscais) incluindo a nova entrada "Cadastros Fiscais Base".
9. Ajustar a tela de documento fiscal: badges de status (Fiscal/Contábil/Apuração) no
   cabeçalho e indicação de item sem vínculo de produto — ajuste pontual, não redesenho
   completo das 7 abas.
10. Estender o formulário de itens (/cadastros/itens) e o de empresa
    (/cadastros/empresas/[id]/editar) com os novos campos — sem criar rotas novas para isso.

FORA DE ESCOPO (não implementar mesmo que pareça pequeno):
Cálculo/apuração de CBS/IBS/IS; fiscal_document_item_taxes; tax_reform_rates/tax_rate_rules;
tabela tax_types; troca do enum Postgres; SPED/EFD/ECD/ECF; emissão fiscal/webservice
SEFAZ; folha de pagamento; refactor global de lint; migração retroativa de documentos
antigos; qualquer limpeza destrutiva de duplicatas fora dos scripts já existentes.

VALIDAÇÃO OBRIGATÓRIA ANTES DE FINALIZAR:
- `npm run build` limpo.
- Teste manual (ou automatizado, se houver tempo) de: importar XML → item cai na fila de
  revisão quando sem match forte → vincular manualmente → documento mostra o vínculo;
  apuração de tributo com calculation_mode=MANUAL não gera linha automática; importação de
  NF-e sem configuração de PIS/COFINS não aplica alíquota adivinhada e gera aviso.
- Atualizar DEVELOPMENT_LOG.md com o que foi de fato implementado (sem inflar escopo).
- Não marcar CBS/IBS/IS como iniciado — a 35A não toca nisso.
```

---

## 9. Atualização do Histórico

`DEVELOPMENT_LOG.md` atualizado apenas com nota de consolidação desta rodada — a 35A **não** foi marcada como implementada.
