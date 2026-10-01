# Hotfix — validação do cadastro de indicador

Data: 30/09/2026

## Incidente

Na etapa **Agora crie seu acesso ao painel**, o cadastro exibia dois campos sem
rótulos persistentes. Gerenciadores de senha podiam interpretar o CPF como
login e preencher o campo de e-mail com os últimos seis dígitos do CPF. A
validação então mostrava apenas a mensagem genérica **Complete as opções desta
etapa**, sem identificar que faltava um e-mail válido.

## Correção

- os campos agora possuem rótulos explícitos para **CPF** e **E-mail para acesso
  e recuperação de senha**;
- o CPF sinaliza aos preenchimentos automáticos que não é uma credencial de
  senha;
- a tela informa claramente que nenhuma senha deve ser digitada nessa etapa;
- a senha inicial continua sendo criada automaticamente com os últimos seis
  dígitos do CPF;
- cada etapa informa o campo exato ausente ou inválido, em vez de uma mensagem
  genérica.

## Abrangência SaaS

O formulário é compartilhado pela família Racon. A correção vale para Racon
Sinop, Racon Sorriso e demais tenants que utilizem o mesmo programa, mantendo o
cadastro e os dados isolados pelo tenant resolvido no servidor.

## Validação

Testes automatizados cobrem CPF/e-mail válidos, a entrada equivocada da senha
no campo de e-mail e mensagens específicas nas demais etapas. Lint e build de
produção foram executados antes da publicação.

