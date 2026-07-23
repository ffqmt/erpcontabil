-- =====================================================================================
-- ERP CONTÁBIL — SCHEMA — v1.3 — BANCOS E CONCILIAÇÃO CONTÁBIL MVP (Etapa 18)
-- Migração incremental sobre erp_schema_v1_1.sql + erp_schema_v1_2_cadastros_base.sql.
-- Aditiva apenas — nenhuma tabela/coluna/constraint existente é removida ou renomeada.
-- =====================================================================================
--
-- DECISÃO DE MODELAGEM (a mais importante desta migração): `bank_statement_imports`,
-- `bank_statement_lines` e `bank_reconciliations` JÁ EXISTIAM desde erp_schema_v1_1.sql
-- (Bloco 9 — "Bancos & Conciliação"), inclusive já com RLS habilitada e policies escritas
-- em erp_rls_v1.sql. Esta migração NÃO cria essas 3 tabelas — apenas ESTENDE as duas
-- primeiras com as colunas que o fluxo de conciliação da Etapa 18 precisa e que ainda não
-- existiam. `bank_reconciliations` não precisa de nenhuma coluna nova: seu desenho
-- original (reconciled_at/reconciled_by/unreconciled_at/unreconciled_by referenciando
-- journal_entry_line_id) já é exatamente a trilha de auditoria de conciliação/
-- desconciliação que o MVP precisa — é usada como está.
--
-- Decisões específicas de reaproveitamento (detalhe em cada bloco abaixo):
--   - `bank_statement_lines.entry_date` (já existente) é usado no lugar de um novo
--     "statement_date" — mesmo conceito, não duplicar coluna.
--   - `bank_statement_lines.hash` (já existente, com unique(bank_account_id, hash)) é
--     usado no lugar de um novo "line_hash" — o comentário original da coluna já dizia
--     "empresa+conta+data+valor+descrição normalizada"; a Etapa 18 só passa a também
--     incorporar document_number no cálculo quando presente (ver actions.ts).
--   - `bank_statement_lines.journal_entry_line_id` (já existente, FK para a LINHA do
--     lançamento, não para o cabeçalho) é usado no lugar de um novo "journal_entry_id".
--     É mais preciso: identifica exatamente qual perna do lançamento representa o
--     movimento bancário. O cabeçalho (journal_entry) é obtido por join de um hop
--     (journal_entry_lines.journal_entry_id) nas queries da aplicação — não duplicamos a
--     referência para não arriscar desalinhamento entre as duas.
--   - `bank_statement_lines.reconciled` (boolean, já existente) é mantido por
--     compatibilidade estrutural, mas nenhum código novo o lê/escreve — o novo enum
--     `status` (PENDING/CLASSIFIED/RECONCILED/IGNORED/ERROR) é a fonte de verdade daqui
--     em diante. Ele é sincronizado (reconciled = true quando status = RECONCILED) só
--     para não deixar a coluna antiga "mentindo" caso algo externo ainda a consulte.
--   - `bank_statement_imports.status` (enum `import_status` já existente:
--     SUCCESS/WARNING/ERROR/PROCESSING) é reaproveitado no lugar de um novo enum
--     PROCESSED/PARTIAL/FAILED — mapeamento: PROCESSED->SUCCESS, PARTIAL->WARNING (teve
--     linhas inválidas/duplicadas), FAILED->ERROR. Evita um enum redundante.
--   - `bank_statement_imports.created_by` (já existente) cobre o papel de "imported_by" —
--     não duplicado.
-- =====================================================================================


-- =====================================================================================
-- BLOCO 1 — ENUM NOVO: status da linha de extrato
-- =====================================================================================
-- Não existe hoje nenhum enum equivalente — `bank_statement_lines.reconciled` era só um
-- boolean, insuficiente para distinguir PENDING/CLASSIFIED/IGNORED/ERROR, que a Etapa 18
-- precisa para o fluxo de trabalho de conciliação.

do $$
begin
  if not exists (select 1 from pg_type where typname = 'bank_statement_line_status') then
    create type bank_statement_line_status as enum ('PENDING', 'CLASSIFIED', 'RECONCILED', 'IGNORED', 'ERROR');
  end if;
end;
$$;
comment on type bank_statement_line_status is 'Estado de trabalho de uma linha de extrato bancário no fluxo de conciliação contábil (Etapa 18).';


-- =====================================================================================
-- BLOCO 2 — EXTENSÃO DE `bank_statement_imports`
-- =====================================================================================

alter table bank_statement_imports add column if not exists source text not null default 'CSV';
alter table bank_statement_imports add column if not exists total_lines int not null default 0;
alter table bank_statement_imports add column if not exists valid_lines int not null default 0;
alter table bank_statement_imports add column if not exists invalid_lines int not null default 0;
alter table bank_statement_imports add column if not exists duplicate_lines int not null default 0;
alter table bank_statement_imports add column if not exists notes text;
alter table bank_statement_imports add column if not exists updated_at timestamptz not null default now();

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'trg_bank_statement_imports_updated_at') then
    create trigger trg_bank_statement_imports_updated_at before update on bank_statement_imports
      for each row execute function set_updated_at();
  end if;
end;
$$;

comment on column bank_statement_imports.status is 'Reaproveita o enum import_status (SUCCESS/WARNING/ERROR/PROCESSING) já existente. Mapeamento da Etapa 18: PROCESSED(conceitual)->SUCCESS, PARTIAL(teve linha inválida/duplicada)->WARNING, FAILED->ERROR.';
comment on column bank_statement_imports.source is 'Origem do lote — "CSV" nesta etapa (MVP). Reservado para "OFX"/outros formatos futuros, sem exigir migração nova.';
comment on column bank_statement_imports.total_lines is 'Total de linhas presentes no arquivo/texto importado (válidas + inválidas + duplicadas).';


-- =====================================================================================
-- BLOCO 3 — EXTENSÃO DE `bank_statement_lines`
-- =====================================================================================

alter table bank_statement_lines add column if not exists document_number text;
alter table bank_statement_lines add column if not exists balance numeric(18,2);
alter table bank_statement_lines add column if not exists status bank_statement_line_status not null default 'PENDING';
alter table bank_statement_lines add column if not exists counterparty_account_id uuid references chart_accounts(id);
alter table bank_statement_lines add column if not exists partner_id uuid references partners(id);
alter table bank_statement_lines add column if not exists cost_center_id uuid references cost_centers(id);
alter table bank_statement_lines add column if not exists classification_memo text;
alter table bank_statement_lines add column if not exists error_message text;
alter table bank_statement_lines add column if not exists reconciled_at timestamptz;

-- Backfill: sincroniza o novo status a partir do boolean legado, para linhas que
-- porventura já existam de antes desta migração (nenhuma esperada em ambiente novo, mas
-- mantém o arquivo idempotente e seguro em qualquer ordem de aplicação).
update bank_statement_lines
set status = case when reconciled then 'RECONCILED'::bank_statement_line_status else 'PENDING'::bank_statement_line_status end
where status = 'PENDING'::bank_statement_line_status and reconciled = true;

comment on column bank_statement_lines.reconciled is 'LEGADO (pré-Etapa 18): mantido por compatibilidade estrutural, sincronizado com status=RECONCILED. Código novo deve ler/escrever a coluna "status", não esta.';
comment on column bank_statement_lines.status is 'Estado de trabalho no fluxo de conciliação: PENDING (importada, sem classificação) -> CLASSIFIED (contrapartida escolhida, sem lançamento ainda) -> RECONCILED (lançamento gerado/vinculado e conciliado) | IGNORED (descartada com justificativa) | ERROR (falhou na importação/parsing).';
comment on column bank_statement_lines.counterparty_account_id is 'Conta contábil de contrapartida escolhida na classificação manual — deve ser analítica, ativa e da mesma empresa (validado na Server Action, não por constraint de banco).';
comment on column bank_statement_lines.journal_entry_line_id is 'Referência à perna do lançamento contábil que representa este movimento bancário (não ao cabeçalho — ver decisão de modelagem no topo do arquivo). Preenchida quando status=RECONCILED.';

-- amount <> 0 é regra de negócio explícita da Etapa 18 (linha de extrato com valor zero é
-- inválida e não deve ser inserida — ver validação em csv-parser.ts). Constraint adicionada
-- como rede de segurança no banco, não só na aplicação.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'chk_bank_statement_lines_amount_nonzero'
  ) then
    alter table bank_statement_lines add constraint chk_bank_statement_lines_amount_nonzero
      check (amount <> 0);
  end if;
end;
$$;

create index if not exists idx_bank_statement_lines_company_status on bank_statement_lines (company_id, status);
create index if not exists idx_bank_statement_lines_bank_account_date on bank_statement_lines (bank_account_id, entry_date);
create index if not exists idx_bank_statement_lines_import on bank_statement_lines (bank_statement_import_id);


-- =====================================================================================
-- BLOCO 4 — RLS
-- =====================================================================================
-- Nenhuma policy nova é necessária. `bank_statement_imports`, `bank_statement_lines` e
-- `bank_reconciliations` já têm RLS habilitada e policies escritas em erp_rls_v1.sql
-- (SELECT via can_read_company, INSERT/UPDATE via can_write_company, sem DELETE) —
-- policies do Postgres se aplicam a TODA a linha, não por coluna, então adicionar colunas
-- a uma tabela existente não exige (nem permite) uma policy "por coluna nova". As colunas
-- adicionadas nesta migração já estão automaticamente cobertas pelas policies existentes.
-- Por isso não existe um arquivo erp_rls_v1_3_*.sql — não haveria nada para colocar nele.
