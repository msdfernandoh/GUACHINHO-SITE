# Relatório de Implementação — Suporte Completo a Parcela Reduzida (50% e 60%), Cotas Oficiais e Correção do Robô Simulador

**Data:** 20/10/2026  
**Status:** Concluído e Enviado para `main`  
**Commit:** `2a71f7fd`  

---

## 1. Contexto e Diagnóstico

O usuário identificou três problemas críticos na operação do catálogo de consórcios no Site e no ERP:
1. **Ausência da opção Reduzida 50%:** Grupos como 5588 tinham a parcela reduzida travada apenas em 60%, sem exibir a opção de 50%.
2. **Grupo 1563 como "Integral (única opção)":** Novos grupos extraídos pelo robô exibiam apenas "Integral" sem permitir a escolha de parcelas reduzidas (50% e 60%).
3. **Cotas incompletas e valores desatualizados:** As cotas dos grupos no site e no ERP apresentavam números fictícios/arredondados (resíduos do seed inicial de junho/2026) misturados com cotas reais, cotas ausentes (ex.: 120k no 1563 e 135k/125k/114k no 5488) e parcelas desatualizadas/corrompidas.

### Causas Raízes Identificadas:
- **`grupos_consorcio` sem flags adequadas:** O robô extrator nunca atualizava `tem_parcela_reduzida = true` nem gravava `percentuais_parcela_reduzida = [50, 60]` no banco de dados.
- **`simulacao-linha.ts` & `grupo-row-adjustments.tsx`:** A função `listarPercentuaisParcelaReduzida` retornava apenas `[60]`, impedindo a renderização do seletor de 50%.
- **Robô sem scroll na tela de planos:** O Playwright capturava apenas os cards do topo do viewport em Newcon sem rolar a página para lazy-load, deixando de fora os créditos intermediários.
- **Falta de inativação das cotas obsoletas:** As cotas antigas de números redondos (100k, 110k, ..., 200k) continuavam com `ativo = true`, poluindo a listagem com valores defasados.

---

## 2. Ações Realizadas

### 2.1. Aplicação das Tabelas Oficiais Racon (PDFs fornecidos)
- **Grupo 5488 (Veículos Pró-Rata Total):**
  - Inativadas as 11 cotas fictícias de números redondos.
  - Inseridas/atualizadas as 16 cotas oficiais (8 créditos distintos em Prorrogada e Diluída):
    - R$ 208.447,00 (Prorrogada: Integral 2.014,85 | 60% 1.208,99 | 50% 1.007,43 — Diluída: Integral 2.302,93 | 60% 1.381,59 | 50% 1.151,45)
    - R$ 187.602,30 (Prorrogada: 60% 1.088,09 | 50% 906,68 — Diluída: 60% 1.243,43 | 50% 1.036,33)
    - R$ 156.335,25 (Prorrogada: Integral 1.511,15 | 60% 906,75 | 50% 755,57 — Diluída: Integral 1.727,19 | 60% 1.036,18 | 50% 863,61)
    - R$ 145.912,90 (Prorrogada: Integral 1.410,39 | 60% 846,29 | 50% 705,19 — Diluída: Integral 1.612,05 | 60% 967,10 | 50% 806,00)
    - R$ 135.490,55 (Prorrogada: Integral 1.309,66 | 60% 785,85 | 50% 654,83 — Diluída: Integral 1.496,90 | 60% 898,02 | 50% 748,44)
    - R$ 125.068,20 (Prorrogada: Integral 1.208,91 | 60% 725,39 | 50% 604,45 — Diluída: Integral 1.381,75 | 60% 828,94 | 50% 690,88)
    - R$ 114.645,85 (Prorrogada: Integral 1.108,18 | 60% 664,95 | 50% 554,08 — Diluída: Integral 1.266,61 | 60% 759,86 | 50% 633,28)
    - R$ 104.223,50 (Prorrogada: Integral 1.007,42 | 60% 604,49 | 50% 503,71 — Diluída: Integral 1.151,46 | 60% 690,78 | 50% 575,72)
- **Grupo 1563 (Imóveis Pró-Rata Total):**
  - Cadastradas as 6 cotas oficiais completas:
    - R$ 200.000,00 (Integral 1.250,00 | 60% 750,00 | 50% 625,00)
    - R$ 180.000,00 (Integral 1.125,00 | 60% 675,00 | 50% 562,50)
    - R$ 160.000,00 (Integral 1.000,00 | 60% 600,00 | 50% 500,00)
    - R$ 140.000,00 (Integral 875,00 | 60% 525,00 | 50% 437,50)
    - R$ 120.000,00 (Integral 750,00 | 60% 450,00 | 50% 375,00)
    - R$ 100.000,00 (Integral 625,00 | 60% 375,00 | 50% 312,50)

### 2.2. Backfill em Lote no Supabase
- Atualizados os 20 grupos ativos com `tem_parcela_reduzida = true` e `percentuais_parcela_reduzida = [50, 60]`.
- Atualizadas 256 cotas com o cálculo exato de `parcela_reduzida_50` e `parcela_reduzida_60`.
- Corrigida anomalia de diluição no Grupo 4088.

### 2.3. Melhorias no Robô Simulador (`scripts/robo-simulador-service.mjs`)
- Adicionada rotina de scroll suave para forçar o carregamento de todos os cartões de planos por lazy-load.
- Extração automática de todos os percentuais reduzidos encontrados no grupo (`[50, 60]`, `[70]`) e gravação em `grupos_consorcio`.
- Inativação automática de cotas antigas/obsoletas que não constem mais na grade atual de créditos da modalidade.
- Proteção contra regex que capturava valores transcorridos indevidos na parcela mensal.

### 2.4. Atualização da Interface (Site Público e ERP)
- **Linha da tabela pública (`grupo-row.tsx`):**
  - Criado seletor compacto na própria coluna de 1ª parcela, permitindo alternar instantaneamente entre **Integral**, **Red. 50%** e **Red. 60%** sem necessidade de abrir o modal de ajustes.
- **Painel de Ajustes (`grupo-row-adjustments.tsx`):**
  - Dropdown direto com opções claras: `Integral (100%)`, `Reduzida (50%)`, `Reduzida (60%)`, etc.
  - Demonstrativo discriminado com o valor de cada modalidade e realce visual na selecionada.
- **Cálculo da linha (`simulacao-linha.ts`):**
  - Prioriza centavos reais extraídos do Newcon (`parcela_reduzida_50`, `parcela_reduzida_60`, `parcelas_reduzidas`) com fallback matemático preciso e trava de segurança anti-corrupção.

---

## 3. Verificação e Build
- Build de produção (`next build` em Turbopack) executado com sucesso: 169 rotas geradas sem erros.
- Push realizado para `origin/main`.
