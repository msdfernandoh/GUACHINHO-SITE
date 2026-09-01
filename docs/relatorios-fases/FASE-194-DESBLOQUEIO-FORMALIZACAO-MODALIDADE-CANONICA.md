# Fase 194 — Desbloqueio da formalização por modalidade canônica

## Diagnóstico

A contratação possuía grupo, produto, consultor, perfil e regras homologadas,
mas os cards de modalidade eram exibidos sem uma opção efetivamente selecionada.
O resumo indicava `Modelo de comissão: não selecionado`, os percentuais ficavam
zerados e o botão permanecia desabilitado sem explicar a causa.

## Correção

- a modalidade preservada na proposta passa a ser selecionada automaticamente
  quando possui regra homologada e percentual positivo;
- na ausência dela, a resolução usa a modalidade canônica do grupo; somente uma
  alternativa única pode ser fixada automaticamente;
- se o consultor tiver apenas uma regra homologada compatível com a venda, ela
  fica fixa; se possuir mais de uma, o operador escolhe entre as regras elegíveis;
- percentuais sempre vêm da regra selecionada, sem padrão financeiro implícito;
- modalidades sem regra para o perfil continuam visíveis para diagnóstico, mas
  não podem ser selecionadas;
- o formulário lista todas as pendências que ainda impedem a formalização e
  confirma explicitamente quando a venda está pronta;
- a RPC canônica continua realizando a validação final no servidor.

## Validação

- testes unitários cobrem preferência pela modalidade da proposta e fallback
  para uma regra homologada;
- lint, TypeScript e build de produção aprovados;
- nenhuma venda, comissão ou configuração financeira existente foi alterada.
