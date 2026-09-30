# Hotfix — Destino do parceiro comercial após login

Data: 30/09/2026

## Incidente e diagnóstico

O novo usuário Thiago foi criado no tenant Sorriso com perfil técnico
`parceiro` e vínculo N:N ativo no papel `parceiro_comercial`. A troca de senha
foi concluída; o log de Produção registrou a falha seguinte em `/admin`:
`Sem permissão para executar esta operação nesta empresa`.

O papel `parceiro_comercial` possui acesso à Área do Parceiro, e não ao
backoffice administrativo. O participante comercial do usuário está ativo.
Portanto, não havia falha de senha nem de autorização: o destino padrão do
login era incompatível com o papel escolhido.

## Correção

O layout de `/admin` identifica o código do papel no vínculo N:N já resolvido
para o host atual. Para `parceiro_comercial`, redireciona a `/area-parceiro`
antes de carregar qualquer recurso administrativo.

## Segurança e dados

- Não adiciona permissões administrativas ao parceiro.
- Não altera papel, usuário, senha, participante ou vínculo existente.
- O tenant e o papel continuam resolvidos no servidor pelo vínculo ativo.
- Usuários internos mantêm o fluxo normal de `/admin`.
