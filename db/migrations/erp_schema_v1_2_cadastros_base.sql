-- =====================================================================================
-- ERP CONTÁBIL — SCHEMA — v1.2 — CADASTROS BASE COMPARTILHADOS (Etapa 15)
-- Migração incremental sobre erp_schema_v1_1.sql. Aditiva apenas: nenhuma tabela, coluna
-- ou constraint existente é removida ou renomeada. Idempotente (IF NOT EXISTS em toda
-- tabela/coluna/índice; enums criados com guarda via DO block).
-- =====================================================================================
-- Escopo: Parceiros (extensão de `partners` já existente), Produtos/Serviços (`items`,
-- nova), Naturezas Fiscais (`fiscal_operation_natures`, nova), Contas Bancárias (extensão
-- de `bank_accounts` já existente), Municípios/UF (`states`/`municipalities`, novas,
-- catálogo de referência global — não multiempresa).
--
-- DECISÕES DE MODELAGEM (ver também item 8 da entrega da Etapa 15):
--   - `partners` JÁ EXISTIA (erp_schema_v1_1.sql) com partner_type text (CUSTOMER/
--     SUPPLIER/EMPLOYEE/OTHER — papel único). Em vez de substituir, adicionamos colunas
--     booleanas de papel (is_customer/is_supplier/is_carrier/is_employee) que permitem
--     múltiplos papéis simultâneos (ex.: cliente E transportadora). `partner_type` é
--     mantido por compatibilidade com o seed/lançamentos existentes, mas passa a ser
--     informativo/legado — o código novo lê e escreve as colunas booleanas.
--   - `bank_accounts` JÁ EXISTIA com chart_account_id NOT NULL (toda conta bancária
--     operacional precisa de uma conta do plano de contas correspondente — mantido como
--     está, é a âncora que bank_statement_imports/bank_reconciliations já assumem).
--     Adicionamos apenas colunas cadastrais extras (bank_code, account_digit,
--     account_type, holder_name, holder_document, opening_balance).
--   - `states`/`municipalities` são catálogo de referência GLOBAL (sem workspace_id/
--     company_id): geografia brasileira não muda por tenant. `partners.city`/`state`
--     continuam como texto livre (mesmo padrão já usado em `companies`/`establishments`)
--     — os seletores de UF/Município apenas preenchem esses campos de texto a partir do
--     catálogo, sem exigir integridade referencial rígida (nem todo município do Brasil
--     está seedado nesta etapa).
--   - `items` e `fiscal_operation_natures` são tabelas novas, tenant-owned (workspace_id +
--     company_id), seguindo exatamente o mesmo padrão de auditoria/soft-delete das demais
--     tabelas do schema (created_at/updated_at/created_by/updated_by/deleted_at,
--     trigger set_updated_at, unique (company_id, code)).
-- =====================================================================================


-- =====================================================================================
-- BLOCO 1 — ENUMS NOVOS
-- =====================================================================================

do $$
begin
  if not exists (select 1 from pg_type where typname = 'item_type') then
    create type item_type as enum ('PRODUCT', 'SERVICE', 'BOTH');
  end if;
end;
$$;
comment on type item_type is 'Classificação do item de cadastro: produto, serviço ou ambos.';

-- Nome deliberadamente distinto de "fiscal_direction" (já existente, usado em
-- fiscal_documents para o sentido de UM documento concreto: sempre IN ou OUT). Uma
-- natureza de operação é uma DEFINIÇÃO cadastral que pode se aplicar às duas direções
-- (ex.: "Devolução"), por isso precisa do valor BOTH que fiscal_direction não tem.
do $$
begin
  if not exists (select 1 from pg_type where typname = 'fiscal_nature_direction') then
    create type fiscal_nature_direction as enum ('INBOUND', 'OUTBOUND', 'BOTH');
  end if;
end;
$$;
comment on type fiscal_nature_direction is 'Direção de aplicação de uma natureza fiscal cadastral: entrada, saída ou ambas. Distinto de fiscal_direction (que descreve o sentido de um documento fiscal concreto, sempre IN ou OUT).';

do $$
begin
  if not exists (select 1 from pg_type where typname = 'bank_account_type') then
    create type bank_account_type as enum ('CHECKING', 'SAVINGS', 'CASH', 'INVESTMENT');
  end if;
end;
$$;
comment on type bank_account_type is 'Tipo cadastral da conta bancária: corrente, poupança, caixa (numerário físico) ou investimento.';


-- =====================================================================================
-- BLOCO 2 — CATÁLOGO GLOBAL DE REFERÊNCIA: ESTADOS & MUNICÍPIOS
-- =====================================================================================
-- Sem workspace_id/company_id: geografia é compartilhada por todos os tenants. RLS
-- (bloco separado erp_rls_v1_2) permite apenas SELECT para authenticated; escrita fica
-- restrita a service_role/migrações — não há Server Action de criar estado/município.

create table if not exists states (
  id uuid primary key default gen_random_uuid(),
  uf char(2) not null unique,
  name text not null,
  ibge_code text,
  created_at timestamptz not null default now()
);
comment on table states is 'Catálogo de referência global de Unidades Federativas (não multiempresa).';

create table if not exists municipalities (
  id uuid primary key default gen_random_uuid(),
  state_id uuid not null references states(id) on delete restrict,
  uf char(2) not null,
  name text not null,
  ibge_code text,
  created_at timestamptz not null default now(),
  unique (uf, name)
);
comment on table municipalities is 'Catálogo de referência global de municípios (não multiempresa). Seed mínimo nesta etapa — não é obrigatório para cadastrar um parceiro (city/state em partners permanecem texto livre).';

create index if not exists idx_municipalities_state_id on municipalities (state_id);


-- =====================================================================================
-- BLOCO 3 — EXTENSÃO DE `partners` (Pessoas/Parceiros)
-- =====================================================================================

alter table partners add column if not exists legal_name text;
alter table partners add column if not exists trade_name text;
alter table partners add column if not exists document_type text check (document_type in ('CPF', 'CNPJ'));
alter table partners add column if not exists email text;
alter table partners add column if not exists phone text;
alter table partners add column if not exists state_registration text;
alter table partners add column if not exists municipal_registration text;
alter table partners add column if not exists address text;
alter table partners add column if not exists city text;
alter table partners add column if not exists state char(2);
alter table partners add column if not exists zip_code text;
alter table partners add column if not exists notes text;
alter table partners add column if not exists is_customer boolean not null default false;
alter table partners add column if not exists is_supplier boolean not null default false;
alter table partners add column if not exists is_carrier boolean not null default false;
alter table partners add column if not exists is_employee boolean not null default false;

comment on column partners.partner_type is 'LEGADO (pré-Etapa 15): papel único do parceiro. Mantido só por compatibilidade com dados/relatórios existentes — cadastros novos devem usar as colunas booleanas is_customer/is_supplier/is_carrier/is_employee, que permitem múltiplos papéis simultâneos.';
comment on column partners.is_customer is 'Papel: parceiro atua como cliente.';
comment on column partners.is_supplier is 'Papel: parceiro atua como fornecedor.';
comment on column partners.is_carrier is 'Papel: parceiro atua como transportadora.';
comment on column partners.is_employee is 'Papel: parceiro é colaborador (uso futuro pelo módulo de Folha/DP).';

-- Backfill: propaga o partner_type legado (dados já existentes no seed contábil) para as
-- novas colunas booleanas, evitando que registros antigos fiquem sem nenhum papel marcado.
update partners set is_customer = true where partner_type = 'CUSTOMER' and not is_customer;
update partners set is_supplier = true where partner_type = 'SUPPLIER' and not is_supplier;
update partners set is_employee = true where partner_type = 'EMPLOYEE' and not is_employee;

-- Exige pelo menos um papel marcado (regra de negócio pedida na Etapa 15). Aplicada
-- depois do backfill acima para não quebrar em cima de dados existentes.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'chk_partners_at_least_one_role'
  ) then
    alter table partners add constraint chk_partners_at_least_one_role
      check (is_customer or is_supplier or is_carrier or is_employee);
  end if;
end;
$$;


-- =====================================================================================
-- BLOCO 4 — EXTENSÃO DE `bank_accounts` (Contas Bancárias)
-- =====================================================================================

alter table bank_accounts add column if not exists bank_code text;
alter table bank_accounts add column if not exists account_digit text;
alter table bank_accounts add column if not exists account_type bank_account_type not null default 'CHECKING';
alter table bank_accounts add column if not exists holder_name text;
alter table bank_accounts add column if not exists holder_document text;
alter table bank_accounts add column if not exists opening_balance numeric(18,2);

comment on column bank_accounts.chart_account_id is 'Obrigatório (mantido da v1.1): toda conta bancária operacional precisa de uma conta correspondente no plano de contas — é a âncora usada por bank_statement_imports/bank_reconciliations.';


-- =====================================================================================
-- BLOCO 5 — TABELA NOVA: `items` (Produtos/Serviços)
-- =====================================================================================

create table if not exists items (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete restrict,
  company_id uuid not null references companies(id) on delete restrict,
  code text not null,
  name text not null,
  description text,
  item_type item_type not null default 'SERVICE',
  unit text,
  ncm text,
  service_code text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id),
  deleted_at timestamptz,
  unique (company_id, code)
);
comment on table items is 'Cadastro estrutural de produtos/serviços. Sem estoque, sem preço, sem tributação calculada — apenas os campos de referência (NCM/código de serviço) que os módulos Fiscal/Financeiro futuros vão consumir.';

create trigger trg_items_updated_at before update on items
  for each row execute function set_updated_at();


-- =====================================================================================
-- BLOCO 6 — TABELA NOVA: `fiscal_operation_natures` (Naturezas Fiscais Básicas)
-- =====================================================================================

create table if not exists fiscal_operation_natures (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete restrict,
  company_id uuid not null references companies(id) on delete restrict,
  code text not null,
  name text not null,
  direction fiscal_nature_direction not null,
  description text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id),
  deleted_at timestamptz,
  unique (company_id, code)
);
comment on table fiscal_operation_natures is 'Cadastro estrutural de naturezas de operação fiscal (ex.: venda de mercadoria, prestação de serviço, compra para uso/consumo). Sem cálculo de imposto, sem CFOP/CST completo — apenas a referência cadastral que o módulo Fiscal futuro vai consumir.';

create trigger trg_fiscal_operation_natures_updated_at before update on fiscal_operation_natures
  for each row execute function set_updated_at();


-- =====================================================================================
-- BLOCO 7 — RLS: HABILITAÇÃO NAS TABELAS NOVAS (policies ficam em erp_rls_v1_2, opcional)
-- =====================================================================================
-- Mesmo padrão de erp_schema_v1_1.sql: habilita RLS sem nenhuma policy ainda — enquanto
-- erp_rls_v1_2_cadastros_base.sql não for aplicado, authenticated/anon ficam bloqueados
-- e o Admin Client (service_role) continua funcionando normalmente em modo dev.

alter table states enable row level security;
alter table municipalities enable row level security;
alter table items enable row level security;
alter table fiscal_operation_natures enable row level security;


-- =====================================================================================
-- BLOCO 8 — REATAÇÃO DO TRIGGER GENÉRICO fn_prevent_tenant_change (só se RLS v1 já rodou)
-- =====================================================================================
-- fn_prevent_tenant_change() foi criada em erp_rls_v1.sql (não neste arquivo). Se essa
-- migração já foi aplicada no ambiente, reanexamos o mesmo trigger às tabelas tenant-owned
-- novas (items, fiscal_operation_natures) — states/municipalities são catálogo global,
-- sem company_id/workspace_id, então não se aplicam. Se erp_rls_v1.sql ainda não foi
-- aplicado neste ambiente, este bloco é ignorado silenciosamente (nada quebra).

do $$
begin
  if exists (select 1 from pg_proc where proname = 'fn_prevent_tenant_change') then
    execute 'drop trigger if exists trg_items_prevent_tenant_change on items';
    execute 'create trigger trg_items_prevent_tenant_change before update on items for each row execute function fn_prevent_tenant_change()';

    execute 'drop trigger if exists trg_fiscal_operation_natures_prevent_tenant_change on fiscal_operation_natures';
    execute 'create trigger trg_fiscal_operation_natures_prevent_tenant_change before update on fiscal_operation_natures for each row execute function fn_prevent_tenant_change()';
  end if;
end;
$$;
