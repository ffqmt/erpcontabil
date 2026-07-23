-- =====================================================================================
-- ERP CONTÁBIL — SCHEMA — v1.7 — ETAPA 32B — FUNDAÇÃO PARA IMPORTAÇÃO DE XML DE NF-e DE
-- ENTRADA. Migração incremental sobre v1.6. Aditiva apenas — nenhuma tabela/coluna/
-- constraint existente é removida ou renomeada.
-- =====================================================================================
--
-- BLOCO 1 — partners.document_normalized: coluna GERADA (nunca escrita diretamente,
--   sempre derivada de `document`) contendo só os dígitos do CPF/CNPJ, usada para casar
--   "12.345.678/0001-95" com "12345678000195" sem duplicar parceiro. NULL quando `document`
--   é nulo/vazio (não força unicidade para parceiros sem documento).
-- BLOCO 2 — auditoria de duplicidades ANTES de tentar criar o índice único: roda como
--   consulta de diagnóstico (aparece no painel de resultados do SQL Editor) — não apaga,
--   não mescla, não decide nada sozinho. Se houver duplicidade, o índice único do Bloco 3
--   não é criado (fica documentado via RAISE NOTICE) até a usuária decidir manualmente o
--   que fazer com os parceiros duplicados.
-- BLOCO 3 — índice único condicional (só cria se a auditoria do Bloco 2 não achou duplicata).
-- BLOCO 4 — fiscal_xml_imports: trilha de auditoria de toda tentativa de importação de XML
--   (inclusive rejeitadas/duplicadas), com RLS própria (mesmo padrão can_read_company/
--   can_write_company usado em bank_statement_imports desde a Etapa 18).
-- =====================================================================================


-- =====================================================================================
-- BLOCO 1 — partners.document_normalized (coluna gerada)
-- =====================================================================================

alter table partners add column if not exists document_normalized text
  generated always as (nullif(regexp_replace(coalesce(document, ''), '\D', '', 'g'), '')) stored;

comment on column partners.document_normalized is 'Etapa 32B: CPF/CNPJ só com dígitos, derivado automaticamente de "document" (nunca escrito diretamente). NULL quando document é nulo/vazio/só-pontuação — não força unicidade de parceiros sem documento. Usado por resolveOrCreatePartnerFromXmlAction para casar "12.345.678/0001-95" com "12345678000195" sem duplicar.';


-- =====================================================================================
-- BLOCO 2 — Auditoria de duplicidades existentes (SÓ DIAGNÓSTICO — não corrige nada)
-- =====================================================================================
-- Esta consulta aparece nos resultados do SQL Editor ao rodar a migração. Se retornar
-- linhas, há parceiros duplicados por documento normalizado HOJE — decisão de mesclar ou
-- inativar um deles é manual, da usuária, nunca automática.

select
  company_id,
  document_normalized,
  count(*) as duplicate_count,
  array_agg(id order by created_at) as partner_ids,
  array_agg(name order by created_at) as partner_names
from partners
where document_normalized is not null
group by company_id, document_normalized
having count(*) > 1;


-- =====================================================================================
-- BLOCO 3 — Índice único condicional (company_id, document_normalized)
-- =====================================================================================
-- Só cria o índice se NÃO houver duplicidade hoje (a consulta do Bloco 2 acima decide).
-- Se houver duplicidade, a migração continua (Bloco 4 roda normalmente) mas o índice único
-- fica pendente — rode esta migração de novo depois de resolver as duplicidades
-- manualmente (é idempotente: "if not exists" já cobre o caso de sucesso repetido).

do $$
declare
  v_dup_count int;
begin
  select count(*) into v_dup_count
  from (
    select company_id, document_normalized
    from partners
    where document_normalized is not null
    group by company_id, document_normalized
    having count(*) > 1
  ) dups;

  if v_dup_count > 0 then
    raise notice 'ATENÇÃO: % grupo(s) de parceiros duplicados por documento encontrados (ver resultado do SELECT acima). Índice único NÃO criado — resolva as duplicidades manualmente e rode esta migração de novo.', v_dup_count;
  else
    if not exists (select 1 from pg_indexes where indexname = 'uq_partners_company_document_normalized') then
      create unique index uq_partners_company_document_normalized
        on partners (company_id, document_normalized)
        where document_normalized is not null;
      raise notice 'OK: índice único uq_partners_company_document_normalized criado — nenhuma duplicidade encontrada.';
    else
      raise notice 'OK: índice único uq_partners_company_document_normalized já existia.';
    end if;
  end if;
end;
$$;


-- =====================================================================================
-- BLOCO 4 — fiscal_xml_imports (trilha de auditoria de importação de XML)
-- =====================================================================================

create table if not exists fiscal_xml_imports (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete restrict,
  company_id uuid not null references companies(id) on delete restrict,
  fiscal_document_id uuid references fiscal_documents(id),
  file_name text,
  xml_raw text,
  access_key text,
  import_hash text,
  import_status text not null default 'PENDING_REVIEW'
    check (import_status in ('PENDING_REVIEW', 'CONFIRMED', 'REJECTED', 'DUPLICATE', 'ERROR')),
  parse_errors jsonb,
  parsed_preview jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id)
);
comment on table fiscal_xml_imports is 'Etapa 32B: trilha de auditoria de CADA tentativa de importação de XML fiscal (mesmo rejeitada/duplicada/com erro) — mesmo padrão de bank_statement_imports (Etapa 18). fiscal_document_id só é preenchido quando import_status=CONFIRMED (documento efetivamente gravado).';
comment on column fiscal_xml_imports.import_hash is 'Hash do XML bruto (dedup quando access_key não pôde ser extraída) — mesmo padrão de fiscal_documents.import_hash (uq_fiscal_documents_import_hash, erp_schema_v1_1.sql).';
comment on column fiscal_xml_imports.parsed_preview is 'Snapshot JSON do que foi extraído do XML (cabeçalho + itens + tributos) no momento da importação — auditoria independente do estado atual de fiscal_documents, que pode ser editado depois.';

create trigger trg_fiscal_xml_imports_updated_at before update on fiscal_xml_imports
  for each row execute function set_updated_at();

create index if not exists idx_fiscal_xml_imports_company on fiscal_xml_imports (company_id, created_at desc);
create unique index if not exists uq_fiscal_xml_imports_access_key on fiscal_xml_imports (company_id, access_key)
  where access_key is not null and import_status = 'CONFIRMED';

alter table fiscal_xml_imports enable row level security;

create policy fiscal_xml_imports_select on fiscal_xml_imports
  for select to authenticated
  using (can_read_company(company_id));

create policy fiscal_xml_imports_insert on fiscal_xml_imports
  for insert to authenticated
  with check (can_write_company(company_id));

create policy fiscal_xml_imports_update on fiscal_xml_imports
  for update to authenticated
  using (can_write_company(company_id))
  with check (can_write_company(company_id));

comment on table fiscal_xml_imports is 'RLS: leitura/escrita can_read_company/can_write_company, mesmo padrão de bank_statement_imports. Sem DELETE (trilha de auditoria não deve ser apagável) — mesmo padrão de fiscal_documents/companies.';
