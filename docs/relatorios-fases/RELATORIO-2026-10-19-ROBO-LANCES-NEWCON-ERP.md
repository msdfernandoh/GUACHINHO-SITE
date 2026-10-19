# Relatório de Implementação — Robô de Oferta de Lances da Franquia (Newcon Web & ERP)

**Data:** 19/10/2026  
**Fase:** Automação Operacional de Franquias / Robôs ERP  
**Escopo:** Mapeamento do Robô de Lances Newcon Web, Regra de Lance Livre (`embutido + 1,1234`), Lance Fixo e 2º Lance Fixo, Opção Reduzir Parcela, Repetição por 6 Assembleias, Captura de Protocolo no Alert, Tabela de Ofertas (`cota_lances_ofertados`), Enriquecimento de `cota_estrategias_lance` e Interface ERP em `/erp/lances`.

---

## 1. Visão Geral e Objetivos Atingidos

Conforme solicitação e especificações operacionais fornecidas, foi implementada e homologada a automação de **Oferta de Lances Automáticos da Franquia** no Newcon Web, conectada diretamente à gestão operacional do ERP:

1. **Entrada no Newcon Web:**
   - Reaproveitamento da autenticação SSO Microsoft / Portal Randon.
   - Acesso ao Newcon Web (`https://nwcweb.randonconsorcios.com.br/frmMain.aspx`) com seleção automática da Administradora Randon (`0101 Randon Administradora`).
2. **Navegação Consorciado / Atendimento:**
   - Acesso à tela de atendimento pelo ícone dos dois bonequinhos (`CONAT/frmConAtSrcConsorciado.aspx`).
   - Consulta cota a cota das cotas ativas não contempladas da franquia: preenchimento de `Grupo` e `Cota` e clique em `[Localizar]`.
3. **Acesso à Operação "Oferta de Lance":**
   - Na tela de Atendimento (`CONAT/frmConAtCnsAtendimento.aspx`), clique no link "Oferta de Lance" no menu lateral "Operações".
   - Abertura de `CONCP/frmConCpCadCredenciamentoLance.aspx`.
4. **Regras de Lance Parametrizadas:**
   - **Lance Livre:** Sempre `1,1234% + Lance Embutido Máximo do Grupo`.  
     *Exemplo Grupo 1273 / Cota 209:* Com embutido máximo de 25%, o lance livre ofertado é rigorosamente `26,1234%`, com `25,0000%` de embutido.
   - **Lance Fixo:** Preenchimento com o percentual fixo do grupo (ex: 25%) e embutido de 25%.
   - **2º Lance Fixo:** Se o grupo possuir segundo lance fixo (ex: 40%), oferta com embutido limitado ao teto de 25% permitido pela regra do grupo.
   - **Opção do Lance:** Sempre selecionada a opção `Reduzir Parcela`.
   - **Repetição:** Sempre marcado `[x] Repetir a oferta do lance por 6 assembleia(s)`.
5. **Captura Assíncrona de Protocolo do Navegador:**
   - Ao submeter a oferta (`[Confirmar]`), o Newcon exibe um `dialog` nativo do navegador:  
     `"Anote os números dos protocolos: Lance Livre: 5735314"`.
   - O robô escuta o evento de diálogo via Playwright (`page.once('dialog')`), extrai o número do protocolo via regex, confirma com `OK` (`dialog.accept()`) e aguarda o comprovante.
6. **Captura e Armazenamento do Comprovante Oficial (Supabase Storage):**
   - Na tela de relatório (`CONCM/frmConCmNewconReports.aspx`), o robô captura o comprovante oficial de lance em alta resolução e realiza o upload imediato para o bucket `lances-comprovantes` no Supabase Storage (`${empresa_id}/${cota_id}/comprovante_${tipo}_...png`).
   - Gera URL assinada de longa duração (1 ano) e vincula `comprovante_storage_path`, `comprovante_url` e `comprovante_nome` em `cota_estrategias_lance` e em `cota_lances_ofertados`.
   - Na interface do ERP (`/erp/lances`), o link `Ver` na tabela e o botão `Ver Comprovante Oficial` no Drawer lateral abrem diretamente o comprovante capturado.
   - Localiza e clica no botão `[Voltar]`, permitindo ofertar em seguida o Lance Fixo sem recarregar o sistema.
7. **Sincronização e Auditoria no ERP (`/erp/lances`):**
   - Atualiza `cota_estrategias_lance` com status `confirmado = true`, preenche `protocolo_lance_livre`, `protocolo_lance_fixo`, `protocolo_segundo_lance_fixo`, `assembleia_numero`, `ultimo_lance_ofertado_em` e `repetir_seis_assembleias = true`.
   - Grava cada oferta individualizada na tabela canônica `cota_lances_ofertados`.
8. **Agendamento Operacional:**
   - O Robô de Oferta de Lances foi configurado para ser executado **todo dia 10 de cada mês** (`dia_corte: 10`).

---

## 2. Alterações de Banco de Dados (Migration 321)

- **Arquivo:** `supabase/migrations/321_lances_automacao_protocolos.sql`
- **Extensões na tabela `public.cota_estrategias_lance`:**
  - `protocolo_lance_livre` (TEXT)
  - `protocolo_lance_fixo` (TEXT)
  - `protocolo_segundo_lance_fixo` (TEXT)
  - `assembleia_numero` (TEXT)
  - `assembleia_data` (DATE)
  - `repetir_seis_assembleias` (BOOLEAN DEFAULT true)
  - `ultimo_lance_ofertado_em` (TIMESTAMPTZ)
  - `oferta_origem` (TEXT DEFAULT 'ROBO_NEWCON')
- **Nova Tabela Canônica `public.cota_lances_ofertados`:**
  - `id` (UUID PK)
  - `empresa_id` (UUID FK empresas)
  - `cota_definitiva_id` (UUID FK cotas_definitivas)
  - `numero_grupo`, `numero_cota` (TEXT)
  - `assembleia_numero` (TEXT), `assembleia_data` (DATE)
  - `tipo_lance` (TEXT: `LIVRE`, `FIXO`, `SEGUNDO_FIXO`, `LIMITADO`, `FIDELIDADE`)
  - `opcao_reducao` (TEXT DEFAULT 'REDUZIR_PARCELA')
  - `percentual_lance` (NUMERIC 8,4)
  - `percentual_embutido` (NUMERIC 8,4)
  - `valor_lance`, `valor_embutido` (NUMERIC 14,2)
  - `protocolo` (TEXT NOT NULL)
  - `repetir_seis_assembleias` (BOOLEAN DEFAULT true)
  - `status` (TEXT DEFAULT 'CONFIRMADO')
  - `ofertado_em` (TIMESTAMPTZ DEFAULT now())
  - Políticas RLS por tenant (`empresa_id`) e índices de busca rápida por grupo/cota.

---

## 3. Telas e Componentes Atualizados

1. **`scripts/robo-lances-service.mjs`:**
   - Mapeamento completo com Playwright e funções puras exportadas: `calcularRegraLanceLivre`, `extrairProtocoloAlert` e `calcularEstrategiaGrupo`.
2. **`scripts/robo-execucao-child.mjs`:**
   - Roteamento condicional para o serviço de automação de lances sob o tipo `FRANQUIA_LANCES_AUTOMATICOS`.
3. **`gauchinho-app/src/app/erp/robos/actions.ts`:**
   - Template oficial `TEMPLATE_ROBO_LANCES` com dia de corte 10 e descrição passo a passo das 5 telas do Newcon.
4. **`gauchinho-app/src/app/erp/lances/actions.ts`:**
   - DTO `CotaLanceOperacionalDTO` enriquecido com os novos campos de protocolo e metadados de automação.
5. **`gauchinho-app/src/components/erp/erp-lances-view.tsx`:**
   - Coluna de Confirmação exibe os números de protocolo do lance livre e fixo.
   - Badge `🤖 Robô Newcon` nas cotas que receberam lances automatizados.
   - Painel de Protocolos Newcon no Drawer de detalhes da cota, exibindo cards com os protocolos de cada modalidade, opção de redução de parcela, número da assembleia e repetição por 6 assembleias.

---

## 4. Testes e Validação de Produção

- **Testes Unitários:** `gauchinho-app/src/lib/erp/robo-lances.test.ts`
  - 8 testes cobrindo cálculo da regra `embutido + 1,1234`, formatação brasileira com vírgula, extração de protocolos em alertas com regex, e teto de embutido para 2º lance fixo.
- **Suíte de Lances & Franquia:** 28 testes passando com 100% de sucesso.
- **Build de Produção:** Next.js build concluído com sucesso (`✓ Compiled successfully`, `Finished TypeScript`, 169 rotas geradas sem erros).
