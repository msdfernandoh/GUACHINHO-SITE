# Fase 156 — Cadastro completo de grupos e opções fixas reduzidas

## Objetivo

Completar o cadastro de grupos no ERP e na Platform sem criar estruturas paralelas para dados que já existiam, além de permitir várias opções comerciais fixas de parcela reduzida, como 60% e 70%.

## Decisões de arquitetura

- `fundo_reserva_percentual`, `seguro_habilitado`, `seguro_percentual` e `observacoes` continuam em `grupos_consorcio`.
- O seguro permanece armazenado como fator decimal: `0,0004` equivale a `0,04%` do saldo.
- A tabela comercial reutiliza o bucket privado `grupos-tabelas`, `grupos_tabelas` e `grupos_tabelas_historico` da migration 152.
- As opções fixas reduzidas pertencem ao catálogo global do grupo e são armazenadas em `grupos_consorcio.percentuais_parcela_reduzida`. A primeira opção é o padrão compatível com o campo singular legado.
- As três faixas de comissão não foram alteradas e não dependem da quantidade de percentuais fixos cadastrados.

## Compatibilidade e preservação

- Não há backfill nem recálculo de propostas, contratações ou vendas.
- Grupos antigos com a nova coleção nula continuam usando `percentual_parcela_reduzida`.
- O ERP só aplica a coleção diretamente em grupos locais pertencentes ao próprio tenant; catálogo global continua exclusivo da Platform.
- O snapshot da proposta valida o percentual reduzido selecionado contra as opções do grupo e preserva a escolha aceita pelo cliente.

## UX entregue

- campos de fundo de reserva, seguro prestamista e observações no cadastro compartilhado;
- inclusão opcional da tabela comercial durante o cadastro, após a criação do UUID definitivo;
- cadastro dinâmico de várias opções fixas reduzidas;
- escolha da opção reduzida na tela pública de grupos;
- ações separadas “Salvar e continuar” e “Salvar e voltar para Grupos”.

## Banco e segurança

- Migration forward-only: `154_grupos_opcoes_reduzidas_e_cadastro_completo.sql`.
- RPC `rpc_salvar_percentuais_parcela_reduzida_grupo` exige autenticação, mantém escrita global exclusiva do Platform Superadmin e aceita escrita tenant apenas no grupo `LOCAL` originado pela própria empresa.
- `PUBLIC`, `anon` e `service_role` não recebem execução da RPC de usuário.

## Verificações

- dry-run da migration 154 contra o Supabase principal;
- testes direcionados do cálculo, snapshot e leitura de propostas;
- TypeScript sem erros;
- lint sem erros e dentro do baseline de avisos;
- build e suíte regressiva registrados no fechamento da fase.

## Roll-forward

Se houver regressão de interface, a aplicação pode voltar a ler somente o primeiro percentual. A coluna e os dados novos permanecem preservados; qualquer correção de banco deve ser forward-only.
