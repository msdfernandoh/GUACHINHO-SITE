# AGENTS.md — Instruções para Agentes Antigravity / Claude / AI Assistants

> [!IMPORTANT]
> **LEITURA OBRIGATÓRIA DE ARQUITETURA**  
> Todo e qualquer agente de inteligência artificial, desenvolvedor ou auditor que for atuar neste repositório **DEVE LER INTEGRALMENTE** o documento oficial de arquitetura antes de realizar qualquer alteração, migration ou adição de código:
> 
> [`docs/SAAS-MASTER-ARCHITECTURE.md`](file:///C:/Fernando%20Hugo/GAUCHINHO%20SITE/docs/SAAS-MASTER-ARCHITECTURE.md)

---

## Regras Fundamentais do Projeto

1. **Escopo Estrito:**
   * Trabalhar **exclusivamente** no diretório `C:\Fernando Hugo\GAUCHINHO SITE`.
   * **NÃO** acessar, modificar ou integrar o projeto antigo `CONSORCIO-SISTEMA`.

2. **Preservação de Dados e Operação:**
   * A empresa **Gauchinho Consórcios** é a primeira empresa da plataforma SaaS.
   * Todos os dados existentes (`usuarios`, `leads`, `propostas`, `grupos_consorcio`, `grupos_cotas`, `contratacoes_online`, `agenda_eventos`, `indices_financeiros`, etc.) devem ser **preservados integralmente sem perda ou corrupção**.

3. **Multi-tenancy:**
   * Estruturação multiempresa via tabela N:N `empresa_usuarios(empresa_id, usuario_id, papel_id)`.
   * **NÃO** presumir que a solução é apenas `usuarios.company_id`.
   * **NÃO** presumir que `consultant_id = auth.uid()`.

4. **Nomenclatura do Banco:**
   * O banco de dados Supabase Postgres segue o padrão **Português snake_case** (`empresas`, `empresa_usuarios`, `papeis`, `permissoes`, `papel_permissoes`).

5. **Relatórios Obrigatórios por Fase:**
   * Nenhuma fase ou subfase será considerada concluída sem a criação do seu relatório em `docs/relatorios-fases/` e atualização de `docs/SAAS-MASTER-ARCHITECTURE.md`.
