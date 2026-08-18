# Relatório de Fase — PLATFORM-GRUPOS-CATALOGO-085

**Data:** 18/08/2026  
**Status:** IMPLEMENTADO & HOMOLOGADO LOCALMENTE (PRONTO PARA REVISÃO VISUAL)  
**Branch:** `codex/platform-grupos-catalogo-operacional-085`  
**Migration:** `supabase/migrations/085_platform_grupos_catalogo_operacional.sql`  

---

## 1. Contexto e Objetivos

Transformar o módulo de **Grupos** no catálogo operacional oficial da Franqueadora/Administradora, integrando produtos de crédito e modalidades de pagamento de forma canônica, sem duplicar motores existentes e preservando o isolamento multi-tenant entre SaaS Global e ERP Local.

### Inconsistência Corrigida
- A query da aba Grupos na Administradora (`/platform/administradoras/[id]`) referenciava `grupo_modalidades_disponiveis` (singular), enquanto a tabela canônica é `grupos_modalidades_disponiveis` (plural), causando o retorno de 0 grupos. Corrigido para unificar a leitura canônica entre `/platform/grupos` e `Administradoras → Grupos`.

---

## 2. Hierarquia e Modelo de Domínio Canônico

```
ADMINISTRADORA
  └── GRUPO (Número, Tipo Oficial, Prazo, Taxa Adm, Fundo Reserva, Seguro, Capacidade, Vagas)
        └── PRODUTOS / COTAS DE CRÉDITO (Ex: 100k, 80k, 70k)
              └── MODALIDADES DISPONÍVEIS (Integral, Reduzida 60-99, Reduzida <59 com overrides de parcela e status)
```

- **Cota Mínima e Máxima:** Calculadas dinamicamente a partir dos produtos ativos do grupo (`Math.min` e `Math.max`).
- **Taxa Total:** Soma exata de Taxa Adm + Fundo de Reserva + Seguro Prestamista.
- **Entrada em Lote:** Textarea com normalização automática de texto monetário BRL (suporta `100000`, `80.000,00`, `R$ 70.000`), desduplicação e ordenação decrescente.
- **Estatísticas / Lances (Informativo de Vendas):** Suporte a contagem de sorteios, lances embutidos (25%/50%), lance fidelidade, média de lance livre, contemplados no mês anterior e responsáveis, com histórico de auditoria gravado em `grupo_estatisticas_historico`.
- **Global SaaS x ERP Local:** Toggle `usar_dados_globais` e suporte a customizações locais em `empresa_grupos_config` sem corromper a base canônica global.

---

## 3. Alterações Realizadas

1. **Migration 085 (`085_platform_grupos_catalogo_operacional.sql`):**
   - Adicionou colunas de capacidade, vagas e dados estatísticos em `grupos_consorcio`.
   - Adicionou `habilitado` e `modo_reduzido` em `grupo_cota_modalidade_valores`.
   - Criou tabela `grupo_estatisticas_historico` com RLS e índices.
   - Adicionou colunas em `empresa_grupos_config` para personalizações locais.
   - Criou RPCs: `rpc_platform_salvar_grupo`, `rpc_platform_salvar_cotas_lote`, `rpc_platform_configurar_modalidades_grupo`, `rpc_platform_salvar_cota_modalidade`, `rpc_platform_salvar_estatisticas_grupo`, `rpc_platform_excluir_cota_produto`.
2. **Frontend e Helpers (`src/lib/platform/grupos-prontidao.ts`):**
   - Normalizador BRL `parseBRLNumber` e parser de lote `parseBatchCotasInput`.
   - Cálculos de métricas operacionais e validação objetiva de prontidão.
3. **Server Actions (`src/app/platform/grupos-actions.ts` & `grupos-catalogo-actions.ts`):**
   - Server Actions integradas com superadmin auth e revalidação de rotas.
4. **Componentes e Telas:**
   - Workspace operacional (`src/components/platform/grupo-operational-workspace.tsx`) com 4 abas (Dados Gerais, Cotas & Modalidades, Estatísticas/Lances, Histórico).
   - Listagem dedicada `/platform/grupos/page.tsx` com filtros e tabela compacta.
   - Detalhe do Grupo `/platform/grupos/[id]/page.tsx`.
   - Alinhamento da aba Grupos na Administradora em `src/components/platform/administrator-workspace.tsx` e `src/app/platform/administradoras/[id]/page.tsx`.

---

## 4. Gates de Qualidade e Validações

- **Vitest Unit & Contract Tests:** 15 cenários de teste essenciais passando (`15/15 passed`).
- **Vitest Platform Suite:** 48 testes passando (`48/48 passed`).
- **Vitest Full Suite:** 139 arquivos de teste e 786 testes passando (`786/786 passed`).
- **TypeScript:** `npx tsc --noEmit` executado com 0 erros.
- **Next.js Build:** `next build` concluído com sucesso e 135 rotas estáticas/dinâmicas otimizadas.
- **Security Audit:** `npm audit` executado com 0 vulnerabilidades.
- **Git Diff:** `git diff --check` sem erros de formato ou whitespace.

