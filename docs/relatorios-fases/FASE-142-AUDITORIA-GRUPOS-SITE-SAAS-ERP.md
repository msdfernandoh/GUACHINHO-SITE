# Fase 142 — Comparação dos grupos do site, SaaS e ERP

| Metadado | Valor |
|---|---|
| Data | 26/08/2026 |
| Empresa | Gauchinho Consórcios |
| Administradora | Racon |
| Escopo | Origem dos grupos, taxas, vagas, produtos, parcelas e modalidades |
| Banco | Supabase principal `eaeuoynprurmmulzhydt`, somente leitura |
| Status | Auditoria concluída; nenhuma correção de dados executada |

## 1. Resultado executivo

O site Gauchinho não possui uma segunda tabela de grupos. A página `/grupos`
resolve a empresa pelo domínio, valida a concessão Racon em
`empresa_administradoras` e consulta os mesmos UUIDs de `grupos_consorcio` e
`grupos_cotas` utilizados por SaaS e ERP.

Foram comparados Produção e a página pública: os **19 grupos do SaaS aparecem no
site**, com os mesmos códigos e faixas de crédito. Não foi encontrada divergência
de taxa causada por duplicação entre site e SaaS. Em uma conferência funcional,
o grupo 1453 com crédito de R$ 254.400 usou taxa de 25% mais fundo de 2%,
resultando em saldo devedor de R$ 323.088, exatamente conforme o catálogo.

Entretanto, a integração ainda não é integralmente canônica. O site lê taxa,
fundo, seguro e produtos do catálogo compartilhado, mas monta modalidades e
parcelas com campos legados de `grupos_cotas` e `grupos_modalidades_lance`; ele
não consome plenamente `grupos_modalidades_disponiveis` e
`grupo_cota_modalidade_valores`, que são as estruturas editadas pela Platform.

## 2. Origem efetiva dos dados do site

Fluxo atual:

```text
domínio da empresa
  → empresa/tenant
  → empresa_administradoras (concessão ativa)
  → grupos_consorcio
  → grupos_cotas
  → grupos_modalidades_lance
  → cálculo no navegador
```

| Dado | Origem atual | Situação |
|---|---|---|
| Grupo, tipo, prazo | `grupos_consorcio` | Mesmo SaaS/ERP |
| Taxa administrativa | `grupos_consorcio.taxa_administrativa_percentual` | Mesmo SaaS/ERP; usada no cálculo |
| Fundo de reserva | `grupos_consorcio.fundo_reserva_percentual` | Mesmo SaaS/ERP; usado no cálculo |
| Seguro | campos de seguro em `grupos_consorcio` | Mesmo SaaS/ERP; usado no cálculo |
| Vagas | `grupos_consorcio.vagas_disponiveis` | Mesmo cadastro, mas não exibido nem usado para elegibilidade |
| Créditos/produtos | `grupos_cotas` | Mesmo SaaS/ERP |
| Integral/reduzida | campos legados da cota | Ainda não canônico |
| Modalidades por produto | deveria vir de `grupo_cota_modalidade_valores` | Site ainda não usa plenamente |
| Estratégias de lance | `grupos_modalidades_lance` | Estrutura operacional legada |
| Prazo restante | calculado por `data_base_parcelas` quando automático | Pode diferir do valor bruto sem ser erro |

## 3. Diferenças e inconsistências encontradas

### 3.1 Governança

- 19 grupos aparecem no site.
- somente o 5488 está `GLOBAL/GLOBAL`;
- os outros 18 estão `LEGADO/CONFIGURACAO_PENDENTE`;
- o filtro público não exige homologação global, portanto os 18 legados são
  publicados antes de uma homologação formal.

### 3.2 Modalidades e parcelas

- a Platform possui a estrutura N:N por produto/modalidade;
- o site ainda usa principalmente `parcela_integral`, `parcela_reduzida`,
  `valor_parcela` e modalidades de lance legadas;
- mudanças em Integral, 60–99% ou abaixo de 59% podem não chegar ao site com a
  mesma semântica configurada na Platform;
- o produto de R$ 475.000 do grupo 1463 não possui parcela-base válida;
- somente os grupos 1453 e 1463 têm alguma cobertura na estrutura canônica N:N,
  e a cobertura ainda é incompleta.

### 3.3 Produtos duplicados

O grupo 5488 possui produtos duplicados para os créditos de R$ 100 mil, 110 mil,
120 mil, 130 mil, 140 mil, 150 mil e 200 mil, com parcelas diferentes. O site
exibe as opções repetidas. Elas não devem ser excluídas sem descobrir se
representam uma característica comercial real, mas precisam de código externo
ou outra identidade que as diferencie.

### 3.4 Vagas

Seis grupos com `vagas_disponiveis = 0` continuam publicados: 1081, 1193, 1263,
1513, 5088 e 5388 Moto. Atualmente o site não mostra vagas e não diferencia:

- zero vagas confirmado;
- informação ainda não cadastrada;
- informação desatualizada;
- grupo aberto para fila de espera.

Vários grupos também não têm `vagas_atualizado_em`. Zero não deve ser usado como
sinônimo de “não informado”.

### 3.5 Prazos

O site recalcula os prazos automáticos a partir de `parcelas_realizadas_base` e
`data_base_parcelas`. Por isso alguns valores públicos diferem dos campos brutos,
mas estão de acordo com a regra automática. Exemplos:

- 1453: armazenado na base com 14 realizadas; site mostra 16 pela evolução mensal;
- 1463: base 12; site mostra 14;
- 5488: base 12; site mostra 14;
- 1193: data-base histórica produz 135 realizadas no site.

Há uma inconsistência real no 5388 Moto manual: prazo 72, 20 realizadas e 50
restantes somam 70. Deve ser conferido antes da homologação.

### 3.6 Apresentação

Taxa, fundo, seguro, vagas, data da atualização e status de homologação não são
mostrados de maneira clara na listagem pública. A taxa é aplicada ao cálculo,
mas o usuário não consegue conferir sua origem ou validade na tela.

## 4. Modelo recomendado: autonomia com catálogo único

O registro global homologado deve continuar sendo a fonte oficial. Uma alteração
da franquia deve criar uma **nova versão candidata**, sem editar a versão
publicada diretamente.

Estados visíveis no ERP:

```text
OFICIAL SAAS
ALTERAÇÃO LOCAL PENDENTE
EM ANÁLISE NA PLATAFORMA
DEVOLVIDA PARA AJUSTE
APROVADA E PUBLICADA
DIVERGÊNCIA / EXPIRADA
```

### Dois níveis de alteração

1. **Operacional de baixo risco:** vagas, disponibilidade, data da assembleia e
   observação. Pode entrar provisoriamente somente na franquia de origem, com
   destaque “Atualização local aguardando validação”, prazo de expiração e
   alerta imediato à Platform.
2. **Financeiro ou estrutural:** taxa, fundo, seguro, prazo, produto, crédito,
   parcela e modalidade. Fica pendente de homologação. A franquia pode visualizar
   e simular a versão candidata no ERP, mas a versão pública oficial permanece
   até aprovação. Um modo emergencial local exige confirmação explícita,
   justificativa, auditoria e expiração; nunca publica automaticamente para a rede.

Ao aprovar, a Platform promove a versão, preserva o UUID do grupo, registra o
diff, invalida caches e disponibiliza a mesma versão para todas as franquias com
concessão da administradora. Rejeição ou expiração restaura a versão oficial.

### Alertas necessários na Platform

- contador de alterações aguardando aprovação;
- prioridade e SLA por risco;
- comparação antes/depois campo a campo;
- alerta de possível duplicidade por administradora + grupo + tipo;
- indicador de franquias/sites impactados;
- botões Aprovar, Mesclar, Vincular existente, Devolver e Rejeitar;
- trilha append-only com autor, horário, justificativa e versão.

## 5. Como o site deve trabalhar

1. Site, ERP, proposta e contratação devem chamar o mesmo serviço de catálogo.
2. Todos devem usar somente UUIDs canônicos; não copiar grupos por franquia.
3. Parcelas devem ser resolvidas por
   `grupo_cota_modalidade_valores`, com fallback legado apenas durante migração.
4. A resposta do serviço deve informar versão, origem, homologação, validade e
   data da última atualização.
5. Vagas devem usar estado explícito (`DISPONIVEL`, `ULTIMAS_VAGAS`,
   `SEM_VAGAS`, `NAO_INFORMADO`) e data de atualização.
6. O site deve mostrar taxa, fundo, seguro, vagas e atualização em detalhes ou
   tooltip, sem poluir a tabela principal.
7. Grupo pendente não deve chegar a outra franquia. Override provisório só pode
   atingir a franquia autora e deve aparecer identificado.
8. A publicação global deve ocorrer em transação única e ser idempotente.

## 6. Ordem segura de correção

1. criar versionamento/staging e alertas de aprovação;
2. implementar status e versão candidata no ERP;
3. migrar o site para modalidades N:N canônicas com fallback monitorado;
4. resolver o produto sem parcela do 1463 e as duplicidades do 5488;
5. conferir o prazo manual do 5388 Moto;
6. separar zero vagas de informação ausente e mostrar atualização;
7. homologar os 18 legados preservando UUIDs;
8. só então exigir `GLOBAL/HOMOLOGADO` no site e nas vendas.

## 7. Evidências

- consulta somente leitura no Supabase principal;
- comparação dos 19 grupos e 176 produtos com `/grupos` em Produção;
- conferência funcional do cálculo do grupo 1453;
- revisão do resolver por domínio, concessões e serviço de catálogo;
- revisão dos componentes públicos e cálculo de parcelas/prazos;
- nenhuma tabela, grupo, taxa, vaga ou produto foi alterado.
