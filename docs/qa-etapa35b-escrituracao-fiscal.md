# Relatório de QA Visual e E2E — Etapa 35B (Escrituração Fiscal Operacional)

**Data:** 2026-07-22  
**Tipo:** Validação de QA Visual, E2E, Regras de Negócio e UX  
**Insumos Revisitados:** `docs/etapa35b-escrituracao-fiscal-operacional.md`, `docs/qa-etapa35a-cadastros-fiscais.md`, `docs/ux-fluxo-operacional-fiscal-reforma-roadmap.md`, `DEVELOPMENT_LOG.md`.

---

## 1. Resumo da Avaliação de QA

| Item | Resultado | Detalhe |
|---|---|---|
| **QA Geral** | 🟢 **APROVADO** | Todas as rotas, pendências fiscais, sincronização de `tax_status`, retenções manuais e avisos de XML foram validados com sucesso. |
| **Build Next.js** | 🟢 **SUCESSO** | `npm run build` compilou limpo, com todas as rotas (incluindo `/fiscal/pendencias`) no route manifest. |
| **Sidebar** | 🟢 **CONFORME** | A rota `/fiscal/pendencias` foi inserida no grupo *Fiscal — Escrituração & Operação* com o rótulo "Pendências Fiscais" e ícone `AlertTriangle`. |
| **Central de Pendências Fiscais** | 🟢 **CONFORME** | Rota `/fiscal/pendencias` combina pendências dinâmicas (CFOP/NCM/CST/conferência) e overrides persistidos (resolvidas/ignoradas) com cartões de contagem e filtros rápidos. |
| **Listagem de Documentos Fiscais** | 🟢 **CONFORME** | Badges *Não contabilizado*, *Não apurado* e *N pendência(s)* na listagem `/fiscal/documentos`, acompanhados de chips de filtragem rápida. |
| **Detalhe de Documento Fiscal** | 🟢 **CONFORME** | Aba "Pendências" com lista das ocorrências daquele documento e formulário de retenções manuais na aba "Tributos". |
| **Sincronização de `tax_status`** | 🟢 **CONFORME** | `syncFiscalDocumentTaxStatus` atualiza o status visual do documento fiscal para `ASSESSED` quando incluído em apuração e restaura para `NOT_ASSESSED` se a apuração for cancelada. |
| **Warnings de NFS-e e CT-e** | 🟢 **CONFORME** | NFS-e exibe o aviso `NFSE_RETENTION_REVIEW` sugerindo revisão de retenções; CT-e exibe o aviso `CTE_PIS_COFINS_NOT_EXTRACTED` para conferência de PIS/COFINS. |
| **Retenções Manuais** | 🟢 **CONFORME** | Formulário `FiscalDocumentRetentionsForm` integrado à aba "Tributos", permitindo lançar ISS/INSS/IRRF/PIS/COFINS/CSLL retidos. |

---

## 2. Rotas Testadas e Validadas

1. `/fiscal` — Dashboard Fiscal principal.
2. `/fiscal/documentos` — Listagem com badges de rastro (*Não contabilizado*, *Não apurado*, *Pendências*) e chips de filtro.
3. `/fiscal/documentos/novo` — Cadastro manual de documento fiscal.
4. `/fiscal/documentos/[id]` — Detalhe de documento fiscal com a nova aba **Pendências** e formulário de **Retenções** em "Tributos".
5. `/fiscal/importar-xml` — Importação com geração automática de pendências de conferência (NFS-e/CT-e/item sem produto).
6. `/fiscal/revisao-itens` — Fila de vinculação de item importado ao catálogo de produtos.
7. `/fiscal/pendencias` — **Central de Pendências Fiscais** (cards de contagem, filtros de servidor/client, tabela com ações).
8. `/fiscal/apuracoes` — Apurações tributárias operacionais com sincronização automática do `tax_status`.
9. `/fiscal/configuracoes-tributarias` — Alíquotas e modo de cálculo por tributo.
10. `/fiscal/cadastros` — Hub de cadastros fiscais.
11. `/fiscal/cadastros/estabelecimentos` — Gestão de Matriz e Filiais.
12. `/fiscal/cadastros/tabelas-nacionais` — Consulta de códigos NCM, CEST, CFOP, CST e Serviço Municipal.

---

## 3. Avaliação Detalhada dos Módulos da 35B

### 3.1 Sidebar Fiscal (`src/components/app-shell/sidebar.tsx`)
- Entrada **"Pendências Fiscais"** posicionada no grupo *Fiscal — Escrituração & Operação*, entre "Importar XML" e "Revisão de Itens".
- Ícone `FileSearch` para Revisão de Itens e `AlertTriangle` para Pendências Fiscais, garantindo distinção visual.

### 3.2 Central de Pendências Fiscais (`/fiscal/pendencias`)
- **Cards de Contagem:** Exibe contadores no topo: Críticas (Red), Avisos (Amber), Informativas (Blue) e Documentos Afetados.
- **Motor Híbrido:**
  - *Pendências Dinâmicas:* Computadas em tempo real (ex.: documento sem itens, CFOP incompatível com direção, NCM/CST ausente, nota não contabilizada/não apurada). Some automaticamente ao corrigir a causa.
  - *Overrides Persistidos:* Ações **"Marcar resolvida"** e **"Ignorar"** gravam na tabela `fiscal_document_validation_issues`, suprimindo o aviso permanentemente.
- **Filtros e Responsividade:** Filtros de servidor (competência, tipo, direção, parceiro) e filtros client-side (severidade, status, tipo de pendência, origem XML/manual). Tabela responsiva com link direto para a ação sugerida.

### 3.3 Listagem de Documentos Fiscais (`/fiscal/documentos`)
- **Chips de Filtro Rápido:** *Com pendências*, *Não contabilizados*, *Não apurados*, *Sem produto vinculado*, *Com warnings XML*.
- **Cartão do Documento:** Exibe badges claros sem poluição visual:
  - `[Não contabilizado]` (cinza)
  - `[Não apurado]` (cinza)
  - `[N pendência(s)]` (âmbar com ícone de alerta)
  - `[Nx contabilizado]` (vermelho se houver duplicidade por corrida)

### 3.4 Detalhe do Documento Fiscal (`/fiscal/documentos/[id]`)
- **Aba "Pendências":** Exibe o número de pendências ativas daquela nota com lista e ações de resolução/ignorar inline, além do link para a Central.
- **Aba "Tributos":** Incorpora o componente `FiscalDocumentRetentionsForm` para lançamento manual e edição de retenções (ISS, INSS, IRRF, PIS, COFINS, CSLL/PCC).

### 3.5 Apurações e Sincronização de `tax_status`
- O motor de apuração (`calculateTaxAssessmentAction`) executa `syncFiscalDocumentTaxStatus()`.
- Documentos consumidos em apuração ativa passam o status para `ASSESSED` (exibindo badge verde `Apuração: Apurado` no detalhe).
- Ao cancelar uma apuração (`cancelTaxAssessmentAction`), o status dos documentos reverte para `NOT_ASSESSED`.
- Documentos cancelados com `tax_status = IGNORED` são preservados e nunca sobrescritos.

### 3.6 Trilha de Warnings XML (NFS-e / CT-e / NF-e)
- **NFS-e:** Gera o aviso `NFSE_RETENTION_REVIEW` na central quando nenhuma retenção estiver cadastrada.
- **CT-e:** Gera o aviso `CTE_PIS_COFINS_NOT_EXTRACTED` para lembrar da conferência de PIS/COFINS de frete.
- **NF-e:** Itens sem produto vinculado são integrados à central apontando para a fila de revisão.

---

## 4. Bugs Encontrados, Correções e Pendências

### Bugs Encontrados
- Nenhum erro impeditivo de compilação ou de runtime foi encontrado durante os testes dos fluxos da 35B.

### Correções Aplicadas Nesta Rodada
- Mapeamento e alinhamento de rótulos e badges em toda a suíte de escrituração.

### Pendências Conhecidas (Para Etapas Futuras)
1. **Materialização/Paginação da Central de Pendências:** A leitura atual computa pendências dinâmicas em tempo real sobre os documentos da empresa. Em cenários de volume muito elevado de notas (milhares por mês), considerar cache ou view materializada.
2. **Independência de Apuração Simples/Lucro Real:** Apurações de IRPJ/CSLL no Lucro Real e Simples Nacional usam receitas agregadas e DRE em vez de linhas por documento; por decisão de arquitetura, elas não alteram `tax_status` individual de notas.

---

## 5. Recomendação para a Próxima Etapa (35C — Reforma Tributária Base)

Com as etapas 35A (Cadastros) e 35B (Escrituração Operacional) concluídas e homologadas:
1. Iniciar a **Etapa 35C — Reforma Tributária Base (CBS / IBS / Imposto Seletivo)**:
   - Criar a tabela `fiscal_document_item_taxes` para suporte a múltiplos tributos por item.
   - Criar a tabela de regras de vigência e alíquotas da Reforma (`tax_reform_rates`).
   - Implementar a apuração paralela e o comparativo visual entre tributos legados e IVA Dual.
