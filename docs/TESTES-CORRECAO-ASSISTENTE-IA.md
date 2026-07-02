# Testes — Correção Assistente IA (Gauchinho)

## Causa comum do “indisponível”

1. **`OPENAI_API_KEY` ausente** na Vercel ou `.env.local` → o chat usa **modo fallback** (respostas guiadas + formulário de lead), não erro seco.
2. **`IA_PROVIDER` diferente de `openai`** → mesmo comportamento de fallback.
3. **Tabelas `ia_conversas` / `ia_mensagens`** sem migration aplicada → conversa não persiste, mas o chat continua com histórico enviado pelo navegador.
4. **`SUPABASE_SERVICE_ROLE_KEY` ausente** → falha ao persistir conversa/lead; logs em `[ia/chat]`.

## Variáveis na Vercel (produção)

```env
OPENAI_API_KEY=sk-...
IA_PROVIDER=openai
IA_MODEL=gpt-4o-mini
NEXT_PUBLIC_SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
```

Opcional: conferir migration `009_ia_conversas.sql` aplicada.

## Admin

`/admin/configuracoes` → aba **IA**:

- Banner **IA configurada** ou **modo fallback**.
- Ativar chat, captura de lead, mensagem inicial, origem WhatsApp.

## Comportamento esperado

| Cenário | Comportamento |
|--------|----------------|
| Chave OK | Respostas OpenAI (`mode: ai`) |
| Sem chave | Fallback comercial + coleta nome/WhatsApp/tipo/valor |
| Erro OpenAI | Mensagem amigável + formulário de lead |
| Lead completo na conversa | Lead `origem=ia_chat` no admin |

## Fallback manual

- Formulário no widget ou `POST /api/public/leads/ia-fallback`
- Lead com `origem=ia_chat_fallback`

## API

- `POST /api/ia/chat` — corpo: `sessionId`, `message`, `history?`, `paginaOrigem`
- Resposta: `{ ok, mode, message, reply, showLeadCapture?, leadCreated? }`

## Testes automatizados

- `src/lib/ia/fallback-engine.test.ts`

## Comandos

```bash
cd gauchinho-app
npm test
npm run build
```

## Teste manual rápido

1. Abrir site → Assistente Gauchinho → mensagem inicial (não “indisponível”).
2. Enviar “Quero simular consórcio imóvel 300 mil” + nome + WhatsApp.
3. Conferir lead em `/admin/leads`.
4. Sem chave: respostas guiadas + atalhos ativos.
