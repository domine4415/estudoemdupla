-- Execute uma vez no Supabase SQL Editor, depois de fazer um backup/exportação.
-- Mantém os históricos de tentativas. Não mexe em salas.
begin;
alter table public.dupla_bank_questions add column if not exists source_id text;
-- Mapeia códigos importados anteriormente, somente numéricos.
-- Em caso de códigos repetidos, conserva o registro mais antigo.
create temporary table _dupla_id_merge on commit drop as
with candidatos as (
  select id, data->>'originalId' as codigo, created_at,
  first_value(id) over(partition by data->>'originalId' order by created_at, id) as id_mestre,
  row_number() over(partition by data->>'originalId' order by created_at,id) as ordem
  from public.dupla_bank_questions
  where (data->>'originalId') ~ '^[0-9]{3,20}$'
)
select id as id_duplicado, id_mestre from candidatos where ordem>1;
-- Primeiro transfere as respostas dos registros duplicados para o canônico.
update public.dupla_bank_attempts a
set question_id=m.id_mestre
from _dupla_id_merge m
where a.question_id=m.id_duplicado;
-- Depois remove apenas duplicatas com o mesmo código original.
delete from public.dupla_bank_questions q
using _dupla_id_merge m where q.id=m.id_duplicado;
update public.dupla_bank_questions
set source_id=data->>'originalId'
where (data->>'originalId') ~ '^[0-9]{3,20}$' and source_id is distinct from data->>'originalId';
create unique index if not exists dupla_bank_questions_source_id_unique
on public.dupla_bank_questions(source_id) where source_id is not null;
commit;
-- Conferência (deve retornar zero linhas):
select source_id,count(*) from public.dupla_bank_questions
where source_id is not null group by source_id having count(*)>1;
