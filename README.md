# Sela Sistem — ERP Modular

ERP modular construído em Next.js App Router + Supabase/PostgreSQL, com o módulo Contábil como base e roadmap para Cadastros Base, Fiscal/Tributário, Financeiro, Patrimônio, Departamento Pessoal/Folha, Obrigações/Exportações e integração final de autenticação/RLS (Francoos).

Consulte `DEVELOPMENT_LOG.md` para o histórico detalhado de cada etapa, `docs/audit-accounting-mvp.md` para a auditoria técnica/contábil do MVP, e `docs/erp-master-plan.md` para o plano mestre atualizado (estado por módulo, trilha técnica de schema/RLS, riscos e roadmap).

## Stack

- Next.js (App Router, Turbopack) + React
- Supabase (PostgreSQL, Auth, RLS)
- Tailwind CSS
- Zod (validação de Server Actions)

## Como rodar

```bash
npm install
npm run dev
```

Abra [http://localhost:3000](http://localhost:3000).

Configure um `.env.local` com base em `db/README.md` (variáveis `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` e as `DEV_*` de contexto fixo de desenvolvimento).

## Banco de dados

Ordem de aplicação dos scripts SQL (ver `db/README.md` para detalhes):

1. `erp_schema_v1_1.sql`
2. `db/seed/seed_demo_accounting.sql`
3. `db/migrations/erp_schema_v1_2_cadastros_base.sql`
4. `db/seed/seed_demo_base_registrations.sql`
5. `erp_rls_v1.sql` + `db/migrations/erp_rls_v1_2_cadastros_base.sql` (opcional no MVP em modo dev)

## Build

```bash
npm run build
```
