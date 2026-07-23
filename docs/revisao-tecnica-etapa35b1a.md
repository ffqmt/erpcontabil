# Revisão Técnica Pós-Implementação — Etapa 35B.1-A

**Data:** 2026-07-23  
**Escopo:** revisão técnica da Etapa 35B.1-A — Motor Fiscal por Natureza e Regras de Importação.  
**Fora de escopo mantido:** 35B.1-B, 35C, Reforma Tributária/CBS/IBS/IS, SPED, emissão fiscal, folha, lint/refactor global.

## 1. Typecheck e Build

- `npx tsc --noEmit` passou antes das correções.
- `npm run build` passou antes das correções.
- Após as correções pontuais:
  - `npx tsc --noEmit` passou.
  - `npm run build` teve uma primeira execução estourando timeout local em 191s, sem erro reportado; repetido com timeout maior, passou limpo.
- Revalidação final após alinhar o nome do relatório solicitado no anexo:
  - `npx tsc --noEmit` passou.
  - `npm run build` passou limpo.
- Build final: Next.js 16.2.10, rotas novas de `/fiscal/configuracoes/regras-importacao` presentes no manifest.

## 2. Migration v2.10

Arquivo revisado: `db/migrations/erp_schema_v2_10_35b1a_fiscal_operation_engine.sql`.

Conclusão: migration aditiva e coerente com o escopo fechado da 35B.1-A.

- Adiciona campos opcionais/default-safe em `fiscal_operation_natures`.
- Adiciona `fiscal_document_items.xml_cfop` nullable, sem quebrar histórico.
- Cria `fiscal_import_classification_rules` com RLS por `company_id`.
- Alarga o check de `fiscal_document_validation_issues.issue_type` para incluir `BOOKKEEPING_CFOP_MISSING`.
- Faz seed referencial mínimo de CFOP e CST/CSOSN/PIS/COFINS, sem alíquota.
- Não implementa CBS/IBS/IS, SPED, emissão, folha nem tabela duplicada de apuração.

Risco residual: a tabela `fiscal_import_classification_rules` possui FKs simples para `partners`, `items` e `fiscal_operation_natures`; o banco não impede, sozinho, que uma linha de uma empresa referencie ID de outra empresa. A revisão reforçou essa defesa nas Server Actions. Se houver escrita direta no banco fora da aplicação, ainda convém tratar isso com constraints compostas/trigger em etapa futura.

## 3. Natureza Fiscal

Os campos operacionais da Natureza Fiscal foram implementados em schema, tipos, action e formulário:

- `operation_kind`, `applicable_document_types`, `fiscal_purpose`;
- CFOP/CST sugeridos;
- tratamentos de ICMS, ICMS-ST, IPI, PIS/COFINS e ISS;
- retenções esperadas;
- indicadores `generates_credit`, `enters_tax_assessment`, `triggers_accounting`;
- exigências de produto/NCM e tipo de item padrão.

Correção aplicada: `createFiscalNatureAction` e `updateFiscalNatureAction` agora validam que `suggestedAccountingRuleId`, se enviado, pertence à empresa ativa antes de salvar.

## 4. Regras de Importação XML

O motor está tecnicamente consistente com a implementação documentada:

- regra ativa apenas;
- condição nula como coringa;
- menor `priority` vence primeiro;
- especificidade desempata apenas dentro da mesma prioridade;
- `item_id` funciona como alvo de ação de mapeamento, não como condição de match;
- `partner_id`, CNPJ emitente, CFOP XML, NCM, código do fornecedor, descrição, tipo, direção e faixa de valor são considerados;
- `xml_cfop` é preservado como origem e `cfop` só recebe CFOP de escrituração quando a regra aplica.

Correções aplicadas:

- Validação impede `minAmount > maxAmount`.
- `createPartnerItemMapping=true` agora exige `itemId` alvo.
- Actions de criar/editar regra validam que parceiro, produto alvo e natureza fiscal pertencem à empresa ativa.
- UI exibe o erro de produto alvo obrigatório e remove o texto antigo que dizia que a ação apenas “não teria efeito”.
- Comentário com typo no matcher foi ajustado.

Limitações mantidas/documentadas:

- `origin_state`, `destination_state` e `municipality_code` existem no schema/matcher, mas o parser ainda não propaga esses campos ao contexto da importação.
- `cest` existe no schema/matcher, mas `writeFiscalDocumentFromImport` ainda passa `cest: null`; uma regra condicionada a CEST não casa nesta subetapa.
- `item_fiscal_usage` e `generates_credit` ficam gravados na regra, mas a aplicação da regra não persiste efeito posterior no item/documento.
- A tela simples de regras não expõe todos os campos técnicos; preserva valores existentes ao editar, mas não é uma UI completa de todos os atributos.

## 5. Importação XML

`writeFiscalDocumentFromImport` aplica as regras antes de gravar o documento, o que permite salvar a natureza fiscal no cabeçalho e os campos resolvidos nos itens.

Validação técnica:

- `xml_cfop` recebe o CFOP original do XML.
- `cfop` fica nulo quando nenhuma regra resolve o CFOP de escrituração.
- `BOOKKEEPING_CFOP_MISSING` assume a pendência quando há `xml_cfop` sem `cfop`.
- Matching produto-fornecedor continua conservador: usa mapeamento existente ou regra explícita com produto alvo e código de fornecedor.
- A criação/atualização de `partner_item_mappings` revalida que o produto alvo pertence à empresa ativa.

## 6. Pendências Fiscais

O módulo de pendências está alinhado com a separação `xml_cfop` x `cfop`:

- `CFOP_DIRECTION_MISMATCH` compara apenas o `cfop` de escrituração.
- `CFOP_MISSING` só aparece quando não há `cfop` nem `xml_cfop`.
- `BOOKKEEPING_CFOP_MISSING` aparece quando há CFOP de origem do XML, mas falta CFOP de escrituração.
- Documentos cancelados continuam fora da central.
- A regra de NCM usa `requires_ncm` da Natureza Fiscal como reforço aditivo, não supressivo.

Sem correção adicional necessária nesta revisão.

## 7. Apuração Automática

Para o branch ICMS/ISS/IPI/retenções, a implementação está coerente:

- `getReadyDocumentsForAssessment()` filtra documentos `BOOKED`, `tax_status != IGNORED`, com Natureza Fiscal definida, com `enters_tax_assessment != false` e sem pendência `CRITICAL` aberta.
- `generateAutomaticLines()` recebe `readyIds` e só soma documentos prontos.
- Retenções também são filtradas pelos documentos prontos.
- Documentos excluídos ficam em `calculation_memory.excludedDocuments`.

Ponto de atenção: Simples Nacional e IRPJ/CSLL continuam usando receita agregada/DRE, conforme a documentação da implementação desta subetapa; não foram adaptados ao filtro de documentos prontos nesta revisão para evitar refatoração fora do escopo.

## 8. Segurança Multiempresa

Validação após correções:

- Listagens e queries novas filtram por `company_id`.
- Importação XML busca regras ativas por `company_id`.
- Escrita de regras de importação agora valida IDs relacionados por empresa.
- Escrita de Natureza Fiscal agora valida a regra contábil sugerida por empresa.
- RLS da nova tabela segue o padrão `can_read_company`/`can_write_company`.

Risco residual: integridade tenant-cross-FK ainda depende das actions para os FKs opcionais da regra de importação. Para escrita direta no banco, recomenda-se trigger/constraint composta futura.

## 9. Regressão 35A/35B

Verificações técnicas:

- Hardcode operacional de PIS/COFINS recuperável não voltou; as ocorrências de `1,65`/`7,60` encontradas estão em comentários históricos explicando a remoção.
- Matching XML → produto continua conservador.
- `calculation_mode` não foi alterado nesta revisão.
- Central de pendências da 35B continua compatível com o novo tipo `BOOKKEEPING_CFOP_MISSING`.
- NFS-e/CT-e mantêm warnings operacionais anteriores.
- Smoke HTTP sem sessão em `/fiscal/pendencias`, `/fiscal/revisao-itens`, `/fiscal/documentos`,
  `/fiscal/importar-xml`, `/fiscal/apuracoes`, `/fiscal/cadastros/tabelas-nacionais`,
  `/fiscal/configuracoes-tributarias`, `/cadastros/naturezas-fiscais` e
  `/fiscal/configuracoes/regras-importacao` retornou `307 /login`, esperado para rotas
  protegidas e suficiente para validar abertura estrutural sem sessão autenticada.

Não foram executados testes autenticados com escrita real no Supabase.

## 10. Correções Feitas

Arquivos alterados nesta revisão:

- `src/modules/fiscal/import-classification-rules/validations.ts`
- `src/modules/fiscal/import-classification-rules/actions.ts`
- `src/modules/fiscal/import-classification-rules/matcher.ts`
- `src/modules/fiscal/import-classification-rules/components/rule-form.tsx`
- `src/modules/registrations/fiscal-natures/actions.ts`

Resumo:

- Validação de faixa de valor da regra.
- Produto alvo obrigatório para mapeamento automático.
- Validação multiempresa de parceiro/produto/natureza nas regras.
- Validação multiempresa de regra contábil sugerida nas naturezas.
- Ajuste de mensagem/erro na UI.
- Ajuste textual em comentário.

## 11. Riscos Restantes

- Regras por UF/município/CEST ainda podem ser cadastradas por banco, mas não têm contexto efetivo na importação atual.
- `generates_credit`/`expected_retentions` em regra casada ainda não geram persistência operacional.
- A tela de regras é funcional, mas incompleta para todos os campos técnicos do schema.
- `calculation_memory.excludedDocuments` ainda não tem painel visual dedicado.
- Sem testes E2E autenticados nesta revisão.

## 12. Veredito

35B.1-A está tecnicamente aprovada com correções pontuais aplicadas e riscos residuais documentados. A fundação de Natureza Fiscal + Regras de Importação está coerente para seguir para validação funcional/QA ou para a 35B.1-B, sem abrir 35C/Reforma neste momento.
