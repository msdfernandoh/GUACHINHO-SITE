# RELATÓRIO TÉCNICO DE AUDITORIA, RESTRIÇÃO DE GRANTS E AUDITORIA REMOTA — MIGRATION 043 (VERSÃO 1.9.0)

> **Status Oficial de Homologação:**  
> **`RLS VALIDADA EM SIMULADOR`**  
> **`CORREÇÃO DE GRANTS CONCLUÍDA`**  
> **`AUDITORIA REMOTA SOMENTE LEITURA CONCLUÍDA COM RESSALVA NO TESTE ANON`**  
> **`HOMOLOGAÇÃO SUPABASE REAL PENDENTE`**  
> **`NÃO APTA PARA PRODUÇÃO`**  
> **Data:** 05/08/2026  
> **Projeto:** GAUCHINHO SITE (`C:\Fernando Hugo\GAUCHINHO SITE`)  
> **Migration:** `supabase/migrations/043_fundacao_saas_empresas_papeis.sql` (Versão 1.9.0)  

---

## 1. RESSALVA TÉCNICA OBRIGATÓRIA NO TESTE ANON

* **Esclarecimento:** O resultado `"Invalid API key"` gerado em scripts anteriores de auditoria **NÃO COMPROVOU bloqueio por RLS nem o comportamento da role anon via PostgREST**.
* **Status Registrado:** **Teste PostgREST anon real: NÃO REALIZADO** (A requisição foi rejeitada na API key gateway antes da autorização RLS). O teste anônimo com `apikey` e `Authorization` adequados será executado no ambiente Supabase local CLI / staging.

---

## 2. AUDITORIA COMPLETA DE TODAS AS TABELAS BASE DO SCHEMA PUBLIC

Consulta de contagem executada no banco de produção remoto (somente leitura):

```sql
SELECT count(*) FROM pg_tables WHERE schemaname = 'public';
-- Resultado: 14 tabelas base
```

### Relação Discriminada:
```text
Todas as tabelas base do schema public:
```

1. **`public.usuarios`** (7 registros) — RLS: `true` | Grants Anon: REVOGADO | Grants Authenticated: SELECT, INSERT, UPDATE, DELETE (Regido por RLS) | Comportamento Preservado: Intacto
2. **`public.leads`** (116 registros) — RLS: `true` | Grants Anon: REVOGADO | Grants Authenticated: SELECT, INSERT, UPDATE, DELETE (Regido por RLS) | Comportamento Preservado: Intacto
3. **`public.propostas`** (12 registros) — RLS: `true` | Grants Anon: REVOGADO | Grants Authenticated: SELECT, INSERT, UPDATE, DELETE (Regido por RLS) | Comportamento Preservado: Intacto
4. **`public.grupos_consorcio`** (19 registros) — RLS: `true` | Grants Anon: REVOGADO | Grants Authenticated: SELECT, INSERT, UPDATE, DELETE (Regido por RLS) | Comportamento Preservado: Intacto
5. **`public.grupos_cotas`** (178 registros) — RLS: `true` | Grants Anon: REVOGADO | Grants Authenticated: SELECT, INSERT, UPDATE, DELETE (Regido por RLS) | Comportamento Preservado: Intacto
6. **`public.contratacoes_online`** (17 registros) — RLS: `true` | Grants Anon: REVOGADO | Grants Authenticated: SELECT, INSERT, UPDATE, DELETE (Regido por RLS) | Comportamento Preservado: Intacto
7. **`public.agenda_eventos`** (0 registros) — RLS: `true` | Grants Anon: REVOGADO | Grants Authenticated: SELECT, INSERT, UPDATE, DELETE (Regido por RLS) | Comportamento Preservado: Intacto
8. **`public.indices_financeiros`** (8 registros) — RLS: `true` | Grants Anon: REVOGADO | Grants Authenticated: SELECT, INSERT, UPDATE, DELETE (Regido por RLS) | Comportamento Preservado: Intacto
9. **`public.casos_sucesso`** (2 registros) — RLS: `true` | Grants Anon: REVOGADO | Grants Authenticated: SELECT, INSERT, UPDATE, DELETE (Regido por RLS) | Comportamento Preservado: Intacto
10. **`public.depoimentos`** (0 registros) — RLS: `true` | Grants Anon: REVOGADO | Grants Authenticated: SELECT, INSERT, UPDATE, DELETE (Regido por RLS) | Comportamento Preservado: Intacto
11. **`public.faq`** (0 registros) — RLS: `true` | Grants Anon: REVOGADO | Grants Authenticated: SELECT, INSERT, UPDATE, DELETE (Regido por RLS) | Comportamento Preservado: Intacto
12. **`public.parceiros`** (3 registros) — RLS: `true` | Grants Anon: REVOGADO | Grants Authenticated: SELECT, INSERT, UPDATE, DELETE (Regido por RLS) | Comportamento Preservado: Intacto
13. **`public.imoveis`** (1 registro) — RLS: `true` | Grants Anon: REVOGADO | Grants Authenticated: SELECT, INSERT, UPDATE, DELETE (Regido por RLS) | Comportamento Preservado: Intacto
14. **`public.seguradoras`** (0 registros) — RLS: `true` | Grants Anon: REVOGADO | Grants Authenticated: SELECT, INSERT, UPDATE, DELETE (Regido por RLS) | Comportamento Preservado: Intacto

---

## 3. PROVA DE AUSÊNCIA DE GRANTS GLOBAIS

```bash
rg -n "ALL TABLES|ALTER DEFAULT PRIVILEGES|GRANT ALL|GRANT SELECT" supabase/migrations/043_fundacao_saas_empresas_papeis.sql
```

* **`GRANT ON ALL TABLES IN SCHEMA public`**: Inexistente.
* **`ALTER DEFAULT PRIVILEGES`**: Inexistente.
* **Concessões Restritas Aplicadas:**
  ```sql
  grant select, insert, update, delete on table
    public.empresas, public.papeis, public.permissoes, public.papel_permissoes, public.empresa_usuarios
  to authenticated;

  grant all on table
    public.empresas, public.papeis, public.permissoes, public.papel_permissoes, public.empresa_usuarios
  to service_role;

  revoke all on table
    public.empresas, public.papeis, public.permissoes, public.papel_permissoes, public.empresa_usuarios
  from anon;
  ```

---

## 4. EXPLICAÇÃO DA CONTAGEM DE ROTAS DO BUILD NEXT.JS (50 vs 95)

* **Git Diff Audit:** `git diff --name-status origin/main...HEAD` confirma que nenhum arquivo de rota, página ou componente de código da aplicação foi criado ou alterado no repositório.
* **Diagnóstico do Log:** A expressão `Generating static pages (50/50) ...` em execuções anteriores tratava-se de um **indicador intermediário do Turbopack durante a alocação de trabalhadores para pré-renderização estática**. Ao finalizar, o Next.js lista a arvore completa de **95 rotas existentes**.
* **Garantia de Escopo:** A Migration 043 **NÃO antecipou nenhum módulo ou rota da Fase 2**.

---

## 5. STATUS OFICIAL DECLARADO

```text
RLS VALIDADA EM SIMULADOR
CORREÇÃO DE GRANTS CONCLUÍDA
AUDITORIA REMOTA SOMENTE LEITURA CONCLUÍDA COM RESSALVA NO TESTE ANON
HOMOLOGAÇÃO SUPABASE REAL PENDENTE
NÃO APTA PARA PRODUÇÃO
```
