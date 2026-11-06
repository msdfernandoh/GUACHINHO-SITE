# Relatório — Robô de lances por cota e contas

Data: 06/11/2026  
Fase: organização operacional do robô de lances Newcon/Racon

## Entrega

- O robô filtra as cotas pela mesma conta operacional usada pelo robô de boletos:
  `GAUCHINHO_ERONI` ou `RACON_FERNANDO`.
- A estratégia da cota passou a guardar embutido separado para lance livre, fixo e
  segundo fixo.
- A tela de Lances & Estratégias exibe as modalidades disponíveis do grupo e impede
  selecionar modalidade que o grupo não oferece.
- O serviço usa a estratégia confirmada/ativa da cota e não oferta modalidades que
  foram desmarcadas.
- A repetição de seis assembleias usa validade operacional de cinco meses, encerrando
  uma assembleia antes do prazo real.
- A configuração de login/senha dos robôs não sobrescreve contas diferentes; a
  sincronização opcional é limitada aos robôs da mesma conta operacional e vem
  desmarcada por padrão.

## Banco de dados

Migration criada: `supabase/migrations/334_lances_por_cota_e_login.sql`.

Alterações principais em `cota_estrategias_lance`:

- `lance_livre_embutido_percentual`
- `lance_fixo_embutido_percentual`
- `segundo_lance_fixo_embutido_percentual`

Também foram adicionados validação de valores não negativos, índice operacional e
normalização do vínculo de login dos robôs existentes.

## Validação

- `node --check scripts/robo-lances-service.mjs` — aprovado.
- `npx tsc --noEmit` — aprovado.
- `npm run build` — aprovado; 173 páginas geradas.
