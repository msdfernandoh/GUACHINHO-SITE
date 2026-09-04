# Fase 217 - Portal parceiro: acesso a links de proposta

Data: 04/09/2026

## Incidente

O link curto de proposta gerado em `raconsinop.com.br` usava corretamente a
rota pública `/proposta/rascunho?c=...`, mas o proxy do site parceiro não a
reconhecia como rota operacional. Como consequência, ele a reescrevia para a
home institucional do parceiro.

## Correção

- Incluído o prefixo `/proposta` em `partnerOperationalPaths` no proxy.
- A rota pública agora chega à página de proposta original com os cabeçalhos de
  empresa e parceiro já resolvidos pelo host.
- O endpoint do rascunho continua validando o código curto contra o
  `empresa_id` resolvido no servidor; não foi criado fallback de tenant nem
  aceito tenant do navegador.

## Validação

- `npx vitest run src/lib/platform/master-parceiro-visibilidade-212-contract.test.ts src/lib/contratacoes-online/proposta-link-curto-contract.test.ts` aprovado
  (5 testes).
- `npx tsc --noEmit` aprovado.

