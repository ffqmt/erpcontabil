# Arquitetura Fiscal do ERP Sela Sistem — Diagnóstico Profundo e Roadmap para a Reforma Tributária

**Data:** 2026-07-21
**Tipo:** Análise funcional e arquitetural — nenhum código, migration ou RLS foi alterado nesta etapa.
**Insumos revisados:** `docs/auditoria-estado-sistema-pos-contabil-fiscal.md`, `DEVELOPMENT_LOG.md` (integral), os 13 demais arquivos de `docs/`, `src/modules/fiscal/**`, `src/modules/tax-assessments/**`, `src/modules/registrations/**`, `src/modules/assets/**`, `src/modules/accounting/**` (estrutura), rotas `src/app/(erp)/fiscal/**`, `src/components/app-shell/sidebar.tsx`, e todas as migrations fiscais de `erp_schema_v1_4` a `erp_schema_v2_7` + scripts operacionais de limpeza.

---

## 1. Visão Geral

O módulo fiscal do Sela Sistem deixou de ser "importador de XML + gerador de lançamento" há várias etapas — hoje ele tem: cadastro completo de documento fiscal (entrada/saída, manual ou via XML), suporte a NF-e/CT-e/NFS-e com graus de completude bem diferentes entre si, um motor de regras contábeis fiscais maduro (multi-linha, multi-condição, com trilha de auditoria imutável e proteção contra dupla contabilização), apuração tributária genérica reaproveitada por 10 tipos de tributo (incluindo IRPJ/CSLL com regras por regime e vigência), e integração completa com Patrimônio (inclusive baixa com ganho/perda já implementada de ponta a ponta, não mais um TODO).

O que falta não é "mais uma tela" — é o que separa um sistema que **gera lançamento a partir de XML** de um sistema que é **um motor fiscal parametrizável de verdade**: cadastros fiscais estruturados (hoje CST/CFOP/NCM/CEST são texto livre, sem tabela própria), vínculo real entre item importado e catálogo de produto/serviço (hoje inexistente na prática), eliminação de alíquotas hardcoded (PIS/COFINS recuperável na importação de XML usa 1,65%/7,60% fixos no código, não configuração), e — o motivo desta análise — **nenhuma modelagem de CBS/IBS/Imposto Seletivo em lugar nenhum do código** (confirmado por busca textual completa em `src/`).

A boa notícia estrutural: os pontos que a Reforma Tributária mais vai exigir (parametrização por vigência, não travar alíquota no código, engine de regra multi-condição, trilha de auditoria) **já são o estilo arquitetural dominante deste projeto** — `tax_regime_rates` (IRPJ/CSLL) já resolve "vigência + regime + natureza fiscal" sem hardcode, e `fiscal_accounting_rule_lines` já resolve "N linhas contábeis com bases de valor configuráveis" sem hardcode. A Reforma não exige um paradigma novo — exige **estender esses dois padrões já validados** para os novos tributos, mais adicionar os cadastros fiscais que ainda faltam mesmo sem reforma nenhuma.

---

## 2. Diagnóstico do Fiscal Atual

### 2.1 O que já existe e está maduro
- **Documento fiscal completo**: CRUD manual, importação XML (unitária e em lote até 30 arquivos), workflow DRAFT→IMPORTED→VALIDATED→BOOKED→CANCELLED, cancelamento com motivo, rastro completo em 7 abas na tela de detalhe (Documento, Itens, Tributos, Contabilidade, Apuração Tributária, Patrimônio, XML/Auditoria).
- **Motor de regras contábeis fiscais**: multi-linha (`fiscal_accounting_rule_lines`, N débitos/créditos por regra), multi-condição (arrays de tipo de documento/direção/CFOP/padrão de CFOP/natureza/tipo de item/parceiro/regime — `erp_schema_v2_4`), casamento por especificidade + prioridade + data, resolução dinâmica de conta de cliente/fornecedor (cria a conta automaticamente na execução, nunca na prévia), 13 bases de valor configuráveis por linha (incluindo frete/seguro/desconto/cada imposto individualmente), nunca posta sozinho sem confirmação humana mesmo com `auto_generate_draft=true`.
- **Rastreabilidade fiscal→contábil**: `fiscal_accounting_applications` é uma trilha imutável (nunca apagada, só marcada REVERSED), protegida por índice único (`erp_schema_v2_7`) contra o bug de contabilização duplicada corrigido nesta mesma sessão. Existe "Regerar" (estorna + reposta em uma ação) tanto individual quanto em lote.
- **Apuração tributária genérica**: um único pipeline (create→calculate→recompute→account→close) atende ISS/ICMS/IPI/SIMPLES/INSS_RETIDO/IRRF/PCC/IRPJ/CSLL/OTHER. IRPJ/CSLL tem motor próprio dentro do mesmo pipeline: trimestral, Presumido (por natureza fiscal) e Real (a partir da DRE real + ajustes LALUR simplificados), com guarda explícita contra empresa do Simples.
- **`tax_regime_rates`**: exatamente o padrão que a Reforma vai precisar — taxa por regime + tributo + natureza fiscal opcional + vigência (`valid_from`/`valid_until`), nunca hardcoded, resolução por "mais específico, depois mais recente".
- **Patrimônio**: criação de bem a partir de item fiscal classificado como ativo, depreciação linear mensal calculada e postada em dois passos, **baixa com ganho/perda já totalmente implementada** (débito de depreciação acumulada + débito de recebível se houver venda + débito de perda ou crédito de ganho, tudo validado e balanceado antes de postar) — isso já estava pronto, não é mais gap.

### 2.2 O que está parcial
- **CT-e**: só extrai ICMS (base/alíquota/valor/CST); PIS/COFINS existem na XML do CT-e e são ignorados. Sintetiza um único item "Serviço de Transporte" (correto para o caso, mas sem granularidade). Identificação do tomador é best-effort com aviso explícito quando ambíguo.
- **NFS-e**: parser **deliberadamente tolerante** (busca recursiva por nome de tag, não é schema-aware, porque não existe XSD nacional de NFS-e). Não extrai INSS/IRRF/PIS/COFINS/CSLL retidos mesmo sendo comuns em NFS-e real — precisa complemento manual. O próprio código já avisa "não recomendado para importação em lote".
- **PIS/COFINS recuperável na entrada de NF-e**: recalculado com **alíquotas fixas no código** (1,65%/7,60%), sem checar o regime tributário da empresa — funciona só para Lucro Real não-cumulativo, mas é aplicado sempre. É exatamente o tipo de hardcode que a Reforma não pode repetir.
- **`calculation_mode` (AUTO/MANUAL por tributo)**: existe no cadastro (`company_tax_assessment_settings`), é editável na tela de Config. Tributárias, mas **não é lido em nenhum lugar do motor de cálculo** — é campo morto, cosmético. Achado nesta análise (não estava documentado antes).
- **Vínculo item↔catálogo de produto**: existe (`items.id` como FK opcional em `fiscal_document_items.item_id`), mas **só é usado no lançamento manual**; na importação de XML o `item_id` nunca é preenchido — todo item vindo de XML é 100% avulso, sem nenhuma tentativa de casamento por NCM/descrição.

### 2.3 O que está improvisado / precisa virar cadastro de verdade
- **NCM, CEST, CFOP, CST ICMS, CSOSN, CST IPI/PIS/COFINS, código de serviço municipal**: hoje são todos **texto livre** digitado (ou vindo da XML) direto em colunas de `fiscal_document_items` — não existe nenhuma tabela `ncm_codes`, `cfop_codes`, `cst_icms_codes` etc. Isso significa: sem validação de "esse CFOP existe", sem descrição amigável, sem qualquer governança central. Cresce em risco com a Reforma, que vai introduzir uma "Classificação Tributária" nacional nova (códigos de situação por CBS/IBS/IS) — se isso também virar texto livre, o sistema não terá como auditar o que está sendo aplicado.
- **`fiscal_operation_natures`**: é usado como dimensão de agrupamento (natureza da receita para Presumido/Simples, condição de regra contábil), mas não carrega CFOP nem qualquer tributo-padrão — é uma etiqueta, não uma configuração fiscal completa.
- **Estabelecimentos (`establishment_id`)**: coluna existe em `fiscal_documents` e é referenciada no tipo, mas **não há CRUD, nem leitura, nem escrita em lugar nenhum do código** — é uma coluna morta. Empresas com múltiplas inscrições estaduais/municipais (comum em transportadoras, que é o perfil real de uma das empresas trabalhadas nesta sessão) não têm como modelar isso hoje.
- **CNAE**: não existe em nenhum lugar do cadastro de empresa — necessário para determinar corretamente enquadramento/alíquota em vários dos novos códigos de classificação da Reforma.

---

## 3. Fluxo Fiscal Real Esperado (com estado atual mapeado em cada etapa)

### Entrada
Importação XML (✅ funcional para NF-e, parcial para CT-e) → conferência/preview editável (✅) → classificação de item (⚠️ não existe tela dedicada; item chega sem vínculo ao catálogo) → CFOP/natureza (⚠️ manual, sem validação contra tabela) → crédito tributário (✅ ICMS/IPI automatizado; PIS/COFINS com alíquota hardcoded) → retenções (✅ tabela e tela existem, preenchimento manual) → contabilização (✅ motor de regras maduro) → inclusão em apuração (✅ automático por tipo de tributo) → auditoria (✅ trilha completa).

### Saída
Importação XML emitida (✅, mesmo pipeline bidirecional da Etapa 32D) → lançamento manual (✅) → receitas/deduções (✅ campos existem no documento) → impostos sobre venda (✅ ICMS/ISS calculados; regra contábil resolve conta de receita/imposto a recolher) → retenções (✅) → contabilização/apuração (✅) → livros fiscais (❌ não existe nenhum "livro de saída" nem export SPED-like ainda).

### Serviços
NFS-e tomada/prestada (⚠️ parser tolerante, retenções de ISS/INSS/IRRF/PIS/COFINS/CSLL precisam ser adicionadas manualmente pós-importação — não há extração automática). Município/código de serviço existe como campo, mas sem tabela de códigos municipais.

### Transporte
CT-e tomado/emitido (⚠️ só ICMS extraído automaticamente), tomador identificado com heurística e aviso quando incerto, remetente/destinatário resolvidos via mesmo motor de parceiro-por-CNPJ do NF-e.

### Reforma Tributária (estado atual: **zero**)
Nenhuma etapa do fluxo acima tem qualquer ramo, campo, parser ou tela preparada para CBS/IBS/IS — nem mesmo um campo oculto/reservado. Isso é o achado central desta análise e o motivador do roadmap da Seção 10.

---

## 4. Impacto da Reforma Tributária no Fiscal do Sela Sistem

### 4.1 O modelo atual de `tax_type` suporta novos tributos?
Mecanicamente sim (é um enum de banco + union type TypeScript), mas **hoje exige tocar manualmente em pelo menos 4 listas distintas** que já divergem entre si mesmo sem a Reforma: `TaxType` (12 valores), o enum Zod de validação, `company_tax_assessment_settings` (CHECK constraint com 10 valores, já **sem** PIS/COFINS por design), e os mapas de cálculo (`HEADER_TAX_FIELD`, `CREDIT_ELIGIBLE_TAX_TYPES`). Não existe um registro central de "quais tributos existem e como cada um se comporta" — é tudo espalhado e replicado à mão. **Antes de adicionar CBS/IBS/IS, vale a pena consolidar essas 4 listas em uma fonte única** (ver Seção 9, camada 3).

### 4.2 A apuração atual suporta coexistência de tributos antigos e novos?
O pipeline genérico (create→calculate→recompute→account→close) é agnóstico ao tipo de tributo — o mesmo padrão que hoje atende ICMS/IPI/ISS lado a lado suporta perfeitamente CBS/IBS/IS rodando **em paralelo** com ICMS/PIS/COFINS/ISS durante a transição (2026-2033), desde que cada apuração seja por tributo (já é). O ponto que precisa de desenho novo é o de **crédito financeiro amplo**: hoje `CREDIT_ELIGIBLE_TAX_TYPES` é uma lista fixa (`['ICMS','IPI']`) decidindo o que gera crédito — sob CBS/IBS, praticamente todo tributo pago em aquisição gera crédito (não só mercadoria para revenda), o que muda a regra de "quando este tributo é recuperável" de uma lista fixa por tipo de tributo para uma regra de classificação por item/operação.

### 4.3 Documentos fiscais suportam múltiplos tributos novos por item?
Não hoje. `fiscal_document_items` modela **um bloco fixo por tributo** (colunas `icms_*`, `ipi_*`, `pis_*`, `cofins_*`, `iss_*`) — não existe estrutura para "N grupos de tributo por item", que é exatamente o que a NF-e vai carregar durante a transição (ICMS **e** IBS no mesmo item, por vários anos). Duas rotas possíveis, ambas viáveis tecnicamente:
- **(a) Mais colunas fixas** (`cbs_base/rate/amount`, `ibs_uf_rate/amount`, `ibs_mun_rate/amount`, `is_rate/amount`, `classificacao_tributaria_code`) — consistente com o estilo já usado para ICMS/IPI/PIS/COFINS/ISS, simples de consultar, mas cresce em colunas a cada novo tributo/quebra federativa.
- **(b) Tabela filha normalizada** (`fiscal_document_item_taxes`: 1 linha por tributo por item, com `tax_type, base, rate, amount, situacao_tributaria, classificacao_tributaria_code`) — mais flexível a longo prazo, não exige nova migration para cada tributo futuro, mas é uma mudança de estilo em relação ao restante do módulo.

Esta decisão está marcada como **ponto de validação técnica (Seção 13)** — não deve ser resolvida sem uma segunda opinião, porque trava a forma de todo o resto (parser, regra contábil, apuração) por anos.

### 4.4 Regras contábeis suportam CBS/IBS a recuperar/recolher?
A arquitetura sim, os valores enumerados não. `fiscal_accounting_rule_lines.value_base` já é uma lista extensível de "de onde tirar o valor desta linha" (`ICMS_AMOUNT`, `IPI_AMOUNT`, `PIS_AMOUNT`, `COFINS_AMOUNT`, `ISS_AMOUNT`, mais os valores gerais). Adicionar `CBS_AMOUNT`/`IBS_UF_AMOUNT`/`IBS_MUN_AMOUNT`/`IS_AMOUNT` é uma extensão aditiva do mesmo enum + um caso a mais em `valueBaseAmount()` — **não é reconstrução**, é o mesmo padrão usado para adicionar qualquer tributo hoje.

### 4.5 Será necessária tabela de parametrização da Reforma?
Sim, mas recomenda-se **estender `tax_regime_rates`** em vez de criar uma tabela paralela — ela já resolve exatamente "taxa por regime + tributo + vigência + natureza fiscal opcional". A extensão necessária: campos opcionais de UF e município (IBS é o único tributo federativamente partido entre estado e cidade — CBS e IS são federais/únicos), e o próprio `tax_type` novo (`CBS`/`IBS`/`IS`) já cabe na coluna existente. Isso segue o princípio "reuso antes de reconstrução" que já rege este projeto (mesma decisão tomada para IRPJ/CSLL reaproveitar `tax_assessments` em vez de `income_tax_assessments`).

### 4.6 Será necessária tabela de códigos/classificações IBS/CBS?
Sim — e aqui não há nada para reaproveitar, porque **hoje não existe nenhuma tabela de código fiscal nacional no sistema** (CFOP/NCM/CST também são texto livre). Recomenda-se criar isso como parte do 35A (cadastros fiscais estruturantes, que já era necessário independente da Reforma) e desenhar a tabela de código de classificação tributária da Reforma (`cClassTrib` e sucessores) como **mais uma tabela de código nacional do mesmo padrão**, não como algo à parte.

### 4.7 Quais campos devem ser preparados desde já (mesmo sem cálculo ainda)?
- Campo(s) reservados no item para os novos tributos (mesmo que fiquem `null` por anos) — decisão de forma na Seção 4.3.
- Um campo de "versão de layout do documento" (legado / transição / definitivo) para o parser saber qual formato esperar sem quebrar documentos antigos.
- Extensão do enum `tax_type` com `CBS`, `IBS`, `IS` assim que a primeira necessidade real aparecer (não antes — evita enum "morto" por anos).
- Campo de situação tributária por item preparado para receber o novo CST/classificação, mesmo que hoje só valide o CST antigo.

**Nada disso deve ser feito com alíquota ou cronograma fixo no código** — todo valor percentual/data de transição deve vir de tabela de vigência, replicando o padrão já validado em `tax_regime_rates`.

---

## 5. Cadastros Fiscais Necessários — Estado Atual

| Cadastro | Existe? | Onde | Observação |
|---|---|---|---|
| Empresa/regime tributário | ✅ | `companies.tax_regime` | Falta CNAE |
| Estabelecimentos | ❌ | coluna morta (`establishment_id`) | Sem CRUD, sem uso real |
| Inscrição estadual/municipal | ✅ | `companies.state_registration/municipal_registration` | Por empresa, não por estabelecimento |
| Regime tributário | ✅ | `companies.tax_regime` | SIMPLES/PRESUMIDO/REAL |
| Perfil fiscal (CNAE-like) | ⚠️ parcial | `companies.company_profile` | Enum solto (TRANSPORTATION/TRADE/SERVICES/INDUSTRY/OTHER), não é CNAE real |
| Produtos/serviços | ⚠️ parcial | `items` | Sem CEST, sem conta padrão, sem natureza fiscal padrão; não vinculado a XML |
| Unidades de medida | ⚠️ | `items.unit` | Texto livre, sem tabela |
| NCM | ⚠️ | texto livre em `items`/`fiscal_document_items` | Sem tabela nacional |
| CEST | ⚠️ | texto livre só em `fiscal_document_items` | Nem no catálogo de item |
| CFOP | ⚠️ | texto livre em `fiscal_document_items` | Sem tabela, é condição de regra contábil só como string/padrão |
| CST ICMS / CSOSN | ⚠️ | texto livre | Sem tabela |
| CST IPI/PIS/COFINS | ⚠️ | texto livre | Sem tabela |
| Código de serviço municipal | ⚠️ | `items.service_code` texto livre | Sem tabela de municípios×código |
| Naturezas de operação | ✅ | `fiscal_operation_natures` | Sem CFOP nem tributo-padrão associado |
| Alíquotas/regras por regime | ✅ | `tax_regime_rates` | Só IRPJ/CSLL/SIMPLES hoje; modelo pronto para estender |
| Regras fiscais por UF | ❌ | — | Não modelado |
| Regras por parceiro | ⚠️ parcial | `fiscal_accounting_rules.partner_ids` | Só para roteamento contábil, não define regime do parceiro |
| Retenções | ✅ | `fiscal_document_retentions` | Funcional, preenchimento manual |
| Benefícios fiscais | ❌ | — | Não modelado |
| Centro de custo | ✅ | `cost_centers` (contábil) | Já integrado à contabilização fiscal via regra |

**Resposta direta:** os cadastros que já existem são "operacionais" (o que precisa para lançar); os que faltam são "governança" (o que precisa para validar/auditar/parametrizar em escala) — e são exatamente os que a Reforma torna urgentes, porque o volume de códigos novos vai expor a ausência de tabela própria de forma muito mais dolorosa do que hoje.

---

## 6. Tabelas/Telas Existentes (inventário objetivo)

**Tabelas:** `fiscal_documents`, `fiscal_document_items`, `fiscal_document_retentions`, `fiscal_xml_imports`, `fiscal_accounting_rules`, `fiscal_accounting_rule_lines`, `fiscal_accounting_applications`, `tax_assessments`, `tax_assessment_lines`, `tax_assessment_adjustments`, `tax_regime_rates`, `company_tax_assessment_settings`, `items`, `fiscal_operation_natures`, `partners` (campos fiscais embutidos), `fixed_assets`, `asset_categories`, `asset_depreciations`.

**Telas:** `/fiscal` (dashboard), `/fiscal/documentos` (lista + ações em lote), `/fiscal/documentos/novo`, `/fiscal/documentos/[id]` (7 abas), `/fiscal/documentos/[id]/editar`, `/fiscal/importar-xml` (unitário + lote), `/fiscal/regras-contabeis` (lista/novo/editar), `/fiscal/apuracoes` (lista/nova/detalhe, com painel específico de ajustes IRPJ/CSLL), `/fiscal/configuracoes-tributarias` (settings + tax_regime_rates).

---

## 7. Tabelas/Telas Faltantes

| Falta | Prioridade | Etapa sugerida |
|---|---|---|
| Tabelas de código nacional (NCM, CEST, CFOP, CST ICMS/CSOSN/IPI/PIS/COFINS, código serviço municipal) | Alta | 35A |
| Tela de classificação/revisão fiscal de itens importados (vincular item de XML ao catálogo) | Alta | 35A/35B |
| Cadastro de estabelecimentos real | Média | 35A |
| CNAE na empresa | Média | 35A |
| Tabela/tela de classificação tributária da Reforma (códigos CBS/IBS/IS) | Alta (mas só quando a especificação nacional estabilizar) | 35C |
| Extensão de `tax_regime_rates` para UF/município e novos tipos de tributo | Alta | 35C |
| Livros fiscais (entrada/saída/apuração) e exportações | Média | 35E |
| Preparação estrutural para SPED/EFD/novo leiaute unificado | Média (estrutura agora, layout depois) | 35F |
| Tela de "documentos pendentes de escrituração"/painel de pendências fiscais | Média | 35B |

---

## 8. Lacunas Críticas (por severidade)

1. **Alíquota hardcoded no importador de XML** (PIS/COFINS 1,65%/7,60% sem checar regime) — viola diretamente o princípio que a própria Reforma exige ("nada de alíquota fixa no código"). Precisa migrar para configuração antes de qualquer trabalho de Reforma, senão o padrão ruim se repete nos tributos novos.
2. **`calculation_mode` morto** — campo configurável na tela que não é lido pelo motor. Ou passa a ser respeitado, ou é removido da tela — deixar como está é enganoso para quem configura.
3. **Ausência total de cadastro de código fiscal nacional** (CFOP/NCM/CST/CEST como texto livre) — cresce em risco proporcional ao número de códigos novos que a Reforma introduz.
4. **CT-e não extrai PIS/COFINS** mesmo estando na XML — perda de crédito potencial não capturada automaticamente.
5. **NFS-e não extrai retenções** (INSS/IRRF/PIS/COFINS/CSLL) comuns em NFS-e real — trabalho manual obrigatório hoje, e vai competir por atenção com o trabalho de adaptação à Reforma.
6. **v2.7 (índice único contra dupla contabilização) — confirmar se já foi aplicado em produção e se a limpeza de duplicatas pré-existentes foi concluída.** Isso foi trabalhado ao longo desta mesma sessão (scripts de diagnóstico/limpeza/estorno foram entregues), mas não há confirmação final de que o ambiente de produção está com a migration aplicada e os dados já normalizados — é um item operacional pendente, não arquitetural, mas bloqueia a garantia de integridade que o resto desta análise assume.
7. **`establishment_id` vestigial** — decisão pendente: construir estabelecimentos de verdade (empresas com múltiplas IEs/IMs, relevante para transportadoras que operam em vários estados) ou remover a coluna morta.
8. **Nenhuma suíte de testes automatizados** — cada mudança de Reforma (que vai tocar parser, regra contábil, apuração, relatório) precisa hoje de verificação manual completa; o risco de regressão cresce com o tamanho do trabalho, não linearmente.

---

## 9. Arquitetura Alvo em Camadas

| # | Camada | Objetivo | Tabelas prováveis | Telas | Integração Contábil | Integração Patrimônio | Integração Futura Folha/REINF | Impacto Reforma |
|---|---|---|---|---|---|---|---|---|
| 1 | Cadastros fiscais | Governar códigos nacionais e regras cadastrais base | `ncm_codes`, `cfop_codes`, `cst_icms_codes`, `cst_pis_cofins_codes`, `municipal_service_codes`, `establishments` | Telas de manutenção (provavelmente somente-leitura para tabelas nacionais, com import periódico) | Fornece dados para regra contábil e apuração | Nenhuma direta | Nenhuma direta | Base para códigos de classificação tributária novos |
| 2 | Produtos/Serviços | Catálogo fiscal completo e vínculo real com item de documento | `items` estendido (CEST, conta padrão, natureza fiscal padrão, classificação ativo/insumo/revenda/uso-consumo) | Tela de classificação/revisão de item importado | Alimenta regra contábil por tipo de item | Alimenta criação de ativo (já existe via `item_type='ASSET'`) | — | Campo de classificação tributária CBS/IBS/IS por produto/serviço |
| 3 | Classificações tributárias | Registro central de "quais tributos existem e como se comportam" (hoje disperso em 4 listas) | `tax_types` (catálogo, não enum) ou consolidação das listas hoje replicadas | Nenhuma nova (interno) | Usado por toda a apuração/regra | — | — | Onde `CBS`/`IBS`/`IS` entram sem duplicar manutenção |
| 4 | Regras fiscais atuais | Já maduro — CFOP/direção/natureza/item/parceiro/regime como condição de regra contábil | `fiscal_accounting_rules` + `_lines` (existentes) | `/fiscal/regras-contabeis` (existente) | É a própria camada de integração contábil | — | — | Reaproveitável quase 1:1 |
| 5 | Regras fiscais Reforma | Vigência/UF/município/regime para CBS/IBS/IS | Extensão de `tax_regime_rates` | Extensão de `/fiscal/configuracoes-tributarias` | Alimenta valor de linha de regra contábil | — | — | Núcleo da preparação para a Reforma |
| 6 | Documentos fiscais | Já maduro — cabeçalho + workflow | `fiscal_documents` (existente) | `/fiscal/documentos/**` (existente) | — | `fiscal_document_id` em `fixed_assets` (existente) | — | Campo de versão de layout; suporte a coexistência de tributos |
| 7 | Itens e tributos | Hoje um bloco fixo por tributo; decisão pendente para multi-tributo | `fiscal_document_items` (extensão) ou nova `fiscal_document_item_taxes` | Aba "Itens"/"Tributos" (existente, a estender) | Base de valor para regra contábil | `fiscal_document_item_id` em `fixed_assets` (existente) | — | Onde IBS/CBS/IS por item realmente moram |
| 8 | Classificação/revisão fiscal | Fechar o gap de item-sem-vínculo-a-catálogo | — (fluxo, não tabela nova) | Nova: fila de revisão pós-importação | — | — | — | Situação tributária por item precisa de revisão humana na transição |
| 9 | Regras contábeis | Já maduro | `fiscal_accounting_rules/_lines/_applications` (existentes) | Existente | É a camada | — | — | Novos `value_base` (`CBS_AMOUNT`/`IBS_*_AMOUNT`/`IS_AMOUNT`) |
| 10 | Escrituração | Fluxo real (entrada/saída/serviço/transporte) | Sem tabela nova — é o conjunto de status já existente | Painel de pendências (novo) | — | — | — | Nenhum campo novo, só mais validação |
| 11 | Apuração | Já maduro e genérico | `tax_assessments/_lines/_adjustments` (existentes) | Existente | Gera lançamento de apuração | — | — | Roda em paralelo (tributos antigos + novos), sem mudança estrutural |
| 12 | Obrigações/relatórios | Livros fiscais, exports, preparação SPED | Extensão de `obligation_document_type` | Novas telas de exportação | — | — | Ponto de contato futuro com REINF/eSocial no âmbito fiscal (retenções) | Novo leiaute unificado, quando definido |
| 13 | Auditoria/rastreabilidade | Já maduro | `fiscal_accounting_applications`, `fiscal_xml_imports` (existentes) | Abas de auditoria (existentes) | É a camada | — | — | Mesma trilha, mais tributos passando por ela |

---

## 10. Roadmap Implementável

### 35A — Cadastros Fiscais Estruturantes
Produtos/serviços com CEST/conta padrão/natureza padrão; tabelas de código nacional (NCM/CFOP/CST/CSOSN/código de serviço municipal); CNAE na empresa; decisão sobre estabelecimentos (construir ou remover a coluna morta); vínculo real produto↔item de XML; remover o hardcode de PIS/COFINS recuperável (mover para configuração por regime); decidir o destino do `calculation_mode` morto.

### 35B — Escrituração Fiscal Operacional
Tela de classificação/revisão de item importado (fila, não modal); painel de pendências fiscais (documentos escriturados sem contabilização, sem apuração, com regra ambígua); validação de totais documento×itens; transição de `tax_status` para `ASSESSED` quando a apuração de fato consome o documento (hoje não transiciona).

### 35C — Reforma Tributária Base
Consolidar as 4 listas de `tax_type` em uma fonte única; adicionar `CBS`/`IBS`/`IS` ao catálogo consolidado; estender `tax_regime_rates` com UF/município e vigência específica de transição; decidir e implementar a forma de multi-tributo por item (Seção 4.3); parser tolerante para os campos novos de NF-e/NFS-e/CT-e (mesmo padrão de tolerância já usado no NFS-e, para não quebrar quando o layout nacional mudar); apuração paralela inicial (estrutura pronta, cálculo real só quando as regras definitivas de crédito estiverem publicadas).

### 35D — Contabilização Fiscal Composta
Novos `value_base` (`CBS_AMOUNT`, `IBS_UF_AMOUNT`, `IBS_MUN_AMOUNT`, `IS_AMOUNT`); revisão da lógica de crédito (de lista fixa por tributo para classificação por operação, dado o crédito financeiro amplo da Reforma); regras contábeis de exemplo para os cenários do próprio pedido do usuário (compra com CBS/IBS a recuperar; venda com CBS/IBS a recolher).

### 35E — Apurações e Relatórios Fiscais
Livros de entrada/saída; relatório de retenções; relatório comparativo tributos atuais vs. CBS/IBS/IS (ajuda a empresa a entender o efeito da transição); exportações CSV/Excel dos livros.

### 35F — Preparação de Obrigações Acessórias
Estrutura para SPED/EFD/ECD/ECF (extensão do `obligation_document_type` já existente); auditoria de campos obrigatórios antes de gerar arquivo; ponto de entrada para o futuro leiaute unificado da Reforma quando publicado oficialmente (não antecipar formato específico).

### 36A+ — Folha
Só depois do fiscal estar mais sólido — ver riscos na Seção 12.

---

## 11. Recomendação da Próxima Etapa

**Começar por 35A.** Não porque a Reforma não seja urgente, mas porque **35A é pré-requisito técnico de 35C** — não dá para modelar classificação tributária da Reforma em cima de um sistema onde CFOP/NCM/CST ainda são texto livre sem governança. Fazer 35C antes de 35A significaria construir a parte mais visível (CBS/IBS) sobre uma fundação que ainda não teria onde apoiar os novos códigos de classificação com a mesma disciplina que o resto do sistema já tem.

Dentro de 35A, o primeiro passo pragmático e de menor risco é **remover o hardcode de PIS/COFINS recuperável** e **decidir o destino do `calculation_mode` morto** — são correções pequenas, sem migration estrutural grande, que já eliminam os dois piores exemplos de "alíquota/config fixa no código" antes de começar a adicionar tributos novos.

---

## 12. Riscos se Iniciar Folha Antes do Fiscal Estar Mais Sólido

1. **Atenção dividida em dois domínios grandes e não testados simultaneamente.** Nesta mesma sessão foram encontrados e corrigidos bugs reais em produção no núcleo contábil/fiscal (corrida de dupla contabilização, cálculo do Balanço Patrimonial, encerramento de resultado sem `company_id`/`workspace_id`) — sinal de que a camada ainda está em consolidação, não em regime de manutenção tranquila. Abrir Folha agora compete pela mesma atenção de revisão que esse núcleo ainda precisa.
2. **Duplicação de esforço na engine de regras.** A arquitetura sketch de Folha já prevista (`payroll_accounting_rules`) tende a quere reaproveitar o mesmo padrão do motor fiscal (`fiscal_accounting_rules`) — construir isso antes da Reforma terminar de moldar esse motor (novos `value_base`, possível mudança na lógica de crédito) arrisca ter que refazer parte da engine de Folha depois.
3. **A Reforma tem prazo externo, a Folha não (no mesmo grau).** CBS/IBS têm cronograma legal de transição já em curso desde 2026 — atrasar a preparação fiscal tem custo de conformidade real. Folha é uma capacidade interna sem o mesmo relógio externo (eSocial/REINF já têm sua própria etapa futura reservada, 36D).
4. **Nenhuma suíte de testes automatizados existe.** Expandir para um segundo domínio complexo sem rede de segurança automatizada multiplica o esforço manual de verificação — cada mudança em qualquer um dos dois módulos exige re-teste manual completo do outro para garantir que nada quebrou.

---

## 13. Pontos que Codex Deve Validar Tecnicamente

1. **Forma de multi-tributo por item** (Seção 4.3): colunas fixas adicionais vs. tabela filha normalizada `fiscal_document_item_taxes`. Decisão trava anos de manutenção — merece segunda opinião antes de qualquer migration.
2. **Extensão de `tax_regime_rates` vs. tabela paralela** para UF/município — validar se o padrão de resolução atual (`findEffectiveTaxRegimeRate`) suporta bem a dimensão geográfica extra sem degradar performance/clareza.
3. **Consolidação das 4 listas de `tax_type`** — validar se dá para ter uma única fonte de verdade sem quebrar os pontos que hoje leem cada lista separadamente (`types.ts`, Zod, `company_tax_assessment_settings`, mapas de cálculo).
4. **Confirmar aplicação em produção da migration v2.7** (índice único anti-duplicação) e que a limpeza de duplicatas pré-existentes (scripts entregues nesta sessão) foi de fato executada — pré-requisito de integridade para qualquer trabalho novo em cima do módulo fiscal.
5. **Decisão sobre `calculation_mode`**: implementar o efeito real (gatear cálculo automático) ou remover o campo da tela — não deixar um controle sem efeito.
6. **Decisão sobre `establishment_id`**: construir estabelecimentos reais (útil para empresas multi-UF/multi-IE, como transportadoras) ou remover a coluna morta.
7. **Performance do motor de regras contábeis** conforme o número de regras e condições em array cresce (hoje só `cfops`/`cfop_patterns` têm índice GIN) — validar antes de a Reforma multiplicar o número de regras necessárias (uma regra por combinação de tributo antigo/novo durante a transição é um cenário real).
8. **Risco de ausência de testes automatizados** frente ao volume de mudança que a Reforma vai exigir em parser + regra + apuração simultaneamente — considerar ao menos um conjunto mínimo de testes de regressão para o pipeline fiscal antes de 35C.

---

## 14. Pontos que Gemini Deve Validar na UX

1. **Navegação lateral do Fiscal mistura dois módulos de backend** (`fiscal` e `tax-assessments`) em uma lista plana única, com ícones repetidos (`Percent` usado tanto no Dashboard quanto em Config. Tributárias; `Calculator` reaproveitado entre Fiscal/Bancos/Patrimônio) — vale revisão de agrupamento visual (documentos+regras+XML vs. apurações+configuração) e iconografia distinta.
2. **A tela de detalhe do documento fiscal já tem 7 abas** — antes de adicionar mais conteúdo relacionado à Reforma (situação tributária nova, breakdown de CBS/IBS/IS por item), pensar em como isso cabe sem virar uma tela sobrecarregada (sub-abas? seção expansível dentro de "Tributos"?).
3. **Aviso de NFS-e "não recomendado para importação em lote"** hoje é só um banner informativo — vale tornar isso mais bloqueante/proeminente no fluxo de importação em lote, já que o próprio código reconhece a fragilidade.
4. **Nova tela de classificação/revisão de item importado** (35B) deveria ser desenhada como fila de revisão (lista com ação rápida por item), não como modal por item — o volume esperado (todo item de XML sem vínculo ao catálogo) tornaria um fluxo modal cansativo.
5. **Tela de Config. Tributárias vai crescer bastante** com vigências de CBS/IBS/IS por UF/município — pensar desde já em filtro/busca por UF e por vigência, para não virar uma tabela enorme sem organização.
6. **`calculation_mode` aparece como toggle funcional na tela hoje, mas não tem efeito nenhum** — até a decisão técnica da Seção 13 ser tomada, considerar ocultar ou marcar visualmente como "ainda sem efeito" para não induzir o usuário a erro.
7. **Banner e rótulo de "Resultado do Período" no Balanço Patrimonial foram ajustados nesta mesma sessão** (agora aparece sempre que há resultado cumulativo pendente, não só quando a competência vista não tem encerramento) — vale uma passada de revisão visual/copy nessa tela específica já que o texto mudou.

---

## Anexo — Reconciliação com o Roadmap Anterior (2026-07-21, `auditoria-estado-sistema-pos-contabil-fiscal.md`)

A auditoria anterior já havia esboçado 35A (Refinamento Fiscal) → 35B (Lançamentos Fiscais Compostos) → 35C (Obrigações/Exportações). Este documento **substitui esse esboço** por uma versão mais granular e explicitamente orientada à Reforma Tributária, reorganizando em 35A→35F conforme pedido nesta análise. O conteúdo funcional do 35A/35B antigos foi preservado (refinamento fiscal e lançamentos compostos continuam aqui, como 35A/35D), e o 35C antigo (obrigações) foi deslocado para 35F, abrindo espaço para o novo 35C (Reforma Tributária Base) no meio do roadmap — na ordem em que a arquitetura efetivamente precisa ser construída.
