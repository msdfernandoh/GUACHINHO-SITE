# Relatório de Implementação: Check-in para Trabalho Externo / Panfletos & QR Code Fixo Permanente

**Data:** 20/10/2026  
**Contexto:** Separação entre Check-in de Evento Presencial e Check-in de Trabalho Externo (Panfletagem na rua e em empresas sem explicação prévia) com QR Code fixo permanente para gráficas.

---

## 1. Objetivo da Implementação

Atender à demanda de diferenciação entre:
1. **Evento Presencial / Reunião**:
   - Voltado a participantes no local de palestras ou reuniões.
   - Pergunta 4 avalia o conteúdo do encontro.
   - Pergunta 5 avalia momento após a apresentação.
   - Tela final confirma presença no encontro e informa sobre sorteio de prêmios durante o evento.
2. **Trabalho Externo / Panfletos (Rua e Empresas)**:
   - Voltado a quem recebeu folhetos físicos sem explicação verbal prévia.
   - **Pergunta 4 (Opção 4B escolhida):** *"O que mais chamou sua atenção no nosso material?"* (Prêmios, parcelas no bolso, consórcio, curiosidade).
   - **Pergunta 5 (Opção 5A escolhida):** *"Pensando nos seus planos, como você prefere dar o próximo passo?"* (Simulação no WhatsApp, dúvidas com consultor, até 3 meses, apenas sorteio).
   - **Tela Final adaptada:** Confirma o cadastro com o Número da Sorte e avisa que a equipe entrará em contato pelo WhatsApp para divulgar resultados e oportunidades exclusivas, com botão direto para WhatsApp da equipe.
   - **QR Code Fixo Permanente (`/qr/externo`):** O QR impresso nunca muda para a gráfica.
   - **Regra de Negócio Crítica:** Apenas **1 evento externo pode ficar ativo por vez**. Ao ativar um evento externo, qualquer evento externo anterior é automaticamente desativado.

---

## 2. Componentes e Arquivos Alterados

1. **Migration 324 (`supabase/migrations/324_eventos_checkin_externo_panfletos_qr_fixo.sql`)**:
   - Coluna `tipo_checkin text not null default 'evento'` em `public.eventos`.
   - Trigger `trg_garantir_unico_evento_externo_ativo` garantindo exclusividade de evento externo ativo.
   - Inserção do QR fixo permanente `externo` em `public.qr_codes_unicos`.
   - Atualização da RPC `rpc_realizar_checkin_conversacional`.
2. **Tipos e Validações (`gauchinho-app/src/lib/eventos-sorteio/checkin-conversacional-types.ts`)**:
   - `OPCOES_INTERESSE_MATERIAL` e `OPCOES_PROXIMO_PASSO_EXTERNO`.
   - `QualificacaoRespostasPayload` com suporte a `tipo_checkin`.
   - `validarQualificacaoRespostas` com ramificação estrita para evento vs externo.
3. **Resolução de QR Code (`gauchinho-app/src/lib/eventos-sorteio/qr-unico.ts`)**:
   - Suporte dinâmico para `/qr/externo` que localiza o evento externo ativo e o entrega com check-in conversacional.
   - Métodos `garantirQrInstitucionalExterno()` e `fetchEventoExternoAtivo()`.
4. **Interface Conversacional (`gauchinho-app/src/components/public/eventos/evento-checkin-conversacional.tsx`)**:
   - Tela 1, Pergunta 4, Pergunta 5 e Tela Final contextualizadas dinamicamente pelo `tipoCheckin`.
   - Botão direto para WhatsApp comercial com número da sorte e mensagem pré-formatada.
5. **Formulário Administrativo do Evento (`gauchinho-app/src/components/admin/eventos/evento-admin-form.tsx`)**:
   - Seletor visual moderno de Finalidade: *Evento Presencial* vs *Trabalho Externo / Panfletos*.
6. **Actions e Regra de Exclusividade (`gauchinho-app/src/app/admin/eventos/actions.ts`)**:
   - Ao criar ou salvar evento externo ativo, desativa qualquer outro externo anterior.
7. **Painel de QR Codes (`gauchinho-app/src/components/admin/configuracoes/qr-codes-admin-client.tsx`)**:
   - Card em destaque para o **QR Fixo — Trabalho Externo (Panfletos / Empresas)** com link `/qr/externo`, download SVG e PNG em 1200px para a gráfica e indicador de status do evento conectado.
8. **CRM de Leads (`gauchinho-app/src/components/admin/crm/lead-checkin-qualificacao.tsx`)**:
   - Exibição especializada das respostas de panfleto (*O que chamou atenção no material* e *Próximo passo / Contato*).

---

## 3. Testes e Validação

- Testes automatizados executados via Vitest (`src/lib/eventos-sorteio/`): **17 arquivos e 116 testes aprovados com 100% de sucesso**.
- Build de produção (`next build`): **169 rotas compiladas sem nenhum erro de tipagem**.
