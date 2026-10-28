# Relatório de Fase — Opção no Cliente para Não Executar Automático (Lances e Boletos) + Cópia dos Robôs em Racon Sinop ERP

**Data:** 27/10/2026  
**Escopo:** `C:\Fernando Hugo\GAUCHINHO SITE`  
**Migration:** `supabase/migrations/331_clientes_bloqueio_automacao_robos_e_racon_sinop.sql`

---

## 1. Objetivo

1. **Opção no cadastro do cliente para não executar automático (Lances Automáticos e Baixa de Boletos):**
   - Permitir marcar na ficha e edição do cliente (`/erp/clientes/[id]`, `/erp/clientes/[id]/editar`, `/erp/clientes/novo`) as opções:
     - **Não executar Lances Automáticos** (`nao_executar_lance_automatico`)
     - **Não executar Baixa de Boletos Automática** (`nao_executar_boleto_automatico`)
   - Garantir que o Robô de Lances (`scripts/robo-lances-service.mjs`) e o Robô de Boletos (`scripts/robo-boletos-dados.mjs`) filtrem a lista de cotas buscando **somente os clientes que não estão marcados para não executar**.

2. **Cópia dos Robôs de Lances e Boletos na empresa Racon Sinop ERP para usar com outro login:**
   - Provisionar em `public.robo_configuracoes` para a empresa **Racon Sinop** (`87df83a8-1d22-4bd1-9712-5cb08915c4a0`):
     - `Robô Racon Sinop — Lances Automáticos (Franquia)` (`FRANQUIA_LANCES_AUTOMATICOS`)
     - `Robô Racon Sinop — Boletos Mensais (Download & Armazenamento)` (`FRANQUIA_DOWNLOAD_BOLETOS`)
   - Garantir isolamento de credenciais por `empresa_id` em `/erp/robos` (`gauchinho-app/src/app/erp/robos/actions.ts` e `erp-robos-hub.tsx`), permitindo que a Racon Sinop configure e utilize seu próprio login e senha independentes sem sobrescrita pela credencial global da Gauchinho Consórcios.

---

## 2. Alterações Realizadas

### 2.1. Banco de Dados (`supabase/migrations/331_clientes_bloqueio_automacao_robos_e_racon_sinop.sql`)
- Adicionadas as colunas `nao_executar_lance_automatico boolean NOT NULL DEFAULT false` e `nao_executar_boleto_automatico boolean NOT NULL DEFAULT false` em `public.clientes`.
- Inseridos os 2 robôs dedicados para **Racon Sinop** (`empresa_id = '87df83a8-1d22-4bd1-9712-5cb08915c4a0'`) e garantido também o robô geral de boletos mensais para **Gauchinho Consórcios** (`empresa_id = '7170f38e-15dd-4b19-8588-51e9a9cf0d4c'`).

### 2.2. Cadastro e Ficha do Cliente no ERP (`/erp/clientes`)
- `gauchinho-app/src/app/erp/clientes/actions.ts`:
  - `saveClienteAction` persiste `nao_executar_lance_automatico` e `nao_executar_boleto_automatico`.
  - Nova server action `salvarAutomacaoClienteAction` permite marcar/desmarcar diretamente na ficha do cliente (`/erp/clientes/[id]`), inclusive com botão rápido de 1 clique (**"Marcar ambos para não executar"** / **"Liberar execução automática"**), registrando auditoria em `clientes_historico`.
- `gauchinho-app/src/app/erp/clientes/[id]/page.tsx`:
  - Novo card **"Automação de Robôs (Lances Automáticos e Baixa de Boletos)"** logo abaixo do cabeçalho do cliente e badges de alerta no topo quando marcado.
- `gauchinho-app/src/app/erp/clientes/[id]/editar/page.tsx` e `novo/page.tsx`:
  - Seção de checkboxes para controle de automação de robôs.
- `gauchinho-app/src/app/erp/clientes/page.tsx`:
  - Badges visuais `Sem lance auto` e `Sem boleto auto` na carteira de clientes.

### 2.3. Filtragem nos Motores dos Robôs (`robo-lances-service.mjs` e `robo-boletos-dados.mjs`)
- `scripts/robo-lances-service.mjs`:
  - Carrega os clientes da empresa com `nao_executar_lance_automatico = true` e valida tanto pelo relacionamento direto `venda.cliente.nao_executar_lance_automatico` quanto por `cliente_id` e CPF/CNPJ normalizado, ignorando todas as cotas de clientes marcados e registrando no log da execução.
- `scripts/robo-boletos-dados.mjs`:
  - Em `carregarCotasBoletos`, inclui `cliente:clientes(id, nao_executar_boleto_automatico)` no join de `vendas` e filtra todas as cotas cujo cliente esteja marcado com `nao_executar_boleto_automatico = true`.

### 2.4. Robôs Independentes por Franquia (`/erp/robos` e `/platform/robos-importacao`)
- `gauchinho-app/src/app/erp/robos/actions.ts`:
  - Removida a sobrescrita automática pela credencial global de outra empresa; cada franquia mantém seu próprio login e senha independentes.
  - Adicionado suporte em `salvarConfiguracaoRoboFranquiaAction` para sincronizar opcionalmente o novo login/senha entre os 2 robôs (Lances e Boletos) da mesma franquia.
  - Estatísticas do painel descontam clientes marcados para não executar automático.
- `gauchinho-app/src/components/erp/robos/erp-robos-hub.tsx` e `RobosImportacaoContent.tsx`:
  - Exibição explícita do login configurado, status da senha cifrada, quantidade de clientes ignorados por bloqueio manual e identificação da Empresa/Franquia em cada card.

---

## 3. Validação e Testes
- Migration `331_clientes_bloqueio_automacao_robos_e_racon_sinop.sql` aplicada com sucesso no Supabase (`npx supabase db push`).
- Testes automatizados (`vitest run src/lib/erp/robo-boletos-persistencia.test.ts src/lib/erp/robo-boletos.test.ts`): **16/16 aprovados** (incluindo teste de bloqueio `nao_executar_boleto_automatico = true`).
- Checagem de tipos TypeScript (`tsc --noEmit`): **0 erros**.
