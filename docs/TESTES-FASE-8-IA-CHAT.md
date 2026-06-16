# Testes — Fase 8 IA Comercial + Chat

## Chat

- [ ] Botão flutuante aparece em `/`, `/simulador`, `/grupos`, `/cartas-contempladas`, `/oportunidades-imobiliarias`, `/calculadoras`
- [ ] Chat **não** aparece em `/admin` nem `/login`
- [ ] Abrir chat dispara evento `ia_chat_aberto`
- [ ] Mensagem inicial e botões rápidos funcionam
- [ ] Enviar mensagem retorna resposta (com `OPENAI_API_KEY`) ou fallback elegante
- [ ] Histórico persiste na sessão (`gauchinho_ia_session_id`)
- [ ] Mobile: painel ocupa tela inferior; botão acessível

## Captura de lead

- [ ] Informar nome, WhatsApp e interesse cria lead (`origem = ia_chat`)
- [ ] `analise_ia` preenchido no lead
- [ ] Botão **Chamar no WhatsApp** após lead (origem `ia_chat` ou principal)
- [ ] Eventos: `ia_mensagem_enviada`, `ia_lead_criado`, `lead_criado`

## Admin

- [ ] Aba **IA** em Configurações salva chave `ia_config`
- [ ] Desativar chat remove widget nas páginas públicas
- [ ] Lead em `/admin/leads/[id]` com origem `ia_chat` mostra **Resumo da IA**

## Segurança / regras

- [ ] Respostas usam “simulação”, “estimativa”, “sujeito à confirmação”
- [ ] IA não promete contemplação/aprovação/rentabilidade garantida (revisão manual)

## Banco

- [ ] Migration `009_ia_conversas.sql` aplicada no Supabase

## Regressão

- [ ] `/`, `/simulador`, `/grupos`, `/cartas-contempladas`, `/oportunidades-imobiliarias`, `/calculadoras`, `/admin/leads`

```bash
cd gauchinho-app
npm test
npm run build
```
