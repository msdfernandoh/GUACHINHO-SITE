# CHECKLIST REUTILIZÁVEL DE HOMOLOGAÇÃO DE PRODUÇÃO (SMOKE & HEAL)

> **Versão:** 1.0.0  
> **Objetivo:** Roteiro padrão para execução de testes de fumaça reais e não destrutivos após deploys em Produção.

---

## 1. Verificação de Integridade de Infraestrutura

- [ ] **1. Vercel Production Build:**
  - Status `READY`, Exit Code 0, Git SHA alinhado com `main`.
- [ ] **2. Supabase Migrations:**
  - `supabase migration list --linked` em 100% de sincronia (`local=remote`).
  - `supabase db push --linked --dry-run` informando `Remote database is up to date.`

---

## 2. Testes de Fumaça HTTP em Produção

Executar chamadas GET em Produção e validar os status esperados:

```bash
# Páginas Públicas (Esperado: 200 OK)
GET https://www.gauchinhoconsorcios.com.br/
GET https://www.gauchinhoconsorcios.com.br/grupos
GET https://www.gauchinhoconsorcios.com.br/simulador
GET https://www.gauchinhoconsorcios.com.br/api/public/grupos/sorteios

# Páginas Administrativas sem Autenticação (Esperado: 307 Redirect para /login)
GET https://www.gauchinhoconsorcios.com.br/admin/dashboard
GET https://www.gauchinhoconsorcios.com.br/admin/financeiro
GET https://www.gauchinhoconsorcios.com.br/admin/comissoes
GET https://www.gauchinhoconsorcios.com.br/admin/vendas
GET https://www.gauchinhoconsorcios.com.br/admin/auditoria
```

---

## 3. Checklist de Validação Negativa (Empresa B Dry-Run)

- [ ] Confirmar que a Empresa B (0 concessões) retorna:
  - 0 grupos autorizados no catálogo público.
  - 0 vendas e 0 cotas definitivas.
  - 0 previsões de comissão.
  - R$ 0,00 de saldo de caixa, recebimentos e repasses.
  - 0 equipes, 0 metas, 0 tarefas e 0 audit logs.
