# Fase 236 — Indicadores e perfil comercial de Eroni

Data: 17/09/2026

## Diagnóstico

O cadastro público em `/indicar` criava o participante comercial e associava
seu vínculo de comissão ao perfil `Indicador Padrão`. Na empresa Gauchinho há
dois perfis ativos com papel base `INDICADOR`, mas a regra homologada vigente
está associada ao perfil `Indicador`. Dois dos três indicadores do programa
estavam vinculados ao perfil sem regra, com escopo `TODOS` e nenhum menu
individual selecionado. O terceiro já tinha sido corrigido manualmente.

No caso de Eroni Bolfe, o vínculo do perfil `Microfranquia Padrão` estava
classificado como função `GESTOR`, exibida como “Master” no seletor de
formalização. O mesmo participante também tem um vínculo de consultor com
perfil `Sócio`. Ao trocar o participante principal, a interface não escolhia
o perfil aplicável quando havia mais de um, deixando o modelo comercial vazio.
A regra vigente da microfranquia está homologada para o programa Racon Imóvel.

Laura Cervelheira tinha o vínculo correto `SDR → SDR Padrão`, mas também um
vínculo incompatível `CONSULTOR → Indicador`, que fazia seu nome aparecer como
principal. A regra SDR existia para Racon Imóvel, mas não para Racon Veículo,
programa usado pelo grupo 5588 da conferência apresentada.

## Correção

- O cadastro público exige o perfil ativo `Indicador` antes de criar qualquer
  participante. O participante nasce com `Minhas comissões` selecionado e escopo
  `VINCULADOS`. Falha ao criar o vínculo de comissão retorna erro e desfaz o
  cadastro parcial.
- A migration `224_indicadores_perfil_canonico_escopo_proprio.sql` migra os
  indicadores existentes do programa para o perfil `Indicador`, adiciona o menu
  sem retirar outros menus, aplica o escopo `VINCULADOS` e inativa o perfil
  `Indicador Padrão`. Preserva vínculos, vigências, previsões e pagamentos.
- A função comercial do vínculo de Eroni com `Microfranquia Padrão` passa de
  `GESTOR` para `MICROFRANQUIA`, incluindo seu tipo de participação. Sua função
  administrativa no login e o vínculo separado de perfil `Sócio` não mudam.
- A formalização prioriza a identidade de participante associada ao usuário,
  evitando que o cadastro duplicado do programa de indicação tome seu lugar.
  Quando há uma única microfranquia elegível, ela é a seleção inicial; a escolha
  explícita de outro perfil válido continua disponível.
- A formalização separa as funções principais das funções secundárias. `SDR`,
  `PARCEIRO` e `INDICADOR` aparecem como secundários e um único perfil
  homologado para o programa da venda é selecionado automaticamente.
- O vínculo incompatível de Laura é encerrado, mantendo `SDR Padrão`.
- Perfis comerciais não são duplicados por tipo de bem. As regras homologadas
  dos perfis de Microfranquia, SDR, Indicador, Sócio e Parceiro são vinculadas
  também ao programa Racon Veículo, conservando percentual, base, curva e
  cronograma do programa Racon Imóvel.
- A formalização compara o tipo do grupo (`IMÓVEL` ou `VEÍCULO`) com o programa
  da regra. Assim, Eroni e Laura usam automaticamente a regra do programa da
  venda, sem cadastros duplicados da mesma pessoa ou perfil.

## Limites e verificação

O cadastro público de indicador não cria credenciais de login. O menu individual
fica pré-configurado no participante, mas o acesso autenticado ao ERP ainda
depende de vincular um usuário a esse participante e de `empresa_usuarios` com
papel e permissão adequados. Em `Minhas comissões`, a consulta usa o
`participante_comercial_id` ligado ao usuário e filtra previsões por esse ID;
um consultor comum não recebe o seletor de equipe.

Verificações: os 9 testes dos defaults da formalização passaram, o lint não
apontou erros e o build de produção foi concluído. Na suíte ampla, 296 arquivos
passaram e 7 arquivos de contratos legados de repasse/financeiro mantiveram 8
falhas de texto preexistentes e não relacionadas a esta fase.

A migration 224 foi aplicada isoladamente em produção após o deploy do commit
`b9f934c`; a migration 223 permaneceu pendente. A conferência no Supabase
confirmou:

- `Indicador Padrão` inativo e todos os três participantes do programa ligados
  ao perfil `Indicador`, com escopo `VINCULADOS` e menu `minhas-comissoes`;
- Eroni com vínculo ativo `MICROFRANQUIA → Microfranquia Padrão`;
- Laura com vínculo ativo `SDR → SDR Padrão` e o vínculo incompatível inativo;
- regras de Veículo homologadas para `SDR Padrão` (12,5%), `Parceiro Padrão`
  (25%), `Indicador` (25%), `Microfranquia Padrão` (50%) e `Sócio` (100%).

Após a homologação, o perfil do vínculo de Eroni foi alterado operacionalmente
para `Sócio`, mantendo o código técnico legado `MICROFRANQUIA`. O fechamento
passou a montar o rótulo pelo perfil de comissão vigente; por isso a alteração
aparece imediatamente como `Sócio · Eroni Bolfe`. O salvamento de vínculos
também invalida as páginas filhas de Contratações para evitar dados antigos.
