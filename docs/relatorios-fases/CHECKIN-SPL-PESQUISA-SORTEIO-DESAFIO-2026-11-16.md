# Check-in SPL · Pesquisa, Sorteio e Desafio (16/11/2026)

## Objetivo
Check-in dos corretores no encontro "Chaves para o Futuro" (SPL × Racon, 17/11/2026 08:00),
gerando leads de clientes indicados, cupons de sorteio, o desafio do primeiro consórcio,
e as perguntas do check-in (sem NPS, a pedido em 16/11).

## Fluxo
1. **Corretor**: nome, WhatsApp, imobiliária (lista das pré-cadastradas ou "Outra") e função
   (Colaborador / Proprietário). Gera presença + cupom próprio (`origem_cupom = cadastro`).
2. **Dados da imobiliária** (só proprietário, se o cadastro não está completo): e-mail, CNPJ
   (opcional), nº de corretores, modelo de parceria e PIX (quando recebe comissão). Pode "completar depois".
3. **Clientes**: nome, telefone e empreendimento SPL (opcional). Cada cliente gera 1 cupom
   (`origem_cupom = indicacao`, no nome do corretor). Meta de 5 incentivada (contador e aviso),
   não obrigatória; botão para adicionar mais. Cliente já indicado no evento não gera cupom.
4. **Desafio**: imóvel 100 mil (375 × 200), imóvel 200 mil (750 × 200), imóvel Grupo SPL
   200 mil (1.076 × 159), veículo 104 mil (604,50 × 104) ou sem interesse. Vira o produto de
   interesse do lead do corretor.
5. **Pesquisa**: veículo, moradia, capacidade mensal, avaliação do encontro, momento atual
   (mesmas opções do check-in conversacional).
6. **Final** (logo após a pergunta do momento atual; o NPS foi retirado deste fluxo): lista de cupons; pode voltar e indicar mais clientes.

## Banco (migration 345 · arquivo `345_spl_evento_checkin_imobiliarias.sql`, aplicada em produção em 16/11/2026)
- `spl_imobiliarias`: responsável, telefone, e-mail e modelo passam a aceitar nulo;
  novas colunas `cadastro_completo`, `origem_cadastro` (`PORTFOLIO` | `PRE_CADASTRO` | `EVENTO`).
- 15 imobiliárias pré-cadastradas (empresa `gauchinho`), status `PENDENTE`.
- `spl_vendedores.funcao` (`COLABORADOR` | `PROPRIETARIO`).
- `spl_clientes`: origem `EVENTO`, `evento_id`, `cupom_codigo`.
- `eventos.checkin_fluxo` (`padrao` | `spl_imobiliarias`).
- Evento `chaves-para-o-futuro` criado (prefixo `SPL-`, check-in `ativo_agora`) com sorteio.
- Inativados: `network-de-negocios` e `do-salario-ao-patrimonio`.

## QR impresso (migration 346)
O QR dos materiais é `/qr/externo`, que abre o evento **externo** ativo mais recente.
O "Chaves para o Futuro" virou `tipo_checkin = externo` e o "Sorteios e Oportunidades"
foi inativado. O QR abre direto no cadastro do corretor. Depois do evento, reativar
o `sorteios-e-oportunidades` para os panfletos voltarem ao fluxo normal.

## Código
- `lib/spl/evento-tipos.ts`, `lib/spl/evento-checkin.ts`, `app/api/public/spl/evento/route.ts`
- `components/spl/spl-evento-checkin.tsx` (+ `-server.tsx`), `app/(landing-spl)/spl/evento/page.tsx`
- Botão "Pesquisa, Sorteio e Desafio" ao lado de "Ver modelos de parceria" (`spl-landing.tsx`)
- `spl.<domínio>/evento` → `/spl/evento` (`lib/landings/subdominios.ts`)
- `/eventos/[slug]/sorteio` e `/qr/[slug]` usam o fluxo SPL quando `checkinFluxo = spl_imobiliarias`
- `/qr/network`: entre palestras ativas, prefere `checkin_modo = ativo_agora` (o Herança
  Inteligente de 17/11, só agendado e com QR próprio, não toma o QR impresso)

## Validação
- `tsc` sem erros; vitest de `landings`, `spl` e `eventos-sorteio`: 157 testes ok (novo teste de prioridade do QR).
- Teste ponta a ponta local contra o banco de produção (corretor proprietário da X2, 2 clientes,
  duplicidade bloqueada, desafio no lead). Dados de teste removidos depois;
  a X2 voltou a pendente.

## Pendências
- Deploy de produção feito em 16/11/2026 (Vercel CLI), já sem o NPS.
- Painel admin ainda não mostra a função do vendedor nem os cupons por cliente.

## Atualização 17/11/2026 · QR impresso para o Herança Inteligente (migration 347)
- O QR fixo (`/qr/externo` e `/qr/network`) respeita um vínculo manual ativo em
  `qr_codes_unicos_vinculos` (dentro do período): abre aquele evento com o check-in do próprio evento.
- `/qr/externo` está vinculado ao Encontro Método Herança Inteligente até 18/11/2026 08:00 (Sinop),
  com o check-in conversacional padrão (veículo, moradia, valor mensal, avaliação do encontro, momento).
- O cadastro do Herança segue em `filhos.raconsinop.com.br/evento`.
- O check-in SPL fica só em `spl.raconsinop.com.br/evento` (evento `chaves-para-o-futuro` voltou a `tipo_checkin = evento`).
- Depois do vínculo vencer, o `/qr/externo` volta a abrir o evento externo ativo mais recente
  (hoje nenhum: o `sorteios-e-oportunidades` está inativo).
