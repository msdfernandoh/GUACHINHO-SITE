# Testes — Fase 5 Oportunidades Imobiliárias

Checklist manual e automatizado após aplicar `supabase/migrations/005_oportunidades_imobiliarias.sql`.

## Pré-requisito

```powershell
Set-Location "C:\Fernando Hugo\GAUCHINHO SITE\gauchinho-app"
npm test
npm run build
```

## Admin Master

- [ ] Criar imobiliária em `/admin/imobiliarias/novo`
- [ ] Upload logo/banner (Storage buckets `imobiliarias`, `imoveis`)
- [ ] Editar, ativar/inativar, ordem e exibir na home
- [ ] Criar usuário perfil `imobiliaria` vinculado
- [ ] Cadastrar imóvel para imobiliária (Master)
- [ ] Editar imóvel, status reservado/vendido, valor público vs sob consulta

## Login Imobiliária

- [ ] Login redireciona para `/admin/minha-imobiliaria`
- [ ] Menu reduzido (Minha imobiliária, Meus imóveis)
- [ ] Editar dados permitidos (sem ativo/ordem/slug)
- [ ] CRUD apenas imóveis próprios
- [ ] Não acessa `/admin/leads`, `/admin/configuracoes`, dashboard geral

## Público

- [ ] `/oportunidades-imobiliarias` lista cards e filtros
- [ ] `/oportunidades-imobiliarias/[slug]` página da imobiliária
- [ ] `/oportunidades-imobiliarias/imovel/[slug]` detalhe
- [ ] Valor público vs “Valor sob consulta”
- [ ] Tenho interesse → lead `origem=oportunidade_imobiliaria` + eventos
- [ ] WhatsApp pós-lead (prioridade imóvel → imobiliária → origem → principal)
- [ ] Simular compra → `/simulador?valor=&tipo=imovel&origem=oportunidade_imobiliaria`

## Regressão

- [ ] `/grupos`, `/simulador`, `/cartas-contempladas`
- [ ] `/admin/leads`, `/admin/propostas`, PDF proposta

## Automatizado

- `src/lib/whatsapp/resolve-imovel.test.ts` — prioridade de destino WhatsApp
