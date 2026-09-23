# Fase 274 — PDF de propostas alinhado ao catálogo vigente

As propostas originadas do simulador de grupos agora recalculam, no momento da emissão ou novo download do PDF, a estratégia comercial salva contra os dados atuais de `grupos_consorcio`, `grupos_cotas` e modalidades de lance ativas. Dessa forma, alteração da taxa administrativa, fundo de reserva ou seguro do grupo passa a refletir parcela, saldo devedor, crédito líquido e totais do documento.

O PDF não reutiliza mais o arquivo em cache para propostas vinculadas a `simulacao_grupo_id`; o arquivo é reemitido com o catálogo vigente. A correção usa o mesmo gerador tenant-aware compartilhado pelos sites Gauchinho Consórcios e Racon Sinop. Não altera vendas, contratações formalizadas ou seus snapshots históricos.
