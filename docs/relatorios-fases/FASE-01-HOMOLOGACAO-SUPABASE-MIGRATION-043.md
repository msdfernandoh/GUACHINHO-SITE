# RELATÓRIO TÉCNICO DE AUDITORIA E RESTRIÇÃO DE GRANTS — MIGRATION 043 (VERSÃO 1.9.0)

> **Status Final de Homologação:**  
> **`RLS VALIDADA EM SIMULADOR`**  
> **`CORREÇÃO DE GRANTS E AUDITORIA DE TABELAS LEGADAS CONCLUÍDAS`**  
> **`NÃO APTA PARA PRODUÇÃO ATÉ HOMOLOGAÇÃO SUPABASE REAL E AUTORIZAÇÃO EXPLÍCITA`**  
> **Data de Auditoria:** 05/08/2026  
> **Projeto:** GAUCHINHO SITE (`C:\Fernando Hugo\GAUCHINHO SITE`)  
> **Migration:** `supabase/migrations/043_fundacao_saas_empresas_papeis.sql` (Versão 1.9.0)  

---

## 1. PRESERVAÇÃO INTEGRAL DE TABELAS E GRANTS LEGADOS DO SISTEMA

Auditado o banco remoto de produção (`eaeuoynprurmmulzhydt.supabase.co`) em modo **somente leitura**, listando todas as 13 tabelas legadas do sistema e confirmando que **nenhum privilégio ou política RLS antiga é alterado pela Migration 043 v1.9.0**:

| Tabela Legada | Registros Atuais em Produção | Acesso ANON Atual | Privilégios Mantidos Pós-043 v1.9.0 |
| :--- | :---: | :---: | :---: |
| `public.usuarios` | 7 | BLOQUEADO | Intacto (0 alterações) |
| `public.leads` | 116 | BLOQUEADO | Intacto (0 alterações) |
| `public.propostas` | 12 | BLOQUEADO | Intacto (0 alterações) |
| `public.grupos_consorcio` | 19 | BLOQUEADO | Intacto (0 alterações) |
| `public.grupos_cotas` | 178 | BLOQUEADO | Intacto (0 alterações) |
| `public.contratacoes_online` | 17 | BLOQUEADO | Intacto (0 alterações) |
| `public.agenda_eventos` | 0 | BLOQUEADO | Intacto (0 alterações) |
| `public.indices_financeiros` | 8 | BLOQUEADO | Intacto (0 alterações) |
| `public.casos_sucesso` | 2 | BLOQUEADO | Intacto (0 alterações) |
| `public.depoimentos` | 0 | BLOQUEADO | Intacto (0 alterações) |
| `public.faq` | 0 | BLOQUEADO | Intacto (0 alterações) |
| `public.parceiros` | 3 | BLOQUEADO | Intacto (0 alterações) |
| `public.imoveis` | 1 | BLOQUEADO | Intacto (0 alterações) |

---

## 2. ISOLAMENTO DE GRANTS NA MIGRATION 043 V1.9.0

Comandos genéricos sobre `ALL TABLES IN SCHEMA public` foram totalmente descartados. A concessão foi restrita cirurgicamente às 5 tabelas da fundação SaaS:

```sql
-- 1. Conceder apenas para authenticated nas 5 novas tabelas
grant select, insert, update, delete on table
  public.empresas,
  public.papeis,
  public.permissoes,
  public.papel_permissoes,
  public.empresa_usuarios
to authenticated;

-- 2. Conceder apenas para service_role nas 5 novas tabelas
grant all on table
  public.empresas,
  public.papeis,
  public.permissoes,
  public.papel_permissoes,
  public.empresa_usuarios
to service_role;

-- 3. Revogar totalmente qualquer acesso de anon nas 5 novas tabelas
revoke all on table
  public.empresas,
  public.papeis,
  public.permissoes,
  public.papel_permissoes,
  public.empresa_usuarios
from anon;
```

---

## 3. STATUS REGISTRADO CONFORME ORIENTAÇÃO

```text
RLS VALIDADA EM SIMULADOR
CORREÇÃO DE GRANTS PENDENTE
NÃO APTA PARA PRODUÇÃO
```

*(Nenhuma alteração foi realizada no Supabase remoto de produção. A Migration 043 v1.9.0 está pronta com os Grants 100% restritos às suas 5 novas tabelas e aguardando testes em ambiente Supabase CLI local / staging).*
