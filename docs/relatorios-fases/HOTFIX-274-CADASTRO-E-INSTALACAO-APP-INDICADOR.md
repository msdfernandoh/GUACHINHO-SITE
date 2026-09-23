# Hotfix 274 — Cadastro e instalação do app de indicação

## Objetivo

Priorizar o cadastro do parceiro antes da instalação do PWA e deixar a
orientação técnica de instalação no momento em que o usuário já possui acesso
ao seu painel.

## Implementação

- O CTA público passou a ser **Cadastre-se e baixe o app** e preserva a
  modalidade de parceiro escolhida no formulário.
- As páginas de cada modalidade exibem esse CTA no hero e no fechamento da
  página para reforçar a adesão ao app.
- O painel autenticado ganhou um card de instalação. Em iPhone, ele instrui a
  usar Compartilhar e **Adicionar à Tela de Início**; nos demais navegadores,
  aciona a instalação PWA quando disponível.

## Escopo e dados

Não houve migration ou alteração de dados. O acesso já existente ao painel
continua disponível pelo login; somente a ordem e a apresentação dos CTAs
foram reorganizadas.
