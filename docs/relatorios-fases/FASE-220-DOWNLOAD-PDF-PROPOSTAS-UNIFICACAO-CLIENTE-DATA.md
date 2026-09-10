# Relatório de Fase 220 — Download de PDF de Propostas e Unificação por Cliente e Data

## 1. Visão Geral e Contexto
- **Fase:** 220
- **Data:** 10/09/2026
- **Status:** Concluído com Sucesso e Validado
- **Objetivo:**
  1. **Download do PDF da Proposta Sem Necessidade de Nova Cotação:**  
     Disponibilizar botões de download direto do PDF oficial da proposta para que clientes e consultores possam baixar o documento a qualquer momento (caso não tenham baixado na hora ou tenham perdido o arquivo), eliminando a necessidade de refazer uma simulação ou gerar outra proposta.
  2. **Geração Automática de PDF Sob Demanda:**  
     Eliminar o erro *"PDF ainda não gerado"* garantindo que chamadas de download gerem o arquivo PDF e criem a URL assinada no Supabase Storage de forma transparente quando o PDF ainda não tiver sido pré-gerado.
  3. **Novo Endpoint Público Dedicado:**  
     Criar a rota `GET /api/public/contratacoes/[token]/pdf` para permitir download direto e redirecionamento seguro ao PDF oficial utilizando apenas o `public_token` da proposta.
  4. **Unificação e Deduplicação de Propostas por Cliente e Data:**  
     Evitar duplicações desnecessárias na base de dados quando o mesmo cliente (mesmo telefone/WhatsApp e/ou nome) realiza múltiplas simulações ou ajustes de valores na mesma data, reutilizando e atualizando a proposta ativa de hoje sem criar registros duplicados.
  5. **Visualização Unificada nas Tabelas do ERP e Admin:**  
     Adicionar ação rápida de download de PDF diretamente em cada linha das listagens de `/admin/propostas` e `/erp/propostas`, além de suporte ao agrupamento diário de propostas por cliente com contadores e badges de quantidade de cotações no dia.

---

## 2. Diagnóstico Técnico e Solução Implementada

1. **Geração e Disponibilização de PDF:**
   - **Antes:** Se uma proposta fosse gerada pelo fluxo online do site (`contratacao-wizard`), o PDF não era gerado antecipadamente no bucket de storage. Se o usuário tentasse baixar, recebia a exceção `"PDF ainda não gerado"`. Além disso, na tela final do wizard e na tela `/proposta/[token]`, havia apenas o botão de copiar link da proposta. Nas listagens do Admin e ERP, a coluna de ações possuía apenas "Marcar Contratada" e "Ver detalhes/Editar", exigindo entrar na edição e reenviar o formulário para baixar o PDF.
   - **Depois:**
     - `getPropostaPdfDownloadUrl`: atualizado para detectar ausência de `pdf_url` ou falha no storage e disparar automaticamente `enrichPropostaProjecaoFromSimulacao` e `generateAndStorePropostaPdf`, retornando a URL assinada recém-gerada.
     - `GET /api/public/contratacoes/[token]/pdf`: novo endpoint que resolve o tenant, localiza a proposta por `public_token`, gera sob demanda e redireciona para a URL assinada.
     - `contratacao-wizard.tsx`: adicionado botão **"Baixar PDF"** no topo da tela `/proposta/[token]`, botão secundário no resumo financeiro de confirmação e botão destacado **"Baixar PDF da Proposta"** na tela de sucesso.
     - `BaixarPropostaPdfButton`: novo componente client com ícone de download e spinner, inserido na coluna de ações das tabelas de `/admin/propostas` e `/erp/propostas`.
     - `proposta-pdf-toolbar.tsx`: botão "Baixar PDF" habilitado para download instantâneo mesmo antes de submeter o formulário de geração manual.

2. **Deduplicação e Unificação por Cliente e Data:**
   - **Antes:** Cada submissão em `criarPropostaDoFluxo`, `/api/public/grupos/fluxo` ou `/api/public/simulador/captura` inseria um novo registro incondicionalmente em `propostas`, gerando dezenas de propostas duplicadas para o mesmo cliente que estava apenas testando variações no mesmo dia.
   - **Depois:**
     - Criado o módulo `proposta-unificacao-service.ts` com as funções `buscarPropostaAtivaDoDia`, `agruparPropostasPorClienteEData`, `extrairIdentificadorCliente` e `getInicioDoDiaBrasilUtc`.
     - Ao criar proposta, se já existir uma proposta ativa (`Gerada`, `PDF gerado`, `Em negociação`, `Enviada`, `Aprovada`) gerada na data de hoje no fuso horário de Brasília para aquele telefone/WhatsApp do cliente, o sistema atualiza a proposta existente com os novos dados de simulação e zera `pdf_url` (para que o novo PDF seja gerado com os valores atualizados), retornando a proposta unificada.
     - Propostas com status final (`Contratada`, `Cancelada`, `Perdida`) nunca são sobrescritas para preservar a integridade histórica dos negócios fechados.
     - Nas páginas `/admin/propostas` e `/erp/propostas`, adicionado o filtro/toggle `Unificar por cliente e data` (ativo por padrão), agrupando cotações diárias do mesmo cliente e exibindo a badge `"X no dia"` com acesso aos dados mais recentes.

---

## 3. Arquivos Modificados e Criados

### 3.1. Novos Componentes e Serviços
1. [`gauchinho-app/src/lib/proposta/proposta-unificacao-service.ts`](file:///C:/Fernando%20Hugo/GAUCHINHO%20SITE/gauchinho-app/src/lib/proposta/proposta-unificacao-service.ts)
   - Serviço central de resolução de propostas ativas por data e agrupamento de propostas por cliente/data.
2. [`gauchinho-app/src/app/api/public/contratacoes/[token]/pdf/route.ts`](file:///C:/Fernando%20Hugo/GAUCHINHO%20SITE/gauchinho-app/src/app/api/public/contratacoes/[token]/pdf/route.ts)
   - Endpoint público de download de PDF via token da proposta.
3. [`gauchinho-app/src/components/admin/baixar-proposta-pdf-button.tsx`](file:///C:/Fernando%20Hugo/GAUCHINHO%20SITE/gauchinho-app/src/components/admin/baixar-proposta-pdf-button.tsx)
   - Componente client para acionar download assinado direto com feedback visual.
4. [`gauchinho-app/src/lib/proposta/proposta-unificacao-pdf-220-contract.test.ts`](file:///C:/Fernando%20Hugo/GAUCHINHO%20SITE/gauchinho-app/src/lib/proposta/proposta-unificacao-pdf-220-contract.test.ts)
   - Testes automatizados cobrindo geração sob demanda, agrupamento e validação de tokens.

### 3.2. Arquivos Atualizados
1. [`gauchinho-app/src/lib/proposta/generate-pdf.ts`](file:///C:/Fernando%20Hugo/GAUCHINHO%20SITE/gauchinho-app/src/lib/proposta/generate-pdf.ts)
   - `getPropostaPdfDownloadUrl` com geração sob demanda e recuperação contra URLs expiradas.
2. [`gauchinho-app/src/components/contratacao/contratacao-wizard.tsx`](file:///C:/Fernando%20Hugo/GAUCHINHO%20SITE/gauchinho-app/src/components/contratacao/contratacao-wizard.tsx)
   - Botões "Baixar PDF" na barra superior, no resumo de confirmação e na tela de sucesso.
3. [`gauchinho-app/src/lib/contratacoes-online/proposta-flow.ts`](file:///C:/Fernando%20Hugo/GAUCHINHO%20SITE/gauchinho-app/src/lib/contratacoes-online/proposta-flow.ts)
   - Integração com `buscarPropostaAtivaDoDia` para reutilização e atualização de proposta diária.
4. [`gauchinho-app/src/app/api/public/grupos/fluxo/route.ts`](file:///C:/Fernando%20Hugo/GAUCHINHO%20SITE/gauchinho-app/src/app/api/public/grupos/fluxo/route.ts)
   - Unificação de propostas de grupos por cliente na mesma data.
5. [`gauchinho-app/src/app/api/public/simulador/captura/route.ts`](file:///C:/Fernando%20Hugo/GAUCHINHO%20SITE/gauchinho-app/src/app/api/public/simulador/captura/route.ts)
   - Unificação de propostas do simulador por cliente na mesma data.
6. [`gauchinho-app/src/app/admin/propostas/page.tsx`](file:///C:/Fernando%20Hugo/GAUCHINHO%20SITE/gauchinho-app/src/app/admin/propostas/page.tsx)
   - Botão `BaixarPropostaPdfButton`, agrupamento diário por cliente e toggle de unificação.
7. [`gauchinho-app/src/app/erp/propostas/page.tsx`](file:///C:/Fernando%20Hugo/GAUCHINHO%20SITE/gauchinho-app/src/app/erp/propostas/page.tsx)
   - Botão `BaixarPropostaPdfButton`, agrupamento diário por cliente e toggle de unificação.
8. [`gauchinho-app/src/components/admin/proposta-pdf-toolbar.tsx`](file:///C:/Fernando%20Hugo/GAUCHINHO%20SITE/gauchinho-app/src/components/admin/proposta-pdf-toolbar.tsx)
   - Botão "Baixar PDF" sempre acessível para download sob demanda.

---

## 4. Validação e Testes

- **Testes Automatizados de Contrato:**
  - `src/lib/proposta/proposta-unificacao-pdf-220-contract.test.ts`: 6 testes aprovados.
  - Suíte completa de propostas e contratações (`src/lib/proposta`, `src/lib/contratacoes-online`): 23 arquivos de teste e 78 testes aprovados com 100% de sucesso.
- **Build de Produção:**
  - `npm run build`: compilado e otimizado com sucesso (código 0), incluindo novas rotas estáticas e dinâmicas (`/api/public/contratacoes/[token]/pdf`, etc.).
