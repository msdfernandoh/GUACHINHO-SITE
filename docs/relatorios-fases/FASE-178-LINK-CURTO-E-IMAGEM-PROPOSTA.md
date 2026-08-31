# Fase 178 — Link curto e imagem da proposta

## Objetivo

Substituir URLs de rascunho que carregavam todo o JSON assinado por um endereço curto e permitir o compartilhamento da primeira visão comercial como imagem.

## Implementação

- a migration `175` cria `proposta_links_curtos`, tenant-aware e sem acesso direto de `anon` ou `authenticated`;
- o payload permanece no servidor por sete dias e o endereço público contém somente um código aleatório de 12 caracteres;
- a resolução cruza código, empresa derivada do host e expiração;
- links legados com `d` e `s` continuam aceitos durante a transição;
- o modal gera localmente um cartão PNG quadrado com tipo do bem, crédito, parcela e protocolo e o copia para a área de transferência;
- copiar a imagem não envia dados ao servidor nem altera a proposta.

## Preservação

Nenhuma proposta, contratação, cálculo ou snapshot histórico é modificado. O código curto não concede acesso cross-tenant e expira automaticamente.
