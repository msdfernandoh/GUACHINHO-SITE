# Relatório de Fase — Platform Programas da Franqueadora & Editor de Regras (Fase 087)

> **Status:** Concluído e Sincronizado  
> **Data:** 18/08/2026  
> **Migration:** `087_platform_programas_regras_editor.sql`  
> **Escopo:** `C:\Fernando Hugo\GAUCHINHO SITE` (Platform Administradoras / Programas da Franqueadora)

---

## 1. Contexto e Motivação

Ao acessar programas em rascunho como **SOCIOS v1** (`/platform/administradoras/[id]/programas/[programaId]`), a tela apresentava uma visualização estática com a mensagem `Regras Internas do Programa (0 modalidades)`, sem formulários, botões ou ações que permitissem:
1. Criar novas regras ou auto-popular regras padrão para os Tipos e Modalidades cadastrados na Administradora;
2. Configurar a comissão total (%), base de cálculo, início/fim de vigência e curvas de estorno;
3. Montar e editar dinamicamente as etapas do cronograma de repasse (parcelas mensais e contemplação) com validação ao vivo;
4. Renomear programas em rascunho ou criar novos programas de comissão da franqueadora diretamente pela Platform.

---

## 2. Solução Implementada

### 2.1 Backend e RPCs Transacionais (Migration 087 Forward-Only)
- **`rpc_platform_criar_programa`**: Cria novo programa em rascunho (versão 1) associado à Administradora e Franqueadora.
- **`rpc_platform_salvar_dados_programa`**: Permite renomear ou atualizar descrição de programas em rascunho, bloqueando alterações em programas já homologados.
- **`rpc_platform_salvar_regra_programa`**: Insere ou atualiza regras em `comissao_regras_franquia` e reconstrói as etapas em `comissao_regra_etapas`, mantendo o campo `etapas_cronograma` (jsonb) para compatibilidade plena com os triggers legados.
- **`rpc_platform_gerar_regras_padrao_programa`**: Varre os Tipos e Modalidades ativos da Administradora e gera automaticamente as regras de comissão com cronograma estruturado (inclusive divisão 2.75% parcelas + 1.25% contemplação para modalidades reduzidas especiais).
- **`rpc_platform_excluir_regra_programa`**: Exclui com segurança regras e etapas de programas em rascunho.

### 2.2 Componente Interativo `ProgramaWorkspace`
- **Header Dinâmico**: Badges de status, Franqueadora, versão, botão de renomear programa, botão de homologar versão (com validação estrita de pendências) e exclusão de rascunhos.
- **Estado Vazio Interativo (0 regras)**:
  - CTA **⚡ Gerar Regras Padrão (Tipos e Modalidades)** para criar instantaneamente todas as regras básicas.
  - CTA **+ Cadastrar Manualmente**.
- **Editor de Regra e Cronograma (`RegraEditorModal`)**:
  - Seleção de Tipo e Modalidade.
  - Comissão Total (%) e Base de Cálculo.
  - Curva de Estorno vinculada.
  - Vigência (Início e Fim).
  - **Construtor de Etapas do Cronograma**:
    - Atalhos pré-configurados: `1x 100%`, `2x Parcelas`, `3x Parcelas`, `Racon (Parcela + Contemplação)`.
    - Adicionar/remover etapas dinamicamente.
    - Seleção de gatilho (`Mês Relativo` vs `Na Contemplação`).
    - Validador em tempo real da soma do cronograma em relação à comissão total esperada.
- **Botão "+ Novo Programa da Franqueadora"** na aba `Programas` do `AdministratorWorkspace`.

---

## 3. Testes e Validação

- **Testes de Contrato Unitários:** 12/12 novos testes em `src/lib/platform/programas-regras-editor-087-contract.test.ts`.
- **Suíte Platform:** 84/84 testes aprovados (`vitest run src/lib/platform/`).
- **Suíte Global do Sistema:** 822/822 testes aprovados (`npm test`).
- **TypeScript:** `npx tsc --noEmit` aprovado com 0 erros.
- **Migration 087 Aplicada no Supabase Production:** `087_platform_programas_regras_editor.sql` aplicada com sucesso via `supabase db push`.

---

## 4. Arquivos Alterados / Criados

- `supabase/migrations/087_platform_programas_regras_editor.sql` [NOVO]
- `gauchinho-app/src/components/platform/programa-workspace.tsx` [NOVO]
- `gauchinho-app/src/lib/platform/programas-regras-editor-087-contract.test.ts` [NOVO]
- `gauchinho-app/src/app/platform/administradoras-actions.ts` [MODIFICADO]
- `gauchinho-app/src/app/platform/administradoras/[id]/programas/[programaId]/page.tsx` [MODIFICADO]
- `gauchinho-app/src/components/platform/administrator-workspace.tsx` [MODIFICADO]
- `docs/SAAS-MASTER-ARCHITECTURE.md` [MODIFICADO]
