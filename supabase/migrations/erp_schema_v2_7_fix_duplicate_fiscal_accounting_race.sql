-- =====================================================================================
-- ERP CONTABIL — v2.7 — TRAVA CONTRA CONTABILIZACAO DUPLICADA DE DOCUMENTO FISCAL
-- =====================================================================================
-- Bug corrigido: accountFiscalDocumentAction (Etapa 32C) fazia um SELECT de
-- fiscal_documents.accounting_status e, so bem depois, gravava 'ACCOUNTED'. Sem nenhuma
-- trava no banco entre a leitura e a escrita, duas chamadas quase simultaneas (duplo
-- clique, a acao em lote rodando junto com a individual, retry de rede) passavam as duas
-- pela checagem antes que qualquer uma gravasse — gerando dois (ou mais) lancamentos
-- contabeis POSTED com origin='FISCAL_DOCUMENT' para o mesmo documento.
--
-- Esta migration adiciona a trava que faltava: um indice unico parcial garantindo que so
-- pode existir UMA aplicacao contabil ATIVA (status='APPLIED') por documento fiscal em
-- fiscal_accounting_applications. Isso nao impede reprocessar apos estorno (a aplicacao
-- antiga vira 'REVERSED', liberando o indice para uma nova 'APPLIED').
--
-- PRE-REQUISITO: se ja existem documentos com mais de uma aplicacao 'APPLIED' (efeito do
-- bug), a criacao do indice abaixo falha com "could not create unique index — duplicate
-- key". Rode primeiro erp_ops_limpar_contabilizacoes_fiscais_duplicadas.sql (dry-run e
-- depois de verdade) para remover os duplicados; so então aplique esta migration.
-- =====================================================================================

create unique index if not exists uq_fiscal_accounting_applications_active_per_document
  on fiscal_accounting_applications (fiscal_document_id)
  where status = 'APPLIED';

comment on index uq_fiscal_accounting_applications_active_per_document is
  'Garante no banco que um documento fiscal so pode ter uma aplicacao contabil ATIVA por vez — a segunda tentativa concorrente de contabilizar o mesmo documento falha com 23505 em vez de criar um segundo lancamento. Ver accountFiscalDocumentAction (trata 23505 como ALREADY_ACCOUNTED).';

notify pgrst, 'reload schema';
