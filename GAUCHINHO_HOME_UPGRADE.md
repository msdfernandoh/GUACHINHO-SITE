# MISSÃO: Upgrade da Home — Gauchinho Escritório de Soluções Financeiras
# Site atual: https://guachinho-site.vercel.app/
# Projeto: C:\Fernando Hugo\GAUCHINHO SITE

Você é um engenheiro de design sênior de agência Awwwards.
Faça um upgrade completo da página principal (`app/page.tsx` ou equivalente) do projeto.
NÃO mude rotas, lógica de negócio, links ou textos — apenas eleve o visual e as animações.

---

## STACK DO PROJETO (não mude)
- Next.js (App Router)
- Tailwind CSS
- TypeScript

## DEPENDÊNCIAS A INSTALAR (rode antes de editar)
```bash
npm install framer-motion gsap @gsap/react lenis @studio-freight/lenis lucide-react
```

---

## SEÇÃO 1 — HERO ("Qual sonho você quer realizar?")

### Problemas atuais
- Hero plano, sem animação de entrada
- Imagem de fundo estática sem profundidade
- Título aparece sem efeito
- CTAs sem personalidade visual

### O que fazer

**Fundo:**
- Adicionar overlay gradient escuro sobre a imagem: `from-black/70 via-black/40 to-transparent`
- Adicionar efeito parallax leve na imagem de fundo com Framer Motion `useScroll` + `useTransform`

**Título:**
- Animar cada palavra do título com Framer Motion, entrada com `y: 60, opacity: 0` → `y: 0, opacity: 1`
- Stagger de 0.12s entre cada palavra
- Usar `variants` e `staggerChildren`

**Subtítulo:**
- Fade in com delay de 0.6s após o título

**Badges (Consultoria / Simulações / Comparativo):**
- Entrada com slide vindo de baixo, stagger entre eles
- Adicionar ícone Lucide em cada badge: `Brain`, `Calculator`, `ArrowLeftRight`
- Hover com scale(1.05) suave

**Botões CTA:**
- Botão primário "Simular agora": fundo sólido com cor da marca, hover com brilho deslizante (shimmer effect)
- Botões secundários: outline com hover fill suave

**Código de referência para animação do hero:**
```tsx
const heroVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.12, delayChildren: 0.3 }
  }
}
const wordVariant = {
  hidden: { y: 60, opacity: 0 },
  visible: { y: 0, opacity: 1, transition: { duration: 0.7, ease: [0.22, 1, 0.36, 1] } }
}
```

---

## SEÇÃO 2 — CARDS DE OBJETIVO ("O caminho certo começa com clareza")

### Problemas atuais
- Grid de cards sem animação de entrada
- Cards sem profundidade visual
- Hover sem feedback

### O que fazer

**Grid:**
- Usar `whileInView` do Framer Motion com `viewport={{ once: true, margin: "-100px" }}`
- Cada card entra com `y: 40, opacity: 0` → `y: 0, opacity: 1`
- Stagger de 0.08s entre cards

**Cards:**
- Adicionar ícone Lucide relevante em cada card:
  - Imóveis → `Home`
  - Veículos → `Car`
  - Motos → `Bike`
  - Caminhonetes → `Truck`
  - Caminhões → `Container`
  - Carta contemplada → `FileCheck`
  - Oportunidades imobiliárias → `Building2`
  - Grupos → `Users`
- Hover: `scale(1.03)` + `boxShadow` mais pronunciada + seta "→" desliza para direita
- Borda sutil que acende no hover: `border-color` transitioning

**Código de referência:**
```tsx
<motion.div
  initial={{ y: 40, opacity: 0 }}
  whileInView={{ y: 0, opacity: 1 }}
  viewport={{ once: true, margin: "-80px" }}
  transition={{ duration: 0.5, delay: index * 0.08 }}
  whileHover={{ scale: 1.03, transition: { duration: 0.2 } }}
>
```

---

## SEÇÃO 3 — VÍDEO INSTITUCIONAL ("Conheça uma nova forma...")

### O que fazer
- Wrapper do vídeo com border-radius maior e sombra premium
- Adicionar play button overlay customizado (ícone grande centralizado, some ao clicar)
- Badge "Campanha institucional" com animação de entrada
- Bullets da lista com ícone `Check` verde do Lucide, cada item com entrada em stagger
- Seção inteira com fade-in ao entrar na viewport

---

## SEÇÃO 4 — SIMULADOR RÁPIDO

### O que fazer
- Título da seção com badge "Ferramenta premium" animado
- Tabs "Consórcio / Financiamento" com indicador deslizante (não apenas troca de classe)
- Slider de valor com tooltip flutuante mostrando o valor em tempo real
- Botão "Ver simulação completa" com shimmer effect no hover

---

## SEÇÃO 5 — GRUPOS EM DESTAQUE

### O que fazer
- Cards de grupo com entrada em stagger no scroll
- Badge "Imóvel" com cor de fundo suave (azul ou verde)
- Valor de crédito em destaque: fonte maior, peso 700
- Hover: card sobe levemente (`y: -4`) com sombra

---

## SEÇÃO 6 — CTA FINAL ("Pronto para escolher...")

### O que fazer
- Seção com fundo gradient escuro (não branco)
- Título animado entrando de baixo
- Dois botões lado a lado com espaçamento generoso
- Botão primário com efeito shimmer
- Adicionar partículas sutis de fundo OU um gradiente animado com `@keyframes`

---

## SMOOTH SCROLL GLOBAL

Adicionar Lenis no layout raiz (`app/layout.tsx`):

```tsx
'use client'
import Lenis from 'lenis'
import { useEffect } from 'react'

export function SmoothScroll({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const lenis = new Lenis()
    function raf(time: number) {
      lenis.raf(time)
      requestAnimationFrame(raf)
    }
    requestAnimationFrame(raf)
    return () => lenis.destroy()
  }, [])
  return <>{children}</>
}
```

Envolver o `{children}` no layout com `<SmoothScroll>`.

---

## NAVBAR

### O que fazer
- Adicionar efeito de blur/glass quando scroll > 50px:
  ```tsx
  // ao scrollar: className muda para:
  "backdrop-blur-md bg-white/80 shadow-sm border-b border-white/20"
  ```
- Usar `useScroll` do Framer Motion para detectar posição
- Links com underline deslizante no hover (pseudo-elemento animado via Tailwind)

---

## REGRAS GERAIS

1. **Não remover nenhum texto existente** — apenas adicionar camadas visuais e animações
2. **Não mudar rotas ou hrefs** — todos os links ficam iguais
3. **Não mudar a estrutura de dados** — grupos, parceiros e simulador ficam com os mesmos dados
4. **Mobile first** — todas as animações devem respeitar `prefers-reduced-motion`
5. **Performance** — usar `will-change: transform` apenas onde necessário, `once: true` no whileInView
6. **Cores da marca** — manter a paleta atual, apenas adicionar profundidade com gradients e opacidade

---

## ORDEM DE EXECUÇÃO

1. Instalar dependências: `npm install framer-motion gsap lenis lucide-react`
2. Criar componente `SmoothScroll` e adicionar no layout
3. Adicionar efeito glass na navbar
4. Upgradar Hero (maior impacto visual)
5. Animar cards de objetivo
6. Melhorar seção de vídeo
7. Melhorar cards de grupos
8. Upgradar CTA final
9. Rodar `npm run dev` e verificar em mobile e desktop
10. Fazer commit: `git add . && git commit -m "feat: upgrade visual home - animações e efeitos premium"`

---

## TESTE FINAL

Após as alterações, verificar:
- [ ] Hero anima ao carregar a página
- [ ] Cards entram em stagger no scroll
- [ ] Navbar fica glass ao scrollar
- [ ] Smooth scroll funcionando
- [ ] Nenhum link quebrado
- [ ] Mobile responsivo
- [ ] Sem erros no console
