# Projeto — Área Logada + CRM de Leads Gauchinho Consórcios | Racon

**Versão:** 1.0  
**Data:** 18/09/2026  
**Objetivo:** criar um módulo de área logada com CRM de leads, dashboard comercial e pipeline visual inspirado na experiência de uso de CRMs como Pipedrive, sem copiar marca, identidade visual, textos, componentes proprietários ou código de terceiros.

---

## 1. Visão Geral do Projeto

Criar dentro do projeto **Gauchinho Site / Área Logada** um módulo chamado **CRM**, focado exclusivamente em **gestão de leads e oportunidades comerciais**.

O sistema não deverá substituir o ERP atual. O ERP continuará controlando vendas, cotas, comissões, repasses, pós-venda e demais rotinas financeiras/operacionais. O novo CRM será a camada visual e operacional para:

- Entrada de leads
- Distribuição de leads
- Gestão do funil de vendas
- Acompanhamento de atividades comerciais
- Agenda e tarefas
- Dashboard de vendas
- Painel de performance para Master/Admin
- Área de visualização para parceiros e perfis comerciais

---

## 2. Premissas Confirmadas

### 2.1 Perfis de acesso

Trabalhar inicialmente com os seguintes perfis:

1. **Admin / Master**
2. **Microfranqueado**
3. **Gerador de Negócios**
4. **Indicador / Gerador de Possibilidades**
5. **SDR**
6. **Financeiro**

### 2.2 Regra especial para SDR

O SDR poderá ter acesso visual a todos os leads, porém deverá trabalhar por meio de filtros e atribuições.

Exemplo:

- SDR vê todos os leads, se autorizado.
- SDR filtra por:
  - leads atribuídos a ele
  - leads sem responsável
  - leads de determinada origem
  - leads em determinada etapa
  - leads parados há X dias
  - leads com reunião pendente
- O sistema deve permitir que Admin/Master defina quais leads entram na fila de trabalho do SDR.

### 2.3 Escopo do CRM

O CRM deverá controlar **somente leads e oportunidades comerciais**.

Não controlar nesta primeira versão:

- Cotas vendidas
- Comissões
- Repasses
- Estornos
- Pós-venda completo
- Financeiro

Esses módulos já existem ou serão mantidos no ERP.

### 2.4 Foco do dashboard

O dashboard principal será focado em **vendas**, com destaque para:

- Volume de leads
- Funil comercial
- Produção em negociação
- Produção fechada
- Conversão
- Atividades comerciais
- Performance da equipe

### 2.5 UI/UX de referência

A interface deve ser inspirada no modelo visual de CRM comercial tipo Pipedrive:

- Pipeline em colunas
- Cards arrastáveis
- Funil visual
- Etapas claras
- Cores por prioridade/status
- Ações rápidas
- Filtros fortes
- Histórico por lead
- Visual limpo e focado em ação

**Importante:** usar a experiência como referência de boas práticas, sem copiar elementos proprietários, marca, identidade visual, ícones exclusivos, textos ou componentes protegidos.

---

## 3. Conceito Principal do Sistema

O sistema deve responder rapidamente a 5 perguntas:

1. Quantos leads temos?
2. Em qual etapa cada lead está?
3. Quem é responsável por cada lead?
4. Qual o próximo passo?
5. Quanto temos em potencial de venda?

A tela principal deve ser construída para o comercial agir, não apenas consultar.

---

## 4. Módulos do CRM

### 4.1 Login e permissões

A área logada já existe ou será integrada ao sistema atual. O CRM deverá respeitar o perfil do usuário.

#### Perfis e permissões sugeridas

| Perfil | Permissões principais |
|---|---|
| Admin / Master | Ver todos os leads, editar, excluir, distribuir, configurar funil, ver performance geral |
| Microfranqueado | Ver seus leads, cadastrar leads, mover no funil, registrar atividades |
| Gerador de Negócios | Ver seus leads, cadastrar oportunidades, acompanhar status, registrar atividades |
| Indicador / Gerador de Possibilidades | Cadastrar leads e acompanhar status simplificado |
| SDR | Ver leads liberados, filtrar carteira, registrar contato, agendar reunião, mover etapas autorizadas |
| Financeiro | Acesso limitado a dados necessários, sem interferir no funil comercial |

---

## 5. Dashboard Principal do CRM

### 5.1 Objetivo

Exibir uma visão executiva e operacional das vendas.

### 5.2 Cards superiores

Exibir os seguintes indicadores no topo:

| Indicador | Exemplo |
|---|---:|
| Leads no mês | 127 |
| Leads novos hoje | 14 |
| Reuniões agendadas | 22 |
| Reuniões realizadas | 15 |
| Oportunidades em negociação | R$ 8.400.000,00 |
| Vendas fechadas no mês | R$ 1.750.000,00 |
| Meta mensal atingida | 58% |
| Taxa de conversão | 14,2% |

### 5.3 Funil visual no dashboard

Criar uma imagem/gráfico de funil com a quantidade de leads em cada fase.

Exemplo de fases:

1. Novo lead
2. Contato realizado
3. Qualificado
4. Reunião agendada
5. Reunião realizada
6. Proposta enviada
7. Documentação / cadastro
8. Boleto enviado
9. Venda fechada
10. Pós-venda / acompanhamento
11. Perdido
12. Stand-by / futuro

### 5.4 Exemplo visual textual do funil

```text
NOVO LEAD                ██████████████████████  120
CONTATO REALIZADO        ████████████████         86
QUALIFICADO              ███████████              61
REUNIÃO AGENDADA         ████████                 42
REUNIÃO REALIZADA        ██████                   31
PROPOSTA ENVIADA         ████                     22
DOCUMENTAÇÃO/CADASTRO    ███                      15
BOLETO ENVIADO           ██                       9
VENDA FECHADA            █                        6
PERDIDO                  █████                    28
STAND-BY/FUTURO          ███                      16
```

### 5.5 Área de alertas do dashboard

Criar alertas comerciais:

- Leads sem responsável
- Leads sem contato há mais de 24h
- Reuniões do dia
- Reuniões atrasadas
- Propostas sem retorno
- Leads parados há mais de 7 dias
- Oportunidades quentes
- Leads de eventos / network pendentes de contato

### 5.6 Painel de performance para Master

No perfil Admin/Master, incluir um painel aberto de performance.

Indicadores:

| Indicador | Descrição |
|---|---|
| Produção por parceiro | Valor total movimentado por parceiro |
| Leads cadastrados | Quantidade de leads por origem/parceiro |
| Reuniões realizadas | Volume de reuniões por responsável |
| Taxa de conversão | Conversão por responsável e origem |
| Tempo médio de resposta | Quanto tempo demora até o primeiro contato |
| Leads parados | Oportunidades sem evolução |
| Ranking de atividade | Performance baseada em ações, não apenas venda |

O nome recomendado é **Painel de Performance**, não “ranking”, para gerar motivação sem estimular disputa negativa.

---

## 6. CRM Kanban estilo Pipeline

### 6.1 Objetivo da tela

A tela de CRM deve funcionar como o centro operacional de vendas.

Layout recomendado:

```text
[ Filtros ] [ Busca ] [ Novo Lead ] [ Exportar ]

| Novo Lead | Contato Realizado | Qualificado | Reunião Agendada | Proposta Enviada | Boleto | Fechado |
|-----------|-------------------|-------------|------------------|------------------|--------|---------|
| Card      | Card              | Card        | Card             | Card             | Card   | Card    |
| Card      | Card              | Card        | Card             | Card             | Card   | Card    |
```

### 6.2 Cards de lead

Cada card deve mostrar:

- Nome do lead
- Telefone / WhatsApp
- Valor estimado da oportunidade
- Produto de interesse
- Origem
- Responsável
- Temperatura do lead
- Próxima atividade
- Data da última interação
- Sinalização se está parado

Exemplo:

```text
João Pereira
R$ 500.000 | Imóvel
Origem: Landing Page Parceiros
Resp.: SDR Ana
🔥 Quente
Próxima ação: reunião hoje 19h
```

### 6.3 Ações rápidas no card

Ao clicar ou passar o mouse:

- Abrir lead
- Chamar no WhatsApp
- Agendar reunião
- Criar tarefa
- Registrar ligação
- Registrar observação
- Mover etapa
- Marcar como perdido
- Transferir responsável

### 6.4 Drag and drop

Permitir arrastar o card entre colunas.

Ao mover de etapa, abrir modal curto:

- Confirmar mudança
- Registrar observação opcional
- Criar próxima atividade
- Atualizar temperatura
- Definir data de retorno

Exemplo:

```text
Lead movido para: Proposta enviada

Deseja registrar o próximo passo?
[ ] Retornar em 2 dias
[ ] Agendar reunião
[ ] Enviar documentação
[ ] Sem próxima ação
```

---

## 7. Fases do Funil

Funil aprovado:

1. **Novo lead**
2. **Contato realizado**
3. **Qualificado**
4. **Reunião agendada**
5. **Reunião realizada**
6. **Proposta enviada**
7. **Documentação / cadastro**
8. **Boleto enviado**
9. **Venda fechada**
10. **Pós-venda / acompanhamento**
11. **Perdido**
12. **Stand-by / futuro**

### 7.1 Regras por fase

#### Novo lead
Lead entrou no sistema, mas ainda não recebeu contato.

#### Contato realizado
Alguém tentou ou conseguiu falar com o lead.

#### Qualificado
Lead tem interesse real, perfil e possibilidade de compra.

#### Reunião agendada
Reunião online ou presencial marcada.

#### Reunião realizada
Reunião aconteceu e houve avanço comercial.

#### Proposta enviada
Plano, simulação ou proposta foi enviada.

#### Documentação / cadastro
Cliente iniciou envio de dados, documentos ou análise.

#### Boleto enviado
Primeira etapa de pagamento ou contratação foi gerada.

#### Venda fechada
Venda concluída e enviada para o ERP.

#### Pós-venda / acompanhamento
Status de transição para acompanhamento fora do CRM comercial.

#### Perdido
Lead descartado, sem interesse, sem perfil ou não avançou.

#### Stand-by / futuro
Lead com potencial, mas sem momento atual.

---

## 8. Cadastro de Lead

### 8.1 Premissa importante

O lead pode entrar incompleto.

Nem todos os canais trazem todas as informações no primeiro contato. O sistema deve permitir entrada rápida e enriquecimento posterior.

### 8.2 Campos mínimos obrigatórios

- Nome ou identificação
- Telefone, e-mail ou canal de contato
- Origem do lead

### 8.3 Campos recomendados

- Nome completo
- WhatsApp
- E-mail
- Cidade/Estado
- Origem
- Responsável
- Tipo de pessoa: cliente, parceiro, empresa, investidor
- Produto de interesse: imóvel, veículo, serviços, pesados, máquinas, capital, outro
- Valor estimado de crédito
- Modelo de interesse:
  - Cliente final
  - Microfranqueado
  - Gerador de Negócios
  - Gerador de Possibilidades
  - Ainda não definido
- Temperatura:
  - Frio
  - Morno
  - Quente
  - Urgente
- Observações
- Próxima ação
- Data de retorno

### 8.4 Campos que podem ser preenchidos depois

- CPF/CNPJ
- Data de nascimento
- Profissão
- Renda
- Valor de entrada/lance
- Objetivo do consórcio
- Prazo desejado
- Histórico comercial
- Documentos
- Anexos
- Motivo de perda
- Probabilidade de fechamento

---

## 9. Origem do Lead

Lista inicial de origens:

- Site
- Landing Page Parceiros
- Formulário de indicação
- WhatsApp
- Instagram
- Facebook
- Google Ads
- Tráfego pago
- Evento presencial
- Happy hour / network
- Reunião online
- Indicação de parceiro
- Microfranqueado
- Gerador de Negócios
- Gerador de Possibilidades
- Cadastro manual
- Planilha importada
- Outros

---

## 10. Filtros do CRM

Filtros obrigatórios:

- Responsável
- Origem
- Etapa do funil
- Produto de interesse
- Valor estimado
- Data de entrada
- Data da última interação
- Próxima atividade
- Temperatura
- Modelo de interesse
- Parceiro indicador
- Leads sem responsável
- Leads parados
- Leads do SDR
- Leads por cidade/estado

Filtro especial para SDR:

- Meus leads
- Leads sem responsável
- Leads liberados para SDR
- Leads parados há X dias
- Leads de reunião pendente
- Leads de primeiro contato
- Leads por campanha

---

## 11. Tela Interna do Lead

Ao abrir um lead, exibir uma página completa com abas.

### 11.1 Cabeçalho do lead

- Nome
- Status
- Etapa atual
- Responsável
- Valor estimado
- Origem
- Botão WhatsApp
- Botão agendar
- Botão editar
- Botão converter / enviar ao ERP

### 11.2 Abas

1. **Resumo**
2. **Atividades**
3. **Histórico**
4. **Reuniões**
5. **Propostas**
6. **Arquivos**
7. **Dados do cliente**
8. **Origem e responsáveis**

### 11.3 Timeline do lead

Registrar automaticamente:

- Criação do lead
- Alteração de responsável
- Mudança de etapa
- Comentários
- Ligações
- WhatsApp enviado
- Reuniões marcadas
- Reuniões realizadas
- Propostas enviadas
- Alterações de temperatura
- Perda ou fechamento

---

## 12. Agenda

A agenda já existe no sistema. O CRM deve apenas integrar/usar essa agenda.

### 12.1 Funções necessárias

- Criar reunião a partir do lead
- Criar tarefa a partir do lead
- Definir lembrete
- Registrar comparecimento
- Marcar como:
  - compareceu
  - não compareceu
  - remarcou
  - avançou
  - perdeu
- Exibir próximas atividades no card
- Mostrar agenda do dia no dashboard

### 12.2 Eventos fixos

Incluir evento fixo:

**Network de negócios — toda terça-feira às 19h**

Possíveis ações:

- Vincular lead ao evento
- Confirmar presença
- Registrar comparecimento
- Criar retorno pós-evento

---

## 13. Área do Parceiro

A área do parceiro já existe ou será incluída no modelo atual.

### 13.1 O que o parceiro deve ver

- Seus leads cadastrados
- Status dos leads
- Próximas reuniões
- Histórico simplificado
- Botão cadastrar novo lead
- Link próprio de indicação
- Materiais de venda
- Convite para network de terça às 19h

### 13.2 Visão por modelo

#### Microfranqueado
- CRM completo dos próprios leads
- Pipeline próprio
- Agenda
- Performance individual
- Leads atribuídos pela Master
- Materiais e treinamentos

#### Gerador de Negócios
- Leads cadastrados
- Reuniões agendadas
- Status das oportunidades
- Ações recomendadas
- Convites para eventos

#### Gerador de Possibilidades
- Cadastro rápido de indicação
- Status simplificado:
  - recebido
  - em contato
  - em negociação
  - convertido
  - sem interesse
- Material de indicação

---

## 14. Tela de Materiais e Treinamentos

Criar uma área simples com:

- Materiais digitais
- Materiais impressos em PDF
- Scripts de abordagem
- Objeções frequentes
- Vídeos de treinamento
- Apresentações comerciais
- Convites para eventos
- Links de cadastro

Categorias sugeridas:

- Como indicar
- Como convidar para reunião
- Como explicar consórcio
- Como falar com empresários
- Como trabalhar imóveis
- Como trabalhar veículos
- Como convidar para o network
- Scripts de WhatsApp

---

## 15. Integração com Landing Pages

Todos os formulários do site devem alimentar a mesma base de leads.

### 15.1 Landing pages conectadas

- Página principal de parceiros
- Página Microfranqueado
- Página Gerador de Negócios
- Página Gerador de Possibilidades
- Formulário geral de indicação
- Página de cliente final

### 15.2 Campos vindos da landing page

- Nome
- WhatsApp
- E-mail
- Cidade/Estado
- Modelo de interesse
- Origem da página
- UTM source
- UTM medium
- UTM campaign
- Indicado por
- Mensagem/observação

### 15.3 Lead incompleto

Quando o lead vier sem informação completa:

- Criar mesmo assim
- Marcar como “incompleto”
- Solicitar enriquecimento no primeiro atendimento
- Destacar no card com um ícone discreto

---

## 16. Envio para ERP

Como o ERP já controla o restante, o CRM deve ter um ponto de transição.

### 16.1 Botão

**Enviar para ERP**

### 16.2 Quando usar

Após o lead chegar em uma destas etapas:

- Documentação / cadastro
- Boleto enviado
- Venda fechada

### 16.3 Dados enviados

- Dados do lead
- Histórico comercial
- Responsável
- Origem
- Produto
- Valor estimado
- Observações
- Arquivos, se houver
- Status comercial

### 16.4 Evitar duplicidade

Antes de enviar ao ERP, validar:

- CPF/CNPJ, se houver
- WhatsApp
- E-mail
- Nome + telefone
- Lead já existente

---

## 17. UX e UI Inspirada em CRM Comercial Moderno

### 17.1 Princípios visuais

- Interface limpa
- Poucas telas para executar ação
- Cards visuais
- Cores por prioridade
- Funil claro
- Ações rápidas
- Foco em vendas
- Histórico sempre visível
- Menos cliques para registrar atividade

### 17.2 Referência de experiência

O sistema deve se inspirar em boas práticas de CRMs visuais:

- Pipeline como centro da operação
- Visualização rápida de etapa
- Arrastar e soltar
- Próxima atividade destacada
- Alertas para leads parados
- Filtros fortes
- Relatórios de performance
- Gestão por atividade

### 17.3 Não copiar

Não copiar:

- Marca Pipedrive
- Cores exatas
- Ícones proprietários
- Código
- Textos
- Componentes exclusivos
- Imagens ou screenshots

Criar uma identidade própria Gauchinho/Racon.

### 17.4 Paleta sugerida

- Verde escuro para ação/conversão
- Azul para informação
- Amarelo/laranja para atenção
- Vermelho discreto para atrasos
- Cinza claro para fundo
- Branco para cards
- Preto/grafite para textos

---

## 18. Automação Comercial

### 18.1 Automações iniciais

- Novo lead → notificar Admin/SDR
- Lead sem responsável → aparecer no alerta do dashboard
- Lead sem contato em 24h → alerta
- Reunião agendada → aparecer na agenda
- Reunião não realizada → tarefa de reagendamento
- Proposta enviada sem retorno em 3 dias → alerta
- Lead parado há 7 dias → alerta de recuperação
- Lead perdido → exigir motivo
- Venda fechada → opção de enviar ao ERP

### 18.2 Motivos de perda

Lista sugerida:

- Sem interesse
- Sem perfil financeiro
- Já comprou com outro
- Não respondeu
- Momento futuro
- Achou parcela alta
- Não entendeu consórcio
- Preferiu financiamento
- Falta de documentação
- Outros

---

## 19. Banco de Dados — Estrutura Sugerida

### 19.1 Tabela `users`

- id
- name
- email
- phone
- role
- status
- created_at
- updated_at

### 19.2 Tabela `leads`

- id
- name
- phone
- email
- city
- state
- source
- campaign
- model_interest
- product_interest
- estimated_value
- temperature
- status
- stage_id
- owner_id
- indicated_by_id
- assigned_sdr_id
- is_incomplete
- notes
- created_at
- updated_at

### 19.3 Tabela `pipeline_stages`

- id
- name
- order
- color
- is_won
- is_lost
- is_active

### 19.4 Tabela `lead_activities`

- id
- lead_id
- user_id
- type
- title
- description
- due_date
- completed_at
- result
- created_at

### 19.5 Tabela `lead_history`

- id
- lead_id
- user_id
- action
- old_value
- new_value
- description
- created_at

### 19.6 Tabela `lead_files`

- id
- lead_id
- file_url
- file_name
- uploaded_by
- created_at

### 19.7 Tabela `events`

- id
- title
- description
- date
- time
- type
- location
- online_link
- created_at

### 19.8 Tabela `lead_event_registrations`

- id
- lead_id
- event_id
- status
- attended
- notes
- created_at

---

## 20. Telas do Sistema

### 20.1 Login

- E-mail
- Senha
- Recuperar senha

### 20.2 Dashboard

- Cards de indicadores
- Funil visual
- Agenda do dia
- Alertas
- Painel de performance

### 20.3 CRM / Pipeline

- Kanban de leads
- Filtros
- Busca
- Cards
- Drag and drop
- Ações rápidas

### 20.4 Lista de leads

Além do Kanban, criar modo tabela.

Colunas:

- Nome
- Telefone
- Origem
- Responsável
- Etapa
- Valor estimado
- Temperatura
- Próxima ação
- Criado em
- Última interação

### 20.5 Cadastro / edição de lead

Formulário com campos essenciais e campos avançados.

### 20.6 Detalhe do lead

Tela completa com abas e timeline.

### 20.7 Agenda

Usar agenda existente, integrando com lead.

### 20.8 Performance

Visão do Admin/Master.

### 20.9 Materiais e treinamentos

Biblioteca de conteúdos.

### 20.10 Configurações

- Etapas do funil
- Origens
- Usuários
- Permissões
- Automações
- Motivos de perda

---

## 21. MVP Recomendado

### 21.1 Primeira entrega

Obrigatório:

- Login com permissões
- Dashboard de vendas
- Funil visual com quantidade por fase
- CRM Kanban
- Cadastro de leads incompletos
- Edição de leads
- Filtros
- Agenda integrada
- Timeline do lead
- Ações rápidas
- Área do parceiro com leads próprios
- Painel de performance para Master
- Envio para ERP

### 21.2 Segunda fase

- Automação avançada
- Importação por planilha
- Relatórios personalizados
- Integração WhatsApp mais profunda
- Notificações internas
- Webhooks
- Permissões refinadas por campo
- Dashboard mobile

---

## 22. Regras de Negócio

### 22.1 Lead sem dados completos

O sistema deve aceitar o cadastro e marcar como incompleto.

### 22.2 Responsável

Todo lead pode entrar sem responsável, mas deve aparecer no alerta de distribuição.

### 22.3 SDR

SDR pode visualizar todos os leads se a Master permitir, mas a fila de trabalho deve ser definida por filtros.

### 22.4 Mudança de etapa

Toda mudança de etapa deve gerar histórico.

### 22.5 Lead perdido

Obrigatório informar motivo.

### 22.6 Lead fechado

Ao marcar como venda fechada, oferecer envio para ERP.

### 22.7 Duplicidade

O sistema deve alertar possíveis duplicidades por telefone, e-mail ou CPF/CNPJ.

---

## 23. Prompt para Desenvolvedor / IA Executora

Use o prompt abaixo para executar o desenvolvimento:

```prompt
Você é um arquiteto de produto e desenvolvedor full-stack. Crie dentro do projeto Gauchinho Site uma Área Logada com módulo chamado CRM, focado exclusivamente em gestão de leads.

O CRM deve ter dashboard comercial, funil visual com quantidade de leads por fase, pipeline em Kanban com cards arrastáveis, cadastro de lead incompleto, filtros avançados, timeline do lead, agenda integrada, área do parceiro e painel de performance para Master.

O visual deve ser inspirado em boas práticas de CRMs como Pipedrive: pipeline em colunas, cards claros, ações rápidas, filtros fortes, etapas de venda visíveis, drag and drop e gestão por atividade. Não copiar marca, identidade visual, cores, textos ou componentes proprietários. Criar UI própria para Gauchinho/Racon.

Perfis:
- Admin/Master
- Microfranqueado
- Gerador de Negócios
- Indicador/Gerador de Possibilidades
- SDR
- Financeiro

Regras principais:
- O sistema controla somente leads e oportunidades comerciais.
- O ERP atual controla vendas, cotas, comissões, repasses e pós-venda.
- Leads podem entrar incompletos.
- Campos mínimos: nome ou identificação, telefone/e-mail/canal e origem.
- SDR pode ver todos os leads quando autorizado, mas trabalha com filtros e atribuições.
- Dashboard é focado em vendas.
- Incluir Painel de Performance para Master.
- Agenda já existe; apenas integrar atividades e reuniões ao lead.
- Área do parceiro já existe; incluir visualização dos leads do parceiro.

Funil:
1. Novo lead
2. Contato realizado
3. Qualificado
4. Reunião agendada
5. Reunião realizada
6. Proposta enviada
7. Documentação / cadastro
8. Boleto enviado
9. Venda fechada
10. Pós-venda / acompanhamento
11. Perdido
12. Stand-by / futuro

Telas:
- Dashboard
- CRM Kanban
- Lista de Leads
- Cadastro/Edição de Lead
- Detalhe do Lead com Timeline
- Agenda integrada
- Painel de Performance
- Materiais e Treinamentos
- Configurações

No dashboard, mostrar:
- Leads no mês
- Leads novos hoje
- Reuniões agendadas
- Reuniões realizadas
- Oportunidades em negociação
- Vendas fechadas no mês
- Meta mensal atingida
- Taxa de conversão
- Funil visual com quantidade por etapa
- Alertas de leads parados, sem responsável e sem contato

Criar estrutura de banco com:
- users
- leads
- pipeline_stages
- lead_activities
- lead_history
- lead_files
- events
- lead_event_registrations

Gerar componentes com design responsivo, layout limpo, foco em vendas, cards objetivos e ações rápidas.
```

---

## 24. Checklist de Implantação

### Produto
- [ ] Validar escopo com Master
- [ ] Confirmar perfis
- [ ] Confirmar funil
- [ ] Confirmar campos mínimos
- [ ] Confirmar integração com agenda
- [ ] Confirmar integração com ERP

### Design
- [ ] Criar wireframe dashboard
- [ ] Criar wireframe CRM Kanban
- [ ] Criar tela de lead
- [ ] Criar área do parceiro
- [ ] Definir identidade visual própria

### Desenvolvimento
- [ ] Criar rotas protegidas
- [ ] Criar permissões
- [ ] Criar tabelas
- [ ] Criar API de leads
- [ ] Criar Kanban
- [ ] Criar filtros
- [ ] Criar timeline
- [ ] Criar dashboard
- [ ] Integrar agenda
- [ ] Criar envio para ERP

### Testes
- [ ] Testar cadastro de lead incompleto
- [ ] Testar drag and drop
- [ ] Testar permissões por perfil
- [ ] Testar filtros do SDR
- [ ] Testar alertas
- [ ] Testar envio ao ERP
- [ ] Testar mobile

---

## 25. Resultado Esperado

Ao final, a Gauchinho Consórcios terá uma área logada com CRM visual, comercial e prático, capaz de organizar leads, acelerar atendimento, melhorar acompanhamento, dar visão de funil e aumentar a conversão sem duplicar funções que já pertencem ao ERP.

O sistema deve ser simples para quem cadastra, poderoso para quem gerencia e motivador para parceiros comerciais.
