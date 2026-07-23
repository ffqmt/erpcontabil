# Testes de Segurança (RLS / Isolamento Multiempresa)

Etapa 17 do roadmap (`docs/erp-master-plan.md`). Esta pasta contém a suíte de validação da
Row Level Security escrita em `erp_rls_v1.sql` + `db/migrations/erp_rls_v1_2_cadastros_base.sql`
— até esta etapa, essa RLS nunca havia sido exercitada contra dados reais (ver achado da
Etapa 16).

## Objetivo

Confirmar, com asserções automáticas (não inspeção manual), que:
- usuários sem vínculo não enxergam nem escrevem nada;
- isolamento entre empresas e entre workspaces é real (não só "por enquanto ninguém
  tentou");
- cada papel (OWNER/ADMIN de workspace; ACCOUNTANT/ASSISTANT/CLIENT_VIEWER de empresa) tem
  exatamente o nível de acesso documentado nos comentários de `erp_rls_v1.sql`;
- tabelas globais (catálogos) e tabelas filhas (linhas de lançamento, itens de documento
  fiscal) seguem a mesma disciplina.

## !! AMBIENTE — NÃO É O BANCO DE DESENVOLVIMENTO PRINCIPAL !!

Rode isto em **um destes ambientes**, nunca no banco de dev usado pela aplicação:
- um projeto Supabase novo, descartável, criado só para este teste;
- uma *branch* de banco do Supabase (se disponível no seu plano);
- um Postgres local que você possa resetar (`docker run postgres`, `supabase start` local,
  etc.);
- um clone temporário do banco de dev.

A suíte roda inteira dentro de `BEGIN ... ROLLBACK`, então tecnicamente não persiste nada
mesmo se rodada no banco errado — mas ainda assim **não rode no banco de dev principal**:
qualquer erro de operador (esquecer o ROLLBACK, rodar só um pedaço do arquivo colando à
mão) pode deixar dados de teste para trás lá.

## Pré-requisitos (nesta ordem, no banco descartável)

```
1. erp_schema_v1_1.sql
2. db/migrations/erp_schema_v1_2_cadastros_base.sql
3. erp_rls_v1.sql
4. db/migrations/erp_rls_v1_2_cadastros_base.sql
5. db/tests/rls_isolation_tests.sql   <- este arquivo
```

Os seeds de demonstração (`seed_demo_accounting.sql` / `seed_demo_base_registrations.sql`)
**não são pré-requisito** — a suíte cria seus próprios dados de teste com UUIDs fixos
prefixados em `e...` (não colidem com os prefixos dos seeds de demo). Pode rodar com ou
sem os seeds de demo já aplicados.

## Como executar

### Opção A — Supabase SQL Editor (Recomendado devido a limitações de CLI no host local)

Como o ambiente local não dispõe de ferramentas de linha de comando (`psql`, `supabase` ou `docker` no PATH), a forma correta é executar manualmente pela interface web do Supabase. 

> [!IMPORTANT]
> O SQL Editor do Supabase **não aceita** comandos de terminal como `\i`.
> Consulte o guia detalhado em [rls_sql_editor_execution_guide.md](file:///c:/Users/peace/OneDrive/Área de Trabalho/SELA SISTEM/db/tests/rls_sql_editor_execution_guide.md) para copiar/colar cada arquivo de schema, RLS e testes na ordem exata.

1. Abra o projeto descartável → SQL Editor.
2. Cole o conteúdo de `db/tests/rls_isolation_tests.sql` inteiro (o arquivo já começa com `begin;` e termina com `rollback;`).
3. Clique em "Run".
4. Leia a aba de resultados/logs: cada asserção que passa aparece como uma linha `NOTICE: OK: ...`. Se algo falhar, a execução para imediatamente com `ERROR: FALHA: <mensagem explicando o que era esperado>`.

### Opção B — psql (Apenas se psql for instalado no host fora do PATH do sandbox)

```bash
psql "postgresql://postgres:<senha>@<host-do-projeto-descartavel>:5432/postgres" \
  -f erp_schema_v1_1.sql \
  -f db/migrations/erp_schema_v1_2_cadastros_base.sql \
  -f erp_rls_v1.sql \
  -f db/migrations/erp_rls_v1_2_cadastros_base.sql \
  -f db/tests/rls_isolation_tests.sql
```

Ou, um arquivo por vez, na mesma ordem, se preferir rodar interativamente e inspecionar
entre os passos.

## Como interpretar sucesso/falha

- **Sucesso**: a saída termina com a mensagem `TODOS OS CENÁRIOS DE ISOLAMENTO E RLS
  PASSARAM SEM FALHAS.` e o comando final é o `ROLLBACK` (nenhum dado fica persistido).
- **Falha**: a execução para no primeiro `assert_*` que falhar, com uma mensagem
  `FALHA: <cenário>: <o que era esperado>`. A transação inteira já terá sido abortada pelo
  Postgres (erro dentro de uma transação aborta a transação) — não precisa rodar
  `ROLLBACK` manualmente, mas não custa rodar por segurança.
- Se a falha for num `assert_write_succeeds` (algo que deveria funcionar e não funcionou),
  o erro exibido é o erro CRU do Postgres/RLS que bloqueou a operação — geralmente já
  aponta a policy culpada na própria mensagem.

## Estratégia de simulação de usuário autenticado (sem Francoos/HTTP real)

O projeto ainda não tem sessão real de Supabase Auth (ver `docs/erp-master-plan.md`). Para
testar RLS sem isso, a suíte simula a claim JWT que `auth.uid()` normalmente leria de uma
requisição HTTP real, usando `set_config()` diretamente na sessão SQL:

```sql
select set_test_auth('<uuid-do-auth.users-do-persona>');
-- ... roda os SELECTs/INSERTs/UPDATEs como esse usuário ...
select reset_test_auth();
```

`set_test_auth()` define **os dois formatos conhecidos** de claim usados por `auth.uid()`
em diferentes versões da imagem do Supabase (`request.jwt.claim.sub` e
`request.jwt.claims` em JSON) e troca a role da sessão para `authenticated` via `SET LOCAL
ROLE` — sem isso, mesmo com o claim certo, a sessão continuaria como
`postgres`/`service_role` e ignoraria toda a RLS.

**Isto foi escrito sem acesso a um projeto Supabase ao vivo para confirmar qual dos dois
formatos está realmente ativo na sua instância** — por isso os dois são setados
defensivamente. Se, ao rodar, `current_profile_id()` retornar `NULL` para um usuário que
deveria existir (sintoma: as asserções do Bloco 2 falham logo no início), o `auth.uid()`
da sua instância pode estar lendo de um lugar diferente. Fallback manual para diagnosticar:

```sql
-- Depois de `select set_test_auth('<uuid>');`, rode à mão:
select auth.uid();  -- deveria retornar o mesmo uuid que você passou
```

Se retornar `NULL`, inspecione a definição real de `auth.uid()` no seu projeto
(`\sf auth.uid` no psql, ou procure no schema `auth` pelo SQL Editor) e ajuste
`set_test_auth()` para o GUC que ela realmente lê.

## O que a suíte cobre

11 cenários (nomeados exatamente como no pedido da Etapa 17) + um bloco dedicado às 11
funções auxiliares de autorização (`current_profile_id`, `is_workspace_member`,
`has_workspace_role`, `is_company_member`, `has_company_role`, `can_read_company`,
`can_write_company`, `can_admin_company`, `can_close_period`, `can_read_workspace`,
`can_admin_workspace`). Ver os comentários dentro do próprio `.sql` para o detalhe de cada
asserção — a lista abaixo é só o resumo:

1. Usuário sem vínculo — zero leitura, zero escrita.
2. Owner/Admin do workspace A — lê/administra as 2 empresas do próprio workspace, nada do
   workspace B.
3. Vínculo só em `company_a1` — lê só essa empresa (nem `company_a2` do mesmo workspace,
   sem papel de workspace). Inclui o persona "viewer" (ASSISTANT de workspace sem vínculo
   de empresa) — ver nota de mapeamento de papel abaixo.
4. ACCOUNTANT — escreve dados operacionais, administra plano de contas, fecha período.
5. ASSISTANT — escreve dados operacionais e **efetiva lançamentos** (DRAFT→POSTED, tratado
   como operação básica), mas não administra plano de contas nem fecha período; uma vez
   POSTED, nem o próprio ASSISTANT altera mais.
6. CLIENT_VIEWER — só leitura, bloqueado em toda escrita testada.
7. Isolamento cross-company — SELECT/INSERT/UPDATE contra empresa alheia, e a tentativa de
   mover um registro próprio para outra empresa (bloqueada por `fn_prevent_tenant_change`,
   não pela RLS).
8. Tabelas filhas — `journal_entry_lines` (via `journal_entries`) e
   `fiscal_document_items` (via `fiscal_documents`).
9. Auditoria — `audit_logs`: só OWNER/ADMIN/ACCOUNTANT leem; INSERT direto por
   `authenticated` é sempre bloqueado (sem policy — só `service_role` escreve).
10. Tabelas globais — `account_templates`, `states`, `municipalities`: leitura liberada a
    qualquer autenticado, escrita bloqueada para todos.
11. Cadastros Base v1.2 — `items`/`fiscal_operation_natures` seguem `can_write_company`;
    `bank_accounts` é mais restrito (`can_admin_company`, igual a `chart_accounts`); nenhum
    tem policy de DELETE.

### Nota de mapeamento de papel: "user_viewer_a1"

O enum `workspace_role` real do schema não tem um papel `VIEWER` (decisão documentada em
`erp_rls_v1.sql`, Bloco 0 — não foi adicionado via `ALTER TYPE` para evitar uma migração em
dois passos). O persona `user_viewer_a1` desta suíte é mapeado como um `ASSISTANT` de
*workspace* **sem** nenhum vínculo em `company_users` — validando na prática o
comportamento de fallback que já estava documentado: um papel de workspace sozinho, sem
vínculo direto de empresa, não dá acesso operacional a nenhuma empresa.

## Limitações conhecidas (não cobertas por esta suíte)

- **Não testa a transição POSTED→REVERSED via `reverse_journal_entry()`** nem o
  balanceamento/numeração completos — esses fluxos já foram exercitados pelos testes
  funcionais das Etapas 6/9 (Server Actions); esta suíte foca no limite de autorização da
  RLS, não na lógica de negócio contábil.
- **Não testa `tax_assessments`/`tax_assessment_lines`, `payroll_*`, `asset_*`,
  `obligations`, `income_tax_*`, `bank_statement_*`/`bank_reconciliations`,
  `period_audits`/`period_audit_findings`, `import_logs`, `attachments`,
  `accounting_rules`** — todas seguem o mesmo padrão `can_read_company`/`can_write_company`/
  `can_admin_company` já validado em `partners`/`chart_accounts`/`journal_entries`/
  `fiscal_documents`, então o risco de comportamento divergente é baixo, mas não foi
  verificado linha a linha. Se algum desses módulos for implementado (Fiscal, Folha,
  Patrimônio — ver roadmap), vale estender esta suíte com o mesmo padrão antes de ligar a
  RLS de verdade.
- **TODO (Etapa 23 — auditoria das Etapas 19–22): `fiscal_document_retentions`
  (`db/migrations/erp_rls_v1_4_fiscal_tax_assets.sql`) precisa de um Cenário 12 dedicado**,
  diferente das demais tabelas listadas acima: é a ÚNICA tabela desta rodada com policy
  não-genérica — INSERT/UPDATE/DELETE exigem, além de `can_write_company`, que o
  `fiscal_documents` pai ainda esteja em `DRAFT`/`IMPORTED`/`VALIDATED` (subquery em cada
  policy, não só `can_write_company`). O padrão genérico `can_read_company`/
  `can_write_company` das demais tabelas de Fiscal/Apuração/Obrigação/Patrimônio continua
  coberto pelo argumento de baixo risco acima, mas esta policy composta com subquery é nova
  o bastante para merecer um teste dedicado: (a) INSERT de retenção falha quando o
  documento pai já está BOOKED/CANCELLED mesmo com `can_write_company`=true; (b) INSERT
  funciona quando o pai está DRAFT/IMPORTED/VALIDATED; (c) usuário sem acesso à empresa do
  documento pai não lê nem escreve retenções, mesmo sabendo o UUID. Adicionar ao arquivo
  `.sql` seguindo o padrão dos Cenários 8/11 existentes (tabela filha com FK para tabela
  já testada) antes da próxima execução real da suíte.
- **Storage (buckets/anexos físicos) não é coberto.** `attachments` (a tabela de metadados)
  tem RLS própria, mas o arquivo em si no Supabase Storage precisa de *storage policies*
  separadas (bucket policies), fora do escopo deste arquivo SQL — ver comentário em
  `erp_rls_v1.sql` sobre `attachments`.
- **Orquestração e Execução vs. Identidade Simulada**: A execução da suíte de testes no SQL Editor do Supabase é disparada pelo superusuário administrativo (`postgres`/`service_role`) para fins de setup inicial, definição de tabelas auxiliares de teste e gravação das sementes sob bypass de RLS. No entanto, as asserções de acesso de cada cenário operacional (para `ACCOUNTANT`, `ASSISTANT` e `CLIENT_VIEWER`) utilizam estritamente o chaveamento da sessão via `set_test_auth` para a role `authenticated` com claims JWT específicas. A role administrativa do superusuário não é usada para simular a identidade de usuário final nos cenários operacionais.
- **Edge Functions e uso de `service_role` fora deste teste**: Qualquer rota de runtime que rode com a chave `service_role` (como o `Admin Client` que a aplicação Next.js usa hoje em `src/lib/supabase/server.ts`) ignora por completo a RLS. A segurança nestes fluxos depende inteiramente da aplicação (Server Actions). É necessária uma etapa futura de hardening para restringir a chave de admin em runtime e utilizar clients de usuário autenticado.
- **Status de Execução real**: Os testes foram executados manualmente no painel SQL Editor do Supabase descartável com sucesso absoluto na Etapa 25B. Todos os 12 cenários de isolamento multiempresa e regras de RLS passaram nas validações, terminando com rollback limpo da transação.

## Se encontrar uma FALHA rodando pela primeira vez

1. Leia a mensagem — ela nomeia o cenário e a regra esperada.
2. Se for um falso positivo da estratégia de simulação de Auth (ver seção acima), ajuste
   `set_test_auth()`.
3. Se for uma policy genuinamente errada em `erp_rls_v1.sql`/`erp_rls_v1_2_cadastros_base.sql`,
   corrija ali (não reescreva o arquivo inteiro — mudança mínima e localizada), documente
   antes/depois no `DEVELOPMENT_LOG.md`, e adicione (ou ajuste) a asserção que capturou o
   problema para provar que passou a funcionar.
4. Se a correção exigir mudança estrutural de schema, **não aplique automaticamente** —
   documente como bloqueador em `docs/erp-master-plan.md` e decida com o time antes.
