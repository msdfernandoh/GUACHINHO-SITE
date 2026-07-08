# Testes — Pacote Eventos Sorteio de Brindes

Migration: `supabase/migrations/022_eventos_sorteios.sql`

## Ativar sorteio

1. Admin → **Eventos** → editar evento.
2. Botão **Sorteio / Brindes** (ou `/admin/eventos/[id]/sorteio`).
3. Marque **Ativar sorteio neste evento**, preencha textos e salve.
4. Evento deve estar **ativo** e **publicado** para a página pública funcionar.

## QR Code

Na aba do sorteio (com sorteio ativo):

- QR aponta para `/eventos/[slug]/sorteio`.
- **Exibir QR Code em tela cheia**, **Copiar link**, **Abrir página**, **Baixar QR Code** (SVG).

## Cadastro do participante

1. Escanear QR ou abrir o link no celular.
2. Preencher nome, telefone, valor mensal (máscara BRL) e tipo do sonho.
3. Enviar → tela com código **GCH-0001** (sequencial por evento).
4. Lead criado com `origem = evento_sorteio` e `dados_simulacao` com código e valores.

## Lista no admin

Tabela com filtros (tipo, ganhador, status), WhatsApp, marcar/remover ganhador, cancelar participante, exportar CSV.

## Realizar sorteio

1. Botão **Realizar sorteio** → animação de códigos (~3s).
2. **Confirmar vencedor** grava `ganhador`, `sorteado_em` e linha em `eventos_sorteio_resultados`.
3. **Sortear novamente** não repete quem já é ganhador.

## Home

Marque **Mostrar na página principal** no sorteio ativo e aberto. A Home exibe faixa com CTA **Participar do sorteio**. Prioridade: evento em destaque, depois data mais recente.

## Testes automatizados

```bash
cd gauchinho-app
npm test -- src/lib/eventos-sorteio
```

## Build

```bash
npm run build
```
