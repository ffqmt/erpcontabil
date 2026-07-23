# Etapas 34A e 34B - IRPJ/CSLL e Baixa Patrimonial

Data: 2026-07-13

## Contexto

Continuação da implementação fiscal-contábil após a queda da sessão anterior. O objetivo foi validar e finalizar a Etapa 34A, corrigir erros de build, implementar a Etapa 34B caso ainda estivesse pendente, rodar build final e atualizar a documentação.

## 34A - IRPJ/CSLL

Já havia sido criada a migration `db/migrations/erp_schema_v2_0_etapa34a_irpj_csll.sql`, com `IRPJ`/`CSLL` no enum `tax_type`, `tax_regime_rates` e `tax_assessment_adjustments`.

Validação e ajustes realizados:

- Corrigido build quebrado por import duplicado de `Percent` em `src/components/app-shell/sidebar.tsx`.
- Validado que a tela `/fiscal/configuracoes-tributarias`, as actions de alíquotas e o painel de ajustes de Lucro Real estavam presentes.
- Corrigido o cálculo de Lucro Real em `calculateIncomeTaxAssessmentAction`: o resultado contábil agora usa `calculateDre(...).operatingProfit`, evitando inversão manual incorreta de sinal.
- Mantido o bloqueio explícito para empresas no Simples Nacional, sem usar alíquotas hardcoded.

## 34B - Baixa Patrimonial com Ganho/Perda

Antes desta etapa, `disposeFixedAssetAction` apenas marcava o bem como baixado e orientava lançamento manual.

Implementado:

- Categorias patrimoniais agora salvam `disposal_gain_account_id` e `disposal_loss_account_id`.
- Formulário de baixa do bem aceita conta de entrada/recebível quando há valor de venda/baixa.
- A baixa calcula custo de aquisição, depreciação acumulada, valor contábil líquido, valor de saída, ganho e perda.
- A baixa gera lançamento contábil `ASSET_DISPOSAL` em `POSTED`, com:
  - débito da depreciação acumulada;
  - débito da conta de entrada/recebível quando há valor de saída;
  - débito da perda, se houver;
  - crédito do custo de aquisição;
  - crédito do ganho, se houver.
- O bem recebe `disposal_journal_entry_id` e status `SOLD` quando há valor de saída, ou `DISPOSED` quando não há.
- `asset_events` registra a baixa com o `journal_entry_id`.
- Revalidação adicionada para patrimônio, diário, lançamentos e balancete.

## Verificação

- `npm run build` executado com sucesso após as correções.
- `npm run lint` executado, mas a suíte já falha por débitos amplos pré-existentes
  (`no-explicit-any`, scripts `scratch_*`, hooks antigos e avisos de imports não usados).
  Não foi tratado nesta rodada por estar fora do escopo e não bloquear o build final.

## Observações

Não foi executado teste E2E em navegador nesta rodada. A verificação feita foi estrutural e de build TypeScript/Next.
