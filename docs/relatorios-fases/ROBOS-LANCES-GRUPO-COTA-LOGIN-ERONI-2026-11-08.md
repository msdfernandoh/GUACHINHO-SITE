# Relatório — Robô de lances por grupo/cota e login do Eroni

## Escopo

Corrigir o direcionamento do robô de lances para buscar cada cliente no Newcon
por **Grupo** e **Cota** antes de abrir **Oferta de Lance**, e garantir que as
cotas marcadas para o login `GAUCHINHO_ERONI` não sejam filtradas pelo robô do
login `RACON_FERNANDO`.

## Diagnóstico

- O robô de lances da empresa Gauchinho estava configurado somente para
  `RACON_FERNANDO`.
- A cota 1553/0656 de Luiz Carlos estava marcada como `GAUCHINHO_ERONI` e,
  por isso, era excluída antes da automação chegar à tela de busca.
- O robô também aguardava `domcontentloaded` em páginas Newcon que mantêm
  requisições abertas; isso causava timeout antes do preenchimento de Grupo e
  Cota.

## Correções aplicadas

1. Criado no Supabase o robô ativo **Robô Racon — Lances Automáticos
   (Franquia) - ERONI**, vinculado a `GAUCHINHO_ERONI`, reaproveitando a
   configuração protegida do robô de lances existente sem expor a senha.
2. Mantida a seleção de cotas pelo vínculo do login e pelo filtro explícito de
   `cotas_alvo_ids`.
3. A navegação para `CONAT/frmConAtSrcConsorciado.aspx` e para a tela de
   Oferta de Lance passou a aguardar o compromisso da navegação e os campos
   visíveis, sem depender exclusivamente do evento `domcontentloaded`.
4. O fluxo permanece: login/empresa → Consorciados → Grupo/Cota → Localizar →
   Atendimento → Oferta de Lance.

## Validação

- `node --check scripts/robo-lances-service.mjs`: aprovado.
- `git diff --check`: aprovado.
- Publicado na `main` no commit `cf280fe1`.
- Nenhum lance real foi registrado nesta etapa; portanto nenhum comprovante
  foi inventado ou gravado manualmente.

## Próximo teste operacional

Executar separadamente as cotas 1553/0656 e 1253/0551, cada uma pelo robô
correspondente ao seu login, e conferir no Newcon os protocolos e PDFs antes de
considerar a homologação concluída.
