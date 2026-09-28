# Fase 297 — Fechamento financeiro somente pelo servidor autorizado

Data: 28/09/2026. A prévia de fechamento contém o lucro confirmado pelo gestor e referências do extrato, por isso a RPC de gravação não pode receber diretamente um demonstrativo enviado pelo navegador. A migration `297_fechamento_socios_rpc_servidor.sql` revoga a execução autenticada tanto da RPC legada `rpc_fechar_socios` quanto da nova RPC interna de corte. Um wrapper executável somente pela `service_role` exige um usuário Auth com vínculo ativo na empresa e passa o contexto à RPC interna. A Server Action exige acesso ao módulo e permissão `gerenciar_financeiro` no tenant antes de chamar o wrapper.

O botão de fechamento legado em Contas a Pagar foi substituído por um link ao painel novo. A antiga action devolve erro explicativo caso ainda seja chamada por um cliente desatualizado. Na edição de centros de custo, o campo do teto foi colocado na atualização correta; a edição de banco não envia mais essa coluna.

O SQL da migration foi executado no Supabase ligado com autorização do titular e o cache do PostgREST recarregado. A consulta de permissões confirmou: usuário `authenticated` sem EXECUTE nas duas RPCs diretas, `service_role` com EXECUTE apenas no wrapper. A tabela de cortes da Gauchinho continua com zero registros. As versões 294–297, antes aplicadas por SQL direto, foram registradas como aplicadas no histórico de migrations após conferência dos objetos. As versões 289–293 continuam pendentes.

Validação local: TypeScript sem erros; seis testes direcionados aprovados; ESLint sem erros, com avisos preexistentes; build Next aprovado antes desta última proteção e será repetido após a integração. A interface não foi publicada no domínio de produção nesta fase.
