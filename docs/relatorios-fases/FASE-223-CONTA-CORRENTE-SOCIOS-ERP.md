# Relatório de Fase 223 — Conta-Corrente dos Sócios no ERP Gauchinho

## 1. Visão Geral e Contexto
- **Fase:** 223
- **Data:** 11/09/2026
- **Status:** Concluído com Sucesso e Validado
- **Demanda do Usuário:**
  - Criação de um novo módulo financeiro no ERP do Gauchinho Consórcios: **CONTA-CORRENTE DOS SÓCIOS** sob `/erp/conta-corrente-socios` e com atalhos em `/erp/financeiro`.
  - Controlar e equalizar com simplicidade visual:
    1. Comissões pertencentes a cada sócio (Garantidas, Previstas por etapa, Recebidas e Compensadas);
    2. Despesas da empresa vs despesas pagas pessoalmente pelo sócio do próprio bolso;
    3. Divisão/rateio de despesas (50/50 igualitário, percentual societário estatutário, exclusivo do sócio ou 100% empresa);
    4. Créditos e débitos com cálculo automático de equalização contábil;
    5. Botão de amortização rápida: **"USAR COMISSÃO PARA COMPENSAR"** para abater débitos retendo comissões na empresa;
    6. Separação rigorosa entre Saldo Contábil e **Valor Disponível para Saque / Repasse** (deduzindo reservas ativas);
    7. Despesas futuras previstas (fixas recorrentes e variáveis sugeridas automaticamente com base no histórico real dos últimos meses);
    8. Previsão de comissões futuras;
    9. **Break-Even**: Quanto a empresa ainda precisa vender para pagar as despesas operacionais;
    10. **Metas individuais de venda** de cada sócio com barras de progresso para atingir o equilíbrio financeiro;
    11. **Termômetro do Mês** (% de cobertura) e projeção de 30, 60 e 90 dias;
    12. Fechamento mensal com comparativo lado a lado e instruções de repasse entre sócios;
    13. Duas formas de visualização: **RESUMIDA** (cards grandes, frase instantânea explicativa, termômetro e metas) e **DETALHADA** (tabelas completas com drill-down, filtros, comprovantes e ações);
    14. Suporte flexível e dinâmico a 2 ou mais sócios (atualmente Fernando Hugo e Eroni Bolfe, 50% cada).

---

## 2. Auditoria Técnica e Arquitetura de Dados

### 2.1. Descoberta e Mapeamento de Entidades Reais
Auditoria executada no banco de dados Supabase para o tenant Gauchinho Consórcios (`7170f38e-15dd-4b19-8588-51e9a9cf0d4c`):
- **Sócios (`empresa_socios`):**
  - Fernando Hugo: `socio_id: 5e04d080-7e63-4ca7-870a-ef0f43d2a419`, `usuario_id: 31617f5c-42c7-4f08-ba5a-38323eacbffd`, 50% de participação.
  - Eroni Bolfe: `socio_id: 77e48cf6-ece5-4471-a41e-9aba788f6c74`, `usuario_id: b12a20d7-14e8-4480-bd18-9faf88f07b07`, 50% de participação.
- **Participantes Comerciais (`participantes_comerciais`):**
  - Fernando Hugo: `b25a8ab6-e2a7-4e61-97db-9e6c930c1bb8`.
  - Eroni Bolfe: `d32ca86d-e5e5-4355-8449-c31ee3586d13`.
- **Previsões de Comissões (`comissao_previsoes_participantes`):** 92 previsões reais cadastradas.
- **Vendas Registradas (`vendas`):** 31 vendas mapeadas (R$ 2,35M Fernando, R$ 8,88M Eroni).
- **Contas a Pagar (`financeiro_contas_pagar`):** 50 despesas reais identificando despesas da empresa e despesas pagas pessoalmente com `pago_pessoalmente = true` e `socio_pagador_usuario_id`.

---

## 3. Implementação e Modificações

### 3.1. Migration 219 (`supabase/migrations/219_conta_corrente_socios_ledger_rateios_metas.sql`)
Aplicada com sucesso no Supabase PostgreSQL:
1. `socio_conta_corrente_movimentos`: Ledger contábil imutável (append-only) com trigger `bloquear_delete_ledger_socio` impedindo deleção física de lançamentos confirmados e permitindo apenas estornos com chave de idempotência.
2. `financeiro_despesa_rateios`: Tabela relacional para definir a proporção de rateio de cada despesa da empresa (`IGUAL_50_50`, `PERCENTUAL_SOCIETARIO`, `EXCLUSIVO_SOCIO`, `EMPRESA_INTEGRAL`), quem pagou e a diferença de equalização.
3. `financeiro_reservas_socios`: Provisões retidas para aluguel, folha de pagamento, impostos e contingências.
4. `financeiro_previsoes_orcamento`: Orçamento de despesas fixas recorrentes e variáveis sugeridas com média histórica.
5. `financeiro_compensacoes_comissoes`: Registro auditado de retenção/abatimento de comissão contra débitos de despesas.
6. `financeiro_metas_socios`: Metas mensais de vendas por sócio e taxa de referência de comissão para break-even.
7. Políticas RLS multi-tenant ativadas com `can_read_tenant_internal` e `can_write_tenant_internal`.

### 3.2. Server Actions Operacionais (`src/app/erp/conta-corrente-socios/actions.ts`)
- `carregarDadosContaCorrenteSocios`: Consolida quadro societário, comissões garantidas vs previstas vs recebidas vs compensadas, despesas rateadas, ledger cronológico, reservas ativas, termômetro da empresa, break-even, metas individuais dos sócios e projeção 30/60/90 dias.
- `usarComissaoCompensarAction`: Amortiza despesas em aberto retendo comissão elegível, gera registro em `financeiro_compensacoes_comissoes`, lança débito no ledger imutável e atualiza status da comissão.
- `salvarRateioDespesaAction`: Configura a regra de divisão de despesa (50/50, societário, exclusivo ou empresa) e sincroniza `pago_pessoalmente` na tabela principal de contas a pagar.
- `salvarReservaFuturaAction` e `liberarReservaAction`: Gestão de retenções de caixa preventivas.
- `salvarPrevisaoOrcamentoAction`: Manutenção de despesas fixas e variáveis sugeridas.
- `salvarMetasSociosAction`: Configuração de metas de vendas e parâmetros de comissão.
- `estornarMovimentoLedgerAction`: Operação auditada de estorno que gera lançamento compensatório inverso no ledger.

### 3.3. Interface de Usuário Client (`src/components/erp/financeiro/conta-corrente-socios-view.tsx`)
- Alternador de visualização no topo: **Visão Resumida** (para entendimento em poucos segundos) e **Visão Detalhada** (tabelas completas com drill-down).
- Seletor de Competência (Mês/Ano) e Seletor de Sócio (`Todos os Sócios`, `Fernando Hugo (50%)`, `Eroni Bolfe (50%)`).
- **Frase de Status Instantânea**: Banner colorido em destaque informando imediatamente a situação do sócio (ex: "Fernando, você possui R$ X disponíveis para saque após reservar R$ Y para despesas do próximo mês").
- **Cards Principais**:
  - Comissões Garantidas
  - Despesas da Minha Responsabilidade
  - Despesas que Já Paguei
  - Saldo a Compensar (vermelho se devedor) / Crédito de Equalização
  - Reserva para Próximas Despesas (amarelo)
  - Disponível para Saque (verde grande)
- **Termômetro da Empresa**: Barra visual de progresso da cobertura de despesas, déficit e break-even de vendas necessárias.
- **Metas Individuais de Venda**: Painel com metas individuais, vendas realizadas, quanto falta vender e barra percentual.
- **Visão 30 / 60 / 90 Dias**: Cards com estimativa de cobertura financeira futura.
- **6 Abas Operacionais**:
  1. *Resumo & Indicadores*: Tabela explicativa consolidada com impacto no saldo.
  2. *Despesas & Rateios*: Tabela detalhada com status, quem pagou, minha parte, desembolso pessoal, diferença e botão modal para configurar rateio.
  3. *Comissões*: Listagem dividida por Garantidas, Previstas, Recebidas e Compensadas, com botão "Compensar Despesa".
  4. *Conta-Corrente (Ledger)*: Extrato cronológico auditado com badges e botão de estorno com justificativa obrigatória.
  5. *Previsão & Reservas*: Gestão de reservas com botão para liberar para saque e orçamento operacional.
  6. *Fechamento do Mês*: Comparativo lado a lado dos sócios, equalização societária e botão de impressão de relatório.

### 3.4. Rota Next.js e Integração no ERP
- **Página:** `src/app/erp/conta-corrente-socios/page.tsx` (`force-dynamic`).
- **Menu Lateral:** `src/components/erp/erp-sidebar.tsx` com ícone `Scale` e link para a rota.
- **Configuração Operacional:** `src/lib/erp/erp-operational.ts` e permissões em `src/lib/erp/erp-acesso.ts`.
- **Atalhos no Financeiro:** `src/app/erp/financeiro/page.tsx` atualizado com botão de destaque no topo e link na seção de contas internas.

---

## 4. Testes e Validação

1. **Testes Unitários de Negócio (`src/lib/erp/conta-corrente-socios.test.ts`):**
   - 12 testes cobrindo rateios 50/50, equalização societária de desembolso pessoal, rateios customizados, despesas exclusivas, saldo contábil vs disponível para saque, break-even de vendas, distribuição de metas e imutabilidade de estorno.
   - **Resultado:** 100% de aprovação (12 testes passaram em 4ms via Vitest).

2. **Verificação de Tipos TypeScript (`npx tsc --noEmit`):**
   - 0 erros de compilação.

---

## 5. Arquivos Modificados / Criados
- `supabase/migrations/219_conta_corrente_socios_ledger_rateios_metas.sql` (novo, aplicado)
- `gauchinho-app/src/app/erp/conta-corrente-socios/actions.ts` (novo)
- `gauchinho-app/src/app/erp/conta-corrente-socios/page.tsx` (novo)
- `gauchinho-app/src/components/erp/financeiro/conta-corrente-socios-view.tsx` (novo)
- `gauchinho-app/src/lib/erp/erp-operational.ts` (modificado)
- `gauchinho-app/src/lib/erp/erp-acesso.ts` (modificado)
- `gauchinho-app/src/components/erp/erp-sidebar.tsx` (modificado)
- `gauchinho-app/src/app/erp/financeiro/page.tsx` (modificado)
- `gauchinho-app/src/lib/erp/conta-corrente-socios.test.ts` (novo)
- `docs/relatorios-fases/FASE-223-CONTA-CORRENTE-SOCIOS-ERP.md` (novo)
- `docs/SAAS-MASTER-ARCHITECTURE.md` (atualizado)
