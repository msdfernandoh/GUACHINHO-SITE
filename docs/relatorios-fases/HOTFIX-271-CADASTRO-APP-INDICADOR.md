# Hotfix 271 — Cadastro direto no app do indicador

## Objetivo

Corrigir o link **Quero me cadastrar** da tela de acesso do app instalado do indicador.

## Alteração

- O link deixou de apontar para a landing institucional `/parceiros`.
- Agora abre diretamente o formulário tenant-aware em `/parceiros/cadastro`.
- Como a rota é relativa, o host, a identidade visual e o tenant ativo permanecem os mesmos no app instalado, inclusive em domínios Racon.

## Validação

- Teste de contrato confirma que a tela de login contém o destino `/parceiros/cadastro` e não mantém o antigo destino institucional para esse CTA.

## Impacto

Nenhuma tabela, regra de comissão, permissão, sessão ou dado existente foi alterado.
