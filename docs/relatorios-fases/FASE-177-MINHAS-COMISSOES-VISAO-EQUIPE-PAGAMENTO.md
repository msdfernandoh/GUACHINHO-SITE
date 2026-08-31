# Fase 177 — Minhas Comissões: visão e pagamento da equipe

## Objetivo

Permitir que Administrador da Empresa/Master e Gestor selecionem um consultor da própria empresa na tela **Minhas comissões**, consultem seu extrato e paguem saldos elegíveis.

## Segurança e integridade

- consultores continuam restritos à própria identidade comercial;
- o seletor é disponibilizado ao `super_admin` e a `admin_empresa`/`gestor` com `gerenciar_comissoes`;
- sem parâmetro válido, a tela retorna à identidade comercial do próprio usuário e preserva a visão **Minhas comissões**;
- pagamento exige adicionalmente `gerenciar_financeiro`;
- o participante selecionado é revalidado no servidor contra `empresa_id`;
- o pagamento reutiliza `rpc_registrar_pagamento`, preservando elegibilidade, idempotência, locks, caixa append-only e auditoria transacional;
- a migration `174` alinha a autorização interna da RPC com `gerenciar_financeiro`, sem ampliar outras escritas tenant;
- nenhum percentual, previsão ou registro histórico é recalculado.

## Interface

O cabeçalho passa a apresentar **Consultor da equipe** para perfis autorizados. Cada parcela com saldo elegível apresenta **Pagar comissão**. O consultor mantém a ação individual de conferência após o pagamento.

## Verificação

- teste contratual de autorização, isolamento tenant e uso do serviço transacional;
- suíte direcionada de Minhas Comissões;
- build de produção.
