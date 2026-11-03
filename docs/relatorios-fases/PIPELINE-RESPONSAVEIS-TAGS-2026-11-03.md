# Pipeline — responsáveis e tags
Data: 03/11/2026

O modal usava a lista geral da empresa, incluindo cadastros que não pertencem
à equipe selecionada no evento. Agora consulta os IDs em eventos_leads_usuarios,
intersectando com consultores elegíveis do tenant, já consolidados por identidade.
Não funde pessoas apenas por nome. Leads sem evento mantêm a lista geral.
Um responsável histórico fora da equipe aparece desabilitado como atual,
preservando sua atribuição ao editar outros campos. Falha de consulta impede salvar.

Tags passam de 9px para 12px em negrito com borda e fundo destacados.
Texto digitado é incluído no salvamento sem exigir clique prévio no botão +.

Sem migration, escrita remota ou publicação. Homologação visual em sessão
autenticada permanece pendente. TypeScript executado na validação local.

Envio à main autorizado pelo titular. TypeScript e lint direcionado aprovados.
