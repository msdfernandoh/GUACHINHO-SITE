# Lance Livre padrão e Lance Fixo do grupo 1253 — 07/11/2026

## Diagnóstico

O cadastro do grupo 1253 não possuía nenhuma linha ativa em `grupos_modalidades_lance`. Por isso, a tela não conseguia apresentar o Lance Fixo de 25%; grupos com duas alternativas legadas também estavam sendo classificados pelo texto de forma ambígua.

## Correção

- Lance Livre passou a ser tratado como modalidade padrão de todos os grupos, mesmo quando não há linha explícita no cadastro.
- O grupo 1253 recebeu a modalidade ativa `Lance Fixo 25%`, com embutido máximo de 25%.
- Quando o cadastro legado possui duas alternativas sem tipo explícito, a maior percentual é classificada como Lance Fixo e a menor como 2º Lance Fixo.
- O formulário mantém percentuais/valores totais e embutido separados por modalidade.

## Validação

O registro do grupo 1253 foi confirmado no Supabase após a correção. TypeScript e build de produção foram aprovados com 173 páginas.
