# Diagnóstico e Arquitetura Fiscal-Contábil — Etapa 32A

**Escopo desta etapa: diagnóstico e plano apenas.** Nenhum código, migração, RLS ou dado
real foi alterado para produzir este documento — só leitura (`sistema.html`, código-fonte
TypeScript, arquivos `.sql` de schema/migração).

**Achado central que muda a premissa do pedido**: o ERP atual **já tem** uma base fiscal/
tributária/patrimonial muito mais madura do que um diagnóstico "do zero" pressuporia —
módulos `fiscal`, `tax-assessments`, `assets` e `obligations` já existem, com schema, RLS,
Server Actions e UI completos (construídos nas Etapas 19–24, confirmados por leitura direta
do código nesta sessão, não por suposição). As lacunas reais são mais específicas e menores
do que "construir o módulo fiscal" — são: **importação de XML**, **resolução automática de
parceiro por CNPJ**, **motor de regras contábeis configurável** (hoje é 100% manual) e
**IRPJ/CSLL como tributos de apuração periódica** (hoje ausentes do catálogo de tributos).

---

## 1. O que o `sistema.html` antigo previa

| Função | Finalidade | Conexão com o ERP novo | Reaproveitar? |
|---|---|---|---|
| `parseXMLToDoc(xmlStr)` (linha ~6257) | Parser de XML de NF-e/CT-e/NFS-e via `DOMParser` + fallback regex quando o XML está malformado/parcial. Extrai chave de acesso, número, série, data emissão, valor total, CNPJ/nome emitente e destinatário, PIS/COFINS/ICMS/ISS. | O ERP novo **não tem nenhum parser de XML hoje** — este é o gap mais concreto e o ponto de partida direto para a Etapa 32B. | **Adaptar**: a estratégia dual (DOM parser + regex fallback) é uma boa ideia para robustez contra XMLs malformados, mas o parsing em si deve migrar para uma lib de XML server-side no Node (ex. `fast-xml-parser` ou `@xmldom/xmldom`), já que roda em Server Action, não no browser. Os *seletores* de campo (`infNFe`, `vNF`/`vTPrest`/`ValorServicos`, `emit > CNPJ`, etc.) são um bom ponto de partida para o mapeamento NF-e/CT-e/NFS-e. |
| `garantirParceiroPorCnpj(cnpj, nome)` (linha ~6360) | Busca parceiro existente por CNPJ normalizado; se não achar, `confirm()` do usuário e cria um novo parceiro **sempre com `tipo: 'FORNECEDOR'`** (bug do legado: não distingue cliente de fornecedor pela direção do documento). | Base direta para a regra do item "Parceiros automáticos por CNPJ" (seção 4) — mas o bug precisa ser corrigido no novo desenho (usar `direction` do documento para decidir Cliente vs Fornecedor). | **Adaptar com correção**: reaproveitar a ideia (buscar → confirmar → criar), corrigir o bug de tipo fixo, e adicionar o que o legado não fazia: criação automática de conta contábil (o legado nunca criava conta — só cadastro de parceiro). |
| `importarDocXML(ev)` / `importarDocXMLTexto()` | Dois pontos de entrada — upload de arquivo `.xml` e colar texto — ambos chamam `processarXmlEImportar`. | Padrão de UX a reaproveitar: **upload OU colar texto**, mesmo padrão já usado em `bank-statement-import-form.tsx` (Etapa 30A) para CSV. | **Reaproveitar o padrão de UX**, não o código (é DOM/vanilla JS). |
| `processarXmlEImportar(xmlText)` (linha ~6402) | Orquestra: parseia → resolve parceiro (auto-cria se preciso) → **pré-preenche o formulário de documento fiscal** (não salva direto) → aplica defaults de CFOP/CST por direção (`1102`/`50`/`50` para ENTRADA, `5352`/`01`/`01` para SAÍDA) → `alert()` pedindo para o usuário revisar e salvar manualmente. | **Confirma a decisão de produto certa**: importar XML nunca deve gravar direto — sempre uma prévia editável antes de confirmar. Isso já bate com o padrão que o ERP novo já usa em todo lugar (`journal_entries` sempre nasce `DRAFT`, lançamentos fiscais/de apuração/depreciação são criados e postados na mesma transação só depois de o usuário confirmar uma ação explícita). | **Reaproveitar a ideia do fluxo** (parse → prévia → confirmação), **descartar a pré-seleção fixa de CFOP/CST por direção** — isso deveria vir de `fiscal_operation_natures` (cadastro já existente) ou de uma regra configurável (seção 4), não hardcoded. |
| `gerarLancamentoContabilDoDoc(id)` (referenciado em `renderFiscal`, não lido em detalhe) | Botão "Contabilizar" por documento — gera o lançamento contábil a partir do documento fiscal salvo. | Equivalente direto já existe e está **mais maduro** no ERP novo: `accountFiscalDocumentAction` (`src/modules/fiscal/actions.ts`) já faz isso, com validação de período aberto, contas ativas/analíticas, saldo D=C. | **Já superado** pelo ERP novo — nada a portar aqui, só evoluir (regras automáticas em vez de seleção manual de conta a cada documento). |
| `estornarLancamentoDoDoc(id)` | Estorno do lançamento gerado a partir de um documento. | O ERP novo já tem estorno genérico de lançamento (`reverseJournalEntryAction`, Etapa 14-ish) — mas **não vi um botão específico "estornar e reabrir documento fiscal"** ligando de volta ao `fiscal_documents.accounting_status`. | **Gap a fechar**: quando um lançamento de origem `FISCAL_DOCUMENT` é estornado, o documento fiscal correspondente devia voltar para `accounting_status = 'NOT_ACCOUNTED'` (hoje provavelmente fica preso em `ACCOUNTED` mesmo após o estorno — não confirmado neste diagnóstico, mas é um risco concreto a testar antes de considerar o fluxo fim-a-fim fechado). |
| Importação de eSocial/XML de folha (`importarFolhaXMLFiles`, linhas ~1805-1842) | Fora do escopo desta etapa (folha de pagamento) — mencionado só para registro. | N/A | **Descartar** desta etapa — não pedido no briefing. |
| Ajuste manual do Lucro Real (linha ~2083, comentário) | O próprio legado já documentava: *"os ajustes de adições, exclusões e compensações do Lucro Real... são de preenchimento manual... o sistema não deduz automaticamente ajustes fiscais além do resultado contábil apurado da DRE."* | Confirma que mesmo o protótipo nunca tentou automatizar LALUR/LACS — é consistente com a recomendação desta análise (seção 3) de tratar isso como **entrada manual assistida**, não cálculo automático. | **Reaproveitar a decisão de escopo**: não tentar automatizar adições/exclusões do Lucro Real nesta fase. |

---

## 2. Diagnóstico do ERP Atual

### 2.1 Parceiros (`src/modules/registrations/partners`)

**Schema** (`partners`, `erp_schema_v1.sql:266` + extensões em `erp_schema_v1_2_cadastros_base.sql`):
```
document text                          -- SEM constraint de formato, SEM unique
document_type text check (in CPF/CNPJ) -- opcional
is_customer / is_supplier / is_carrier / is_employee boolean
customer_account_id / supplier_account_id uuid  -- adicionados na Etapa 30A
```

**Respostas diretas**:

1. **Hoje parceiro é único por CNPJ dentro da empresa?** **Não.** Não existe nenhuma
   constraint de unicidade em `document` — confirmado por leitura direta de
   `erp_schema_v1.sql` (só `name`, `document`, `partner_type` na tabela original) e de
   `erp_schema_v1_2_cadastros_base.sql` (só adiciona colunas + 1 `CHECK` de "ao menos um
   papel marcado" — nenhum `UNIQUE`). Hoje é tecnicamente possível cadastrar o mesmo CNPJ
   duas vezes na mesma empresa.
2. **Há constraint de unicidade por `company_id + documento normalizado`?** **Não.**
   Confirmado — grep em todos os arquivos de schema/migração não encontrou nenhum `unique`
   envolvendo a coluna `document`.
3. **O cadastro já normaliza CNPJ?** **Não.** `document` é gravado como o usuário digitar
   (`toRow()` em `partners/actions.ts` só faz `input.document || null`, sem `.replace(/\D/g,
   '')` nem qualquer normalização). Grep por `normalizeDocument`/`normalizeCnpj` no módulo
   não encontrou nada.
4. **Já cria conta contábil automática para cliente/fornecedor?** **Sim, mas só
   manualmente** — Etapa 30A implementou um checkbox opcional no formulário de parceiro
   ("Criar automaticamente uma conta contábil analítica de Cliente/Fornecedor"), que cria a
   conta sob `1.1.2 CLIENTES`/`2.1.1 FORNECEDORES` **antes** de salvar o parceiro (decisão
   deliberada — `chart_accounts` não tem `DELETE`, então criar a conta primeiro evita
   inconsistência se o parceiro falhar depois). **Não está conectado a nenhum fluxo
   automático** (XML, fiscal) — só ao formulário manual de cadastro de parceiro.
5. **Onde salva `customer_account_id`/`supplier_account_id`?** Colunas nullable em
   `partners`, 1:1 opcional (mesmo padrão de `chart_accounts.default_cost_center_id`) — ver
   `db/migrations/erp_schema_v1_6_etapa30a_operacao_multiempresa.sql`.
6. **O que precisa mudar para XML não duplicar fornecedor?** Duas coisas, nesta ordem de
   prioridade:
   - **(a) Constraint de unicidade** — `unique (company_id, document_normalized)` onde
     `document_normalized` é uma coluna gerada (`generated always as
     (regexp_replace(document, '\D', '', 'g')) stored`) ou uma normalização feita na
     aplicação antes do INSERT/lookup. Prefiro a coluna gerada: garante a unicidade mesmo
     se algum outro caminho (import direto, script) inserir sem passar pela Server Action.
   - **(b) Lógica de "buscar antes de criar"** na Server Action de importação de XML — nunca
     fazer `INSERT` direto de parceiro a partir de um XML sem primeiro tentar
     `SELECT ... WHERE company_id = ? AND document_normalized = ?`.

### 2.2 Fiscal (`src/modules/fiscal`)

**Já existe, e é rico.** Tabelas confirmadas por leitura de `erp_schema_v1_1.sql` +
`erp_schema_v1_4_fiscal_tax_assets.sql`: `fiscal_documents`, `fiscal_document_items`,
`fiscal_document_retentions`, `fiscal_operation_natures` (cadastro de referência, sem regra
de conta).

**Respostas diretas**:

1. **Já existem tabelas de documentos fiscais?** **Sim** — `fiscal_documents` (cabeçalho,
   ~35 colunas incluindo `access_key`, `direction` IN/OUT, `document_type`
   NFE/NFCE/NFSE/CTE/CTE_OS/MDFE/MANUAL/OTHER, `status`
   DRAFT→IMPORTED→VALIDATED→BOOKED→CANCELLED, `accounting_status`, `tax_status`,
   `journal_entry_id`, bases/alíquotas/valores de ICMS/ISS/PIS/COFINS no cabeçalho) +
   `fiscal_document_items` (itens com CFOP/CST/CSOSN/NCM/CEST e tributos por item, incl.
   IPI que não existe no cabeçalho) + `fiscal_document_retentions` (IRRF, INSS_RETIDO, PCC
   etc.).
2. **Já existe importação XML?** **Não.** Todo o CRUD de `fiscal_documents` hoje é
   formulário manual (`fiscal-document-form.tsx`) — sem nenhum parser/upload de `.xml`.
3. **Já existe parser de XML?** **Não** (nem no Next.js — só existia no `sistema.html`
   legado, seção 1).
4. **Já existe vínculo documento fiscal → lançamento contábil?** **Sim, e funciona bem.**
   `fiscal_documents.journal_entry_id` + `accountFiscalDocumentAction` (`fiscal/actions.ts`)
   já cria o lançamento (`journal_entries.origin = 'FISCAL_DOCUMENT'`, `origin_id =
   fiscal_document.id`), valida período aberto, contas analíticas/ativas, e posta na mesma
   transação lógica. **Limitação real**: as contas débito/crédito são **sempre escolhidas
   manualmente pelo usuário a cada documento** — não existe nenhuma regra automática por
   CFOP/natureza/tipo de item.
5. **Já existem tributos por item/documento?** **Sim**, nos dois níveis — cabeçalho
   (ICMS/ISS/PIS/COFINS agregados) e item (`fiscal_document_items` tem campos individuais de
   base/alíquota/valor para ICMS/IPI/PIS/COFINS/ISS, mais CFOP/CST/CSOSN/NCM/CEST).
6. **Já existe status para documento importado/classificado/postado/cancelado?** **Sim** —
   `status` (DRAFT/IMPORTED/VALIDATED/BOOKED/CANCELLED) cobre exatamente esse ciclo, com
   `IMPORTED` já reservado para quando a importação de XML existir (hoje nunca é usado, mas
   o valor já está no enum — não precisa de migração de schema para isso).
7. **Existe prevenção de duplicidade por chave de acesso?** **Sim, já pronta no banco** —
   `create unique index uq_fiscal_documents_access_key on fiscal_documents (company_id,
   access_key) where access_key is not null` (e também `uq_fiscal_documents_import_hash`
   para quando a chave não puder ser extraída). **A importação de XML só precisa usar essa
   constraint** (capturar erro `23505` ou fazer um `SELECT` prévio) — nenhuma migração nova
   necessária para deduplicação.

### 2.3 Contabilidade (Journal)

1. **Como gerar lançamento a partir de documento fiscal?** Padrão já estabelecido e
   repetido em 3 lugares (`accountFiscalDocumentAction`, `postAssetDepreciationAction`,
   `accountTaxAssessmentAction`): valida período aberto → valida contas → `INSERT
   journal_entries` com `status: 'DRAFT'` → `INSERT journal_entry_lines` (2 linhas
   balanceadas) → `UPDATE journal_entries SET status = 'POSTED'` (o trigger do banco valida
   D=C nessa transição) → grava `journal_entry_id` de volta na origem. **Esse padrão deve
   ser reaproveitado tal e qual** para qualquer novo gerador automático de lançamento (regra
   de conta, IRPJ/CSLL).
2. **O lançamento deve nascer DRAFT ou POSTED?** No padrão atual: nasce `DRAFT` e é postado
   **na mesma ação**, sem ficar pendurado para revisão posterior — diferente do padrão de
   Conciliação Bancária (Etapa 30A), que deliberadamente deixa em `DRAFT` para revisão manual
   quando a origem é uma regra automática de baixa confiança. **Recomendação para XML**: como
   XML importado tem uma etapa de confirmação humana ANTES da contabilização (o documento só
   chega a `BOOKED` depois do usuário revisar/confirmar), é seguro manter o padrão atual
   (`DRAFT`→`POSTED` na mesma ação de "Contabilizar") — a revisão já aconteceu antes, na
   confirmação da importação.
3. **Existe campo de origem/origin_type/origin_id?** **Sim** — `journal_entries.origin`
   (enum: MANUAL, OPENING, FISCAL_DOCUMENT, FISCAL_ASSESSMENT, PAYROLL_SUMMARY,
   PAYROLL_PAYMENT, BANK_STATEMENT, ASSET_ACQUISITION, ASSET_DEPRECIATION, ASSET_DISPOSAL,
   IRPJ_CSLL, RESULT_CLOSING, REVERSAL) + `origin_id`. **`IRPJ_CSLL` já existe como valor do
   enum** — outra confirmação de que a intenção de tratar IRPJ/CSLL à parte já estava
   prevista no desenho de schema, só nunca foi implementada na camada de aplicação.
4. **Há suporte para histórico/memo?** Sim — `journal_entries.description`/`document` no
   cabeçalho, `journal_entry_lines.memo` por linha.
5. **Há validação de débito = crédito?** Sim, via trigger de banco na transição
   DRAFT→POSTED (mesmo mecanismo usado em toda etapa anterior, incluindo Etapa 30A).
6. **Como respeitar períodos contábeis?** Todo gerador automático de lançamento já
   consulta `accounting_periods` pela competência do documento/apuração e bloqueia se
   `status` não for `OPEN`/`REOPENED` — padrão 100% consistente hoje.

### 2.4 Ativo Imobilizado (`src/modules/assets`)

1. **Já existe cadastro de bens?** Sim — `fixed_assets` completo, com categorias
   (`asset_categories`, contas padrão de ativo/depreciação/despesa/ganho/perda configuráveis
   por categoria).
2. **Já calcula depreciação?** Sim — `generateAssetDepreciationsAction`, linear
   (`calculateMonthlyDepreciation`), idempotente por competência (não gera duas vezes o
   mesmo mês), transição automática para `FULLY_DEPRECIATED` quando o saldo residual é
   atingido.
3. **Já gera lançamento contábil de depreciação?** Sim —
   `postAssetDepreciationAction` (mesmo padrão DRAFT→POSTED, `origin =
   'ASSET_DEPRECIATION'`).
4. **Já existe vínculo com documento fiscal de aquisição?**
   **Parcialmente** — a coluna `fixed_assets.fiscal_document_id` **já existe no schema e no
   formulário** (`createFixedAssetSchema`/`fixedAssetIdSchema` aceitam `fiscalDocumentId`
   opcional), mas é 100% manual: o usuário escolhe o documento fiscal ao cadastrar o bem, não
   existe nenhuma sugestão/criação automática partindo de um documento de entrada.
5. **O que falta para XML de compra criar/sugerir bem?** Ver seção 5 — o gap real é: (a)
   marcar um item do documento fiscal como "é bem do imobilizado" (não existe hoje — nem
   `fiscal_document_items.item_type` tem um valor "ASSET"; só PRODUCT/SERVICE/FREIGHT/OTHER),
   e (b) uma ação que, a partir de um item marcado assim, pré-preenche
   `createFixedAssetSchema` com `fiscalDocumentId`, `partnerId`, `acquisitionDate`,
   `acquisitionAmount` vindos do documento. **Achado extra**: `disposeFixedAssetAction` hoje
   **não gera lançamento contábil de baixa automaticamente** (a própria mensagem de sucesso
   da action já avisa isso) — gap conhecido e já documentado no código, não uma novidade
   desta análise.

### 2.5 Apuração Tributária (`src/modules/tax-assessments`)

1. **Já existe apuração tributária?** Sim, um motor genérico e já bastante maduro
   (Etapas 20 e 24): `tax_assessments`/`tax_assessment_lines`, com geração automática de
   linhas de débito/crédito a partir de documentos fiscais `BOOKED` da competência,
   retenções, ajustes manuais, saldo credor anterior, multa/juros, `calculation_memory`
   (JSON com o detalhamento do cálculo), workflow DRAFT→CALCULATED→REVIEWED→CLOSED→CANCELLED,
   e contabilização da provisão (`accountTaxAssessmentAction`).
2. **Quais tributos são suportados?** `TaxType` atual: `ISS | ICMS | IPI | PIS | COFINS |
   SIMPLES | INSS_RETIDO | IRRF | PCC | OTHER`.
3. **Existe IRPJ?** **Não** — ausente do enum `TaxType`.
4. **Existe CSLL?** **Não** — ausente do enum `TaxType`.
5. **Existe Simples Nacional/DAS?** **Parcialmente** — `SIMPLES` já é um valor válido de
   `TaxType`, mas a geração automática de linhas (`generateAutomaticLines`) só sabe mapear
   tributos que têm um campo correspondente no cabeçalho do documento fiscal
   (`HEADER_TAX_FIELD`: ISS/ICMS/PIS/COFINS) ou em item (IPI) — `SIMPLES` não tem um campo de
   valor destacado em `fiscal_documents`/`fiscal_document_items` (faz sentido: o Simples não
   é destacado por documento, é uma alíquota sobre a receita bruta do período). Hoje, uma
   apuração `SIMPLES` só teria valor se alguém lançar manualmente uma linha.
6. **Existe Lucro Presumido?** **Não implementado** — `TaxAssessment.regime` é um campo
   `text` livre que existe no schema mas **não é lido em nenhum lugar da lógica de cálculo**
   (`calculateTaxAssessmentAction`/`generateAutomaticLines` não fazem nenhum `if
   (regime === 'LUCRO_PRESUMIDO')`). É decorativo hoje.
7. **Existe Lucro Real?** **Não implementado** — mesma situação do item 6.
8. **Existe geração de provisão contábil?** Sim, genérica — `accountTaxAssessmentAction` já
   provisiona qualquer `tax_assessment` fechado (`CLOSED`) com `payable_amount > 0`,
   independente do tipo de tributo. **Funcionaria para IRPJ/CSLL sem nenhuma mudança**, uma
   vez que a apuração em si existisse.
9. **O que falta?** (resumo, detalhado na seção 3): (a) adicionar `IRPJ`/`CSLL` ao enum
   `TaxType`; (b) uma função de geração de linhas específica para IRPJ/CSLL — completamente
   diferente de `generateAutomaticLines` atual, porque não deriva de campos de tributo
   destacado em documento, e sim de **receita bruta do período** (Presumido) ou **resultado
   contábil + ajustes** (Real); (c) tabela de configuração de percentuais de presunção (não
   hardcoded); (d) usar `companies.tax_regime` (já existe:
   `SIMPLES_NACIONAL/LUCRO_PRESUMIDO/LUCRO_REAL`) para decidir automaticamente qual
   estratégia de cálculo aplicar.

---

## 3. IRPJ e CSLL Como Tributos de Apuração Periódica

**Decisão de arquitetura recomendada**: reaproveitar `tax_assessments`/
`tax_assessment_lines` (adicionando `IRPJ`/`CSLL` ao enum `TaxType`) em vez de criar tabelas
paralelas — a máquina de estado (DRAFT→CALCULATED→REVIEWED→CLOSED), a trilha de auditoria
(`calculation_memory`), o link para `journal_entry_id`/`obligation_id`, e a UI já existem e
são genéricos o bastante. O que muda é **apenas a função que gera as linhas automáticas**
(`generateAutomaticLines` hoje só sabe ler campos de tributo do documento; IRPJ/CSLL
precisam de uma segunda estratégia, baseada em regime).

### 3.1 Simples Nacional

Mais simples de todos — **não apura IRPJ/CSLL separadamente**, já estão embutidos no DAS.

- Uma apuração `tax_type = 'SIMPLES'` por competência, com `base_amount` = receita bruta do
  período (mesma fonte de dados da seção 3.2 abaixo) × alíquota efetiva da faixa do Simples
  (configurável, ver 3.4 — **nunca hardcoded**, já que a alíquota efetiva do Simples varia
  por faixa de RBT12 e anexo).
- Lançamento de provisão (reaproveita `accountTaxAssessmentAction` sem nenhuma mudança de
  código, só o cadastro da apuração):
  ```
  D — Despesa com Simples Nacional/DAS
  C — DAS a Recolher
  ```
- Controle gerencial de IRPJ/CSLL "dentro do DAS" é opcional e fora do escopo do MVP — se
  pedido no futuro, seria um cálculo informativo (não gera lançamento próprio, já que já
  está dentro do valor do DAS).

### 3.2 Lucro Presumido

Precisa de dados que hoje **não são calculados em nenhum lugar do sistema**: receita bruta
por período segregada por atividade (a base de presunção do IRPJ varia por atividade —
comércio/indústria 8%, serviços em geral 32%, transporte de carga 8%/serviços diversos
32%, etc.).

**Fonte da receita bruta**: dois caminhos possíveis, e recomendo o **primeiro**:
1. **Soma de `fiscal_documents.document_amount` (ou `merchandise_amount`/`services_amount`
   separados) de documentos `BOOKED`, `direction = 'OUT'`, na competência** — já é
   exatamente o padrão que `generateAutomaticLines` usa hoje para ICMS/ISS/PIS/COFINS, só
   trocando "monta linha de débito/crédito" por "soma para virar base de cálculo". Vantagem:
   reaproveita 90% do código já existente e testado.
2. Somar contas de resultado tipo `REVENUE` na DRE do período (via `getDreRawData`, já
   existente da Etapa "DRE"). Vantagem: pega receita mesmo sem documento fiscal (ex.: um
   lançamento manual de receita). **Risco**: pode contar duas vezes se o documento fiscal
   também gerar lançamento na mesma conta de receita — precisaria de uma regra clara de "a
   base vem OU do fiscal OU da contabilidade, nunca dos dois". Por isso recomendo a opção 1
   como fonte única de verdade nesta fase, e revisitar a opção 2 só se a apuração precisar
   também considerar receitas sem documento fiscal formal.

**Segregação por atividade**: usar `fiscal_operation_natures` (já existe, tem `direction` e
já é vinculada a cada `fiscal_document`) como o campo de segregação, com uma tabela nova de
configuração de percentual por natureza (ver 3.4).

**Cálculo**:
```
base_irpj  = Σ(receita_bruta_por_natureza × percentual_presuncao_irpj_da_natureza)
base_csll  = Σ(receita_bruta_por_natureza × percentual_presuncao_csll_da_natureza)
irpj       = base_irpj × alíquota_irpj (configurável, hoje 15%)
adicional  = max(0, base_irpj_trimestral − limite_isento_trimestral) × alíquota_adicional (configurável, hoje 10%)
csll       = base_csll × alíquota_csll (configurável, hoje 9%)
```

**Lançamento de provisão** (reaproveita `accountTaxAssessmentAction` sem mudança de código):
```
D — Despesa com IRPJ         C — IRPJ a Recolher
D — Despesa com CSLL         C — CSLL a Recolher
```
(2 apurações separadas — uma `tax_type='IRPJ'`, outra `tax_type='CSLL'` — ou 1 apuração
combinada com 2 pares de linhas; recomendo **2 apurações separadas**, mais simples de
auditar/fechar independentemente e mais consistente com o padrão "1 apuração = 1 tributo"
já usado em todos os outros tipos.)

### 3.3 Lucro Real

Mais complexo — parte do **resultado contábil apurado** (reaproveita `getDreRawData`/
`calculateDre`, já existentes), soma adições, subtrai exclusões e compensações de prejuízo
fiscal/base negativa.

```
resultado_contabil  = netProfit da DRE do período (já calculado, Etapa "DRE")
base_fiscal_irpj     = resultado_contabil + adições − exclusões − compensação_prejuizo_fiscal
base_fiscal_csll     = resultado_contabil + adições − exclusões − compensação_base_negativa
irpj                 = base_fiscal_irpj × alíquota_irpj + adicional (mesma fórmula da 3.2)
csll                 = base_fiscal_csll × alíquota_csll
```

**Adições/exclusões/compensações**: conforme o próprio `sistema.html` já reconhecia
explicitamente (comentário citado na seção 1), **não tentar automatizar** — são lançadas
manualmente por um contador, com controle simples de "tipo (adição/exclusão)", "descrição",
"valor", "competência/período de apuração" (a apuração de IRPJ/CSLL no Real normalmente é
trimestral, não mensal — ponto de atenção de configuração, não de cálculo).

**Necessidade de controle tipo LALUR/LACS**: recomendo **não** implementar um livro fiscal
completo nesta fase — só uma tabela simples de "ajustes de apuração" com saldo acumulado de
prejuízo fiscal/base negativa compensável (analogamente a `previous_balance_amount`/
`next_balance_amount`, que **já existem em `tax_assessments`** e já resolvem exatamente esse
problema de "saldo que carrega de um período para o outro" — reaproveitável sem mudança de
schema).

**Lançamento de provisão**: idêntico ao 3.2, mesma mecânica de `accountTaxAssessmentAction`.

### 3.4 Não Hardcodar Alíquotas — Tabela de Configuração

Proposta de tabela nova (schema, **não implementar nesta etapa**):

```sql
create table tax_regime_rates (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id),
  company_id uuid not null references companies(id),   -- ou null = regra padrão do sistema, empresa pode sobrescrever
  tax_regime tax_regime not null,                        -- reaproveita enum já existente (SIMPLES_NACIONAL/LUCRO_PRESUMIDO/LUCRO_REAL)
  tax_type text not null check (tax_type in ('IRPJ','CSLL','SIMPLES')),
  fiscal_operation_nature_id uuid references fiscal_operation_natures(id), -- null = regra genérica, específica = sobrescreve por atividade
  presumption_rate numeric(6,4),        -- % de presunção (só Presumido) — ex.: 0.3200 para serviços
  tax_rate numeric(6,4) not null,       -- alíquota do tributo em si — ex.: 0.1500 (IRPJ), 0.0900 (CSLL)
  additional_rate numeric(6,4),         -- adicional de IRPJ (10%), só aplicável a IRPJ
  additional_threshold_monthly numeric(18,2), -- limite mensal do adicional (ex.: 20.000,00)
  valid_from date not null,
  valid_until date,                     -- histórico de mudança de alíquota ao longo do tempo
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

Por que uma tabela e não uma constante no código: alíquotas de IRPJ/CSLL/percentuais de
presunção **mudam por lei** com alguma frequência (e o adicional de IRPJ, o limite de
R$20.000/mês, são valores de lei, não do sistema) — uma tabela com `valid_from`/
`valid_until` permite reprocessar/consultar apurações antigas com a alíquota vigente na
época, sem precisar de uma migração de código a cada mudança de legislação.

---

## 4. Arquitetura Fiscal-Contábil Proposta

### 4.1 Documentos fiscais — tabelas

**Não recriar** — `fiscal_documents`/`fiscal_document_items`/`fiscal_document_retentions`
já cobrem os campos essenciais listados no pedido (`access_key`, `direction`, `document_type`,
`competence`, `partner_id`, `journal_entry_id`, etc.). O que falta é 1 tabela nova:

```sql
create table fiscal_xml_imports (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id),
  company_id uuid not null references companies(id),
  fiscal_document_id uuid references fiscal_documents(id), -- null até a prévia ser confirmada
  file_name text,
  xml_raw text,                       -- ou storage_path se for movido para Supabase Storage
  access_key text,
  import_status text not null default 'PENDING_REVIEW'
    check (import_status in ('PENDING_REVIEW','CONFIRMED','REJECTED','DUPLICATE')),
  parse_errors jsonb,                 -- campos que não puderam ser extraídos, para o usuário revisar
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id)
);
```

Trilha de auditoria de CADA importação (mesmo as rejeitadas/duplicadas) — mesmo padrão já
usado em `bank_statement_imports` (Etapa 18).

### 4.2 Parceiros automáticos por CNPJ

Regras (Server Action nova, ex. `resolveOrCreatePartnerFromXmlAction`):

1. Normalizar CNPJ/CPF (`replace(/\D/g, '')`).
2. `SELECT` em `partners` por `company_id + document_normalized` (requer a coluna gerada da
   seção 2.1).
3. Se existir: reaproveita — e se o papel atual não bate com a direção do documento (ex.:
   já é só `is_supplier=true` mas o documento é de saída, então ele também é cliente),
   **atualiza para `is_customer=true` também** (nunca remove um papel já marcado — só
   adiciona).
4. Se não existir: cria com `is_customer`/`is_supplier` de acordo com a direção
   (ENTRADA → emitente vira fornecedor; SAÍDA → destinatário vira cliente), documento e nome
   do XML.
5. **Criação automática de conta contábil**: reaproveita a lógica já existente da Etapa 30A
   (`createLinkedAccountForRole` em `partners/actions.ts`) — só muda o *gatilho* (hoje é um
   checkbox manual no formulário; para XML, vira automático e silencioso, sem perguntar,
   **mas documentado na prévia de importação** para o usuário ver antes de confirmar).
6. **Nunca duplicar conta**: mesma regra já implementada — só cria se
   `customer_account_id`/`supplier_account_id` ainda for `null`.

### 4.3 Tributos — separação proposta

| Categoria | Tributos | Onde vive hoje |
|---|---|---|
| Do documento (destacados no XML) | ICMS, IPI, PIS, COFINS, ISS | `fiscal_documents`/`fiscal_document_items` — já existe |
| Retidos na fonte | IRRF, INSS_RETIDO, PCC, CSLL retida | `fiscal_document_retentions` — já existe (`tax_type` cobre IRRF/INSS_RETIDO/PCC; **CSLL retida especificamente não está no enum de retenção — mesmo gap do item 3, replicado aqui**) |
| Recuperáveis (geram crédito) | ICMS, IPI, PIS, COFINS (só em documentos de ENTRADA) | Já implementado em `CREDIT_ELIGIBLE_TAX_TYPES` (`tax-assessments/actions.ts`) |
| A recolher (apuração fecha e provisiona) | Todos os acima, via `tax_assessments` | Já implementado |
| De apuração periódica (não vêm de documento) | IRPJ, CSLL, SIMPLES/DAS | **Gap — seção 3** |

### 4.4 Regras contábeis configuráveis

**Maior gap estrutural do módulo fiscal hoje**: contabilizar um documento fiscal
(`accountFiscalDocumentAction`) exige que o usuário escolha manualmente a conta de débito e
a de crédito **a cada documento**, sempre. Não existe nenhuma regra automática. Proposta
(nova tabela, inspirada tanto no motor de conciliação da Etapa 30A quanto no pedido
explícito do briefing):

```sql
create table fiscal_accounting_rules (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id),
  company_id uuid not null references companies(id),
  name text not null,
  document_type text,              -- null = qualquer tipo
  direction fiscal_document_direction, -- null = qualquer direção
  cfop_pattern text,                -- ex.: "1102" ou prefixo "11%" — null = qualquer CFOP
  fiscal_operation_nature_id uuid references fiscal_operation_natures(id), -- null = qualquer natureza
  item_type text,                   -- null = qualquer tipo de item
  partner_id uuid references partners(id), -- null = qualquer parceiro (regra específica de 1 parceiro tem prioridade)
  debit_account_id uuid not null references chart_accounts(id),
  credit_account_id uuid not null references chart_accounts(id),
  value_base text not null default 'DOCUMENT_AMOUNT'
    check (value_base in ('DOCUMENT_AMOUNT','MERCHANDISE_AMOUNT','SERVICES_AMOUNT')),
  description_template text,
  auto_generate boolean not null default false, -- true = gera lançamento DRAFT sozinho ao BOOKED; false = só sugere as contas no formulário
  priority int not null default 100,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

Mesma filosofia de prioridade + "sugestão vs. geração automática" já validada e aprovada
pela usuária no motor de regras de conciliação bancária (Etapa 30A) — **reaproveitar o
mesmo padrão de UX** (regra casa → mostra sugestão → botão "usar sugestão" ou "aplicar e
gerar rascunho", nunca posta sozinho sem confirmação quando `auto_generate=false`; mesmo com
`auto_generate=true`, recomendo manter o lançamento em `DRAFT` até confirmação humana, e não
pular direto para `POSTED`, dado que aqui o "documento" já passou a validação workflow BOOKED
mas a *contabilização* ainda não teve revisão humana nenhuma).

### 4.5 Fluxo de Lançamentos — XML até o Journal Entry

```
XML (upload/colar)
  → fiscal_xml_imports (PENDING_REVIEW)
  → parse (server-side, Node)
  → resolveOrCreatePartnerFromXmlAction (busca ou cria parceiro + conta, seção 4.2)
  → prévia editável na tela (documento + itens + tributos pré-preenchidos, tudo editável)
  → usuário confirma
      → fiscal_documents (status=IMPORTED) + fiscal_document_items + fiscal_document_retentions
      → fiscal_xml_imports.import_status = CONFIRMED, fiscal_document_id preenchido
  → usuário valida (fluxo já existente: validateFiscalDocumentAction → VALIDATED)
  → usuário escritura (fluxo já existente: bookFiscalDocumentAction → BOOKED)
  → fiscal_accounting_rules casa (seção 4.4) → sugere contas OU gera rascunho
  → usuário confirma/ajusta contas → accountFiscalDocumentAction (já existente, sem mudança) → journal_entry DRAFT→POSTED
```

Cada seta já corresponde a uma Server Action existente, exceto as 3 primeiras (parse,
resolução de parceiro, geração de sugestão de conta) — que são exatamente o escopo da Etapa
32B/32C.

---

## 5. Ativo Imobilizado e Depreciação — XML

**Fluxo proposto**:
```
XML entrada (fiscal_document_items)
  → usuário marca 1+ itens como "é bem do imobilizado" (checkbox no formulário de item, ou
    detecção automática por NCM em faixa de bens de capital — recomendo começar manual, NCM
    automático é uma iteração futura, arriscado por falso positivo)
  → ação "Criar Bem a partir deste Item" pré-preenche createFixedAssetSchema:
      description = item.description
      acquisitionDate = fiscal_document.operation_date
      acquisitionAmount = item.total_amount
      fiscalDocumentId = fiscal_document.id
      partnerId = fiscal_document.partner_id
      categoryId = sugerido por regra (mesma tabela fiscal_accounting_rules pode ganhar uma
        variante "sugestão de categoria de bem" — ou uma tabela irmã mais simples, avaliar
        no detalhamento da Etapa 33A)
  → usuário revisa/completa (useful_life_months, contas de ativo/depreciação/despesa —
    sugeridas pelos defaults da categoria, já existentes em asset_categories)
  → createFixedAssetAction (já existe, sem mudança)
  → depreciação mensal: fluxo já existente e funcionando (generateAssetDepreciationsAction +
    postAssetDepreciationAction)
```

**Lacunas confirmadas por diagnóstico** (seção 2.4): (a) nenhum campo hoje classifica um item
de documento fiscal como "bem" — `fiscal_document_items.item_type` precisa ganhar um valor
`'ASSET'` (migração aditiva simples: `alter type fiscal_item_type add value 'ASSET'`,
respeitando a restrição já documentada no schema de não usar um valor de enum recém-criado
na mesma transação); (b) a ação "sugerir/criar bem a partir do item" não existe — é 100% nova;
(c) baixa de bem (`disposeFixedAssetAction`) não gera lançamento de ganho/perda
automaticamente — gap pré-existente, não introduzido por XML, mas vale resolver na mesma
janela de trabalho já que toca o mesmo módulo.

---

## 6. MVP Recomendado (sequência ajustada ao que foi encontrado)

A sequência original proposta no pedido já está bem desenhada — pequenos ajustes abaixo
refletem que boa parte da fundação (`fiscal_documents`, `tax_assessments`, `fixed_assets`)
**já existe e não precisa ser reconstruída**, então o esforço real de cada etapa é menor do
que "construir o módulo do zero".

### Etapa 32A — Diagnóstico e arquitetura fiscal-contábil
✅ **Este documento.** Só análise e plano, nenhuma mudança de código.

### Etapa 32B — Importação XML NF-e Entrada MVP
- Parser server-side (Node) para NF-e (CT-e/NFS-e podem ficar para 32D, reduz escopo do MVP).
- `fiscal_xml_imports` (tabela nova, seção 4.1).
- `resolveOrCreatePartnerFromXmlAction` (seção 4.2) — fornecedor automático por CNPJ +
  conta contábil automática (reaproveitando `createLinkedAccountForRole` já existente).
- Prévia editável antes de confirmar (reaproveita o padrão de UX do importador de CSV
  bancário, Etapa 30A).
- Itens + tributos principais (ICMS/IPI/PIS/COFINS já mapeados nos campos existentes).
- Prevenção de duplicidade por chave de acesso (**já pronta no banco** —
  `uq_fiscal_documents_access_key` — só usar).

### Etapa 32C — Prévia e Geração de Lançamento Contábil
- `fiscal_accounting_rules` (tabela nova, seção 4.4).
- Sugestão de conta ao escriturar (`BOOKED`) um documento.
- `accountFiscalDocumentAction` não muda — só passa a receber uma sugestão pré-preenchida
  em vez de campos vazios.
- Vínculo documento → journal_entry: **já existe, sem mudança**.

### Etapa 32D — XML Saída / CT-e / NFS-e
- Extenção do parser da 32B para CT-e e NFS-e (formatos de XML mais variados).
- Clientes automáticos (mesma função da 32B, `direction = 'OUT'`).
- Receitas/impostos sobre vendas — já mapeados nos campos existentes de
  `fiscal_documents`/`fiscal_document_items`.

### Etapa 33A — Ativo Imobilizado via XML
- Novo valor de enum `fiscal_item_type = 'ASSET'`.
- Ação "Criar Bem a partir deste Item" (seção 5).
- Resto do fluxo de depreciação: **já existe, sem mudança**.

### Etapa 34A — Apuração Tributária IRPJ/CSLL/PIS/COFINS/ICMS/ISS
- `IRPJ`/`CSLL` no enum `TaxType`.
- `tax_regime_rates` (tabela nova, seção 3.4) — sem alíquotas hardcoded.
- Nova função de geração automática de linhas para IRPJ/CSLL (Presumido: receita ×
  presunção; Real: resultado contábil + ajustes) — **em paralelo** à
  `generateAutomaticLines` existente (que continua servindo ICMS/IPI/PIS/COFINS/ISS sem
  mudança).
- Provisão contábil: **já existe, sem mudança** (`accountTaxAssessmentAction` é genérico).
- PIS/COFINS/ICMS/ISS **já estão praticamente prontos** hoje (Etapas 20/24) — o esforço real
  desta etapa concentra quase 100% em IRPJ/CSLL/Simples.

### Etapa 34B (nova, sugestão não pedida no briefing original) — Fechamento do Ciclo
Sugiro adicionar esta etapa ao final, não pedida explicitamente mas revelada pelo
diagnóstico: (a) corrigir o comportamento de estorno de documento fiscal (seção 1, linha
`estornarLancamentoDoDoc`) para reabrir `accounting_status` quando o lançamento vinculado é
estornado; (b) gerar lançamento de ganho/perda na baixa de bem patrimonial (gap já
documentado no próprio código, seção 2.4/5). Nenhuma delas depende de XML — são acabamentos
de fluxos já existentes, mas ficam mais visíveis/urgentes depois que XML aumentar o volume
de documentos fiscais passando pelo sistema.

---

## 7. Resumo dos Entregáveis (mapeamento às 17 perguntas do pedido)

| # | Item pedido | Onde está neste documento |
|---|---|---|
| 1 | Resumo do `sistema.html` | Seção 1 |
| 2 | Diagnóstico de Parceiros | Seção 2.1 |
| 3 | Diagnóstico Fiscal | Seção 2.2 |
| 4 | Diagnóstico Contábil | Seção 2.3 |
| 5 | Diagnóstico de Ativos | Seção 2.4 |
| 6 | Diagnóstico de Apuração Tributária | Seção 2.5 |
| 7 | Lacunas do ERP atual | Espalhado em cada subseção de "Diagnóstico" (2.1–2.5) + resumidas no preâmbulo |
| 8 | Arquitetura fiscal-contábil | Seção 4 |
| 9 | Regras fornecedor/cliente automático por CNPJ | Seção 4.2 |
| 10 | Regras de criação automática de contas | Seção 4.2, item 5 |
| 11 | Estratégia para XMLs | Seções 4.1, 4.5, 6 (Etapas 32B/32D) |
| 12 | Estratégia para tributos | Seção 4.3 |
| 13 | Estratégia IRPJ/CSLL | Seção 3 |
| 14 | Estratégia bens/depreciação | Seção 5 |
| 15 | Estratégia de geração de lançamentos | Seções 2.3, 4.5 |
| 16 | MVP recomendado | Seção 6 |
| 17 | Tabelas/modelos propostos | `fiscal_xml_imports` (4.1), `fiscal_accounting_rules` (4.4), `tax_regime_rates` (3.4), novo valor de enum `fiscal_item_type='ASSET'` (5) |

---

## Observação Final

Nenhuma das tabelas/colunas propostas neste documento foi criada. Nenhum código foi
alterado. Este é um documento de planejamento — a próxima etapa (32B) deve começar com uma
leitura fresca deste diagnóstico e, aí sim, implementar incrementalmente, seguindo o mesmo
padrão de migração idempotente e aditiva (`ALTER TABLE ADD COLUMN IF NOT EXISTS`, `CREATE
TABLE IF NOT EXISTS`) já usado em todas as migrações anteriores deste projeto.
