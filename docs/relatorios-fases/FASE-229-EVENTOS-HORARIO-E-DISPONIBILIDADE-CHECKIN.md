# Relatório de Fase 229 — Eventos: Correção de Horário & Disponibilidade do Check-in

> **Status:** Concluído com sucesso (Aguardando autorização para deploy em produção)  
> **Data:** 12 de Setembro de 2026  
> **Módulo:** Eventos — Controle de Data/Hora (America/Cuiaba), Idempotência de Salvamento, Modos de Disponibilidade do Check-in e Tela de Encerramento/Aguarde  

---

## 1. Contexto e Objetivos

Após a entrada em produção das Fases 227 e 228 (Check-in conversacional, sorteios, telão e melhorias de UX no QR/Branding), identificou-se um problema no fluxo de data/hora:
1. **Bug do Deslocamento de Horário:** Ao preencher um horário (ex: `16/09/2026 18:30`) e salvar o evento, o horário sofria alteração para `14:30` (ou subtraía 4 horas a cada novo salvamento consecutivo).
2. **Disponibilidade do Check-in:** Não havia mecanismo para controlar quando o check-in e QR Code estariam abertos, gerando risco de acessos antecipados ou erro 404 antes do evento.

---

## 2. Auditoria Técnica Ponta a Ponta do Bug de Horário

### 2.1 Causa Exata
- **Input:** `<input type="datetime-local">` emite uma string civil `"YYYY-MM-DDTHH:mm"` sem fuso (ex: `"2026-09-16T18:30"`).
- **Interpretação na Server Action:** O código executava `new Date("2026-09-16T18:30").toISOString()`. Como a Server Action executa no servidor Vercel (onde `process.env.TZ` é UTC), o JavaScript interpretava `18:30` como `18:30 UTC` (`2026-09-16T18:30:00.000Z`), em vez de converter os 18:30 de Cuiabá (UTC-4) para seu verdadeiro instante UTC (**22:30 UTC**).
- **Banco de Dados (`public.eventos.data_evento`):** O campo no PostgreSQL é do tipo `timestamptz`. O banco armazenava `2026-09-16 18:30:00+00`.
- **Reabertura no Formulário:** A função `toDatetimeLocalValue` fazia `new Date(iso).getHours()` no navegador do administrador em Cuiabá (`America/Cuiaba` / UTC-4), subtraindo 4 horas e renderizando `14:30`.
- **Efeito Cumulativo no Duplo Salvamento:** Ao salvar novamente sem tocar na data, enviava `14:30`, que virava `14:30 UTC`, reabrindo como `10:30`.

### 2.2 Diagnóstico do Campo no Banco
- **Coluna:** `public.eventos.data_evento`
- **Tipo PostgreSQL:** `timestamptz` (`timestamp with time zone`)
- **Veredito:** O tipo de coluna está correto; o problema estava exclusivamente na conversão entre a string do formulário civil e o instante UTC.

### 2.3 Auditoria de Dados Históricos
- **Diretiva:** Nenhum registro histórico foi alterado em massa automaticamente.

---

## 3. Implementação e Solução Arquitetural

### 3.1 Módulo Oficial de Fuso Horário (`timezone.ts`)
- Fuso oficial: `America/Cuiaba` (UTC-4).
- `eventoLocalDateTimeToIso(raw)`: Converte `"YYYY-MM-DDTHH:mm"` local civil de Cuiabá para instante UTC ISO exato (`22:30:00.000Z`).
- `eventoIsoToDatetimeLocal(iso)`: Decompõe o instante UTC estritamente nas coordenadas de `America/Cuiaba` via `Intl.DateTimeFormat("en-CA")`, retornando `"YYYY-MM-DDTHH:mm"` idêntico em qualquer ambiente.
- `formatarDataHoraEvento(iso)`: Formatação pública padronizada `DD/MM/AAAA às HH:mm`.
- **Idempotência comprovada:** `eventoIsoToDatetimeLocal(eventoLocalDateTimeToIso(x)) === x`.

### 3.2 Modos de Disponibilidade do Check-in (`disponibilidade.ts`)
Centralização via `resolverStatusCheckinEvento()`:
- **Modo Agendado (`agendado`):** Abre automaticamente com base na data do evento menos a antecedência (default: 30 min).
- **Modo Ativar Agora (`ativo_agora`):** Liberação imediata para ensaio/teste real com a equipe.
- **Modo Encerrado (`encerrado`):** Finalização manual.
- **Botão `[ Voltar ao agendamento ]`:** Restaura a regra de agendamento sem necessidade de redigitar datas.
- **Tela Amigável (`EventoCheckinFechado`):** Se o visitante acessar antes da abertura ou após encerramento, exibe tela mobile amigável com branding oficial, data confirmada e horário previsto, sem erro 404.
- **Preview (`?preview=1`):** Operadores autenticados continuam podendo testar visualmente mesmo com check-in fechado.

### 3.3 Migration Aditiva 221
- Arquivo: `supabase/migrations/221_eventos_checkin_disponibilidade.sql`
- Colunas aditivas: `checkin_modo`, `checkin_abertura_antecipada_minutos`, `checkin_ativo_manual_at`, `checkin_ativo_manual_por_id`.
- 100% retrocompatível com fallback defensivo em código caso ainda não aplicada no banco.

---

## 4. Resultados dos Testes de Homologação

- **Testes Unitários:** 16 arquivos, 109 testes aprovados (100% PASS).
- **TypeScript:** 0 erros (`npx tsc --noEmit` PASS).
- **ESLint:** 0 erros, 0 warnings nos arquivos modificados.
- **Build de Produção:** Next.js 16.3 Turbopack PASS (153 rotas compiladas).
