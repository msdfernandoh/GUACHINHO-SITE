# Relatório de Implementação — Robô de Boletos da Franquia (Download, Storage & WhatsApp)

**Data:** 19/10/2026  
**Fase:** Automação Operacional de Franquias / Robôs ERP  
**Escopo:** Mapeamento do Robô de Boletos Newcon, Supabase Storage (`boletos-cotas`), Tabela de Boletos (`cotas_boletos`), Interface ERP em Vendas & Cotas (Aba Boletos) e Extração de QR Code Pix.

---

## 1. Visão Geral e Objetivos Atingidos

Conforme solicitado pelo usuário, foi realizado o mapeamento completo e implementação em produção do **Robô de Boletos da Franquia**:
1. **Entrada no Newcon Web:**
   - Reaproveitamento da autenticação SSO Microsoft / Portal Randon.
   - Acesso ao Newcon Web (`https://nwcweb.randonconsorcios.com.br/frmMain.aspx`) com seleção automática da Administradora Randon (`0101 Randon Administradora`).
2. **Navegação Consorciado / Atendimento:**
   - Clique no botão com ícone de dois bonecos (clientes/consorciados) ou acesso direto a `CONAT/frmConAtSrcConsorciado.aspx`.
   - Consulta cota a cota: preenchimento de `Grupo` e `Cota` e clique em `[Localizar]`.
3. **Emissão de Cobrança:**
   - Na tela de Atendimento (`CONAT/frmConAtCnsAtendimento.aspx`), clique no link "Emissão de Cobrança" no menu lateral "Operações".
   - Na tela de Boleto Avulso (`CONCO/frmConCoRelBoletoAvulso.aspx`), seleção da pendência (checkbox ou `[Selecionar Todas]`) e clique em `[Emitir Cobrança]`.
4. **Captura, Download e Extração de Dados:**
   - Download automatizado do PDF do boleto.
   - Extração do código **QR Code Pix Copia e Cola (padrão EMV QRCode `000201...6304XXXX`)** em texto puro.
   - Extração de Linha Digitável, Vencimento e Valor do documento.
5. **Armazenamento Seguro (Supabase Storage):**
   - Criação do bucket `boletos-cotas` via Migration `320_cotas_boletos_storage.sql`.
   - Upload de cada PDF para caminho isolado por franquia e competência: `boletos/{empresa_id}/{competencia}/boleto_{grupo}_{cota}_{timestamp}.pdf`.
6. **Gravação e Sincronização no ERP:**
   - Gravação na tabela especializada `public.cotas_boletos` com chave única por `(empresa_id, numero_grupo, numero_cota, competencia)`.
   - Sincronização automática com `public.vendas_boletos_envios`.
7. **Interface ERP em Vendas & Cotas (`/erp/vendas` — Aba Boletos):**
   - Botão direto para **Baixar Boleto PDF** do Storage.
   - Botão **Copiar Pix** (1 clique para copiar o Pix Copia e Cola para a área de transferência com feedback visual).
   - Botão **QR Code** que abre modal interativo renderizando o QR Code visual (`react-qr-code`) e a chave em texto.
   - Disparo via **WhatsApp** com template enriquecido contendo a chave Pix Copia e Cola e o link para download direto do PDF.

---

## 2. Alterações de Banco de Dados (Migration 320)

- **Arquivo:** `supabase/migrations/320_cotas_boletos_storage.sql`
- **Bucket Storage:**
  - `boletos-cotas` (limite de 10MB, tipo MIME `application/pdf`, com políticas RLS públicas e autenticadas para tenant).
- **Tabela `public.cotas_boletos`:**
  - `id` (UUID PK)
  - `empresa_id` (UUID FK empresas)
  - `venda_id` (UUID FK vendas)
  - `cota_definitiva_id` (UUID FK cotas_definitivas)
  - `numero_grupo`, `numero_cota` (TEXT NOT NULL)
  - `cliente_nome`, `cliente_documento`, `cliente_telefone` (TEXT)
  - `competencia` (TEXT NOT NULL)
  - `vencimento` (DATE), `valor` (NUMERIC)
  - `arquivo_storage_path`, `arquivo_url` (TEXT)
  - `qr_code_pix`, `linha_digitavel` (TEXT)
  - `status` (TEXT: `DISPONIVEL`, `BAIXADO`, `ENVIADO_WHATSAPP`, `PAGO`)
  - `origem` (TEXT DEFAULT 'ROBO_NEWCON')
  - `enviado_em`, `enviado_por_id`, `enviado_por_nome`
  - Restrição única: `(empresa_id, numero_grupo, numero_cota, competencia)`.
- **Extensões em `public.vendas_boletos_envios`:**
  - Adição de `arquivo_storage_path`, `arquivo_url`, `qr_code_pix`, `linha_digitavel`, `valor`, `vencimento`, `numero_grupo`, `numero_cota`, `origem`.

---

## 3. Serviços e Scripts Criados / Atualizados

1. `scripts/robo-boletos-service.mjs`:
   - Serviço modular responsável por iterar sobre cotas ativas da franquia, navegar no Newcon até a emissão de cobrança, baixar o PDF, extrair a chave Pix Copia e Cola via regex EMV inteligente (suportando espaços nos campos de comerciante/cidade), enviar ao bucket `boletos-cotas` e persistir em `cotas_boletos` e `vendas_boletos_envios`.
2. `scripts/robo-execucao-child.mjs`:
   - Despacho condicional para `FRANQUIA_DOWNLOAD_BOLETOS` e robôs contendo "boleto" no nome.
3. `gauchinho-app/src/app/erp/robos/actions.ts`:
   - Configuração oficial do template do robô de boletos com o mapeamento passo a passo.
   - Herança automática de credenciais Racon criptografadas para evitar digitação repetida pela franquia.
4. `gauchinho-app/src/app/admin/vendas/page.tsx`:
   - Unificação de dados de `vendas_boletos_envios` e `cotas_boletos`.
5. `gauchinho-app/src/components/erp/vendas/erp-vendas-hub-view.tsx`:
   - Exibição de botões para download do PDF, cópia do Pix Copia e Cola, modal com QR Code dinâmico (`react-qr-code`) e disparo de WhatsApp formatado.
6. `gauchinho-app/src/lib/erp/robo-boletos.test.ts`:
   - Testes unitários para extração de Pix EMV, linha digitável, vencimento e valores.

---

## 4. Testes e Validação

- **Testes Unitários:**
  - `npx vitest run src/lib/erp/erp-operational.test.ts src/lib/erp/erp-acesso.test.ts src/lib/erp/robo-boletos.test.ts`
  - Resultado: **17 testes aprovados (100% de sucesso)**.
- **Compilação de Produção Next.js:**
  - `npm run build`
  - Resultado: **169 rotas estáticas e dinâmicas geradas com sucesso (0 erros)**.
- **Migration:**
  - `npx supabase db push` aplicada com sucesso em produção.
