# Relatório de Preparação de Auditoria RLS & Isolamento Multiempresa

Este documento registra a preparação e o status da validação de segurança (Row Level Security) do ERP Contábil, correspondente à **Etapa 25**.

---

## 1. Status da Execução
* **Estado Final**: `Aprovado com ressalvas`
* **Execução Real Realizada**:  **Sim (Execução Manual)**
* **Ambiente de Teste**: Supabase descartável via SQL Editor web.
* **Detalhes**: 
  * A execução física dos scripts SQL e a orquestração da suíte foram disparadas no SQL Editor por uma conexão administrativa (`postgres`/`service_role`) para fins de setup de tabelas temporárias e carga inicial de sementes.
  * As asserções de segurança e acesso foram validadas **simulando identidades de usuário final** (`ACCOUNTANT`, `ASSISTANT` e `CLIENT_VIEWER`) através de claims JWT associadas à role `authenticated`.
  * A chave `service_role` ou o superusuário `postgres` **não** foram usados como identidades de usuários finais nos cenários operacionais avaliados.
  * Todos os 12 cenários de isolamento e RLS passaram com sucesso absoluto, sem erros de asserção, terminando com `ROLLBACK` conforme projetado. As correções funcionais de banco foram gravadas nos arquivos oficiais.

---

## 2. O que foi Preparado e Melhorado

A fim de possibilitar uma execução manual fluida e segura, a suíte de testes de RLS foi expandida e novos guias foram consolidados:

1. **Expansão da Suíte de Testes ([rls_isolation_tests.sql](file:///c:/Users/peace/OneDrive/Área de Trabalho/SELA SISTEM/db/tests/rls_isolation_tests.sql))**:
   * Foi adicionado o **Cenário 12** cobrindo todos os módulos estendidos de Fiscal, Apurações, Obrigações, Patrimônio e Bancos (Etapas 18–24).
   * Validação de RLS de tabelas recém-criadas ou modificadas: `fixed_assets`, `asset_depreciations`, `asset_categories`, `fiscal_document_retentions`, `tax_assessments`, `tax_assessment_lines`, `obligations`, `bank_statement_lines` e `bank_reconciliations`.
   * Validação estrita da policy customizada de `fiscal_document_retentions`, assegurando que o INSERT/UPDATE é bloqueado se o documento fiscal associado não estiver em estado editável (como `BOOKED`).
   * Validação da imutabilidade pós-fechamento e bloqueios cross-company para todas as tabelas operacionais novas.
   
2. **Guia de Execução no SQL Editor ([rls_sql_editor_execution_guide.md](file:///c:/Users/peace/OneDrive/Área de Trabalho/SELA SISTEM/db/tests/rls_sql_editor_execution_guide.md))**:
   * Instruções passo a passo detalhando como rodar a suíte manualmente no console web do Supabase.
   * Alerta sobre a incompatibilidade do comando `\i` no SQL Editor do navegador.
   * Explicação sobre como ler e interpretar os logs de notices (`NOTICE: OK: ...`) e exceções.

3. **Mapeamento de Ordem de Execução ([rls_manual_execution_order.sql](file:///c:/Users/peace/OneDrive/Área de Trabalho/SELA SISTEM/db/tests/rls_manual_execution_order.sql))**:
   * Roteiro em arquivo SQL mapeando a ordem correta de aplicação dos schemas, das políticas de RLS correspondentes e da suíte de testes.

---

## 3. Cenários e Tabelas Cobertos pela Suíte

A suíte de validação agora cobre um total de **12 cenários de isolamento** e **11 funções auxiliares de autorização**:

* **Funções de Segurança**: `current_profile_id`, `is_workspace_member`, `has_workspace_role`, `is_company_member`, `has_company_role`, `can_read_company`, `can_write_company`, `can_admin_company`, `can_close_period`, `can_read_workspace`, `can_admin_workspace`.
* **Cenário 1**: Usuário sem vínculo (`no_access`) -> Zero leitura, zero escrita em parceiros, itens, bank_accounts.
* **Cenário 2**: Administrador do Workspace A -> Lê e gerencia apenas recursos do Workspace A (bloqueia em B).
* **Cenário 3**: Vínculo exclusivo em `company_a1` -> Lê apenas a própria empresa (bloqueia na empresa vizinha `company_a2`). Valida que papéis de workspace sem vínculo de empresa (`viewer_a1`) têm zero acesso operacional.
* **Cenário 4**: Papel `ACCOUNTANT` -> Acesso total à escrita operacional, manutenção do plano de contas e fechamento de períodos.
* **Cenário 5**: Papel `ASSISTANT` -> Acesso à escrita operacional básica e efetivação de lançamentos (DRAFT -> POSTED). Bloqueado em tarefas administrativas (plano de contas, fechamento de períodos e criação de contas bancárias). Garante imutabilidade contábil pós-POSTED.
* **Cenário 6**: Papel `CLIENT_VIEWER` -> Leitura autorizada na empresa vinculada, porém bloqueado para qualquer operação de escrita (INSERT, UPDATE, DELETE).
* **Cenário 7**: Vazamento de Tenant (Cross-company) -> SELECT/INSERT/UPDATE em outras empresas afetam 0 linhas. Tentativa de mover um registro próprio para outra empresa é abortada pelo trigger `fn_prevent_tenant_change`.
* **Cenário 8**: RLS em Tabelas Filhas -> Cobertura de `journal_entry_lines` (vinculada a `journal_entries`) e `fiscal_document_items` (vinculada a `fiscal_documents`).
* **Cenário 9**: Registros de Auditoria (`audit_logs`) -> Somente visível por `ACCOUNTANT` e papéis de Workspace; escrita direta por usuários autenticados é bloqueada (apenas o sistema/service_role insere).
* **Cenário 10**: Catálogos Globais -> Leitura livre de `account_templates`, `states` e `municipalities` para todos os autenticados, mas bloqueado para escrita.
* **Cenário 11**: Cadastros Base v1.2 -> Políticas RLS em `items`, `fiscal_operation_natures` e `bank_accounts`. Bloqueio de DELETE físico geral.
* **Cenário 12**: Novos Módulos v1.4/v1.5 -> Teste de RLS de `fixed_assets` (depreciação linear, exclusão bloqueada se ativo), `asset_depreciations`, `asset_categories`, `fiscal_document_retentions` (restrição de status), `tax_assessments`, `tax_assessment_lines`, `obligations` e `bank_statement_lines`.

---

## 4. Veredito e Ressalvas de Runtime

* **Segurança RLS do Banco**: **VALIDADA** em Supabase descartável via SQL Editor web.
* **Isolamento Multiempresa**: **APROVADO** contra todos os 12 cenários de teste da suíte.
* **Ressalva Crítica de Runtime**: Embora o banco de dados esteja com as políticas de RLS 100% corretas, a aplicação Next.js em runtime hoje conecta-se ao Supabase através da chave administrativa `service_role` (`Admin Client` em `src/lib/supabase/server.ts`). Como o `service_role` ignora a RLS, as políticas de segurança do banco estão sendo temporariamente ignoradas na execução normal do software, dependendo unicamente das regras escritas nas Server Actions.

> [!WARNING]
> **Antes do deploy em produção multiusuário**, é obrigatório realizar o hardening das conexões no Next.js para separar o Client de Usuário Autenticado (que obedece a RLS) do Admin Client (com privilégios elevados, de uso estritamente restrito).

---

## 5. Próxima Etapa Recomendada

### Etapa 26 — Hardening de Runtime Supabase/Auth:
* **Mapeamento de conexões**: Mapear todas as queries e Server Actions que hoje consomem o cliente Supabase com chave `service_role`.
* **Segregação de Clientes**: Separar as conexões da aplicação em duas instâncias:
  1. *User Client* (cliente autenticado usando o token/cookie JWT do usuário final), obrigando todas as operações cotidianas a passarem pela RLS no banco de dados.
  2. *Admin Client* (com a chave `service_role`), restrito exclusivamente a fluxos de retaguarda, rotinas administrativas server-only e jobs batch devidamente documentados e isolados.
* **Remoção de Privilégios**: Eliminar o uso do `service_role` nos fluxos de leitura e escrita executados sob o contexto do usuário comum.
* **Validação**: Garantir que as políticas RLS validadas no banco de dados passem a atuar ativamente no tráfego de produção do Next.js.
