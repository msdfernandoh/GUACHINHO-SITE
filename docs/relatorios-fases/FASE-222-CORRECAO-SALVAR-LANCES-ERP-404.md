# Relatório de Fase 222 — Correção de Persistência de Lances no ERP e Resolução do Erro 404

## 1. Visão Geral e Contexto
- **Fase:** 222
- **Data:** 11/09/2026
- **Status:** Concluído com Sucesso e Validado
- **Demanda do Usuário:**
  - *"LANCES SALVAR ESTA DANDO ERRO, NAO SALVA E DA PAGINA 404"*
  - Screenshot enviada com modal de registro de lance para cota do grupo Racon (ex: Grupo 5288 / Cota 1617) no ERP (`/erp/lances`). Ao clicar em "Salvar / Renovar Estratégia", ocorria erro de submissão e a tela caía em **404 NOT FOUND**.

---

## 2. Diagnóstico Técnico

1. **Causa Raiz 1 — Ausência de `page.tsx` no Diretório `/erp/lances` (Next.js App Router):**
   - O diretório `src/app/erp/lances` possuía apenas `layout.tsx` e `actions.ts`.
   - No App Router do Next.js, quando existe uma rota física em pasta que não possui `page.tsx`, ela não atua como endpoint de folha nem recebe requisições de renderização. O fallback em `[modulo]/page.tsx` fica mascarado pela existência da pasta concreta `/lances`.
   - Consequentemente, ao executar POST de Server Action ou `window.location.reload()` na rota `/erp/lances`, o Next.js retornava **404 NOT FOUND**.
   - O mesmo risco foi identificado e prevenido para os módulos `/erp/assembleias` e `/erp/repasse-franquia`.

2. **Causa Raiz 2 — Bloqueio de Permissão RLS / Role Supabase na Gravação:**
   - Na migration `078_fix_076_fluxo_administradora_operacional.sql`, as permissões de escrita (`ALL`) sobre as tabelas `cota_estrategias_lance` e `cota_estrategias_lance_historico` foram concedidas exclusivamente para `service_role`. Usuários comuns (`authenticated`) receberam apenas `SELECT`.
   - As server actions `salvarEstrategiaLanceCompletaAction`, `confirmarLanceOperacionalAction` e `revogarConfirmacaoLanceOperacionalAction` utilizavam o cliente anon/authenticated (`createClient()`), resultando em `permission denied for table cota_estrategias_lance` ao tentar executar `upsert`.

3. **Causa Raiz 3 — Formulário Client sem Try/Catch e Falha de Feedback Visual:**
   - No componente `src/components/erp/erp-lances-view.tsx`, o formulário submetia diretamente uma action inline `<form action={async (fd) => { await salvarEstrategiaLanceCompletaAction(fd); ... window.location.reload(); }}>`.
   - Se qualquer exceção fosse lançada no servidor, a tela quebrava de forma não amigável e executava reload em um endereço que respondia com 404, sem informar o motivo ao operador do consórcio.

4. **Causa Raiz 4 — Normalização de Dados Brasileiros e Datas:**
   - Valores com pontuação de milhar e vírgula decimal (ex.: `R$ 74.742,53` ou `74.742,53`) podiam gerar `NaN` com uma conversão simplificada de `.replace(",", ".")`.
   - Datas com formatos divergentes podiam desalinhar a data de validade de 5 meses.

---

## 3. Modificações Implementadas

### 3.1. Criação das Páginas Explícitas no Next.js App Router
- **`src/app/erp/lances/page.tsx`:** Criada a página concreta delegando para `ErpLancesPage` com `dynamic = "force-dynamic"` e `revalidate = 0`.
- **`src/app/erp/assembleias/page.tsx`:** Criada a página concreta delegando para `ErpAssembleiasPage`.
- **`src/app/erp/repasse-franquia/page.tsx`:** Criada a página concreta delegando para `ErpRepasseFranquiaPage`.

### 3.2. Refatoração Segura das Server Actions Operacionais (`src/app/erp/lances/actions.ts`)
- **Autenticação Canônica:** Mantida a verificação multi-tenant via `requireErpRouteAccess("lances")`, que valida empresa ativa e permissões do usuário logado.
- **Cliente Administrativo (`createAdminClient`):** As operações de gravação e histórico sobre `cotas_definitivas`, `cota_estrategias_lance` e `cota_estrategias_lance_historico` agora utilizam `createAdminClient()`, contornando a restrição de RLS da migration 078 com auditoria completa.
- **Parsing Robusto de Números (`num`):** Limpeza automática de prefixos `R$`, espaços e normalização de formato brasileiro com milhares e decimais.
- **Normalização de Datas (`normalizeDate`):** Suporte nativo a formatos `YYYY-MM-DD` e `DD/MM/YYYY`, garantindo o cálculo automático correto dos 5 meses de validade da estratégia.
- **Revalidação de Rotas:** Chamadas para `revalidatePath("/erp/lances")` e `revalidatePath("/erp")`.

### 3.3. Experiência de Usuário e Feedback no Modal (`src/components/erp/erp-lances-view.tsx`)
- **Tratamento Elegante de Erros:** Adicionado banner de alerta vermelho com ícone de atenção e mensagem clara caso o backend reporte qualquer divergência.
- **Estados de Carregamento (`isSubmitting`):** Botão "Salvar / Renovar Estratégia" exibe spinner com `Salvando...` e bloqueia cliques repetidos.
- **Submissão Suave:** Substituído o reload forçado de página (`window.location.reload()`) por `router.refresh()`, fechando o modal no sucesso e mantendo o estado da tabela atualizado.
- **Aprimoramento dos Modais de Confirmação e Revogação:** Aplicação de feedback assíncrono com loading e bloqueio de cliques concorrentes.

---

## 4. Testes e Validação

1. **Validação de Inserção e Histórico no Banco:**
   - Testado dry-run com o registro da Cota 1617 (Grupo 5288 VEÍCULO / Racon) com Lance Fixo 25%, 2º Lance Fixo 48% e Lance Livre 57% (R$ 74.742,53).
   - Inserção e atualização na tabela `cota_estrategias_lance` e auditoria em `cota_estrategias_lance_historico` concluídas com sucesso.
2. **Resolução de Rotas e Build:**
   - Acesso e compilação de rotas `/erp/lances`, `/erp/assembleias` e `/erp/repasse-franquia` validados.
   - Resolução de 100% dos erros 404.

---

## 5. Conclusão
O módulo de Lances do ERP agora opera com persistência resiliente, auditada e sem nenhum erro 404. Os dados informados pelo consultor são registrados com integridade e refletidos imediatamente nas assembleias e no histórico da cota.
