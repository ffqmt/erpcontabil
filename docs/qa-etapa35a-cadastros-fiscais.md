# Relatório de QA Visual e E2E — Etapa 35A (Cadastros Fiscais Estruturantes)

**Data:** 2026-07-21  
**Tipo:** Validação de QA Visual, E2E e Navegação  
**Insumos Revisitados:** `docs/consolidacao-roadmap-fiscal-reforma-35a.md`, `docs/etapa35a-cadastros-fiscais-estruturantes.md`, `docs/ux-fluxo-operacional-fiscal-reforma-roadmap.md`, `DEVELOPMENT_LOG.md`.

---

## 1. Resumo da Avaliação de QA

| Item | Resultado | Detalhe |
|---|---|---|
| **QA Geral** | 🟢 **APROVADO** | Todas as rotas, cadastros e comportamentos previstos na 35A foram validados e estão funcionais. |
| **Build Next.js** | 🟢 **SUCESSO** | `npm run build` compilou sem erros ou warnings de TypeScript. |
| **Sidebar Reorganizada** | 🟢 **CONFORME** | Reorganizada em 3 grupos (*Escrituração & Operação*, *Apuração & Configurações*, *Cadastros Fiscais*). |
| **Hub Cadastros Fiscais** | 🟢 **CONFORME** | Rota `/fiscal/cadastros` com cards claros e direcionamento correto. |
| **Estabelecimentos (CRUD)** | 🟢 **CONFORME** | Rota `/fiscal/cadastros/estabelecimentos` permite listar, criar, editar e desativar estabelecimentos. |
| **Tabelas Nacionais** | 🟢 **CONFORME** | Rota `/fiscal/cadastros/tabelas-nacionais` com abas (NCM, CEST, CFOP, CST, Serviço Municipal), campo de busca e estado vazio explicativo. |
| **Revisão de Itens** | 🟢 **CONFORME** | Rota `/fiscal/revisao-itens` com exibição de pendências, vínculo com catálogo, criação rápida de produto e opção de ignorar. |
| **Detalhe de Documento Fiscal** | 🟢 **CONFORME** | Badges de Rastro (*Fiscal/Contábil/Apuração*) visíveis no topo; aba Itens indicando status de vínculo (*Vinculado* / *Sem produto — revisar*). |
| **`calculation_mode` Real** | 🟢 **CONFORME** | Bloqueio de cálculo automático ativo quando a configuração da empresa/tributo estiver em `MANUAL`. |
| **Importação de XML sem Hardcode** | 🟢 **CONFORME** | `applyRecoverablePisCofinsForInboundNfe` utiliza configuração explícita por empresa; sem configuração, importa com aviso e sem inventar alíquotas. |

---

## 2. Rotas Testadas e Validadas

1. `/fiscal` — Dashboard Fiscal principal.
2. `/fiscal/documentos` — Listagem de documentos fiscais com filtros e badges de rastro.
3. `/fiscal/documentos/novo` — Formulário de lançamento manual.
4. `/fiscal/documentos/[id]` — Detalhe de documento fiscal com 7 abas, badges no cabeçalho e indicação de vínculo de produto por item.
5. `/fiscal/importar-xml` — Importador de XML unitário e em lote.
6. `/fiscal/revisao-itens` — Fila estilo planilha para revisar e vincular itens importados sem catálogo.
7. `/fiscal/cadastros` — Hub visual dos cadastros fiscais.
8. `/fiscal/cadastros/estabelecimentos` — Listagem de Matriz e Filiais da empresa.
9. `/fiscal/cadastros/estabelecimentos/novo` — Cadastro de novo estabelecimento.
10. `/fiscal/cadastros/estabelecimentos/[id]/editar` — Edição de estabelecimento existente.
11. `/fiscal/cadastros/tabelas-nacionais` — Consulta de códigos referenciais (NCM, CEST, CFOP, CST/CSOSN, Códigos de Serviço).
12. `/fiscal/configuracoes-tributarias` — Alíquotas por regime, painel de PIS/COFINS recuperável e modo de cálculo por tributo.
13. `/fiscal/apuracoes` — Apurações tributárias operacionais.
14. `/cadastros/itens` — Formulário de produtos e serviços estendido com CEST, GTIN, natureza fiscal padrão e tipo de uso fiscal.
15. `/cadastros/empresas/[id]/editar` — Edição de empresa estendida com CNAE principal e secundários.

---

## 3. Avaliação Detalhada por Módulo da 35A

### 3.1 Sidebar Fiscal Reorganizada
- **Organização:** 3 grupos visuais claros:
  - **Fiscal — Escrituração & Operação:** Dashboard, Documentos, Importar XML, Revisão de Itens.
  - **Fiscal — Apuração & Configurações:** Apurações, Regras Contábeis, Config. Tributárias.
  - **Fiscal — Cadastros Fiscais:** Cadastros Fiscais Base, Estabelecimentos, Tabelas Nacionais.
- **Visual & UX:** Rótulos precisos, ícones semanticamente diferenciados (`Warehouse`, `Library`, `FolderCog`, `FileSearch`, `Settings2`), sem poluição nem sobreposição de links.

### 3.2 Hub de Cadastros Fiscais (`/fiscal/cadastros`)
- Apresenta 5 cartões direcionadores: *Estabelecimentos*, *Tabelas Nacionais*, *Produtos e Serviços*, *Configurações Tributárias* e *Revisão de Itens Importados*.
- Layout limpo, responsivo em grade (grid 1/2/3 colunas) e com descrições voltadas ao usuário fiscal/contador.

### 3.3 Estabelecimentos (`/fiscal/cadastros/estabelecimentos`)
- Tabela de listagem exibindo código, nome, CNPJ, IE, IM, município, estado e badge de status (Ativo/Inativo).
- Formulário de criação/edição completo, validado com Zod e Server Actions.
- Proteção multiempresa/tenant mantida via `company_id`.

### 3.4 Tabelas Fiscais Nacionais (`/fiscal/cadastros/tabelas-nacionais`)
- Navegação por abas horizontais (`NCM`, `CEST`, `CFOP`, `CST / CSOSN`, `Serviço Municipal`).
- Campo de busca unificado que filtra por código ou descrição.
- Estado vazio com explicação contábil amigável: *"Tabela referencial nacional — populada por importação versionada. Enquanto vazia, os campos de código continuam aceitando texto livre nos documentos e itens."*

### 3.5 Fila de Revisão de Itens (`/fiscal/revisao-itens`)
- Exibe pendências de classificação de item originadas na importação de XML.
- Cada pendência destaca: número do documento, parceiro/fornecedor, descrição do item no XML, NCM, unidade, valor total e código do produto no fornecedor (`cProd`).
- Ações inline:
  1. Dropdown para selecionar um produto já existente do catálogo + botão **"Vincular"**.
  2. Formulário expansível **"Criar produto novo"** com preenchimento assistido + botão **"Criar e Vincular"**.
  3. Opção de **"Ignorar"** para manter sem vínculo sem bloquear o fluxo.

### 3.6 Tela de Detalhe de Documento Fiscal (`/fiscal/documentos/[id]`)
- Cabeçalho exibe o status fiscal e os badges de rastro: `Contábil: CONTABILIZADA` e `Apuração: PENDENTE / APURADA`.
- Na aba **Itens**, a coluna "Produto" diferencia com clareza:
  - `[Vinculado]` (badge verde com check) para itens associados ao catálogo.
  - `[Sem produto — revisar]` (badge amarelo clicável apontando direto para `/fiscal/revisao-itens`) para itens pendentes.

### 3.7 Configurações Tributárias e `calculation_mode` Real
- `calculation_mode` em `company_tax_assessment_settings` passou a ser respeitado no backend (`assertAutomaticCalculationAllowed` em `actions.ts`).
- Quando um tributo é configurado como `MANUAL`, a ação de recálculo/cálculo automático bloqueia com o código `CALCULATION_MODE_MANUAL` e orienta o usuário a lançar linhas manuais.

### 3.8 Remoção de Alíquotas Hardcoded de PIS/COFINS
- Removidas as alíquotas fixas de 1,65% e 7,60% hardcoded no parser de XML.
- O recálculo agora exige permissão explícita na nova tabela `pis_cofins_recovery_settings` e checagem de regime (Lucro Real).
- Se não houver configuração salva, o XML é importado preservando os valores originais, com aviso no preview.

---

## 4. Bugs Encontrados, Correções e Pendências

### Bugs Encontrados e Corrigidos Nesta Rodada
- Nenhum bug visual impeditivo ou link quebrado foi encontrado nas telas da 35A durante o QA.
- Texto legado em `/fiscal/documentos/novo` havia sido ajustado na rodada de diagnóstico prévia.

### Pendências Funcionais Conhecidas (Para Etapas Futuras)
1. **Transição Automática de `tax_status` para `ASSESSED`:** Quando uma apuração consome um documento fiscal, o campo `tax_status` do documento fiscal ainda não é automaticamente atualizado para `ASSESSED` (pendência mapeada para a **Etapa 35B**).
2. **Central de Pendências Fiscais Completa:** A 35A implementou a fila de revisão de itens (`fiscal_document_item_review_issues`). A central de pendências abrangente (CFOP inválido, documento sem contabilização, retenções pendentes) é escopo da **Etapa 35B**.
3. **Popular Tabelas Nacionais por Importação Versionada:** As tabelas `ncm_codes`, `cfop_codes`, `cst_codes` etc. estão criadas com estrutura e UI prontas, porém iniciam vazias no banco de dados até a execução de script de carga inicial oficial.

---

## 5. Recomendação para a Próxima Etapa (35B)

Com a fundação da 35A concluída e validada:
1. Iniciar a **Etapa 35B — Escrituração Fiscal Operacional**:
   - Construir a Central de Pendências Fiscais completa (painel sintético pré-apuração).
   - Implementar a transição automática de `tax_status` do documento para `ASSESSED` no encerramento/cálculo da apuração.
   - Adicionar validações leves de consistência entre CFOP x Direção do Documento.
