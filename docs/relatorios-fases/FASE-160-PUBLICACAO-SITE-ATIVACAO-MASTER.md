# Fase 160 — Publicação do site na ativação da Master Franquia

## Diagnóstico

A empresa e sua assinatura eram ativadas, mas `empresa_branding` e
`empresa_site_modelos` permaneciam em `RASCUNHO`. O resolver público exige
empresa ativa, domínio ativo/verificado e branding publicado, portanto o domínio
respondia com “Site não configurado para este domínio”.

## Correção

- a ativação valida domínio principal ativo e verificado;
- valida também a existência da identidade e do modelo do site;
- empresa, assinatura, branding e vínculo do modelo mudam de estado na mesma transação;
- empresas ativadas antes da correção são reconciliadas somente quando já possuem domínio verificado, branding e modelo;
- o checklist da Platform não considera mais apenas o texto do domínio: exige seu estado publicável.

## Segurança e dados

Não foi criado fallback de tenant nem relaxada a resolução por domínio. O
backfill é restrito a empresas já ativas com infraestrutura completa, preservando
o comportamento de falha fechada para cadastros incompletos.

## Validação

O contrato `ativacao-publica-site-159-contract.test.ts` cobre a validação do
domínio, a publicação atômica e os critérios do backfill.
