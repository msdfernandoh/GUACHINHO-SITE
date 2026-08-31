# ERP — Cronograma próprio no cadastro de regra por perfil

Data: 31/08/2026. Estado: implementação local completa; sem publicação ou alteração remota de banco.

## Pedido e correção

Ao desmarcar seguir a franqueadora, o formulário abre quantidade de parcelas,
mês e percentual de cada parcela. Há atalhos para SDR em seis parcelas e
indicador em pagamento único. A distribuição fecha 100% da comissão do perfil,
com resíduo de arredondamento na última parcela. Na base de valor fixo, informa-se
o total e os valores em reais de cada parcela. O mês 1 representa a primeira
parcela da venda, não uma ordem de pagamento imediato.

O checkbox antes ausente no FormData era interpretado como verdadeiro. Agora o
estado é explícito e o servidor reconhece somente `true` como herança.
`etapas_cronograma` é carregado na edição e validado antes da persistência:
quantidade, meses positivos distintos, valores positivos e soma exata.
Não há mais substituição silenciosa por parcela única. O modal tem rolagem e
preserva o programa selecionado ao editar, limpando a seleção ao iniciar nova regra.

## Segurança e preservação

Mantidos o guard `requireErpRouteAccess`, comparação com tenant ativo,
`can_write_tenant_internal`, sessão Supabase e filtros `empresa_id` das escritas.
Nenhuma migração, nova tabela, alteração de RLS, recálculo, pagamento ou escrita
remota foi executada. Alterações preexistentes de outras tarefas foram preservadas.

## Validação

- Testes direcionados de cronograma, parser da franquia e governança 107: 25 aprovados.
- TypeScript sem emissão: aprovado.
- ESLint do escopo: zero erros; 31 avisos preexistentes nos arquivos antigos;
  os três arquivos novos não introduzem avisos.
- Não foi feita homologação autenticada no navegador ou teste contra banco remoto.

## Aplicação financeira preparada

Foi criada a migration forward-only `171_cronograma_proprio_perfil_e_opcao_impostos`.
Ela preserva o motor da franqueadora e envolve a RPC V2 somente para reconstruir
a previsão do perfil que optou por cronograma próprio ou pela base bruta sem
desconto fiscal. Regras existentes que seguem a franqueadora e aplicam impostos
continuam no caminho anterior, sem mudança de modelo ou cálculo.

O motor resolve tenant, perfil, programa, vigência, tipo e modalidade; falha em
ambiguidade; distribui o total com resíduo monetário na última parcela; congela
base bruta/líquida, imposto e escolha no snapshot. A elegibilidade continua
proporcional aos recebimentos da franqueadora pelo mecanismo canônico da fase 076.
Previsão com valor elegível ou pago não pode ser substituída. Não há backfill ou
recálculo histórico.

Para R$ 100.000 de crédito e comissão de franquia de 4%, uma regra SDR de 12,5%
gera R$ 500 (0,5% da cota). Em seis parcelas iguais, ficam cinco de R$ 83,30 e a
última de R$ 83,50, preservando exatamente R$ 500.

A opção “Aplicar desconto de impostos” vem marcada para compatibilidade. Marcada,
usa a comissão líquida; desmarcada, usa a base bruta. Para percentual direto da
cota ou valor fixo, o imposto é deduzido do resultado quando marcado.

A migration 171 foi aplicada no Supabase principal após dry-run exclusivo. O
pós-check informou que o banco remoto está atualizado e não há migration pendente.

Rollback da aplicação: voltar o código compatível. Depois de aplicada, a migration
é forward-only; eventual correção deve preservar a coluna e criar nova versão da
RPC. Fatos já gerados continuam snapshots históricos. Publicação não realizada.
