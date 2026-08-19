# Relatório de Implementação — Fase 086: Platform Grupos (Assembleias Temporais & Herança de Modalidades)

**Data:** 2026-08-18  
**Branch:** `codex/platform-grupos-temporal-heranca-086`  
**Migration:** `supabase/migrations/086_platform_grupos_assembleia_temporal_heranca.sql`  
**Status:** VALIDADO EM PREVIEW / AGUARDANDO APROVAÇÃO PARA PRODUÇÃO

---

## 1. Resumo das Implementações

### 1.1 Herança Automática de Valores Padrão das Modalidades
- Ao habilitar modalidades no Grupo (Integral, Reduzida 60-99%, Reduzida <59%), os valores padrão cadastrados na Administradora (`percentual_padrao`, `modo_reduzido_padrao`, `percentual_minimo`, `percentual_maximo`) são carregados automaticamente.
- Se o Grupo possuir regra customizada, grava `origem: "GRUPO_OVERRIDE"` com label visual **Personalizado neste Grupo**.
- Se não houver override ou o usuário desmarcar a customização, herda o padrão da Administradora com label visual **Padrão da Administradora**.

### 1.2 Data da 1ª Assembleia e Prazo Total
- Adicionado campo `data_primeira_assembleia` (tipo `date`) na tabela `grupos_consorcio` e nos formulários.
- Preservado o campo `prazo_total` (meses).

### 1.3 Cálculo Automático de Assembleias (Realizadas / Total / Restantes)
- Função canônica pura `calcularAssembleiasTemporal`:
  - Considera o dia e mês da 1ª Assembleia.
  - Verifica se o aniversário mensal da assembleia já decorreu na data de referência.
  - Exemplo: 1ª Assembleia em 15/02/2026 com 100 meses:
    - 14/08/2026 → `6 / 100 / 94`
    - 15/08/2026 → `7 / 100 / 93`
    - 16/08/2026 → `7 / 100 / 93`
    - Final do prazo → `100 / 100 / 0` (Status: Encerrado)
  - Limites estritos: `0 <= realizadas <= prazo_total`, nunca negativo.
  - Próxima Assembleia calculada dinamicamente com base no próximo aniversário mensal ou `Encerrado`.
  - Não confunde com nem cria registros no módulo Assembleias/Pedras.

### 1.4 Características de Contemplação & Indicadores Recentes (Aba Estatísticas & Lances)
- **Estrutura Real de Contemplações Mensais:**
  - Tabela interativa com `Ordem`, `Modalidade de Contemplação` (Sorteio, Sorteio de cotas canceladas, Lance Livre, Lance Fixo, Lance Embutido, Lance Fidelidade, Outro), `Condição / Percentual`, `Observação`, toggle de ativação e reordenação (▲ ▼).
  - Cálculo e resumo automático em tempo real: **Até 9 contemplações/mês** (ex: `3 Sorteios • 3 Lances Livres • 3 Lances Fixos`).
- **Organização em 3 Blocos:**
  - **Bloco 1:** Características de Contemplação (Tabela ordenada e configurável).
  - **Bloco 2:** Indicadores Recentes & Lances (Média do Lance Livre %, Mínimo/Máximo %, Contemplados no Mês Anterior real, Limite de Lance Embutido %, Vagas Disponíveis, Data de Referência).
  - **Bloco 3:** Informações & Auditoria (Origem da informação, Responsável pela atualização, Data de atualização, Observação de análise).
- **Card Executivo de Contemplações:**
  - Adicionado no cabeçalho do Grupo com resumo do potencial (`Até 9/mês`, `3 Sorteios • 3 Livres • 3 Fixos`) e link direto para a aba de Estatísticas.
- **Isolamento Total:**
  - Dados estritamente informativos e comerciais. Não executam contemplações automáticas, não alteram cotas definitivas e não criam pedras de sorteio.

### 1.5 Integração Visual nas Telas
- **Lista de Grupos (`/platform/grupos` e aba Grupos da Administradora):**
  - Coluna **Prazo**: `7 / 100 / 93` com tooltip `7 realizadas • 100 total • 93 restantes`.
  - Coluna **1ª Assembleia**: `15/02/2026`.
- **Detalhe do Grupo (`/platform/grupos/[id]`):**
  - Cards executivos no cabeçalho: **Tipo Oficial**, **Faixa de Crédito**, **Assembleias / Prazo**, **Próxima Assembleia**, **Contemplações** e **Taxa Total**.

---

## 2. Testes e Validação de Qualidade

- **Contrato, Regras Temporais, Herança & Contemplações:** 17/17 testes aprovados (`src/lib/platform/grupos-temporal-heranca-086-contract.test.ts`).
- **Platform Suite:** 65/65 testes aprovados (6 arquivos de teste).
- **Suíte Completa:** 803/803 testes ativos aprovados em 140 arquivos.
- **TypeScript:** 0 erros com `npx tsc --noEmit`.
- **Build Next.js:** 135 rotas compiladas com sucesso.
- **Auditoria de Segurança:** 0 vulnerabilidades.
