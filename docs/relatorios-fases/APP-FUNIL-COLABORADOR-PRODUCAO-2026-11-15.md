# App: funil e colaborador somente produção — 15/11/2026

## Resultado
- Todo vendedor vê a etapa real de cada indicação em `crm_funil_etapas`, com consulta limitada à empresa e ao seu indicador. Venda realizada aparece como Fechado e apresenta o crédito contratado. Cancelamentos/estornos não são apresentados como fechamento válido.
- Parceiros ativos encontram **Colaboradores fixos** no app: um link exclusivo para autocadastro e a produção individual da equipe direta. O perfil não aparece no cadastro direto dos geradores remunerados.
- O convite é assinado, confere a empresa do domínio e revalida responsável, vínculo e programa ativos. Colaborador restrito não pode gerar convites ou administrar equipe.
- Cadastro solicita nome, CPF, telefone, e-mail, senha e PIX. O servidor força o perfil de produção independentemente do corpo enviado, grava a política em `app_metadata` não editável pelo usuário e utiliza o papel canônico `colaborador_producao`, sem permissões de ERP ou financeiras.
- O app restrito mostra suas próprias indicações, contagens, etapas e valores fechados. Não renderiza comissão, simulação, calendário de pagamento ou contrato/aceite. A consulta de comissões e eventos é pulada, não apenas ocultada. As URLs financeiras redirecionam antes da consulta e ações de recebimento/aceite são negadas.
- Nenhum perfil de comissão é criado para esse cadastro. O pagamento próprio pelo empregador não altera tabelas, impostos ou regras financeiras existentes. O cadastro público comum rejeita atualização do registro originado pelo convite fixo.

## Dados e arquitetura
`empresa_usuarios` permanece N:N. A identidade de Auth é resolvida a partir do usuário de negócio, sem assumir igualdade com o participante. O vínculo de equipe utiliza `gestor_participante_id` com filtro de empresa. Dados aninhados de outro tenant são descartados antes da apresentação.

A migration 339 é aditiva e idempotente: somente insere o novo papel sem conceder permissões. O mesmo seed foi executado pela API administrativa e confirmado em produção: papel ativo e zero permissões. Nenhum usuário existente, senha, CPF, vínculo operacional, indicação, venda ou comissão foi alterado nesta fase. As contas atuais continuam no perfil padrão.

## Verificação
- 64 testes passaram em 11 arquivos: convite/tamper/tenant, política não editável, etapas e vendas canceladas, bloqueio de URLs e ações antes das consultas, painel sem busca financeira, cadastro restrito e regressões de microfranquia/importação/planos.
- TypeScript e lint dos arquivos envolvidos passaram.
- Build de produção webpack passou (187 páginas); aviso preexistente de `unpdf` no módulo de boletos, sem impedir compilação.
- Painel e formulário renderizados com dados sintéticos, conferidos visualmente e sem corte horizontal em 390 e 1280 pixels. Não foram criadas contas fictícias no banco de produção.
- Consulta de leitura confirmou que as colunas/relacionamentos usados no funil existem em produção.

## Uso
No app padrão: **Colaboradores fixos → Copiar**. Enviar o link ao funcionário. Ele escolhe sua senha no cadastro e passa a entrar com CPF ou e-mail. O perfil restringe a visibilidade no app; a remuneração direta é combinada pelo responsável.
