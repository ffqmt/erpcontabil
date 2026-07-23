# Avaliação de UX e Fluxo Operacional do Módulo Fiscal do ERP Sela Sistem
**Com base no Roadmap Funcional e Arquitetural (Reforma Tributária e Escrituração Fiscal)**

**Data:** 2026-07-21  
**Autor:** Antigravity AI Agent (Pair Programming UX/QA)  
**Insumos Analisados:** `docs/arquitetura-fiscal-erp-contabil-reforma-tributaria-roadmap.md`, `docs/auditoria-estado-sistema-pos-contabil-fiscal.md`, `DEVELOPMENT_LOG.md`, rotas `src/app/(erp)/fiscal/**`, `src/app/(erp)/cadastros/**` e `src/components/app-shell/sidebar.tsx`.

---

## 1. Veredito Geral e Respostas às Perguntas Centrais

### 1.1 "O usuário consegue operar uma rotina fiscal real hoje?"

> [!WARNING]
> **Resposta: PARCIALMENTE.**
> O fiscal atual é muito eficiente para **importar XML de NF-e, gerar lançamentos contábeis via regras multi-linha e integrar com o patrimônio**. Porém, para uma **operação fiscal diária de escritório contábil/empresa real**, ele ainda não é um motor de escrituração fiscal completo.

#### Por que não é completo para escrituração real hoje?
1. **Falta Fila/Tela de Classificação de Itens:** Ao importar um XML, os itens do documento entram como registros avulsos e seu vínculo com o catálogo de produtos (`items.id`) fica nulo. O fiscalista não tem uma tela para vincular "Item da Nota X" ao "Produto Cadastrado Y".
2. **CFOP, NCM, CST e CEST são campos de texto livre:** O usuário digita qualquer string sem validação contra uma tabela oficial. Não há descrição amigável do CFOP/NCM nem consulta por tabela.
3. **Não há Livros Fiscais nem Livro de Apuração:** O fiscalista consegue apurar o imposto, mas não visualiza um livro de Entradas, Saídas ou Apuração de ICMS/ISS.
4. **CT-e e NFS-e exigem complemento manual extenso:** Retenções federais/municipais em NFS-e e PIS/COFINS em CT-e não são extraídos automaticamente.
5. **Falta Central de Pendências Fiscais:** O usuário não tem uma visão sintética de quais notas da competência estão pendentes de contabilização, pendentes de classificação de NCM/CFOP ou pendentes de apuração.

---

### 1.2 "Como a UX precisa evoluir para suportar cadastros fiscais, escrituração e Reforma Tributária sem virar um caos?"

1. **Reorganização do Menu em Domínios Cluros:** O menu Fiscal hoje junta dashboard, documentos, importação, regras contábeis, apurações e configurações em uma lista plana de 6 itens. Ele deve ser estruturado em 3 pilares visuais: **Escrituração & Documentos**, **Apurações & Obrigações**, e **Cadastros Fiscais**.
2. **Tela de Documento Fiscal como Central de Escrituração (Hub):** Transformar a tela de detalhe do documento fiscal em uma central onde o usuário enxerga no cabeçalho o status de 3 pilares: **Status Fiscal (DRAFT/VALIDATED)**, **Status Contábil (ACCOUNTED)** e **Status de Apuração (ASSESSED)**.
3. **Módulos visuais dedicados para a Reforma Tributária (CBS/IBS/IS):** Evitar espalhar CBS/IBS em formulários existentes sem estrutura. A Reforma exige um **Painel de Transição Tributária (2026-2033)** com visão comparativa da carga tributária (Regime Antigo vs. Reforma) e abas/seções claramente delimitadas para os novos tributos por item e apuração paralela.

---

## 2. Diagnóstico da Navegação e Rotas Auditadas

| Rota | Objetivo | Status UX Atual | Problemas/Gargalos de UX Encontrados |
|---|---|---|---|
| `/fiscal` | Dashboard Fiscal | 🟢 Funcional | Exibe cards de resumo da competência. Falta atalho direto para notas pendentes ou com erro. |
| `/fiscal/documentos` | Lista de Documentos | 🟢 Funcional | Possui filtros por tipo/direção/status e ações em lote. Falta indicação visual se a nota já participou de apuração (`ASSESSED`). |
| `/fiscal/documentos/novo` | Cadastro Manual | 🟡 Regular | Form simples. Texto antigo falava em "importação de XML para etapa futura" (ajustado nesta rodada). Faltam retenções no formulário de criação. |
| `/fiscal/documentos/[id]` | Detalhe (7 abas) | 🟢 Rico | 7 abas ricas (Documento, Itens, Tributos, Contabilidade, Apuração, Patrimônio, XML). Atinge o limite de densidade cognitiva. |
| `/fiscal/documentos/[id]/editar` | Edição | 🟢 Funcional | Permite alterar dados básicos se status for editável. |
| `/fiscal/importar-xml` | Importação XML | 🟢 Bom | Suporta NF-e/CT-e/NFS-e unitário e lote (até 30). Exibe avisos de deduplicagem. |
| `/fiscal/regras-contabeis` | Motor de Regras | 🟢 Excelente | Lista/cria/edita regras multi-linha. Interface mais madura do módulo fiscal. |
| `/fiscal/configuracoes-tributarias` | Configs e Alíquotas | 🟡 Enganoso | Contém o `calculation_mode` (AUTO/MANUAL) que é um toggle **sem efeito no backend** (campo morto). |
| `/fiscal/apuracoes` | Apurações Tributárias | 🟢 Bom | Cobre ICMS, ISS, IPI, Simples, Retenções, IRPJ/CSLL. Falta prévia de PIS/COFINS. |
| `/cadastros/parceiros` | Cadastro de Parceiros | 🟢 Bom | Suporta papéis múltiplos (cliente, fornecedor, transportadora). |
| `/cadastros/itens` | Produtos e Serviços | 🟡 Incompleto | Permite cadastrar itens, mas não tem CEST, conta contábil padrão nem vinculo automático com XML. |
| `/cadastros/naturezas-fiscais` | Naturezas de Operação | 🟢 Funcional | Cadastro simples (código/nome/direção). Falta vincular CFOP padrão. |

---

## 3. Avaliação das Jornadas Operacionais Reais (A a E)

### Jornada A — XML NF-e Entrada (Fornecedor)
1. **Importar XML:** Fluxo em 2 passos (Preview editável → Confirmação) funciona com excelência. Deduplica por chave e cria fornecedor/conta contábil se não existir.
2. **Conferência de Cabeçalho, Parceiro e Tributos:** Muito clara no preview e na tela de detalhe.
3. **Classificação do Item:** ❌ **Gargalo Crítico.** Os itens entram no documento fiscal como descrições avulsas da NF-e. O sistema não tenta casar com o catálogo `items`, e o usuário não tem botão ou tela para "Vincular ao Produto Interno X".
4. **CFOP / NCM / CST:** Exibidos como texto simples lido do XML. Não há validação se o CFOP é de entrada (ex: transformou 5102 em 1102) nem indicação se a empresa tem direito a crédito PIS/COFINS por aquele NCM.
5. **Apuração e Contabilização:** A contabilização automática sugere e aplica regras com rastro. Mas o documento **não transiciona seu status visual para `ASSESSED`** após a apuração, deixando o usuário sem saber se a nota já foi apurada.

### Jornada B — Documento Manual de Entrada
- Funciona bem para inclusão simples de notas de serviços ou compras manuais.
- **Gargalos:** Não permite informar retenções (IRRF, INSS, PCC) na tela inicial de criação; o usuário precisa criar o documento e depois editar retenções. CFOP e CST dependem da digitação manual de códigos numéricos sem autocomplete oficial.

### Jornada C — Documento de Saída (Faturamento / Vendas)
- O pipeline bidirecional trata notas de saída (NF-e emitida) com os mesmos componentes de entrada.
- **Gargalos:** Faltam totalizadores visuais de **Deduções sobre Vendas** e destaque dos tributos sobre faturamento (PIS/COFINS/ICMS a recolher) diretamente na aba de resumo do documento de saída.

### Jornada D — NFS-e / Serviços Tomados e Prestados
- O parser de NFS-e é genérico/tolerante por ausência de schema XSD nacional unificado.
- **Gargalos:** O sistema avisa que NFS-e pode exigir complemento manual, mas **não destaca visualmente quais retenções (INSS, IRRF, PIS/COFINS/CSLL) deixaram de ser extraídas**. O usuário precisa lembrar de verificar cada nota de serviço manualmente. O código de serviço municipal fica como string solta sem tabela de referência da cidade.

### Jornada E — CT-e / Conhecimento de Transporte
- Extrai ICMS com sucesso.
- **Gargalos:** PIS e COFINS do CT-e são ignorados no parser XML. Tomador ambíguo gera aviso no topo do detalhe, mas não há um assistente para o fiscalista resolver a tomada do frete com 1 clique.

---

## 4. Avaliação dos Cadastros Fiscais no Menu e na UX

Hoje o ERP possui cadastros base em `/cadastros` e cadastros tributários em `/fiscal/configuracoes-tributarias`, mas **faltam tabelas nacionais oficiais de referência fiscal**.

```
Estrutura Atual dos Cadastros (Dispersa):
├── /cadastros/parceiros           (OK)
├── /cadastros/itens               (Falta CEST, Conta Padrão, CNAE)
├── /cadastros/naturezas-fiscais   (Falta CFOP associado)
├── /cadastros/municipios          (OK)
└── /fiscal/configuracoes-tributarias (Só alíquotas de IRPJ/CSLL)
```

### Diagnóstico dos 15 Cadastros Fiscais Estruturantes:

| Cadastro | Existe no Menu? | Status UX Atual | Recomendação para UX |
|---|---|---|---|
| **Produtos / Serviços** | `/cadastros/itens` | 🟡 Texto simples, sem CEST | Mover/Espelhar em "Cadastros Fiscais", adicionar CEST e conta padrão |
| **Unidades de Medida** | ❌ Não | Texto livre em `items.unit` | Criar tabela referencial (UN, KG, CX, M2, L) |
| **NCM** | ❌ Não | Texto livre em itens de nota | Criar tabela referencial de NCM com busca por código/descrição |
| **CEST** | ❌ Não | Texto livre em itens de nota | Criar tabela referencial vinculada a NCM |
| **CFOP** | ❌ Não | Texto livre em itens de nota | Criar tabela referencial de CFOP (Entradas x Saídas) |
| **CST / CSOSN ICMS** | ❌ Não | Texto livre em itens de nota | Criar tabela referencial de CST (Tabela A + B) |
| **CST PIS / COFINS / IPI** | ❌ Não | Texto livre em itens de nota | Criar tabela referencial de CST |
| **Códigos de Serviço Municipal**| ❌ Não | Texto livre | Criar tabela de LC 116/2003 + códigos municipais |
| **Natureza de Operação** | `/cadastros/naturezas-fiscais` | 🟢 Funcional | Associar CFOPs padrões de entrada/saída |
| **Estabelecimentos (IE/IM)** | ❌ Não | Coluna morta `establishment_id` | Criar CRUD de Estabelecimentos (Filiais/Sedes) |
| **Perfil Fiscal / CNAE** | ❌ Não | Enum genérico na empresa | Adicionar CNAE Principal e Secundários na Empresa |
| **Regras Fiscais por UF** | ❌ Não | Inexistente | Reservado para parametrização por estado (DIFAL/ST) |
| **Regras Contábeis Fiscais** | `/fiscal/regras-contabeis` | 🟢 Excelente | Manter no menu Fiscal |
| **Alíquotas por Vigência** | `/fiscal/configuracoes-tributarias` | 🟢 Funcional para IRPJ/CSLL | Expandir para CBS/IBS com filtro por UF/Município |
| **Retenções Fiscais** | Na nota fiscal | 🟡 Na nota fiscal | Criar visão consolidada de retenções a recolher |

---

## 5. Avaliação da Tela de Documento Fiscal como Central de Escrituração (Hub)

A tela `/fiscal/documentos/[id]` é o centro operacional do módulo fiscal. Hoje possui **7 abas horizontais**:
`[ Documento ]` `[ Itens ]` `[ Tributos ]` `[ Contabilidade ]` `[ Apuração Tributária ]` `[ Patrimônio ]` `[ XML/Auditoria ]`

### Diagnóstico das 7 Abas:
- **Pontos Fortes:** Reúne tudo o que o sistema sabe sobre a nota em um só lugar. A navegação por abas impede que a página fique infinitamente longa.
- **Gargalos com a Reforma Tributária:** 7 abas no topo de um contêiner já preenchem quase toda a largura da tela em telas normais (1080p). Se tentarmos adicionar mais abas para "CBS", "IBS" e "Classificação Tributária", a interface vai quebrar visualmente.

### Proposta de Redesenho da Tela de Documento Fiscal (Layout Ideal):

```
+-----------------------------------------------------------------------------------------------+
| HEADER DA NOTA FISCAL: NF-e nº 45902 — FORNECEDOR ABC LTDA                                    |
| [Status Fiscal: VALIDADA]  [Status Contábil: CONTABILIZADA]  [Apuração: PENDENTE]              |
+-----------------------------------------------------------------------------------------------+
| PAINEL DE ALERTAS/PENDÊNCIAS (se houver):                                                     |
| ⚠️ Item 2 sem vínculo com o Catálogo de Produtos  ·  ⚠️ Retenção de IRRF pendente de conferência |
+-----------------------------------------------------------------------------------------------+
| ABAS PRINCIPAIS (6 Abas Reestruturadas):                                                      |
| 1. Cabeçalho & Operação | 2. Itens & Classificação | 3. Tributos & Reforma |                    |
| 4. Contabilidade        | 5. Apuração & Patrimônio | 6. XML & Auditoria                         |
+-----------------------------------------------------------------------------------------------+
| CONTEÚDO DA ABA SELECIONADA:                                                                  |
| (Exemplo: Na aba "3. Tributos & Reforma", usar sub-seções ou abas internas)                  |
|  [ Tributos Atuais (ICMS / IPI / PIS / COFINS / ISS) ]  [ Reforma Tributária (CBS / IBS / IS) ] |
+-----------------------------------------------------------------------------------------------+
```

---

## 6. UX para a Reforma Tributária (CBS / IBS / Imposto Seletivo)

A convivência entre o sistema tributário antigo (ICMS, ISS, PIS, COFINS, IPI) e o novo (CBS, IBS, IS) durante a fase de transição (2026-2033) é o maior desafio de UX do projeto.

> [!IMPORTANT]
> **Diretriz de Design para a Reforma Tributária:**
> **NUNCA misturar tributos antigos e novos no mesmo bloco sem clara diferenciação visual.** O usuário fiscal precisa identificar instantaneamente o que é imposto legado e o que é tributo dual (CBS/IBS).

### Soluções de UI Recomendadas:

1. **Badges de Regime Tributário na Apuração:**
   - Visualização distintiva com selos: `[LEGADO: ICMS/ISS/PIS/COFINS]` em azul/cinza e `[REFORMA 2026+: CBS/IBS/IS]` em roxo/esmeralda.
2. **Apuração Tributária em Duas Colunas ou Abas de Vigência:**
   - Na tela `/fiscal/apuracoes`, permitir alternar facilmente entre `Apuração Padrão (Tributos Atuais)` e `Apuração Transição (CBS/IBS/IS)`.
3. **Simulador Comparativo de Impacto Tributário:**
   - Relatório visual onde o contador compara: *"Quanto esta empresa pagaria sob as regras atuais vs. quanto pagará com a alíquota de transição da CBS/IBS"*.
4. **Filtros por Escopo Federativo em Configurações Tributárias:**
   - Como o IBS possui parcela estadual e municipal, a tela `/fiscal/configuracoes-tributarias` deve incluir filtros por **Tributo**, **UF (Estado)**, **Município** e **Data de Vigência**.

---

## 7. Avaliação dos Pontos Específicos Apontados pelo Claude

### 7.1 `calculation_mode` (AUTO / MANUAL em Config. Tributárias)
- **Diagnóstico:** Na tela `/fiscal/configuracoes-tributarias`, existe um toggle para cada tributo definindo `calculation_mode` (AUTO vs. MANUAL). A análise arquitetural provou que **esse campo não é lido pelo motor de apuração**.
- **Impacto UX:** Induz o usuário a erro ao sugerir que mudar para "MANUAL" vai desativar o cálculo automático daquele imposto.
- **Ação de UX Recomendada:** Exibir uma tag visual `(Informativo / Em Breve)` ao lado do campo ou ocultá-lo da tela até que o motor de apuração passe a respeitar essa flag.

### 7.2 Aviso de NFS-e Parcial
- **Diagnóstico:** Atualmente existe um pequeno texto dizendo que a importação de NFS-e é tolerante.
- **Ação de UX Recomendada:** Transformar em um **Banner de Alerta Amarelo (Warning)** na tela de importação e no detalhe do documento fiscal de NFS-e: *"NFS-e importada via parser tolerante. Verifique retenções de ISS, IRRF, INSS e PCC antes de apurar."*

### 7.3 Proposta de Reorganização da Sidebar Fiscal
Substituir a lista plana atual da Sidebar no grupo Fiscal por 3 sub-agrupamentos visuais:

```tsx
// Proposta de Estrutura do Menu Fiscal na Sidebar
{
  title: 'Fiscal & Escrituração',
  items: [
    // --- ESCRITURAÇÃO & OPERAÇÃO ---
    { name: 'Dashboard Fiscal', href: '/fiscal', icon: LayoutDashboard },
    { name: 'Documentos Fiscais', href: '/fiscal/documentos', icon: FileText },
    { name: 'Importar XML', href: '/fiscal/importar-xml', icon: FileUp },
    { name: 'Revisão / Classificação', href: '/fiscal/revisao-itens', icon: ListChecks }, // Novo 35B

    // --- APURAÇÃO & CONFIGURAÇÕES ---
    { name: 'Apurações Tributárias', href: '/fiscal/apuracoes', icon: Calculator },
    { name: 'Regras Contábeis Fiscais', href: '/fiscal/regras-contabeis', icon: ScrollText },
    { name: 'Configurações & Alíquotas', href: '/fiscal/configuracoes-tributarias', icon: Percent },

    // --- CADASTROS FISCAIS ---
    { name: 'Cadastros Fiscais Base', href: '/fiscal/cadastros', icon: Building2 }, // Novo 35A
  ]
}
```

---

## 8. Proposta de UX e Telas para a Etapa 35A (Cadastros Fiscais Estruturantes)

Para suportar a escrituração real e preparar o terreno para a Reforma Tributária (35C), a Etapa 35A deve entregar os seguintes cadastros no frontend:

```
                                  ETAPA 35A — CADASTROS FISCAIS
                                               │
   ┌───────────────────────┬───────────────────┼───────────────────┬───────────────────────┐
   ▼                       ▼                   ▼                   ▼                       ▼
Tabelas Oficiais      Catálogo Fiscal       Perfil Empresa     Estabelecimentos    Fila de Vinculação
(NCM/CFOP/CST)        com CEST/Contas       e CNAE Real        (Sede / Filiais)    Item XML ↔ Produto
```

### Detalhamento das Novas Telas da 35A:

1. **`/fiscal/cadastros/tabelas-nacionais` (CRUD/Consulta Referencial)**
   - **Objetivo:** Consultar e gerenciar códigos nacionais de NCM, CEST, CFOP, CST (ICMS, IPI, PIS, COFINS) e Códigos de Serviço LC 116.
   - **UX:** Tabela de consulta rápida com campo de busca por código ou palavra-chave, com indicação de descrição e vigência.
2. **`/fiscal/cadastros/estabelecimentos` (CRUD de Estabelecimentos)**
   - **Objetivo:** Dar vida à coluna morta `establishment_id`. Permitir cadastrar Matriz e Filiais com Inscrição Estadual (IE), Inscrição Municipal (IM) e endereço distintos.
   - **UX:** Cartões de estabelecimentos com indicação visual de "Matriz" e "Filial".
3. **`/cadastros/itens` (Atualização do Catálogo Existente)**
   - **Objetivo:** Estender o formulário de Produtos/Serviços adicionando: **CEST**, **Conta Contábil Padrão de Compra/Venda**, **Natureza Fiscal Padrão** e **Tipo de Item Fiscal (Insumo / Revenda / Imobilizado / Uso-Consumo / Serviço)**.
4. **`/fiscal/cadastros/empresa-perfil` (Perfil Fiscal e CNAE)**
   - **Objetivo:** Cadastrar o CNAE principal e secundários da empresa e definir o enquadramento tributário completo.

---

## 9. Recomendações de UX para as Etapas Seguintes (35B e 35C)

### Etapa 35B — Escrituração Fiscal Operacional
- **Central de Pendências Fiscais:** Painel indicando em tempo real:
  - 📄 Notas importadas sem contabilização (`UNACCOUNTED`);
  - 📦 Itens de XML pendentes de vinculação ao produto interno;
  - ⚠️ Documentos com divergência de impostos (calculado vs. destacado);
  - 🏛️ Notas prontas para fechamento da apuração.
- **Fila de Revisão/Classificação de Itens Importados:** Interface em formato de tabela editável em lote (estilo planilha), onde o fiscalista visualiza os itens importados dos XMLs da semana e vincula com 1 clique ao produto correspondente do catálogo.

### Etapa 35C — Reforma Tributária Base (CBS / IBS / IS)
- **Visualizador Dual de Tributos:** Nas telas de detalhe do documento e apuração, implementar o seletor de visão:
  - `[Visão Tributária Atual]` vs. `[Visão Reforma Tributária (CBS/IBS)]`.
- **Painel de Crédito Amplo da CBS/IBS:** Gráfico demonstrando o total de créditos gerados em entradas (inclusive insumos e uso/consumo) vs. débitos em saídas sob as regras do IVA Dual.

---

## 10. Registros de QA / Pequenas Correções Realizadas nesta Rodada

1. **Ajuste de Copy em `/fiscal/documentos/novo/page.tsx`:**
   - **Problema:** O subtítulo do formulário manual de documento fiscal continha o texto desatualizado *"Cadastro manual — importação de XML/CSV fica para uma etapa futura."*, sendo que a importação de XML já foi implementada e aprovada na Etapa 32B.
   - **Correção:** Texto atualizado para *"Lançamento manual de documento fiscal (para importação de XML, utilize a opção "Importar XML")."* para evitar confusão operacional ao usuário.
2. **Auditoria de Rotas e Link-Check:**
   - Confirmado que todas as 15 rotas de cadastros, contabilidade, fiscal, apurações e patrimônio estão compilando perfeitamente sem links quebrados.

---

## 11. Conclusão e Próximos Passos Recomendados

1. **Iniciar a Etapa 35A (Cadastros Fiscais Estruturantes)** como o alicerce fundamental.
2. **Prioridade Inicial na 35A:**
   - Mover a alíquota hardcoded de PIS/COFINS (1,65%/7,60%) da importação de XML para a tabela de configuração tributária.
   - Ocultar ou rotular adequadamente o campo morto `calculation_mode` na tela de Configurações Tributárias.
   - Construir as tabelas de referência de NCM, CFOP, CST e CEST.
