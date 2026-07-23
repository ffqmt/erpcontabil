# Especificação Funcional — Etapa 35B.1: Simplificação do Fluxo Fiscal Operacional

**Data:** 2026-07-22
**Tipo:** Especificação funcional/produto — **não é implementação, não é migration, não é auditoria genérica.**
**Insumos revisados:** `docs/etapa35a-cadastros-fiscais-estruturantes.md`, `docs/etapa35b-escrituracao-fiscal-operacional.md`, `docs/revisao-tecnica-etapa35b.md`, `docs/qa-etapa35b-escrituracao-fiscal.md`, `docs/arquitetura-fiscal-erp-contabil-reforma-tributaria-roadmap.md`, `DEVELOPMENT_LOG.md`, código atual de `src/modules/fiscal/**`, `src/modules/registrations/fiscal-natures/**`, `src/modules/fiscal/accounting-rules/**`.
**Fora de escopo desta etapa:** implementação de código, migration, Reforma Tributária/CBS/IBS/IS, SPED, emissão fiscal, folha, carga nacional completa, motor de ST nacional completo.

---

## 1. Diagnóstico

### 1.1 A navegação fiscal se fragmentou a cada etapa

A sidebar fiscal hoje (pós-35B) tem **3 grupos** e **13 entradas**, mais um hub interno que
re-lista 5 delas:

- **Fiscal — Escrituração & Operação:** Dashboard Fiscal, Documentos, Importar XML, Revisão de
  Itens, Pendências Fiscais (5 itens).
- **Fiscal — Apuração & Configurações:** Apurações, Regras Contábeis, Config. Tributárias (3
  itens).
- **Fiscal — Cadastros Fiscais:** Cadastros Fiscais Base (hub), Estabelecimentos, Tabelas
  Nacionais (3 itens).
- **`/fiscal/cadastros`** (o hub do 3º grupo) é uma tela própria que só contém 5 cards
  apontando para: Estabelecimentos, Tabelas Nacionais, Produtos e Serviços, Configurações
  Tributárias e Revisão de Itens Importados — ou seja, **3 dessas 5 entradas já existem em
  algum lugar da sidebar**. O hub não organiza nada nem substitui a navegação — só duplica.

Cada etapa (35A criou cadastros, 35B criou pendências) adicionou uma rota nova em vez de
perguntar "isso deveria ser uma aba de algo que já existe?". O resultado, de fora, é: para
"resolver um problema numa nota fiscal" o analista pode precisar visitar `/fiscal/documentos/
[id]`, `/fiscal/pendencias`, `/fiscal/revisao-itens` e `/fiscal/cadastros/tabelas-nacionais` —
4 telas diferentes para 1 tarefa.

### 1.2 O usuário toma decisões hoje sem nenhuma orientação do sistema

Ao importar um XML ou lançar manualmente, o sistema aceita o documento sem exigir nem sugerir:

- **Natureza Fiscal** — campo opcional (`fiscal_operation_nature_id` nullable). Hoje o cadastro
  de Natureza Fiscal (`src/modules/registrations/fiscal-natures/types.ts`) tem só `code`,
  `name`, `direction`, `description`, `is_active` — **nenhum campo de comportamento**.
  Escolher uma natureza ou deixar em branco não muda absolutamente nada no CFOP, CST, crédito,
  retenção ou regra contábil aplicada. É um rótulo, não um motor.
- **CFOP/CST/CSOSN por item** — campos de texto livre em `fiscal_document_items`, sem
  sugestão, sem valor padrão, sem vínculo com a natureza ou com o produto.
- **Estabelecimento** — só é cobrado via pendência (35B), depois do fato.
- **Uso fiscal do item** (`fiscal_item_usage`, 35A) — existe no cadastro de produto, mas não
  influencia CFOP nem crédito no lançamento do documento.

O analista fiscal/contábil (perfil real de quem usa este módulo no dia a dia) precisa saber de
cor qual CFOP/CST usar para cada situação, porque o sistema não usa o que ele já sabe sobre a
operação (a natureza) para sugerir nada. Isso é o oposto de "o lançamento conduz o usuário".

### 1.3 Por que a apuração fica frágil sem natureza/produto/CFOP/CST

`calculateTaxAssessmentAction` → `generateAutomaticLines` (`src/modules/tax-assessments/
actions.ts`) soma **cegamente** `icms_amount`/`iss_amount` do cabeçalho (ou `ipi_amount` por
item) de todo documento `BOOKED` da competência e direção certas — **sem checar** se o CFOP
bate com a direção, se o CST existe, se o item tem produto vinculado ou se a natureza fiscal
está preenchida. A 35B criou pendências que **avisam** sobre esses problemas, mas não impedem
o documento de entrar na apuração. Ou seja: hoje é possível apurar ICMS de um documento com
CFOP de saída lançado como entrada, ou com CST ausente — o valor pode estar certo ou errado, e
o sistema não sabe dizer qual, porque nunca checou a classificação antes de somar. A pendência
avisa DEPOIS; a apuração já rodou ANTES. É escrituração "confie e reze", não "valide e confie".

### 1.4 Por que o CFOP do XML não deve ser tratado como CFOP final de escrituração

Hoje, `writeFiscalDocumentFromImport` (`src/modules/fiscal/xml-import/actions.ts`) grava o CFOP
que vem no XML **diretamente** em `fiscal_document_items.cfop` — o mesmo e único campo que a
35B usa para checar `CFOP_DIRECTION_MISMATCH` contra `fiscal_documents.direction`.

O problema é conceitual, não é bug de digitação: **o CFOP de uma NF-e reflete a operação do
lado de quem emitiu**, não de quem recebe. Um fornecedor que vende mercadoria emite com CFOP
5102 ("venda de mercadoria... a não contribuinte" ou correlato de saída) — esse é o CFOP
correto **para o emitente**. Para a empresa que **recebe** essa nota (documento `direction =
IN`), a escrituração própria dela é uma **entrada**, tipicamente 1102/2102 ("compra para
comercialização"), **nunca** 5102. Isso não é uma exceção rara: é a regra geral de como CFOP
funciona em qualquer compra — o CFOP do documento de origem e o CFOP de escrituração do
destinatário são sempre de "famílias" diferentes (1-2-3 vs 5-6-7) por definição.

Consequência prática: a regra `CFOP_DIRECTION_MISMATCH` da 35B, do jeito que está hoje,
**dispara em praticamente toda NF-e de compra legitimamente importada**, porque está
comparando o CFOP do emitente contra a direção do destinatário — exatamente a comparação que
CFOP nacional é desenhado para "não bater". Isso não foi identificado como bug na revisão
técnica da 35B porque a regra tecnicamente faz o que foi pedido ("CFOP x direção") — o problema
é que falta o conceito de **dois CFOPs**: um de origem (auditoria, imutável) e um de
escrituração (o que a empresa realmente usa para os próprios livros/apuração). Essa distinção é
o núcleo da Seção 4.

---

## 2. Novo conceito central: Natureza Fiscal como motor operacional

Hoje a Natureza Fiscal é um rótulo. A proposta é que ela vire a **peça central** que o usuário
escolhe uma vez (ou o sistema sugere via Regra de Importação, Seção 3) e que **decide sozinha**
o resto do lançamento. Campos funcionais propostos (nomes indicativos, não finais de schema):

| Campo funcional | O que controla |
|---|---|
| `operation_kind` | Tipo de operação: compra mercadoria, compra insumo, compra ativo, compra uso/consumo, venda mercadoria, serviço prestado, serviço tomado, devolução (compra/venda), transferência, outro. |
| `direction` | Entrada/Saída (já existe hoje, mantido). |
| `applicable_document_types` | Quais tipos de documento essa natureza faz sentido (NF-e, NFC-e, NFS-e, CT-e, Manual) — evita oferecer "Prestação de Serviço" para quem está lançando um CT-e. |
| `fiscal_purpose` | Revenda, insumo de produção, ativo imobilizado, uso/consumo, serviço, outro — espelha `fiscal_item_usage` (35A), mas no nível do documento/operação, não só do produto. |
| `default_bookkeeping_cfop` | CFOP de escrituração sugerido (ver Seção 4) — pode ter uma sugestão para entrada e outra para saída se a natureza servir para os dois casos. |
| `default_tax_situation` | CST/CSOSN sugerido de ICMS (por regime: normal usa CST, Simples usa CSOSN). |
| `icms_treatment` | Tributado integral, tributado com redução de base, isento, não tributado, suspenso, diferido. |
| `icms_st_treatment` | Se essa operação normalmente tem ICMS-ST (substituição tributária) e, se sim, se é o emitente que reteve ou se cabe à empresa calcular por dentro (indicador funcional, não motor de cálculo de ST — isso é 35C+). |
| `difal_applicable` | Se essa operação pode gerar diferencial de alíquota (compra interestadual de uso/consumo ou ativo) — vira **aviso**, não cálculo automático nesta etapa. |
| `ipi_treatment` | Tributado, isento, não tributado, suspenso. |
| `pis_cofins_treatment` | Tributado (regime normal/cumulativo), com crédito (Lucro Real), monofásico, substituição, isento. |
| `iss_treatment` | Tributado no município do prestador, tributado no município do tomador, isento, imune, com retenção. |
| `expected_retentions` | Lista de retenções esperadas para esse tipo de operação (ISS/INSS/IRRF/PIS/COFINS/CSLL) — vira checklist na revisão, não lançamento automático de valor. |
| `generates_credit` | Se essa operação, quando de entrada, normalmente gera direito a crédito de ICMS/IPI/PIS/COFINS (efetivo aproveitamento continua dependendo do regime da empresa, já resolvido em outras telas — este campo é sobre "essa operação é do tipo que credita", não sobre a alíquota). |
| `enters_tax_assessment` | Se documentos dessa natureza devem contar na apuração (a maioria sim; devoluções e transferências entre estabelecimentos da mesma empresa tipicamente não). |
| `triggers_accounting` | Se essa natureza deve gerar contabilização automática ao ser confirmada (hoje isso já existe via Regras Contábeis Fiscais, que **já suportam** filtrar por `fiscal_operation_nature_id` — não precisa duplicar, só reforçar o vínculo). |
| `suggested_accounting_rule_id` | Atalho opcional: se a natureza tiver uma regra contábil fiscal claramente preferida, mostrar como sugestão pré-selecionada em vez do usuário escolher entre várias regras manualmente. |
| `requires_product` | Se item dessa natureza deve obrigatoriamente estar vinculado a um produto do catálogo (relevante para NF-e de mercadoria; não relevante para frete/CT-e). |
| `requires_ncm` | Se item dessa natureza exige NCM (mercadoria/ativo: sim; serviço: não). |
| `item_nature_default` | Se documentos dessa natureza devem classificar os itens automaticamente como PRODUCT, SERVICE, FREIGHT ou ASSET (resolve de raiz o problema de item de NFS-e/CT-e sendo tratado como mercadoria — ver Seção 4 e correções já aplicadas na revisão técnica da 35B). |

**Observação de design:** nem todo campo precisa de UI própria complexa — a maioria é um
select simples ou checkbox no formulário de Natureza Fiscal. O ganho não é a quantidade de
campos, é que **um único cadastro, escolhido uma vez por documento, prepara tudo o resto**.

---

## 3. Regras de Importação XML (nova entidade funcional)

Nome sugerido: **Regras de Classificação Fiscal na Importação** (`fiscal_import_classification_rules`,
nome indicativo). Não é uma ideia nova de arquitetura — é o **mesmo padrão já validado em
produção** pelas Regras Contábeis Fiscais (`fiscal_accounting_rules`, Etapa 32C): condições com
"coringa quando nulo", `priority` numérica, e a regra de maior especificidade/menor prioridade
que casar primeiro é a aplicada. Reaproveitar esse padrão em vez de inventar um novo reduz risco
de implementação.

### 3.1 Condições (todas opcionais — nulo = qualquer valor serve)

- Parceiro específico (`partner_id`).
- CNPJ do emitente (para casar antes mesmo de o parceiro existir cadastrado, comum em primeira
  importação de um fornecedor novo).
- CFOP do XML (`xml_cfop`, exato ou por padrão/prefixo — mesmo mecanismo de `cfop_pattern` já
  existente em `fiscal_accounting_rules`).
- NCM (exato ou por prefixo, útil para capítulo/posição da NCM).
- CEST.
- Produto interno (`item_id`) — quando o item já tem um mapeamento confirmado
  (`partner_item_mappings`, 35A).
- Código do produto do fornecedor (`supplierProductCode`) — mesma chave já usada pelo matching
  conservador da 35A.
- Descrição do item (contém/começa com — texto livre, último critério, menor prioridade).
- Tipo de documento (NF-e, NFC-e, NFS-e, CT-e, CT-e OS).
- Direção da operação (IN/OUT).
- UF de origem/destino.
- Município (relevante para ISS/NFS-e).
- Valor mínimo/máximo do item ou documento (útil para casos como "ativo imobilizado só acima de
  R$ X", mas marcado como condição avançada/opcional — não obrigatória de usar).

### 3.2 Ações (uma regra pode disparar mais de uma)

- Aplicar Natureza Fiscal ao documento.
- Aplicar CFOP de **escrituração** ao item (nunca sobrescreve o `xml_cfop` de origem — ver
  Seção 4).
- Aplicar CST/CSOSN ao item.
- Aplicar/confirmar produto interno ao item (grava ou reforça `partner_item_mappings`, reusando
  a mesma tabela da 35A — **não duplica matching**, complementa: hoje o matching só age quando
  já existe mapeamento confirmado; a regra pode ser a forma de **criar** esse mapeamento pela
  primeira vez a partir de um critério mais amplo, como CNPJ + faixa de NCM).
- Aplicar uso fiscal do item (`fiscal_item_usage`).
- Marcar tipo de item (PRODUCT/SERVICE/FREIGHT/ASSET) — resolve o caso de NFS-e/CT-e sem
  depender só do parser adivinhar pelo tipo de documento.
- Configurar tratamento de crédito esperado (herdado da natureza aplicada, mas pode ser
  sobrescrito pela regra para exceções).
- Configurar retenções esperadas (idem).

### 3.3 Onde entra no fluxo

A regra roda **depois do parser, antes de gravar `fiscal_document_items` definitivamente** —
ou seja, ela participa da gravação da importação (mesmo ponto onde hoje `writeFiscalDocumentFromImport`
já decide `item_id` via `partner_item_mappings`), não é um passo manual separado. Quando
nenhuma regra casa, o documento cai na revisão (Seção 5) em vez de ficar com campos em branco
silenciosamente, como hoje.

---

## 4. CFOP do XML x CFOP de escrituração

### 4.1 Modelo de dados proposto (conceitual — a migration real fica para a implementação)

- **`xml_cfop`** (novo campo, nullable, em `fiscal_document_items`): o CFOP exatamente como
  veio no XML. Preenchido **só** na importação, **nunca** editado depois — é o registro de
  auditoria/origem, igual a como `access_key`/`import_hash` já funcionam hoje para o documento
  como um todo.
- **`cfop`** (campo já existente): passa a ser tratado explicitamente como o **CFOP de
  escrituração** — o que a empresa de fato usa para os próprios livros e para a apuração. Para
  documentos manuais (sem XML), `xml_cfop` fica nulo e `cfop` é preenchido diretamente, como já
  é hoje.
- Nenhum dado histórico quebra: documentos já importados simplesmente não têm `xml_cfop`
  preenchido (nulo), e continuam funcionando com o `cfop` que já tinham.

### 4.2 Regra de preenchimento

1. Na importação, `xml_cfop` recebe o CFOP do XML.
2. Se uma Regra de Importação (Seção 3) casar e definir CFOP de escrituração, `cfop` recebe
   esse valor.
3. Se nenhuma regra casar, o sistema tenta uma sugestão **conservadora** baseada na Natureza
   Fiscal do parceiro/operação, se já conhecida (ex.: parceiro já tem outras notas com a mesma
   natureza).
4. Se nada resolver, `cfop` fica em branco e vira pendência **"CFOP de escrituração pendente"**
   (não mais "CFOP incompatível" — ver Seção 7) — o documento vai para a tela única de revisão
   com o `xml_cfop` visível ao lado, para o analista decidir com contexto, não seleção às cegas.

### 4.3 Efeito na pendência de CFOP x direção

A validação `CFOP_DIRECTION_MISMATCH` passa a comparar `cfop` (escrituração) contra a direção —
nunca `xml_cfop`. Isso elimina o falso-positivo estrutural descrito em 1.4: uma NF-e de compra
importada com `xml_cfop = 5102` e `cfop` (escrituração) corretamente resolvido para `1102` não
gera mais alerta nenhum, porque a comparação é feita no campo certo.

---

## 5. Novo fluxo de usuário

### 5.1 Importação de XML

1. Importar XML (um ou lote — sem mudança na entrada).
2. Identificar tipo de documento (NF-e/NFC-e/NFS-e/CT-e/CT-e OS) — já existe.
3. Identificar parceiro (emitente/tomador conforme direção) — já existe, com criação assistida
   se não cadastrado.
4. Identificar itens (descrição, NCM, CFOP do XML, valores) — já existe.
5. Detectar tributos destacados e retenções presentes no XML (ICMS, ICMS-ST quando houver,
   IPI, PIS, COFINS, ISS, e retenções quando o layout trouxer) — parcialmente existente (ICMS/
   PIS/COFINS de NF-e; ISS de NFS-e), precisa reforço explícito para ICMS-ST e DIFAL como
   **sinalização**, não cálculo.
6. Aplicar Regras de Importação (Seção 3) — **novo**: tenta casar natureza, CFOP de
   escrituração, CST, produto, tipo de item.
7. Quando a regra não resolveu 100%, sugerir Natureza Fiscal por proximidade (mesmo parceiro/
   CNPJ com histórico) — **novo**, best-effort, sempre com opção de trocar.
8. Vincular produto (matching conservador já existente da 35A, agora também alimentado pelas
   Regras de Importação).
9. Gerar pendências **acionáveis** (Seção 7) para tudo que não foi resolvido automaticamente.
10. Revisar em **tela única** (Seção 6: Painel Fiscal) — hoje isso está espalhado entre
    `/fiscal/revisao-itens` e `/fiscal/pendencias`; a proposta consolida.
11. Confirmar escrituração — ação explícita do analista, documento passa a `BOOKED`.
12. Documento pronto para contabilizar/apurar — com validação prévia (Seção 5.3), não só
    aviso.

### 5.2 Lançamento manual

1. Escolher tipo de documento.
2. Escolher Natureza Fiscal — **passa a ser obrigatório antes de prosseguir**, não mais um
   campo opcional no meio do formulário.
3. Sistema pré-preenche CFOP de escrituração sugerido, CST/CSOSN sugerido, tratamento de
   tributos e retenções esperadas, todos vindos da natureza escolhida — o analista confirma ou
   ajusta, não digita do zero.
4. Usuário informa itens (valores, quantidades) — o que realmente precisa de digitação manual.
5. Sistema valida (mesmas regras leves da 35B, agora com muito menos chance de disparar, porque
   os campos já vieram preenchidos pela natureza).
6. Documento fica pronto, mesmo destino do fluxo de XML a partir do passo 11.

### 5.3 Apuração

1. Apuração só **considera** (soma) documentos "prontos" — critério objetivo: `status = BOOKED`
   **e** sem pendência `CRITICAL` aberta **e** com Natureza Fiscal preenchida. Isso não é um
   bloqueio arbitrário novo: é fechar a lacuna descrita em 1.3 (hoje a apuração soma sem checar
   nada disso).
2. Documentos fora da apuração aparecem explicitamente na tela de apuração, com o motivo exato
   (ex.: "3 documentos de ICMS desta competência ficaram de fora: 2 sem Natureza Fiscal, 1 com
   pendência crítica") — não silenciosamente ausentes do somatório.
3. Cada motivo tem link direto para corrigir (mesmo padrão de "ação sugerida" da Seção 7).
4. Calcular continua funcionando exatamente como hoje quando as pré-condições estão OK — não
   muda o cálculo em si, só o que **entra** nele.

---

## 6. Simplificação de telas/sidebar

### 6.1 Proposta de sidebar (substitui os 3 grupos fiscais atuais por 2)

- **Painel Fiscal** (`/fiscal`) — rota única, com abas internas:
  - Visão Geral (o que hoje é o Dashboard Fiscal).
  - Pendências (o que hoje é `/fiscal/pendencias`).
  - Revisão de Itens (o que hoje é `/fiscal/revisao-itens`).
  - Documentos sem Natureza (recorte novo, mas usa o mesmo motor de pendências — é
    `FISCAL_NATURE_MISSING` com sua própria aba em vez de linha perdida na tabela geral).
  - Prontos para Apurar (documentos `BOOKED`, sem pendência crítica, ainda `NOT_ASSESSED`).
  - Com Erro (pendências `CRITICAL`, incluindo `NO_ITEMS` e falhas de contabilização).
- **Documentos** (`/fiscal/documentos` + `/fiscal/documentos/[id]`) — sem mudança de conceito,
  ganha as abas já criadas na 35B (Pendências, Tributos com retenções).
- **Importar XML** (`/fiscal/importar-xml`) — sem mudança.
- **Apurações** (`/fiscal/apuracoes`) — sem mudança de conceito, ganha o painel de "fora da
  apuração e por quê" (5.3).
- **Configurações Fiscais** (rota nova, agrupador) — abas ou sub-rotas:
  - Naturezas Fiscais (existente, ganha os campos da Seção 2).
  - Regras de Importação XML (nova, Seção 3).
  - Regras Contábeis (existente, `fiscal_accounting_rules` — só muda de grupo na sidebar).
  - Config. Tributárias (existente — alíquotas, `calculation_mode`, painel PIS/COFINS).
  - Estabelecimentos (existente).
  - Tabelas Fiscais (existente, `/fiscal/cadastros/tabelas-nacionais`).

Resultado: de **3 grupos + 1 hub redundante + 13 entradas** para **2 grupos operacionais +
1 grupo de configuração**, sem remover nenhuma funcionalidade — só reorganizando por
frequência de uso (Painel/Documentos/Importar/Apurar são diários; Configurações Fiscais é
esporádico).

O hub atual `/fiscal/cadastros` deixa de existir como tela própria — suas 5 entradas passam a
viver dentro de "Configurações Fiscais" na sidebar, sem precisar de uma tela intermediária.

### 6.2 `/fiscal/pendencias` e `/fiscal/revisao-itens` viram abas de um único painel

**Recomendação: sim, consolidar.** Hoje as duas telas mostram, na prática, o mesmo tipo de
coisa (pendência que impede o documento de estar "pronto") só que de fontes diferentes (uma é
`fiscal_document_item_review_issues`, outra é o motor dinâmico da 35B) — o usuário não deveria
precisar saber dessa diferença técnica para decidir onde olhar. A `FiscalPendenciesView` já
existente já faz a maior parte do trabalho de unificação nos dados; falta unificar a tela.

---

## 7. Pendências acionáveis (redesenho)

| Caso | Mensagem atual | Mensagem nova | Ação sugerida | Botão/link |
|---|---|---|---|---|
| CFOP incompatível | "CFOP 5102 parece ser de saída, mas o documento é de entrada." (dispara em quase toda compra importada — ver 1.4) | "Este item ainda não tem CFOP de escrituração definido. CFOP original do XML: 5102 (venda, do emitente)." | Aplicar CFOP de escrituração sugerido pela Natureza Fiscal (um clique) ou escolher manualmente | **[Aplicar sugestão]** / [Escolher CFOP] |
| Natureza fiscal ausente | "Documento sem natureza fiscal definida." | "Escolha a Natureza Fiscal desta operação para o sistema sugerir CFOP, CST e tributos automaticamente." | Abrir seletor de natureza direto na linha, sem sair da tela | **[Escolher Natureza Fiscal]** |
| Produto não vinculado | "Item importado sem produto/serviço vinculado do catálogo." | "Este item do fornecedor ainda não está ligado a um produto seu — depois de vincular uma vez, a próxima compra do mesmo fornecedor já reconhece sozinha." | Vincular a produto existente ou criar novo, inline | **[Vincular produto]** |
| CST/CSOSN ausente | "Item sem CST/CSOSN de ICMS." | "Falta o código de situação tributária do ICMS deste item. A Natureza Fiscal escolhida sugere: [CST/CSOSN sugerido]." | Aplicar sugestão ou escolher outro código | **[Aplicar sugestão]** |
| NCM ausente | "Item de mercadoria/ativo sem NCM." | "Este produto ainda não tem NCM cadastrado — cadastre uma vez no produto e ele valerá para as próximas notas." | Ir para o cadastro do produto | **[Cadastrar NCM no produto]** |
| Retenções NFS-e a revisar | "NFS-e importada por parser tolerante. Revise manualmente ISS/INSS/IRRF/PIS/COFINS/CSLL retidos." | "Este serviço tomado costuma ter retenção de [lista vinda da Natureza Fiscal, ex.: ISS e IRRF] — confirme os valores retidos." | Abrir formulário de retenções já com os tipos esperados pré-selecionados | **[Conferir retenções]** |
| PIS/COFINS CT-e a revisar | "CT-e importado com ICMS extraído. Revise PIS/COFINS quando aplicável." | (mantém o texto — já é claro e não-alarmista) | Abrir aba Tributos do documento | **[Revisar tributos do frete]** |
| Documento não contabilizado | "Documento ainda não contabilizado." | "Pronto para contabilizar — regra contábil sugerida: [nome da regra, se a Natureza Fiscal já indicar uma]." | Contabilizar direto com a regra sugerida, sem precisar escolher | **[Contabilizar com regra sugerida]** |
| Documento não apurado | "Documento com tributo apurável ainda fora de apuração." | "Este documento entra na próxima apuração de [ICMS/ISS/IPI] da competência [mês/ano]." | Ir para a apuração da competência (cria se não existir) | **[Ir para apuração de {competência}]** |

Princípio geral do redesenho: toda mensagem passa a citar **o que a Natureza Fiscal já sabe**
sobre a operação (quando aplicável) e toda ação sugerida vira **link/botão de um clique**
quando existir uma sugestão de alta confiança — "abrir o documento" deixa de ser a resposta
padrão para tudo.

---

## 8. Seed mínimo operacional

Objetivo: deixar o sistema **utilizável no primeiro dia** sem carga nacional completa. Todo
item abaixo é **código/rótulo**, nunca alíquota — nenhuma alíquota é proposta aqui (isso
depende do regime/UF/produto de cada empresa real e não deve ser inventado). O seed é ponto de
partida editável pelo escritório, não verdade fechada.

- **CFOPs comuns** (entrada/saída mais frequentes em comércio/serviço): 1102, 1152, 1556, 1901,
  2102, 2401, 5102, 5152, 5401, 5405, 5933, 6108 — cada um com código + descrição padrão
  (Tabela CFOP é pública/nacional; descrições devem ser conferidas contra a fonte oficial antes
  de ir para produção, não copiadas de memória sem checagem).
- **CST ICMS comuns** (regime normal): 00, 10, 20, 40, 41, 50, 51, 60, 90.
- **CSOSN comuns** (Simples Nacional): 101, 102, 103, 201, 202, 203, 300, 400, 500, 900.
- **CST PIS/COFINS comuns**: 01, 02, 04, 06, 07, 08, 09, 49, 50, 70, 98, 99.
- **Naturezas Fiscais padrão** (linhas iniciais, sem comportamento fechado — o escritório
  ajusta os campos da Seção 2 por empresa): Compra para Revenda, Compra de Insumo, Compra de
  Ativo Imobilizado, Compra para Uso/Consumo, Venda de Mercadoria, Serviço Prestado, Serviço
  Tomado, Devolução de Compra, Devolução de Venda, Transferência entre Estabelecimentos.
- **Tipos de retenção**: reaproveita o que já existe (`ISS`, `INSS_RETIDO`, `IRRF`, `PIS`,
  `COFINS`, `PCC`) — nenhum tipo novo precisa ser inventado.
- **Regras fiscais básicas não perigosas**: no máximo 2-3 Regras de Importação de exemplo (ex.:
  "CFOP do XML começa com 5 ou 6 e documento é NF-e de entrada → aplicar Natureza 'Compra para
  Revenda' e marcar item como PRODUCT"), claramente identificadas como exemplo/desativadas por
  padrão, para o escritório usar como modelo ao criar as próprias.

---

## 9. Escopo de implementação da 35B.1

### 9.1 Obrigatório

- Natureza Fiscal como motor (Seção 2): novos campos funcionais no cadastro e formulário.
- Regras de Importação XML (Seção 3): nova entidade, aplicada na gravação da importação.
- CFOP XML x CFOP de escrituração (Seção 4): campo `xml_cfop` + correção da regra de
  incompatibilidade para comparar o campo certo.
- Painel Fiscal único consolidando Pendências + Revisão de Itens + recortes por natureza/
  prontidão (Seção 6.2).
- Simplificação de sidebar (Seção 6.1).
- Pendências redesenhadas com mensagem/ação por caso (Seção 7).
- Seed mínimo operacional (Seção 8).
- Apuração só considera documentos prontos, com painel de "fora da apuração e por quê" (Seção
  5.3) — sem mudar a fórmula de cálculo em si.

### 9.2 Desejável (não bloqueia a entrega da 35B.1)

- Sugestão automática de estabelecimento por UF/CNPJ do emitente quando a empresa tem múltiplos
  estabelecimentos.
- Importação de Regras de Importação em lote (CSV) para escritórios com muitos fornecedores
  recorrentes.
- "Duplicar Natureza Fiscal" como base para criar uma nova parecida.
- Indicador visual explícito na revisão mostrando "CFOP alterado pela regra" vs "CFOP original
  do XML" lado a lado.
- Botão "reclassificar" em documentos antigos para aplicar retroativamente uma Regra de
  Importação criada depois (opt-in, nunca automático).

### 9.3 Fora de escopo

- CBS/IBS/Imposto Seletivo (Reforma Tributária real).
- SPED/EFD/ECD/ECF.
- Emissão fiscal / webservice SEFAZ.
- Folha de pagamento.
- Carga da tabela nacional completa de NCM/CFOP/CST (o seed da Seção 8 é mínimo, não completo).
- Cálculo fiscal complexo por UF (alíquotas interestaduais, protocolos de ST por UF).
- Motor completo de Substituição Tributária nacional (o campo `icms_st_treatment` da Natureza
  Fiscal é só sinalização/aviso nesta etapa, não cálculo de MVA/retenção de ST).
- Reclassificação retroativa em massa de documentos já lançados (fica como "desejável" opt-in,
  nunca automática).

---

## 10. Riscos

- **Modelo de Natureza Fiscal rico demais para o analista configurar sozinho.** Mitigação: seed
  mínimo (Seção 8) com naturezas prontas cobrindo os casos mais comuns, e todos os campos novos
  opcionais com fallback para o comportamento atual (sem natureza = sem sugestão, exatamente
  como hoje) — nada quebra para quem não configurar nada.
- **Regras de Importação mal configuradas aplicando classificação errada silenciosamente.**
  Mitigação: toda aplicação de regra deve ficar visível/reversível na tela de revisão antes da
  confirmação final (nunca direto para `BOOKED` sem passar pela revisão quando uma regra agiu
  pela primeira vez para aquele fornecedor).
- **Migração de CFOP existente.** Documentos já importados não têm `xml_cfop` — ficam
  "incompletos" nesse campo novo para sempre, o que é aceitável (é dado de auditoria, não
  operacional) mas deve ficar documentado para não gerar confusão futura.
- **Apuração passar a excluir documentos que hoje entram.** Se a regra "só documentos prontos"
  for aplicada retroativamente sem aviso, uma apuração recorrente pode dar um valor menor que
  o mês anterior sem explicação. Mitigação: o painel "fora da apuração e por quê" (5.3) é
  obrigatório, não opcional, junto com a mudança.
- **Escopo de "motor" da Natureza Fiscal crescer demais e virar uma pré-Reforma Tributária
  disfarçada.** Mitigação: os campos de tratamento tributário (Seção 2) são sinalizadores
  funcionais (o que esperar), não um motor de cálculo — cálculo automático de ICMS-ST/DIFAL
  continua fora de escopo até 35C+.

---

## Próximo prompt recomendado para implementação

"Implemente a Etapa 35B.1 conforme `docs/especificacao-fluxo-fiscal-operacional-35b1.md`,
começando pelo obrigatório da Seção 9.1 na ordem: (1) campos novos de Natureza Fiscal, (2)
`xml_cfop` + correção de `CFOP_DIRECTION_MISMATCH`, (3) Regras de Importação XML, (4) Painel
Fiscal único, (5) sidebar simplificada, (6) pendências redesenhadas, (7) seed mínimo, (8)
apuração só com documentos prontos. Não implemente os itens 'desejável' nem toque em Reforma
Tributária/SPED/folha. Rode `npm run build` a cada bloco e reporte antes de prosseguir se algo
sair do escopo fechado aqui."
