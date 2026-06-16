# Testes — Fase 9 (Conteúdo, prova social e autoridade)

Migration: `supabase/migrations/010_conteudo_prova_social.sql` (no repositório, `009` é IA).

## Público

- [ ] `/casos-de-sucesso` — hero, filtros, cards, CTAs, disclaimer
- [ ] `/casos-de-sucesso/[slug]` — detalhe, SEO, evento `caso_sucesso_visualizado`
- [ ] `/dicas-do-tche` — listagem e filtros
- [ ] `/dicas-do-tche/[slug]` — artigo, relacionadas, evento `dica_visualizada`
- [ ] `/perguntas-frequentes` — accordion, busca, categorias, evento `faq_visualizado`
- [ ] `/parceiros` — cards por tipo, evento `parceiro_visualizado`
- [ ] CTAs disparam `cta_conteudo_simulador` e `cta_conteudo_whatsapp`
- [ ] Itens com `publicado = false` não aparecem no público

## Admin (master / SRD)

- [ ] Menu **Conteúdo** visível só para master e SRD
- [ ] `/admin/conteudo/casos` — criar, editar, publicar, destaque, upload imagem
- [ ] `/admin/conteudo/dicas` — idem
- [ ] `/admin/conteudo/depoimentos` — CRUD (sem página pública dedicada)
- [ ] `/admin/conteudo/faq` — CRUD + seed inicial após migration
- [ ] `/admin/conteudo/parceiros` — CRUD + logo
- [ ] Excluir — apenas **master**

## Home

- [ ] Até 3 casos em destaque (fallback para publicados se não houver destaque)
- [ ] Até 3 dicas em destaque
- [ ] Parceiros CMS em destaque na seção Parceiros
- [ ] Seções de casos/dicas ocultas quando não há conteúdo publicado

## IA

- [ ] Prompt inclui links FAQ, dicas, casos
- [ ] Quick actions abrem rotas corretas

## Regressão

- [ ] `/`, `/simulador`, `/grupos`, `/cartas-contempladas`, `/oportunidades-imobiliarias`, `/calculadoras`
- [ ] Widget IA/chat
- [ ] `/admin/leads`

## Comandos

```bash
cd gauchinho-app
npm test
npm run build
```

## RLS (Supabase)

- [ ] `anon` só lê registros com `publicado = true` (casos, dicas, depoimentos, FAQ, parceiros)
- [ ] Staff (`is_staff()`) gerencia todas as tabelas de conteúdo
- [ ] Buckets `conteudo`, `depoimentos`, `parceiros` — upload staff
