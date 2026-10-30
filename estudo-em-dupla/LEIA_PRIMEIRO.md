# Estudo em Dupla — gerenciamento de exclusões e comentários formatados

## Instalação
1. Faça backup das tabelas `dupla_bank_questions` e `dupla_bank_attempts` do Supabase. A exclusão é irreversível e remove também tentativas de resposta associadas.
2. No Supabase SQL Editor, execute `ATIVAR_EXCLUSAO_LOTES.sql` antes de publicar os arquivos.
3. No GitHub, pasta `estudo-em-dupla`, substitua `bank-api.js`, `public/bank.js`, `public/bank.html` e `public/bank.css` pelos arquivos deste ZIP.
4. Aguarde o Render concluir o deploy. Atualize o navegador com Ctrl+F5.

## Exclusão
- Questão individual: Administração > Revisar questões > Editar > Excluir.
- Última importação: Administração > Exclusão de questões > Última importação > Conferir quantidade > Excluir seleção. Exclui somente **registros novos criados** pelo lote importado após esta atualização; registros antigos atualizados por reimportação ficam preservados.
- Disciplina ou tópico: Administração > Exclusão de questões > Por disciplina e tópico > selecione a disciplina (obrigatória) e opcionalmente o tópico > Conferir quantidade > Excluir seleção.
- É obrigatório digitar `EXCLUIR` para confirmar a exclusão em lote. Uma segunda conferência no servidor evita apagar uma quantidade que tenha mudado.
- Não é possível apagar por "última importação" lotes anteriores à execução desta migração, pois não tinham identificador de lote gravado. Para esses, use filtros.

## Comentários formatados
O campo commentary do JSON aceita Markdown simplificado, sem HTML:
- `## Fundamentação` para título
- `### Pegadinha` para subtítulo
- `**TERMO IMPORTANTE**` para negrito (capslock fica preservado)
- `==Atenção a este trecho==` para grifo verde
- `__Expressão sublinhada__` para sublinhado

Exemplo de JSON:
```
"commentary": "## Fundamentação\nO art. 2º prevê **CADASTRO NACIONAL**.\n\n### Pegadinha\n==Não confundir registro com porte.==\n\n**DICA:** memorize a diferença."
```
Essas marcas são renderizadas depois que o aluno responde. Não insira HTML, tags ou scripts.

## Limitações
- A exclusão remove de forma permanente as tentativas ligadas às questões; faça backup.
- Não execute exclusão em lote enquanto outro administrador faz importação em paralelo.
- A verificação do funcionamento na sua hospedagem Supabase/Render ainda precisa ser feita após publicar.
