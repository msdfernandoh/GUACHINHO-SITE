# Testes — Correção scroll / UX

## Causa principal

**Lenis (smooth scroll)** no layout público interceptava a rolagem do documento. Em páginas longas (`/indicar`, home, eventos) a altura scrollável ficava inconsistente e a barra “agarrava”. Já havia desativação parcial só em `/grupos`, `/simulador` e `/calculadoras`.

**Correção:** Lenis removido do fluxo ativo; scroll nativo em `html`/`body`. `LenisProvider` apenas limpa classes/styles residuais do Lenis.

## Body `overflow: hidden` preso

Menu mobile e modais gravavam `document.body.style.overflow` sem contador. Ao fechar em sequência ou com Lenis, o body podia ficar travado.

**Correção:** `src/lib/ui/use-lock-body-scroll.ts` com contador de locks — usado em menu, chat IA, modal especialista, modais de calculadora/simulador/grupos.

## Overlays / mascote

- Mascote decorativo: `pointer-events-none` em `MascoteGauchinho`.
- `ConteudoPageShell` já tinha mascote fixo com `pointer-events-none`.
- Chat IA: sem overlay fullscreen quando fechado; lock só com painel aberto.

## CSS global

- `html`/`body`: `overflow-x: hidden`, scroll nativo (`scroll-behavior: auto`).
- Páginas de formulário: `pb-24`/`pb-28` para não cobrir botão enviar pelo FAB do chat.

## Checklist manual

### Desktop

Rolar com mouse, trackpad e arrastar barra em: `/`, `/indicar`, `/calculadoras`, `/simulador`, `/grupos`, `/eventos`, `/eventos/[slug]`.

Abrir/fechar: menu mobile, chat IA, modal Especialista — scroll do documento deve voltar.

### Mobile

Scroll com dedo; chat e menu; formulário longo em `/indicar`; sem scroll horizontal.

### Admin

`/admin/leads`, `/admin/agenda`, `/admin/grupos` — rolagem em `main` (layout admin).

## Arquivos principais

- `src/components/public/lenis-provider.tsx`
- `src/lib/ui/use-lock-body-scroll.ts`
- `src/app/globals.css`
- `public-header-nav.tsx`, `ia-chat-widget.tsx`, `especialista-lead-modal.tsx`, `grupos-public-client.tsx`, modais de lead

## Comandos

```bash
cd gauchinho-app
npm test
npm run build
```
