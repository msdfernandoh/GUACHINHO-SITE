# Fase 159 — Ativação de Master Franquia com status canônico

## Objetivo

Corrigir a falha na ativação da Master Franquia causada pela gravação de valores incompatíveis com a restrição `empresas_status_ativo_coerente`.

## Diagnóstico

A tabela `empresas` define os estados canônicos `ativo`, `suspenso`, `cancelado` e `em_treinamento`, mantendo o booleano `ativo` coerente com o status. As RPCs do hub da Platform tentavam gravar `ativa` e `suspensa`, impedindo a transição no banco.

## Implementação

- migration `158_fix_status_canonico_master_franquia.sql` redefine ativação, suspensão e reativação;
- ativação e reativação gravam `status = 'ativo'` e `ativo = true`;
- suspensão grava `status = 'suspenso'` e `ativo = false`;
- auditoria registra os mesmos valores canônicos;
- hub e listagem reconhecem os estados canônicos e preservam leitura defensiva dos aliases antigos;
- ações exibidas no hub passam a respeitar corretamente cada estado: ativar, suspender ou reativar.

## Integridade

A constraint existente foi preservada integralmente. Não houve alteração destrutiva nem reescrita dos dados atuais.

## Validação

Foi adicionado o contrato `ativacao-master-status-158-contract.test.ts`, cobrindo SQL, auditoria e reconhecimento dos estados pela interface.
