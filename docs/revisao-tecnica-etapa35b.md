# Revisão Técnica Pós-Implementação - Etapa 35B

**Data:** 2026-07-22  
**Tipo:** Auditoria técnica pós-implementação, com correções pontuais relacionadas à 35B.  
**Escopo:** Central de pendências fiscais, sincronização de `tax_status`, listagem/detalhe de documentos, retenções manuais, warnings NFS-e/CT-e e regressão da 35A.  
**Fora de escopo:** Reforma Tributária/CBS/IBS/IS, SPED, folha, refactor grande, lint global e nova arquitetura.

---

## 1. Build e Typecheck

- `npx tsc --noEmit`: passou antes e depois das correções.
- `npm run build`: passou antes e depois das correções.
- Build final: Next.js 16.2.10/Turbopack compilou, rodou TypeScript, gerou as páginas e listou `/fiscal/pendencias` no route manifest.
- `.next`: não houve evidência de cache corrompido; não foi necessário limpar.
- Smoke HTTP sem sessão, com `next start -p 3027`: rotas fiscais protegidas retornaram `307`, esperado por autenticação/middleware:
  - `/fiscal/pendencias`
  - `/fiscal/documentos`
  - `/fiscal/cadastros`
  - `/fiscal/cadastros/estabelecimentos`
  - `/fiscal/cadastros/tabelas-nacionais`
  - `/fiscal/revisao-itens`

---

## 2. Migration v2.9

Arquivo revisado: `db/migrations/erp_schema_v2_9_35b_escrituracao_fiscal_operacional.sql`.

Conclusão: a migration é segura para o escopo da 35B.

- É aditiva e idempotente.
- Cria apenas `fiscal_document_validation_issues`.
- Não duplica `tax_assessment_lines` com uma tabela paralela de vínculo documento-apuração.
- Não altera CBS/IBS/IS, SPED ou folha.
- Não cria FK obrigatória sobre dados históricos.
- Usa RLS no padrão do projeto: `can_read_company(company_id)` e `can_write_company(company_id)`.
- Índices principais existem: por `company_id/status`, por documento, por tipo e unique funcional por documento/item/tipo.

Observação técnica: a consistência cruzada entre `company_id`, `fiscal_document_id` e `fiscal_document_item_id` é garantida nas actions novas. A migration não adiciona trigger de consistência entre pais para evitar mudança incremental de schema sem bug comprovado em produção.

---

## 3. Central de Pendências Fiscais

Módulo revisado: `src/modules/fiscal/validation-issues/**`.

Conclusão: o desenho híbrido está correto.

- Pendências dinâmicas e pendências da 35A são apresentadas em uma central única.
- Overrides persistidos em `fiscal_document_validation_issues` não duplicam a fonte `fiscal_document_item_review_issues`.
- Documentos cancelados são filtrados da central.
- `NOT_ACCOUNTED` e `NOT_ASSESSED` ficam como informativas, sem bloquear fluxo.
- `NOT_ASSESSED` só aparece em documento `BOOKED` com tributo apurável (`ICMS`, `ISS` ou `IPI` em item).
- NFS-e sem retenção gera `NFSE_RETENTION_REVIEW`.
- CT-e sem PIS/COFINS gera `CTE_PIS_COFINS_NOT_EXTRACTED`.

Correções feitas:

- `src/modules/fiscal/validation-issues/validations.ts`: `issueType` deixou de ser `string` livre e passou a validar contra o enum real da migration.
- `src/modules/fiscal/validation-issues/queries.ts`: leitura de retenções agora filtra `company_id` explicitamente e erros auxiliares deixam de ser ignorados silenciosamente.
- `src/modules/fiscal/validation-issues/actions.ts`: `resolved_by` agora grava `context.user.id`, coerente com a FK para `auth.users(id)`.

---

## 4. Sincronização de `tax_status`

Arquivo revisado: `src/modules/tax-assessments/actions.ts`.

Conclusão: a estratégia está correta.

- `syncFiscalDocumentTaxStatus()` usa `tax_assessment_lines.fiscal_document_id` como vínculo documento-apuração.
- Documento vira `ASSESSED` quando há linha em apuração não cancelada.
- Documento volta para `NOT_ASSESSED` quando não há mais linha ativa após recalcular/cancelar.
- Documentos `IGNORED` não são tocados.
- IRPJ/CSLL e Simples continuam fora da sincronização por documento, coerente com cálculo agregado.
- Recalcular apuração limpa linhas automáticas anteriores, preserva manuais e sincroniza a união de documentos antigos e novos.

Correção feita:

- Erros da consulta de links ativos e dos updates em `fiscal_documents` agora são propagados.
- Updates de sincronização agora também excluem `status = 'CANCELLED'`, além de `tax_status = 'IGNORED'`.

---

## 5. Listagem e Detalhe

Arquivos revisados:

- `src/modules/fiscal/queries.ts`
- `src/modules/fiscal/components/fiscal-document-list.tsx`
- `src/modules/fiscal/components/fiscal-document-card.tsx`
- `src/app/(erp)/fiscal/documentos/page.tsx`
- `src/app/(erp)/fiscal/documentos/[id]/page.tsx`

Conclusão: listagem e detalhe estão integrados à 35B.

- `/fiscal/documentos` possui os filtros novos.
- Cards mostram contagem compacta de pendências abertas.
- Detalhe do documento possui aba "Pendências" e indicador de pendências abertas.
- Aba "Tributos" recebeu formulário de retenções manuais.

Correções feitas:

- Filtros "Não contabilizados" e "Não apurados" passaram a seguir as pendências abertas calculadas pelo motor, reduzindo falso positivo em rascunhos/cancelados/documentos sem tributo apurável.
- Badges "Não contabilizado" e "Não apurado" foram reduzidos a situações operacionalmente relevantes.

---

## 6. Retenções Manuais

Arquivos revisados:

- `src/modules/fiscal/components/fiscal-document-retentions-form.tsx`
- `src/modules/fiscal/actions.ts`

Conclusão: o formulário está correto para documentos editáveis.

- A action valida permissão, empresa ativa e status editável do documento.
- Delete/insert substitui a lista inteira, como documentado.
- Retenções alimentam apuração por `tax_assessment_lines` quando o tributo corresponde.

Correções feitas:

- Erro do delete prévio em `fiscal_document_retentions` agora é tratado.
- `revalidateFiscal()` passou a revalidar `/fiscal/pendencias`, para o aviso de NFS-e sem retenção sumir após salvar retenções.

Limitação mantida: documentos já escriturados (`BOOKED`) continuam sem formulário de edição de retenções, seguindo a regra atual de editabilidade fiscal.

---

## 7. NFS-e e CT-e

Conclusão: os warnings operacionais estão corretos depois dos ajustes.

- NFS-e sem retenção continua gerando warning forte.
- CT-e sem PIS/COFINS continua gerando warning de revisão, não bloqueante.
- O aviso de NFS-e some quando há ao menos uma retenção.
- O fluxo não bloqueia importação por esses warnings.

Correções feitas:

- `src/modules/fiscal/xml-import/actions.ts`: itens importados por NFS-e passam a ser gravados como `SERVICE`; itens de CT-e passam a ser gravados como `FREIGHT`. Antes, a confirmação/bulk import gravava tudo como `PRODUCT`.
- `src/modules/fiscal/validation-issues/rules.ts`: regras de CFOP/NCM/CST foram ajustadas para evitar falso positivo de mercadoria em serviço/frete.

---

## 8. Regressão 35A

Itens revisados:

- `/fiscal/cadastros`
- `/fiscal/cadastros/estabelecimentos`
- `/fiscal/cadastros/tabelas-nacionais`
- `/fiscal/revisao-itens`
- matching item XML -> produto
- PIS/COFINS sem hardcode
- `calculation_mode`
- formulário de itens com campos fiscais
- formulário de empresa com CNAE

Conclusão: não foi encontrada regressão técnica da 35A.

- As rotas aparecem no build e responderam `307` no smoke sem sessão.
- Matching por `partner_item_mappings` continua conservador.
- Hardcodes 1,65%/7,60% aparecem apenas em comentários históricos, não em cálculo ativo.
- `calculation_mode` segue bloqueando cálculo automático, sem bloquear lançamento manual.

Correção adicional de regressão:

- `src/modules/fiscal/item-matching/actions.ts`: `resolved_by` também passou a usar `context.user.id`, coerente com a FK da tabela da 35A.
- `revalidateReviewQueue()` passou a revalidar `/fiscal/pendencias`, mantendo central e fila de revisão sincronizadas.

---

## 9. Segurança Multiempresa

Conclusão: as actions novas estão adequadas.

- Actions de pendência validam `fiscal_document_id` contra `company_id` ativo.
- Quando `fiscal_document_item_id` é informado, validam item contra documento e empresa.
- Leitura da central filtra documentos por `company_id`.
- Retenções, overrides e revisão de itens usam `company_id` nas queries principais.
- Writes usam `workspace_id`/`company_id` do contexto, não do client.

Risco residual: a tabela `fiscal_document_validation_issues` não tem trigger de banco garantindo que o `company_id` da linha sempre corresponda ao documento/item referenciado. Como as mutations expostas pela aplicação validam isso, não foi criada migration incremental nesta revisão.

---

## 10. Correções Feitas

- Validação estrita de `issueType` para overrides da central.
- `resolved_by` corrigido para `auth.users(id)` nas pendências da 35B e na fila da 35A.
- Revalidação de `/fiscal/pendencias` ao salvar retenções e ao resolver/ignorar revisão de item.
- Tratamento de erro no delete de retenções.
- Tratamento de erro na sincronização de `tax_status`.
- Exclusão explícita de documentos cancelados nos updates de `tax_status`.
- Filtros/badges de não contabilizado/não apurado alinhados às pendências abertas.
- Tipagem operacional de itens XML por documento: NFS-e como `SERVICE`, CT-e como `FREIGHT`.
- Regras dinâmicas de CFOP/NCM/CST ajustadas para não tratar serviço/frete como mercadoria.

---

## 11. Riscos Restantes

- Central calcula pendências dinâmicas em tempo real sobre todos os documentos não cancelados da empresa; pode exigir paginação/cache/view materializada em alto volume.
- Testes autenticados com escrita real no Supabase não foram executados nesta revisão.
- Não há suíte automatizada cobrindo importação XML + pendências + apuração; o risco de regressão ainda depende de build e validação manual.
- Overrides resolvidos/ignorados continuam como memória humana e não reabrem automaticamente se a mesma condição voltar, conforme decisão da implementação.

---

## 12. Ordem Técnica Recomendada

1. Aplicar somente as correções pontuais desta revisão.
2. Fazer smoke autenticado em Supabase para: importar NFS-e/CT-e, salvar retenção, resolver/ignorar pendência, calcular/cancelar apuração.
3. Antes da 35C, criar testes mínimos para pendências dinâmicas, `tax_status` e importação XML por tipo de documento.
4. Só então iniciar a 35C.
