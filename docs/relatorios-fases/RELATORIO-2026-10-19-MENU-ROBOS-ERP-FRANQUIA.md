# Relatório de Fase — Menu de Robôs no ERP das Franquias

**Data:** 19/10/2026  
**Módulo:** ERP Franquia & Automações  
**Rotas:** `/erp/robos`, `/erp/lances`, `/erp/clientes`

---

## 1. Objetivo da Fase

Conforme a solicitação do usuário, foi implementado o **menu de Robôs e Automações no ERP das Franquias** para suportar a operação de 2 robôs automatizados:
1. **Robô de Lances Automáticos:**
   - Realiza ofertas de lance automáticas a cada nova venda uma vez por mês (no corte de cada assembleia).
   - Reavalia e atualiza os valores e estratégias de lance das cotas ativas da carteira de **6 em 6 meses**.
   - Sincroniza em tempo real a tela de Lances e Estratégias do ERP (`/erp/lances`).
2. **Robô de Boletos Mensais:**
   - Baixa e salva mês a mês os boletos bancários em PDF de todas as parcelas ativas da franquia no portal Newcon/Racon.
   - Armazena os arquivos de forma segura e os vincula diretamente à carteira do cliente no ERP (`/erp/clientes`), habilitando consulta e envio automático via WhatsApp.

---

## 2. Estrutura Arquitetural Implementada

### 2.1. Navegação Operacional & Permissões
- **`src/lib/erp/erp-operational.ts`:**
  - Adicionada a rota operacional:
    ```ts
    {
      id: "robos",
      label: "Robôs e Automações",
      href: "/erp/robos",
      section: "Consorcio",
      requiresAny: ["vendas", "grupos"],
    }
    ```
- **`src/components/erp/erp-sidebar.tsx`:**
  - Registrado o ícone canônico `Bot` para a entrada do menu no ERP.
- **`src/lib/erp/erp-acesso.ts`:**
  - Definidas as permissões canônicas em `ERP_ROUTE_PERMISSIONS`:
    ```ts
    robos: ["gerenciar_grupos", "gerenciar_propostas", "formalizar_vendas"]
    ```
    (Acesso padrão e irrestrito para administradores da franquia e super administradores).

### 2.2. Páginas e Server Actions
- **`src/app/erp/robos/layout.tsx`:**
  - Barreira de segurança e autorização via `requireErpRouteAccess("robos")`.
- **`src/app/erp/robos/page.tsx`:**
  - Componente de servidor que resolve o tenant ativo e carrega os robôs da franquia.
- **`src/app/erp/robos/actions.ts`:**
  - `fetchFranquiaRobosAction`: Auto-provisiona e lista os 2 robôs para a empresa da franquia (`empresa_id`), busca KPIs da carteira e histórico de execuções.
  - `salvarConfiguracaoRoboFranquiaAction`: Salva credenciais cifradas (AES-256-GCM via `encryptCredential`), modo de execução e ponto de venda.
  - `executarRoboFranquiaAction`: Enfileira execuções manuais ou agendadas em `public.robo_execucoes`.

### 2.3. Interface Interativa (`src/components/erp/robos/erp-robos-hub.tsx`)
- **Dashboard de Métricas:** Cotas da carteira, lances configurados vs aguardando, boletos da competência, ciclo mensal/semestral.
- **Aba "Robôs da Franquia (2)":**
  - Card Robô 1 (Lances): badges de periodicidade mensal e semestral, botões "Executar Lances Agora", "Mapear Rota" e "Configurar".
  - Card Robô 2 (Boletos): badge mensal de vencimento de faturas, botões "Baixar Boletos Agora", "Mapear Rota" e "Configurar".
- **Aba "Mapeamento de Rotas & Telas":**
  - Mapeamento detalhado das etapas a serem executadas no Newcon para cada robô (Login SSO -> Seleção de Ponto de Venda -> Navegação -> Preenchimento/Download -> Sincronização no ERP).
- **Aba "Histórico de Execuções":**
  - Tabela com status, horário de início, duração, origem e mensagens de auditoria.
- **Modais Integrados:**
  - Modal de configuração de credenciais, ponto de venda e modo (Produção vs Dry Run).
  - Modal de detalhamento das etapas de navegação para mapeamento guiado.

---

## 3. Verificações & Qualidade
1. **Testes Unitários:**
   - Suíte `src/lib/erp/erp-operational.test.ts` atualizada e aprovada com 100% de sucesso.
   - Suíte `src/lib/erp/erp-acesso.test.ts` executada com 12/12 testes aprovados.
2. **Build de Produção:**
   - Executado `npm run build`: todas as rotas (incluindo `/erp/robos`) compilaram perfeitamente sem nenhum erro de tipagem ou lint.
