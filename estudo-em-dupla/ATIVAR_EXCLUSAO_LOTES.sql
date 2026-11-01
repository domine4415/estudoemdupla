-- Adiciona rastreamento de importações futuras, sem excluir dados.
alter table public.dupla_bank_questions add column if not exists import_batch uuid;
create index if not exists dupla_bank_questions_import_batch_idx on public.dupla_bank_questions(import_batch) where import_batch is not null;
-- Questões anteriores à migração não têm lote e não serão excluídas pelo botão "última importação".
