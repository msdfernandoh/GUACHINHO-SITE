# Fase 176 — Hotfix da Agenda e formalização Racon Imóvel

## Sintomas confirmados

- `POST /admin/agenda` encerrava a rota com o digest `2416219559` e a mensagem `Responsável inválido para esta empresa`.
- A conferência da contratação carregava, porém exibia as modalidades com comissão de franqueadora em `0,00%`; o botão **Confirmar e formalizar venda** permanecia desabilitado.

## Causa raiz

### Agenda

O usuário possuía vínculo N:N ativo, `is_consultor = true` e acesso à Agenda, mas seu papel canônico era `super_admin`. O resolvedor de responsáveis aceitava somente `admin_empresa`, `gestor` e `consultor`. Eventos de equipe usam o próprio usuário como responsável técnico, por isso a validação o rejeitava antes da inserção.

### Formalização

A contratação preservava `dados_simulacao.consultor_id` como `usuarios.id`, enquanto a venda exige `participantes_comerciais.id`. A tela não fazia a conversão pelo vínculo canônico `participantes_comerciais.usuario_id` e não preenchia o único perfil de papel `CONSULTOR`.

Além disso, o programa ativo **Racon Imóvel — Comissão V2**, referenciado pelas regras de perfil vigentes, estava sem `comissao_regras_franquia`. A versão anterior do mesmo catálogo mantinha as três regras imobiliárias oficiais e suas etapas normalizadas, mas elas não haviam sido transportadas ao programa ativo.

## Correções

- O responsável da Agenda passa a ser elegível por `empresa_usuarios.is_consultor` ou pelos papéis canônicos aceitos, incluindo `super_admin`; vínculo ativo, usuário ativo e tenant continuam obrigatórios.
- A criação usa `useActionState`: validações operacionais aparecem dentro do formulário e não derrubam mais a página.
- A formalização converte o usuário da proposta em participante comercial pelo UUID relacionado, seleciona automaticamente somente quando existe um único perfil `CONSULTOR` e traduz a modalidade de parcela do snapshot para o código canônico.
- A migration `173_hotfix_agenda_responsavel_e_regras_racon_imovel.sql` copia percentuais, cronograma, modalidade, tipo e curva da versão canônica anterior para o programa imobiliário ativo. Não inventa percentuais, não altera vendas, previsões ou pagamentos existentes e é idempotente por combinação programa/tipo/modalidade.
- A interface diferencia modalidade de catálogo sem regra vigente e apresenta uma pendência explícita.

## Segurança e preservação

- Nenhum dado pessoal é migrado.
- Nenhum fato financeiro ou histórico é recalculado.
- A RPC de formalização permanece responsável pela validação final de tenant, grupo, produto, participante, perfil, modalidade e regra vigente.
- A restauração é limitada à empresa `gauchinho`, administradora `racon`, tipo `IMOVEL` e programa ativo correspondente.

## Verificação

- Testes unitários dos defaults canônicos da formalização.
- Teste de contrato da elegibilidade do responsável e retorno de erro inline da Agenda.
- Build de produção e validação da migration antes da publicação.
