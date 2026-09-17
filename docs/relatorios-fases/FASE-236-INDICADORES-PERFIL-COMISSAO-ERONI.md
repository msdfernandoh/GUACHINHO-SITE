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

## Limites e verificação

O cadastro público de indicador não cria credenciais de login. O menu individual
fica pré-configurado no participante, mas o acesso autenticado ao ERP ainda
depende de vincular um usuário a esse participante e de `empresa_usuarios` com
papel e permissão adequados. Em `Minhas comissões`, a consulta usa o
`participante_comercial_id` ligado ao usuário e filtra previsões por esse ID;
um consultor comum não recebe o seletor de equipe.

Verificações: teste dos defaults da formalização e contrato do programa de
indicação, lint dos arquivos alterados, build de produção, aplicação controlada
da migration e conferência dos registros alterados no Supabase.
