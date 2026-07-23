# Auditoria do Estado do Sistema Pos-Contabil/Fiscal

Data: 2026-07-21

## 1. Escopo e Fontes Lidas

Esta auditoria revisou o estado atual do ERP Sela Sistem depois das etapas contabeis,
fiscais, patrimoniais, tributarias e do inicio de folha/eSocial.

Arquivos e areas revisados:

- `DEVELOPMENT_LOG.md`
- `docs/`, com enfase em `audit-accounting-mvp.md`, `audit-fiscal-tax-assets.md`,
  `audit-rls-execution.md`, `audit-supabase-runtime-auth.md`,
  `diagnostico-arquitetura-fiscal-contabil-etapa32a.md`, `e2e-audit-etapa32b.md`,
  `etapa34a-34b-irpj-csll-baixa-patrimonial.md` e `tax-assessment-credits.md`
- `package.json`
- migrations recentes de `db/migrations`
- rotas principais em `src/app/(erp)`
- modulos em `src/modules/accounting`, `src/modules/fiscal`, `src/modules/tax-assessments`,
  `src/modules/assets`, `src/modules/payroll`, `src/modules/banking` e suporte Supabase/contexto

Diretriz local atendida: antes de editar codigo Next.js, foram lidos guias em
`node_modules/next/dist/docs/` sobre App Router, Server Actions e Server/Client Components,
conforme `AGENTS.md`.

## 2. Resultado de Build e Verificacao

Build inicial, antes das correcoes desta rodada:

- Comando: `npm run build`
- Resultado: sucesso
- Next.js: `16.2.10` com Turbopack
- Compilacao: concluida com sucesso em 23.7s
- TypeScript: concluido em 24.2s
- Paginas estaticas: 12/12
- Erros/warnings de build: nenhum observado

Build final, depois das correcoes desta rodada:

- Comando: `npm run build`
- Resultado: sucesso
- Next.js: `16.2.10` com Turbopack
- Compilacao: concluida com sucesso em 7.5s
- TypeScript: concluido em 8.9s
- Paginas estaticas: 12/12
- Erros/warnings de build: nenhum observado

Verificacao auxiliar:

- Comando: `npm run lint`
- Resultado: falha por debitos amplos pre-existentes
- Resumo: 297 problemas, sendo 248 erros e 49 warnings. A maior parte e
  `@typescript-eslint/no-explicit-any`, scripts `scratch_*` usando `require`,
  imports/variaveis nao usados, `react/no-unescaped-entities` e alguns avisos de hooks.
- Nao foi tratado nesta rodada porque e saneamento global, nao bloqueador de build, e
  ja constava no historico como debito amplo do projeto.

Nao existe script `test` em `package.json`; portanto nao houve suite automatizada de
aplicacao para executar alem de build/lint.

## 3. Linha do Tempo do Estado Atual

| Etapa | Estado | Observacao |
|---|---|---|
| 14 | Concluida | MVP contabil auditado: plano de contas, lancamentos, periodos, relatorios, encerramento e dashboard |
| 15 | Concluida | Cadastros base: parceiros, itens, naturezas fiscais, contas bancarias e municipios |
| 18 | Concluida | Bancos e conciliacao contabil em vez de financeiro empresarial completo |
| 19-22 | Concluidas | Fiscal, apuracoes, obrigacoes e patrimonio com integracoes contabeis manuais |
| 24 | Concluida | Creditos tributarios, saldos e ajustes em apuracoes |
| 29A/29B/30A | Concluidas | Correcoes de contexto, Auth real, multiempresa e bancos |
| 32A | Concluida | Diagnostico da arquitetura fiscal-contabil |
| 32B | Concluida | Fundacao de importacao XML NF-e |
| 32C/32D | Concluidas | Regras de contabilizacao fiscal, rastreabilidade e suporte ampliado XML |
| 33A | Concluida | Criacao de ativo a partir de item fiscal classificado como imobilizado |
| 34A | Concluida | IRPJ/CSLL dentro de `tax_assessments` |
| 34B | Concluida | Baixa patrimonial com ganho/perda e lancamento contabil |
| v2.1-v2.2 | Concluidas | Hotfixes idempotentes para drift de schema em patrimonio e regras fiscais |
| v2.3-v2.5 | Concluidas no codigo | Regras fiscais multi-linha, multi-condicao e configuracoes de apuracao |
| v2.6 | Parcial | Tabelas e UI inicial de importacao eSocial/folha |
| v2.7 | Pendente operacional | Fix de corrida/duplicidade em contabilizacao fiscal depende de aplicar migration e, se necessario, limpeza previa |

## 4. Veredito Geral

O ERP esta em um estado bem mais maduro do que um MVP contabil isolado. Existe uma espinha
dorsal contabil real e os modulos fiscal, tributario, patrimonial, obrigacoes, bancos e
folha inicial ja se conectam ao mesmo livro diario via `journal_entries`.

Classificacao por modulo:

| Modulo | Veredito | Comentario curto |
|---|---|---|
| Contabilidade | Pronto para MVP com ressalvas | Funcional, integrado e com build limpo. Falta permissao real por papel e testes automatizados |
| Fiscal/XML | Funcional, precisa refinamento | Fluxo de documento, XML e contabilizacao existe. Ainda nao e motor fiscal/legal completo |
| Apuracoes | Funcional, precisa refinamento legal | Bom para controle operacional. PIS/COFINS foram deliberadamente deslocados para contabilizacao por documento |
| Patrimonio | Pronto para MVP com ressalvas | Criacao, depreciacao e baixa contabil existem. Ainda faltam cenarios patrimoniais avancados |
| Obrigacoes | MVP funcional | Geracao a partir de apuracao fechada e workflow operacional existem |
| Bancos | MVP funcional | Importacao, classificacao, contabilizacao e conciliacao existem |
| Folha | Parcial/prototipo | eSocial importado e contabilizavel, mas nao ha folha completa |
| RLS/Auth | Parcialmente pronto | Runtime usa User Client por padrao; RLS foi testada historicamente, mas permissoes de app ainda sao stub |
| UI/UX | Boa base operacional | Telas ricas e navegaveis, mas ainda sem bateria visual/browser automatizada |

## 5. Contabilidade

Pontos prontos:

- Plano de contas com validacoes de empresa, conta pai, conta sintetica/analitica e ativacao.
- Lancamento manual com validacao de periodo aberto, contas da empresa, partidas dobradas e parceiro opcional.
- Postagem, estorno via RPC e origem/rastro por `origin`/`origin_id`.
- Periodos contabeis com fechamento, reabertura e bloqueio de rascunhos.
- Relatorios principais: Diario, Balancete, DRE e Balanco.
- Encerramento de resultado com lancamento `RESULT_CLOSING`.
- Integracoes ja previstas por origem: fiscal, apuracao, banco, folha, patrimonio,
  depreciacao, baixa patrimonial e reversao.

Ressalvas:

- Nao ha rota de detalhe dedicada para lancamento em `/contabilidade/lancamentos/[id]`;
  os detalhes aparecem na lista/consulta. Para auditoria de escritorio, uma tela dedicada
  seria melhor.
- `permissions.ts` ainda concede perfil administrativo/wildcard em nivel de aplicacao.
  A protecao real depende de RLS e dos filtros por empresa nas queries.
- A criacao automatica de periodo ainda tem fallback administrativo controlado em
  `getCurrentAccountingPeriod`, aceitavel como excecao de infraestrutura, mas deve ser
  mantida documentada.
- Nao ha testes automatizados de regressao para os fluxos contabeis.

Conclusao: o MVP contabil pode ser considerado concluido para uso controlado, com a
ressalva de que permissao real por papel e testes precisam entrar antes de producao ampla.

## 6. Fiscal e XML

Pontos prontos:

- Documentos fiscais com status `DRAFT`, `IMPORTED`, `VALIDATED`, `BOOKED`, `CANCELLED`.
- `accounting_status` e `journal_entry_id` para rastrear contabilizacao.
- Itens, retencoes, natureza fiscal, parceiro e direcao de entrada/saida.
- Importacao XML com auditoria em `fiscal_xml_imports`.
- Deteccao de NF-e, CT-e e NFS-e.
- Deduplicacao por chave de acesso/hash e bloqueio de CNPJ divergente.
- Criacao/reuso de parceiro por documento normalizado.
- Contabilizacao fiscal por regra ou fallback manual, gerando `journal_entries` com
  `origin='FISCAL_DOCUMENT'` e historico em `fiscal_accounting_applications`.
- Estorno/regeneracao da contabilizacao fiscal.
- Tela de detalhe fiscal com abas de documento, itens, tributos, contabilidade, apuracao,
  patrimonio e XML/auditoria.

Ressalvas:

- O parser NF-e e bom para fundacao. CT-e e NFS-e sao MVP/tolerantes e precisam de mais
  layouts reais, principalmente NFS-e por prestador/municipio.
- A recuperacao automatica de PIS/COFINS na importacao XML ainda tem percentuais fixos
  no codigo. Isso deve migrar para configuracao tributaria/regra por empresa.
- `tax_status` em `fiscal_documents` e criado/cancelado, mas nao foi encontrado fluxo
  consistente marcando documentos como `ASSESSED` apos apuracao.
- Bulk XML importa automaticamente documentos sem pendencia; para NFS-e/CT-e, isso exige
  uma etapa de revisao operacional mais forte antes de usar com volume real.
- A migration v2.7 protege contra corrida de contabilizacao duplicada, mas ambientes com
  duplicidade antiga precisam aplicar a limpeza operacional antes do indice unico.

Conclusao: fiscal esta funcional para um MVP interno/controlado, mas a Etapa 35A deve ser
priorizada antes de chamar isso de fiscal robusto para operacao real.

## 7. Apuracoes e Tributos

Pontos prontos:

- `tax_assessments` cobre ISS, ICMS, IPI, SIMPLES, retencoes e, nas etapas recentes,
  IRPJ/CSLL.
- Workflow `DRAFT -> CALCULATED -> REVIEWED -> CLOSED -> CANCELLED`.
- Calculo automatico a partir de documentos `BOOKED` por competencia.
- Creditos automaticos de ICMS/IPI em entradas e ajustes manuais.
- Retencoes por documento.
- Saldo credor anterior e saldo a transportar.
- Apuracao do Simples por receita/natureza com tabela de aliquotas.
- IRPJ/CSLL por Lucro Presumido e Lucro Real assistido.
- Contabilizacao de apuracao fechada com `origin='FISCAL_ASSESSMENT'`.
- Configuracoes de tributos apuraveis por empresa.

Ressalvas:

- Nao e um motor legal completo. Nao ha validacao profunda por CST, CFOP, NCM, CIAP,
  excecoes legais, regimes especiais, FCP, DIFAL, substituicao tributaria completa ou
  regras municipais de ISS.
- PIS/COFINS estao fora da apuracao por desenho atual, tratados como tributos
  contabilizados diretamente no documento fiscal. Isso e coerente com as configuracoes
  atuais, mas precisa da Etapa 35B para lancamentos compostos e memoria fiscal completa.
- Lucro Real e assistido: usa DRE + ajustes manuais, nao um LALUR/LACS completo.

## 8. Patrimonio

Pontos prontos:

- Categorias patrimoniais com contas padrao.
- Bens patrimoniais com valor de aquisicao, vida util, residual, status e eventos.
- Criacao de bem a partir de item fiscal `ASSET`, com vinculo `fiscal_document_id` e
  `fiscal_document_item_id`.
- Depreciacao linear por competencia e contabilizacao `ASSET_DEPRECIATION`.
- Baixa patrimonial com calculo de valor liquido, ganho/perda, evento e lancamento
  `ASSET_DISPOSAL`.

Ressalvas:

- Nao ha controle avancado de CIAP.
- Nao ha reavaliacao, impairment, transferencia entre estabelecimentos, desmembramento,
  baixa parcial ou inventario fisico.
- A classificacao do item como `ASSET` ainda depende de revisao humana ou cadastro, nao de
  inteligencia fiscal automatica.

## 9. Folha e eSocial

Estado encontrado:

- Existem tabelas historicas de base (`payroll_summaries`, `payroll_lines`,
  `payroll_payments`) no schema inicial.
- A migration v2.6 adiciona `payroll_esocial_imports`, `payroll_esocial_events` e
  `payroll_esocial_event_items` com RLS.
- Existem rotas `/folha` e `/folha/importar-esocial`.
- Existe parser/importador XML eSocial com deduplicacao por evento/hash e auditoria.
- Evento eSocial importado pode gerar lancamento contabil `PAYROLL_SUMMARY` ou
  `PAYROLL_PAYMENT` conforme valores extraidos.

O que ainda nao existe:

- Cadastro real de empregados, contratos, cargos, lotacoes, horarios, dependentes e
  dados trabalhistas.
- Catalogo de rubricas.
- Geracao de folha mensal propria.
- Calculo nativo de INSS, IRRF, FGTS, ferias, 13o, rescisao, afastamentos e provisoes.
- Fechamento mensal de folha.
- Integracao completa com obrigacoes e guias trabalhistas.
- Estorno/regeneracao de evento de folha no mesmo nivel do fiscal.

Conclusao: folha nao deve ser considerada implementada. O que existe e um inicio tecnico
valioso para importacao e contabilizacao de eventos eSocial. A Etapa 36A deve transformar
isso em arquitetura formal antes de implementar a folha de verdade.

Arquitetura MVP sugerida para folha:

- `employees` ou extensao formal de `partners` com dados trabalhistas.
- `employee_contracts` para salario, admissao, regime, lotacao e centro de custo.
- `payroll_rubrics` para proventos/descontos/base de INSS/IRRF/FGTS.
- `payroll_runs` por empresa/competencia/tipo.
- `payroll_run_lines` por empregado/rubrica.
- `payroll_charges` para INSS patronal, FGTS, terceiros e provisoes.
- `payroll_accounting_rules` ou reaproveitamento controlado de regras contabeis por rubrica.
- Vinculo com `journal_entries` via `origin='PAYROLL_SUMMARY'`, `PAYROLL_PAYMENT` e futuras
  origens de encargos/provisoes.
- Tabelas de auditoria eSocial mantidas como trilha externa, nao como folha mestre.

## 10. UI/UX

Pontos positivos:

- Sidebar cobre Cadastros, Contabilidade, Bancos, Fiscal, Folha, Obrigacoes e Patrimonio.
- Telas fiscais e contabeis usam abas, tabelas, badges de status, filtros e formularios
  com feedback.
- Relatorios contabeis possuem componentes de cabecalho/rodape, impressao e exportacao CSV.
- `globals.css` contem protecoes de contraste para inputs/selects/textareas mesmo em SO
  com tema escuro.
- Tela de documento fiscal e uma boa superficie de auditoria, reunindo contabilizacao,
  apuracao, patrimonio e XML.

Correcoes feitas nesta rodada:

- A tela `/fiscal/importar-xml` dizia "NF-e Entrada", embora o backend suporte NF-e, CT-e
  e NFS-e, entrada e saida. O texto foi ajustado.
- Os formularios de importacao simples e em lote tambem foram atualizados para refletir o
  escopo real de XML fiscal.

Ressalvas:

- Nao houve teste visual em navegador com screenshots nesta rodada.
- A listagem de lancamentos contabeis nao substitui uma tela de detalhe/auditoria dedicada.
- A UI usa bastante cartao e `rounded-xl`, padrao ja existente do projeto; nao foi
  redesenhada nesta auditoria.
- Algumas tabelas podem crescer sem paginacao server-side visivel nas rotas auditadas.

## 11. Multiempresa, Auth e RLS

Estado atual:

- `src/lib/supabase/server.ts` usa User Client por padrao com Supabase Auth/cookies.
- `service_role` fica restrito a `createServerAdminClient()` e a excecoes especificas.
- `getClient()` so cai para Admin Client em desenvolvimento quando
  `BYPASS_RLS_IN_DEV=true` e nao ha sessao.
- `getCurrentContext()` usa `supabase.auth.getUser()`, perfil, empresas permitidas por
  RLS e cookie de empresa/competencia.
- Existe fallback dev controlado por `DEV_ALLOW_UNAUTHENTICATED_CONTEXT=true`.
- A suite historica de RLS documentada passou em ambiente Supabase descartavel.
- As actions e queries principais filtram por `company_id`; nesta rodada foram endurecidas
  leituras/delecoes filhas que ainda confiavam demais em RLS/contexto.

Riscos:

- `permissions.ts` ainda e stub de permissao aplicacional, retornando papel ADMIN e `*`.
  Mesmo com RLS no banco, botoes/acoes de UI nao refletem papeis reais.
- `server-only` ainda nao e importado em `src/lib/supabase/server.ts`. Next consegue
  proteger muitas fronteiras pelo App Router, mas o import explicito continua recomendado.
- Algumas leituras de linhas filhas usam IDs previamente filtrados por empresa. Isso e
  aceitavel sob RLS, mas o padrao ideal e repetir `company_id` sempre que a tabela possui
  a coluna.
- Documentos historicos como `erp-master-plan.md` ainda contem texto antigo dizendo que
  tudo rodava via `service_role`; os docs mais recentes de runtime/Auth sao mais atuais.

## 12. Dados e Integracoes

Vinculos fortes encontrados:

- `journal_entries.origin` e `origin_id` centralizam a rastreabilidade entre modulos.
- `fiscal_documents.journal_entry_id` aponta para o lancamento fiscal atual.
- `fiscal_accounting_applications` guarda historico de aplicacao, regra, status e estorno.
- `tax_assessments.journal_entry_id` guarda contabilizacao da apuracao.
- `fixed_assets.fiscal_document_id` e `fixed_assets.fiscal_document_item_id` conectam
  patrimonio ao fiscal.
- `asset_depreciations.journal_entry_id`, `asset_events.journal_entry_id` e
  `fixed_assets.disposal_journal_entry_id` conectam patrimonio ao diario.
- `payroll_esocial_events.journal_entry_id` conecta evento importado de folha ao diario.
- Bancos usam origem `BANK_STATEMENT` e reconciliacoes para ligar extrato e contabilidade.

Riscos de dados:

- Varias Server Actions fazem sequencias multi-insert/update sem transacao SQL explicita.
  Ha compensacoes de erro em alguns pontos, mas uma RPC/transacao por fluxo critico seria
  mais forte.
- A migration v2.7 deve ser aplicada para impedir contabilizacao fiscal duplicada por
  corrida. Se houver dados antigos duplicados, aplicar antes a limpeza operacional.
- Percentuais fiscais hardcoded devem virar configuracao antes de operacao real.

## 13. Correcoes Aplicadas Nesta Rodada

Correcoes de defesa multiempresa e consistencia:

- `src/modules/fiscal/actions.ts`
  - Validacao de documento agora conta itens por `fiscal_document_id` e `company_id`.
  - Workflow em lote agora busca itens por documentos e `company_id`.
  - Atualizacao/remocao de item fiscal agora exige `id`, `fiscal_document_id` e `company_id`.
  - Estorno de contabilizacao fiscal agora localiza aplicacao por `fiscal_document_id`,
    `journal_entry_id`, `status` e `company_id`.

- `src/modules/fiscal/queries.ts`
  - Itens e retencoes do detalhe fiscal agora repetem `company_id`.
  - Linhas de apuracao exibidas no documento fiscal agora repetem `company_id`.
  - Contagem de aplicacoes contabeis ativas na listagem fiscal agora repete `company_id`.

- `src/modules/fiscal/accounting-rules/actions.ts`
  - Bloqueio de exclusao de regra usada agora conta aplicacoes dentro da empresa ativa.

- `src/modules/tax-assessments/actions.ts`
  - Recalculo de totais agora soma linhas por apuracao e empresa.
  - Limpezas de linhas automaticas agora filtram por `company_id`.
  - Ajustes de IRPJ/CSLL no Lucro Real agora filtram por empresa.
  - Edicao/remocao de linhas manuais agora exige apuracao e empresa.
  - Remocao de ajuste de IRPJ/CSLL agora exige ajuste, apuracao e empresa.
  - Leituras de `calculation_memory` para merge agora filtram por empresa.

- `src/modules/tax-assessments/queries.ts`
  - Linhas e ajustes da apuracao agora sao lidos por apuracao e empresa.

- `src/modules/assets/actions.ts`
  - Checagem de duplicidade de bem a partir de item fiscal agora tambem filtra empresa.

- UI XML fiscal
  - `src/app/(erp)/fiscal/importar-xml/page.tsx`
  - `src/modules/fiscal/xml-import/components/xml-import-form.tsx`
  - `src/modules/fiscal/xml-import/components/bulk-xml-import-form.tsx`
  - Textos atualizados para NF-e/CT-e/NFS-e e entrada/saida.

## 14. Arquivos Alterados

- `src/modules/fiscal/actions.ts`
- `src/modules/fiscal/queries.ts`
- `src/modules/fiscal/accounting-rules/actions.ts`
- `src/modules/tax-assessments/actions.ts`
- `src/modules/tax-assessments/queries.ts`
- `src/modules/assets/actions.ts`
- `src/app/(erp)/fiscal/importar-xml/page.tsx`
- `src/modules/fiscal/xml-import/components/xml-import-form.tsx`
- `src/modules/fiscal/xml-import/components/bulk-xml-import-form.tsx`
- `docs/auditoria-estado-sistema-pos-contabil-fiscal.md`
- `DEVELOPMENT_LOG.md`

## 15. Pendencias e Roadmap Recomendado

### Etapa 35A - Refinamento Fiscal

Objetivo: transformar o fiscal atual de MVP funcional em fluxo operacional mais confiavel.

Itens:

- Remover percentuais hardcoded de PIS/COFINS da importacao XML.
- Criar configuracao por empresa/regime para recuperacao e contabilizacao de tributos.
- Fortalecer parser CT-e e NFS-e com layouts reais.
- Atualizar `tax_status` dos documentos quando participarem de apuracao.
- Melhorar revisao obrigatoria de importacoes sensiveis.
- Adicionar smoke tests focados em XML -> documento -> contabilizacao -> apuracao.
- Confirmar aplicacao da migration v2.7 e limpeza de duplicidades antigas.

### Etapa 35B - Lancamentos Fiscais Compostos e Tributos por Linha

Objetivo: ampliar regras contabeis fiscais para cenarios reais de impostos, recuperaveis,
descontos, frete, despesas acessorias e tributos destacados.

Itens:

- Regras multi-linha com validacao de partida dobrada por documento.
- Bases configuraveis: mercadoria, servico, frete, seguro, desconto, outras despesas,
  ICMS, IPI, PIS, COFINS, ISS.
- Contabilizacao de tributos recuperaveis e a recolher por tipo.
- Memoria de calculo da aplicacao da regra.
- Relatorio de documentos com regra ausente, regra ambigua ou regra desbalanceada.

### Etapa 35C - Obrigacoes e Exportacoes Fiscais

Objetivo: sair do controle interno para preparacao de entregas e auditoria fiscal.

Itens:

- Livros fiscais e relatatorios por periodo.
- Exportacoes CSV estruturadas para conferencia.
- Preparacao para SPED/EFD/ECD/ECF em etapas posteriores.
- Rastro XML -> documento -> regra -> diario -> apuracao -> obrigacao.
- Relatorios de divergencia fiscal-contabil.

### Etapa 36A - Arquitetura de Folha

Objetivo: formalizar o dominio de folha antes de implementar calculos.

Itens:

- Decidir entre `employees` dedicado ou extensao robusta de `partners`.
- Modelar contratos, rubricas, eventos, runs mensais, encargos e provisoes.
- Definir fronteira entre folha calculada internamente e eventos importados do eSocial.
- Definir regras contabeis por rubrica/encargo.
- Planejar migrations e RLS antes da UI.

### Etapa 36B - Folha MVP

Objetivo: gerar uma folha mensal simples, auditavel e contabilizavel.

Itens:

- Cadastro de empregado/contrato.
- Rubricas basicas.
- Competencia de folha.
- Lancamentos por empregado.
- Fechamento de folha.
- Contabilizacao `PAYROLL_SUMMARY` por rubricas/centros de custo.

### Etapa 36C - Encargos e Provisoes

Objetivo: completar o impacto contabil da folha.

Itens:

- INSS patronal, FGTS, terceiros e RAT/FAP parametrizaveis.
- Provisoes de ferias e 13o.
- Baixas/pagamentos e reversoes.
- Integracao com obrigacoes e bancos.

### Etapa 36D - eSocial e Integracoes

Objetivo: consolidar eSocial como trilha de auditoria/integracao, nao como substituto da
folha mestre.

Itens:

- Mapeamento de eventos e rubricas.
- Importacao incremental e conciliacao com folha gerada.
- Estorno/regeneracao de contabilizacao de evento.
- Relatorios de divergencia folha/eSocial/contabilidade.

## 16. Veredito Final

O sistema esta apto a continuar para as Etapas 35A-35C antes de expandir folha. O maior
risco nao e build ou estrutura de rotas, pois ambos estao saudaveis. Os riscos principais
sao operacionais: regras fiscais ainda incompletas para uso real, permissoes aplicacionais
stubadas, lint/testes acumulados e falta de transacoes formais em fluxos multi-etapa.

Recomendacao: iniciar pela Etapa 35A. Ela reduz risco real de operacao fiscal sem abrir um
modulo grande novo. Depois, 35B e 35C consolidam o fiscal-contabil. Folha deve vir na 36A
como arquitetura primeiro, porque o que existe hoje e apenas a semente de eSocial.
