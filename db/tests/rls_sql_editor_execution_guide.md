# Guia de Execução Manual da Suíte de RLS no Supabase SQL Editor

Este guia descreve como executar a suíte de testes de isolamento e Row Level Security (RLS) do ERP Contábil diretamente na interface web do Supabase (SQL Editor), contornando a indisponibilidade local de ferramentas como Docker, Supabase CLI ou `psql`.

---

## ⚠️ ALERTA CRÍTICO: NÃO USE O BANCO DE PRODUÇÃO OU DESENVOLVIMENTO ATIVO

> [!CAUTION]
> **NUNCA execute esses testes no banco de dados de desenvolvimento principal ou em produção.**
> O script de teste de isolamento cria registros fictícios com UUIDs conhecidos, manipula variáveis globais de sessão para simular claims JWT e executa escritas que alteram configurações. Embora o arquivo utilize um bloco de transação com `ROLLBACK` no final, qualquer erro de colagem, falha de conexão no meio da execução ou interrupção de transação pode deixar dados de teste órfãos ou inconsistências nas permissões.

---

## 1. Preparação do Ambiente Descartável

1. Acesse o [painel do Supabase](https://supabase.com).
2. Crie um **projeto Supabase novo e descartável** (plano gratuito) exclusivamente para esta validação.
3. Aguarde o provisionamento completo do banco de dados.

---

## 2. Ordem de Aplicação das Camadas SQL

Como o **Supabase SQL Editor** é uma interface web, ele **NÃO suporta comandos internos do psql como `\i` ou `\copy`**. Você deve copiar e colar o conteúdo dos arquivos SQL manualmente, na ordem exata indicada abaixo.

### Etapa 2.1: Estruturação do Schema
Abra uma aba no SQL Editor e execute o conteúdo dos arquivos de schema nesta ordem:
1. Cole o conteúdo de [erp_schema_v1_1.sql](file:///C:/Users/peace/OneDrive/Área de Trabalho/SELA SISTEM/erp_schema_v1_1.sql) e clique em **Run**.
2. Cole o conteúdo de [db/migrations/erp_schema_v1_2_cadastros_base.sql](file:///C:/Users/peace/OneDrive/Área de Trabalho/SELA SISTEM/db/migrations/erp_schema_v1_2_cadastros_base.sql) e clique em **Run**.
3. Cole o conteúdo de [db/migrations/erp_schema_v1_3_bank_reconciliation_mvp.sql](file:///C:/Users/peace/OneDrive/Área de Trabalho/SELA SISTEM/db/migrations/erp_schema_v1_3_bank_reconciliation_mvp.sql) e clique em **Run**.
4. Cole o conteúdo de [db/migrations/erp_schema_v1_4_fiscal_tax_assets.sql](file:///C:/Users/peace/OneDrive/Área de Trabalho/SELA SISTEM/db/migrations/erp_schema_v1_4_fiscal_tax_assets.sql) e clique em **Run**.
5. Cole o conteúdo de [db/migrations/erp_schema_v1_5_tax_credits.sql](file:///C:/Users/peace/OneDrive/Área de Trabalho/SELA SISTEM/db/migrations/erp_schema_v1_5_tax_credits.sql) e clique em **Run**.

### Etapa 2.2: Aplicação das Regras de Segurança (RLS)
Na mesma aba ou em uma nova, cole e execute os arquivos de políticas de segurança na ordem abaixo:
1. Cole o conteúdo de [erp_rls_v1.sql](file:///C:/Users/peace/OneDrive/Área de Trabalho/SELA SISTEM/erp_rls_v1.sql) e clique em **Run**.
2. Cole o conteúdo de [db/migrations/erp_rls_v1_2_cadastros_base.sql](file:///C:/Users/peace/OneDrive/Área de Trabalho/SELA SISTEM/db/migrations/erp_rls_v1_2_cadastros_base.sql) e clique em **Run**.
3. Cole o conteúdo de [db/migrations/erp_rls_v1_4_fiscal_tax_assets.sql](file:///C:/Users/peace/OneDrive/Área de Trabalho/SELA SISTEM/db/migrations/erp_rls_v1_4_fiscal_tax_assets.sql) e clique em **Run**.

*(Nota: As políticas de RLS das migrations v1.3 e v1.5 estão cobertas pelas policies existentes ou não exigiram novas regras, ver cabeçalhos dos arquivos).*

### Etapa 2.3: Execução da Suíte de Testes
Abra uma nova aba no SQL Editor:
1. Copie todo o conteúdo de [db/tests/rls_isolation_tests.sql](file:///C:/Users/peace/OneDrive/Área de Trabalho/SELA SISTEM/db/tests/rls_isolation_tests.sql).
2. Cole no editor e clique em **Run**.

---

## 3. Como Interpretar os Resultados

Ao executar o script de teste, leia a aba de logs/saídas do SQL Editor:

### Resultado Esperado (Sucesso)
A transação deve rodar inteira e terminar com `ROLLBACK`. A saída de logs deve terminar com as seguintes mensagens de `NOTICE`:
```text
NOTICE: OK: ... (inúmeras linhas)
NOTICE: =====================================================================================
NOTICE:   TODOS OS CENÁRIOS DE ISOLAMENTO E RLS PASSARAM SEM FALHAS.
NOTICE:   Nenhum dado foi persistido — esta transação termina com ROLLBACK.
NOTICE: =====================================================================================
```

### Resultado de Falha
Se alguma asserção falhar, o script interromperá a execução imediatamente com um erro PL/pgSQL:
```text
ERROR: FALHA: Cenário X.Y: <descrição do que era esperado>
```
* **Caso a falha ocorra em um assert de gravação bloqueada**: Isso significa que a RLS falhou em bloquear um acesso indevido.
* **Caso a falha seja um erro cru do Postgres**: A política bloqueou uma operação legítima. A mensagem de erro cru informará qual policy causou a rejeição.

### Como Copiar o Log de Erro
Se o teste falhar:
1. Selecione todo o texto do painel de console/erros no SQL Editor.
2. Salve em um arquivo de texto para que possamos analisar qual policy ou cenário quebrou a integridade.
