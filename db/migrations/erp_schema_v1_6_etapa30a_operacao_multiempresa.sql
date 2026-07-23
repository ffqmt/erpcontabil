-- =====================================================================================
-- ERP CONTÁBIL — SCHEMA — v1.6 — OPERAÇÃO MULTIEMPRESA, PERÍODOS, IMPORTAÇÃO BANCÁRIA E
-- CONCILIAÇÃO INTELIGENTE (Etapa 30A). Migração incremental sobre v1.5. Aditiva apenas —
-- nenhuma tabela/coluna/constraint existente é removida ou renomeada.
-- =====================================================================================
--
-- Cobre 3 necessidades de schema levantadas pela auditoria funcional E2E da Etapa 30A:
--   BLOCO 1 — accounting_periods.reopen_reason: a Server Action de reabertura de período
--     (src/modules/accounting/periods/actions.ts) já existia desde antes desta etapa, mas
--     não capturava o motivo da reabertura — só reopened_at/reopened_by. O pedido da
--     usuária exige motivo obrigatório na reabertura como parte da trilha de auditoria.
--   BLOCO 2 — partners.customer_account_id / partners.supplier_account_id: suporta a
--     criação automática opcional de conta contábil analítica ao cadastrar um parceiro
--     (Cliente -> filha de 1.1.2 CLIENTES, Fornecedor -> filha de 2.1.1 FORNECEDORES).
--     Optou-se por 2 colunas nullable em vez de tabela auxiliar: relação 1:1 opcional e
--     de baixa cardinalidade, mesmo padrão já usado em chart_accounts.default_cost_center_id.
--   BLOCO 3 — bank_reconciliation_rules: motor de regras de mapeamento de conciliação
--     bancária (substring + direção -> conta de contrapartida sugerida + parceiro
--     sugerido), inspirado no protótipo legado sistema.html (REGRAS_PADRAO/
--     acharRegraExtrato), mas com prioridade explícita em vez de ordenação implícita por
--     tamanho de string. Nunca autoposta — só sugere/gera rascunho (ver actions.ts).
-- =====================================================================================


-- =====================================================================================
-- BLOCO 1 — accounting_periods.reopen_reason
-- =====================================================================================

alter table accounting_periods add column if not exists reopen_reason text;

comment on column accounting_periods.reopen_reason is 'Motivo obrigatório (validado na Server Action, Etapa 30A) informado ao reabrir uma competência CLOSED->REOPENED. Nulo para períodos nunca reabertos.';


-- =====================================================================================
-- BLOCO 2 — partners.customer_account_id / partners.supplier_account_id
-- =====================================================================================

alter table partners add column if not exists customer_account_id uuid references chart_accounts(id);
alter table partners add column if not exists supplier_account_id uuid references chart_accounts(id);

comment on column partners.customer_account_id is 'Conta analítica do plano de contas (filha de 1.1.2 CLIENTES) vinculada automaticamente quando o parceiro é marcado como Cliente e a criação automática é solicitada (Etapa 30A). Nula se não gerada/vinculada.';
comment on column partners.supplier_account_id is 'Conta analítica do plano de contas (filha de 2.1.1 FORNECEDORES) vinculada automaticamente quando o parceiro é marcado como Fornecedor e a criação automática é solicitada (Etapa 30A). Nula se não gerada/vinculada.';


-- =====================================================================================
-- BLOCO 3 — bank_reconciliation_rules
-- =====================================================================================

do $$
begin
  if not exists (select 1 from pg_type where typname = 'reconciliation_rule_direction') then
    create type reconciliation_rule_direction as enum ('CREDIT', 'DEBIT', 'ANY');
  end if;
end;
$$;
comment on type reconciliation_rule_direction is 'Sentido do movimento bancário ao qual uma regra de conciliação se aplica: CREDIT (entrada/valor positivo), DEBIT (saída/valor negativo), ANY (qualquer sentido).';

create table if not exists bank_reconciliation_rules (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete restrict,
  company_id uuid not null references companies(id) on delete restrict,
  name text not null,
  keyword text not null,
  direction reconciliation_rule_direction not null default 'ANY',
  counterparty_account_id uuid not null references chart_accounts(id),
  partner_id uuid references partners(id),
  cost_center_id uuid references cost_centers(id),
  description_template text,
  priority int not null default 100,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id)
);
comment on table bank_reconciliation_rules is 'Regra de mapeamento automático (Etapa 30A): quando a descrição de uma linha de extrato PENDING contém "keyword" (case-insensitive) e o sentido bate com "direction", sugere counterparty_account_id/partner_id/cost_center_id. Nunca autoposta — só alimenta sugestão manual ou geração de RASCUNHO revisável (ver applyReconciliationRuleAction). Prioridade menor = aplicada primeiro; em empate, regra mais recente vence.';
comment on column bank_reconciliation_rules.keyword is 'Substring buscada na descrição da linha de extrato (case-insensitive, sem regex — mesmo modelo simples do protótipo legado sistema.html).';
comment on column bank_reconciliation_rules.priority is 'Ordem de aplicação quando múltiplas regras casam a mesma linha — menor valor primeiro. Default 100 (meio da faixa) para deixar espaço para regras mais/menos específicas.';

create trigger trg_bank_reconciliation_rules_updated_at before update on bank_reconciliation_rules
  for each row execute function set_updated_at();

create index if not exists idx_bank_reconciliation_rules_company_active on bank_reconciliation_rules (company_id, active);

alter table bank_reconciliation_rules enable row level security;

create policy bank_reconciliation_rules_select on bank_reconciliation_rules
  for select to authenticated
  using (can_read_company(company_id));

create policy bank_reconciliation_rules_insert on bank_reconciliation_rules
  for insert to authenticated
  with check (can_admin_company(company_id));

create policy bank_reconciliation_rules_update on bank_reconciliation_rules
  for update to authenticated
  using (can_admin_company(company_id))
  with check (can_admin_company(company_id));

create policy bank_reconciliation_rules_delete on bank_reconciliation_rules
  for delete to authenticated
  using (can_admin_company(company_id));

comment on table bank_reconciliation_rules is 'RLS: leitura can_read_company (qualquer papel vinculado vê as regras ativas, útil para entender uma sugestão automática); escrita can_admin_company — o comentário da própria função já lista "regras" explicitamente entre a configuração crítica que só OWNER/ADMIN do workspace ou ACCOUNTANT administram (ASSISTANT nunca administra, mesmo podendo operar conciliação manual). DELETE físico permitido aqui (diferente de chart_accounts/companies) porque uma regra é config auxiliar sem trilha histórica própria — desativar (active=false) é preferível, mas apagar uma regra criada por engano não compromete auditoria de lançamentos já gerados (que continuam intactos, independentes da regra).';
