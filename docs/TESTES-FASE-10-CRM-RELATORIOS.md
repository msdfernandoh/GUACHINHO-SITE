# Testes — Fase 10 (CRM, funil e relatórios)

Migration: `supabase/migrations/012_funil_crm_leads.sql`

## Pré-requisitos

- Migration **012** aplicada (colunas CRM em `leads` + tabela `lead_atividades`).
- Acesso staff (master / SRD / visualizador) em `/admin/leads`.

## Leads — lista

- [ ] `/admin/leads` — filtros (status, origem, temperatura, consultor, busca).
- [ ] Colunas: produto, valor, temperatura, próxima ação, última interação.
- [ ] **Exportar CSV** respeita filtros da URL.
- [ ] Link para **Funil** e **Relatórios**.

## Leads — detalhe

- [ ] Status do funil, temperatura, valor estimado, próxima ação.
- [ ] Fechamento exige valor + produto; perda exige motivo.
- [ ] WhatsApp abre com mensagem padrão; evento `crm_whatsapp_aberto`.
- [ ] Timeline (histórico + eventos + atividades).

## Follow-ups

- [ ] Criar atividade; concluir; cancelar.

## Funil

- [ ] `/admin/leads/funil` — colunas Kanban; alterar status no card; evento `lead_status_alterado`.

## Relatórios

- [ ] `/admin/relatorios` — cards, origem, funil, consultores.
- [ ] Alertas: sem responsável / follow-ups vencidos.

## Regressão

- [ ] `/`, `/simulador`, `/grupos`, `/calculadoras`, `/admin/configuracoes`.

```bash
cd gauchinho-app
npm test
npm run build
```
