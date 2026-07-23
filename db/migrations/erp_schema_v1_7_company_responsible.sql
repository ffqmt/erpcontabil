-- =====================================================================================
-- ERP CONTÁBIL — ADIÇÃO DE CAMPOS DE RESPONSÁVEL LEGAL / ASSINATURA — v1.7
-- =====================================================================================
-- Adiciona campos na tabela companies para alimentar a assinatura dinâmica dos relatórios.
-- =====================================================================================

BEGIN;

ALTER TABLE public.companies
ADD COLUMN IF NOT EXISTS responsible_name text,
ADD COLUMN IF NOT EXISTS responsible_cpf text,
ADD COLUMN IF NOT EXISTS responsible_role text,
ADD COLUMN IF NOT EXISTS responsible_crc text;

COMMENT ON COLUMN public.companies.responsible_name IS 'Nome do responsável legal / administrador';
COMMENT ON COLUMN public.companies.responsible_cpf IS 'CPF do responsável';
COMMENT ON COLUMN public.companies.responsible_role IS 'Cargo ou função do responsável (ex: Administrador, Diretor)';
COMMENT ON COLUMN public.companies.responsible_crc IS 'Registro do contador no CRC (se aplicável)';

COMMIT;
