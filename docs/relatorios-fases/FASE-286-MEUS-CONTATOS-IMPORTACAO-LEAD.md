# Fase 286 — Meus contatos, importação e conversão para lead

## Entrega

- Novo menu tenant-aware **Meus contatos** em `/admin/contatos`.
- Importação de arquivos `.csv` e `.vcf`, com normalização de telefone e upsert por usuário, empresa e telefone. O parser foi validado com o export do iCloud `vCards iCloud (1).vcf`, incluindo `item1.TEL`, prefixos `+55` e prefixos antigos de operadora `015`.
- Cada usuário visualiza somente os próprios contatos na empresa ativa.
- Edição de empresa e profissão após a importação.
- Ação **Enviar para lead** usa `rpc_upsert_lead_por_telefone`, preservando a deduplicação existente e atribuindo o usuário da sessão como `srd_responsavel_id`/nome após validação server-side do vínculo N:N.

## Banco e segurança

A migration `281_meus_contatos_telefone.sql` cria `contatos_usuario` como tabela tenant-scoped, com chave composta lógica, índice e RLS para o vínculo ativo. Nenhum dado existente é alterado ou removido.

## Limitações conhecidas

O parser CSV atende arquivos simples separados por vírgula ou ponto e vírgula; campos com vírgulas internas devem ser exportados entre aspas sem separadores internos. A importação é feita no navegador e enviada ao servidor em lote.
