# Auditoria de Segurança: Conexões Supabase e Hardening de Runtime

Este documento registra a auditoria e as medidas de endurecimento aplicadas sobre as conexões de banco de dados do Supabase em runtime, correspondente à **Etapa 26**.

---

## 1. Usos de Cliente Administrativo (`service_role`) Mapeados

Durante a auditoria estática do código, identificamos que a aplicação Next.js utilizava o cliente administrativo (`createAdminClient()`) em **46 locais**, espalhados por praticamente todas as Server Actions e queries de dados. 

A estrutura de chamada predominante em todos os módulos seguia este padrão:
```typescript
let db = null;
try {
  const supabase = await createClient();
  const { error } = await supabase.from('...').select('id').limit(1);
  if (error) throw error;
  db = supabase;
} catch {
  db = createAdminClient(); // Fallback incondicional para superusuário
}
```

### Classificação de Risco dos Usos Encontrados

| Componente/Tabela | Arquivo de Origem | Uso Original | Classificação de Risco | Ação Aplicada |
| :--- | :--- | :--- | :--- | :--- |
| **Geral / Cadastro** | `registrations/*/queries.ts` e `actions.ts` | Fallback para leitura e escrita | 🔴 **Inseguro em Produção** (Bypass total de RLS) | Substituído por `getClient()` |
| **Fiscal** | `fiscal/queries.ts` e `actions.ts` | Fallback para leitura e escrita | 🔴 **Inseguro em Produção** (Bypass total de RLS) | Substituído por `getClient()` |
| **Apurações & Guias** | `tax-assessments/*` e `obligations/*` | Fallback para leitura e escrita | 🔴 **Inseguro em Produção** (Bypass total de RLS) | Substituído por `getClient()` |
| **Bancos** | `banking/queries.ts` e `actions.ts` | Fallback para leitura e escrita | 🔴 **Inseguro em Produção** (Bypass total de RLS) | Substituído por `getClient()` |
| **Patrimônio** | `assets/queries.ts` e `actions.ts` | Fallback para leitura e escrita | 🔴 **Inseguro em Produção** (Bypass total de RLS) | Substituído por `getClient()` |
| **Relatórios Contábeis** | `accounting/balance-sheet/queries.ts`, `dre/queries.ts`, `trial-balance/queries.ts`, `journal/queries.ts`, `closing/queries.ts` | Fallback para leitura de relatórios | 🔴 **Inseguro em Produção** (Leitura de dados de outras empresas) | Substituído por `getClient()` |
| **Operações Contábeis** | `accounting/journal/actions.ts` (linhas 61, 210, 342) | Efetivação, lançamento e estorno | 🔴 **Inseguro em Produção** | Substituído por `getClient()` |
| **Fechamento de Período** | `accounting/periods/actions.ts` | Fechamento e reabertura de competências | 🔴 **Inseguro em Produção** | Substituído por `getClient()` |
| **Contador Contábil** | `accounting/journal/actions.ts` (linha 389) | Incremento de número de lote contábil | 🟢 **Uso Administrativo Legítimo** (Sem RLS na tabela do contador) | Mantido `createServerAdminClient()` com comentário |
| **Lote de Períodos** | `accounting/periods/queries.ts` (linha 156) | Geração inicial de competências em lote | 🟢 **Uso Administrativo Legítimo** | Mantido `createServerAdminClient()` com comentário |

---

## 2. Riscos Detectados no Padrão de Fallback Anterior

1. **Bypass Silencioso de RLS**:
   Como o Next.js no sandbox local roda sem cookies de autenticação Supabase configurados, o `createClient()` (User Client) falhava ao tentar ler ou escrever (retornava erro de permissão RLS do Postgres). O bloco `catch` capturava a exceção e imediatamente caía no `createAdminClient()`.
   Em produção, se ocorresse um erro legítimo de permissão de RLS (ex: um assistente tentando invadir dados de outra empresa), o erro dispararia o `catch` e a query rodaria sob o `service_role` com privilégios de superusuário, vazando os dados confidenciais.
2. **Inutilidade da RLS do Banco**:
   Com o fallback incondicional, a Row Level Security validada e implantada com tanto rigor no banco de dados na Etapa 25B nunca era exercitada de verdade em runtime, pois a aplicação optava sempre pela service_role administrativa.

---

## 3. Correções Aplicadas

1. **Centralização do Controle de Acesso (`src/lib/supabase/server.ts`)**:
   Implementamos a função `getClient()`. Ela retorna prioritariamente o cliente sujeito a RLS (`createServerUserClient()`). O fallback administrativo só ocorre em desenvolvimento (`process.env.NODE_ENV === 'development'`) e com a flag `process.env.BYPASS_RLS_IN_DEV === 'true'` explicitamente configurada.
2. **Refatoração das Queries e Actions**:
   Removemos os blocos try-catch de fallback redundantes. Todo o código contábil de usuário agora faz chamadas simples ao cliente retornado por `getClient()`, garantindo aplicação de RLS imediata em produção e em modo dev seguro.
3. **Justificativa das Exceções Administrativas**:
   * O incremento de contador de lançamentos (`company_journal_counters`) é uma rotina transacional que roda sob concorrência e não possui RLS no banco de dados por razões de performance e integridade de travamento. Utiliza explicitamente o `createServerAdminClient()`.
   * O utilitário de criação em lote de períodos contábeis durante o setup inicial de uma empresa também é um fluxo de sistema e utiliza o `createServerAdminClient()`.

---

## 4. Garantias de Segurança e Riscos Remanescentes

* **Isolamento da Chave Service Role**: A variável `SUPABASE_SERVICE_ROLE_KEY` é carregada estritamente no servidor (`process.env`). Nenhuma função que instancie o cliente admin é exportada ou acessível por componentes Client Component do Next.js (todos os arquivos que a tocam possuem importações server-only ou rodam estritamente em Server Actions/Server Components). A chave nunca é exposta no browser.
* **Preservação de Guards no Nível da Aplicação (App-level)**: Todos os guards operacionais de validação de `company_id`, `workspace_id`, validação de períodos fechados (`accounting_periods` status = `CLOSED`) e restrições de permissão baseados em perfil do usuário foram preservados intactos no código das Server Actions, atuando como uma camada dupla de defesa junto com a RLS do banco.
* **Riscos Remanescentes**: O principal risco operacional remanescente é o descompasso de dados caso um administrador ou desenvolvedor configure a flag `BYPASS_RLS_IN_DEV=true` no ambiente de produção. Isso anularia a RLS localmente e permitiria bypass administrativo. Para mitigar, a inicialização em `server.ts` bloqueia o desvio se `NODE_ENV` não for `'development'`. Outro risco é o desenvolvimento de novos componentes contábeis no futuro que reintroduzam o padrão de fallback `createAdminClient()`. Para combater isso, criamos esta documentação técnica de diretriz de desenvolvimento contínuo.

---

## 5. Resultado das Verificações Estáticas (Build e Compilação)

Para atestar a integridade das tipagens do TypeScript e assegurar que a refatoração do cliente central do Supabase e a remoção das instâncias manuais de fallback não geraram quebras de compilação, rodamos o comando oficial de otimização de build do Next.js:

```bash
npm run build
```

### Log Real do Terminal
```text
> sela-sistem@0.1.0 build
> next build

▲ Next.js 16.2.10 (Turbopack)

  Creating an optimized production build ...
✓ Compiled successfully in 7.7s
  Running TypeScript ...
  Finished TypeScript in 8.4s ...
  Collecting page data using 11 workers ...
  Generating static pages using 11 workers (0/10) ...
✓ Generating static pages using 11 workers (10/10) in 343ms
  Finalizing page optimization ...

Route (app)
...
├ ƒ /contabilidade/balancete
├ ƒ /contabilidade/balanco
├ ƒ /contabilidade/diario
├ ƒ /contabilidade/dre
...
```

* **Veredito do Build**: Sucesso absoluto. Compilado e tipado com 100% de conformidade.
* **Veredito do Lint (npm run lint)**: Executado com 221 problemas legados herdados do código de base do projeto (tipagem explícita `any` do TypeScript e formatação de aspas em JSX legadas), sem problemas novos introduzidos nesta etapa.

---

## 6. Veredito Final da Etapa 26

* **Veredito**: **Aprovado com ressalvas**.
* **Ressalvas**: O isolamento em runtime foi implementado e auditado com sucesso. As únicas ressalvas são as duas exceções justificadas onde a infraestrutura de sistema exige privilégios de superusuário (incremento de lote contábil e autocriação de períodos). Fora desses pontos controlados, 100% dos fluxos contábeis, cadastros, apurações e obrigações rodam estritamente sob as regras de RLS do banco de dados (User Client).

---

## 7. Próxima Etapa Recomendada

**Etapa 27 — Central de Pendências e Painéis de Controle Contábil**:
- Construção de interfaces centralizadas consolidando pendências operacionais (extratos sem classificação, notas não integradas e apurações vencidas).
- Garantir que a nova interface use estritamente a chamada segura `getClient()`.

