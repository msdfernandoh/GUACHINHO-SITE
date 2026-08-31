# Fase 162 — Identidade independente do tenant Racon

## Objetivo

Separar integralmente a apresentação da empresa que usa o modelo
`racon_inspired` da identidade Gauchinho, mantendo os mesmos recursos públicos e
administrativos da plataforma multiempresa.

## Implementação

- o contexto de marca entrega nome, slug, logo e cores efetivas aos componentes
  client-side;
- o site Racon usa superfícies brancas, texto escuro e azul do tenant nas páginas
  institucionais e operacionais;
- login, Admin, ERP e Área do Parceiro usam nome, logomarca e cor primária da
  empresa resolvida pelo domínio;
- o Admin Racon deixa de herdar a classe escura e a navegação amarela do tenant
  Gauchinho;
- simulador, grupos, calculadoras, proposta, eventos e mensagens comerciais não
  apresentam mascote nem textos fixos do Gauchinho no domínio Racon;
- metadata, OpenGraph e JSON-LD deixam de misturar as duas organizações;
- o assistente específico do Gauchinho permanece restrito ao tenant original.

## Multi-tenancy e preservação

A decisão visual continua derivada do host resolvido, de `empresa_branding` e de
`empresa_site_modelos`. Nenhum dado comercial foi alterado e não há fallback de
marca entre empresas. O tema original do Gauchinho permanece disponível somente
em seu próprio domínio.

## Validação

O contrato `identidade-racon-independente-162-contract.test.ts` verifica os
shells público, autenticação, Admin, ERP, simulador e o isolamento do assistente.

- Build de produção e TypeScript validados.
- Inspeção local de home, simulador, grupos e login: fundo branco, menus do
  modelo e textos da empresa Sorriso, sem texto ou mascote Gauchinho.
- Admin/ERP validados por compilação e contratos; a inspeção autenticada depende
  de sessão da empresa e não foi realizada nesta fase.
- Sem migration ou alteração de dados comerciais.
