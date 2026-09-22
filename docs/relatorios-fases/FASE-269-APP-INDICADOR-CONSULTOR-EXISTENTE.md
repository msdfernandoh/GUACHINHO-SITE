# Fase 269 — App de indicação para consultor existente

## Objetivo

Permitir que um consultor existente seja habilitado no Programa de Parceiros e
no app de indicação sem a criação de uma segunda pessoa comercial, usuário ou
CPF no mesmo tenant.

## Fluxo

1. O cadastro valida CPF, e-mail, WhatsApp e PIX.
2. Se já existir um participante ativo com o tipo `CONSULTOR`, ele é
   reutilizado.
3. É criado apenas o vínculo ao `programa_indicadores`, o tipo técnico
   `INDICADOR` e o perfil inicial Gerador de Oportunidades.
4. Um consultor que já tenha conta autenticada preserva a senha atual.
5. Quando não há uma credencial Auth, o sistema cria a primeira com os últimos
   seis dígitos do CPF como senha inicial.

## Proteções

- CPF relacionado a participante inativo não é reativado pelo cadastro público.
- CPF de participante que não é consultor não é reutilizado automaticamente.
- Rollback remove somente usuário, Auth e vínculo criados na tentativa atual;
  nunca exclui o consultor existente.
- A habilitação é registrada em `participante_auditoria`.

## Validação

- Teste unitário para a senha inicial de seis dígitos.
- Teste contratual para o reaproveitamento do consultor e preservação da
  credencial existente.
- TypeScript, ESLint e build de produção executados.
