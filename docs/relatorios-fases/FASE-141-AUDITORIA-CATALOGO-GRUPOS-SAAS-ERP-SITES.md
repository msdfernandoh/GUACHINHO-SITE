# Fase 141 — Auditoria do catálogo de grupos entre SaaS, ERP e sites

| Metadado | Valor |
|---|---|
| Data | 26/08/2026 |
| Escopo | Cadastro, homologação e consumo de grupos, produtos, taxas e vagas |
| Banco auditado | Supabase principal `eaeuoynprurmmulzhydt`, somente leitura |
| Status | Auditoria concluída; correções ainda não implantadas |

## 1. Conclusão executiva

Existe uma única base física para SaaS, ERP e site, mas ainda não existe um único
fluxo funcional de cadastro. A leitura pública e operacional já converge para
`grupos_consorcio` e `grupos_cotas`, porém os três editores possuem campos e
regras diferentes.

O modelo correto é receber cadastros da franquia como **propostas de catálogo**,
nunca como grupos canônicos. A Platform compara a proposta com o catálogo da
administradora, pede ajustes quando necessário e, ao homologar, cria ou atualiza
um único grupo global. ERP e painel do site devem reutilizar o mesmo formulário,
serviço e proposta. Sites públicos e ERPs de todas as franquias devem ler apenas
o registro global homologado, respeitando concessão e visibilidade local.

O fluxo atual não atende integralmente esse modelo e possui um risco imediato:
registros legados ou locais pendentes podem entrar na leitura pública antes da
homologação porque a elegibilidade não exige `status_governanca = 'GLOBAL'`.

## 2. Estado real da Produção

Na Racon foram encontrados:

| Indicador | Resultado |
|---|---:|
| Grupos | 19 |
| Produtos/cotas comerciais ativos | 176 |
| Grupos `GLOBAL/GLOBAL` | 1 |
| Grupos `LEGADO/CONFIGURACAO_PENDENTE` | 18 |
| Grupos locais aguardando Platform | 0 |
| Grupos que o filtro público atual considera publicáveis | 19 |
| Grupos não globais que podem chegar ao site | 18 |
| Grupos sem valores na estrutura N:N de modalidade por produto | 17 |
| Configurações `empresa_grupos_config` da Gauchinho | 0 |
| Duplicidades pelo código textual exato | 0 |
| Colisões pelo número Racon | 1 (`5388 Veículo` e `5388 Moto`) |

Todos os 19 possuem taxa, fundo, seguro, capacidade, vagas e produtos, mas
quatro não possuem primeira assembleia. A maior parte ainda depende dos campos
legados de parcela: somente os grupos 1453 e 1463 possuem algum valor na relação
canônica `grupo_cota_modalidade_valores`, e apenas 1463 tem cobertura relevante.

O modelo publicado da empresa Gauchinho está correto:
`empresa_site_modelos.status = 'PUBLICADO'` e modelo `gauchinho_default`.

Nenhum dado foi alterado durante esta auditoria.

## 3. Comparação dos cadastros atuais

| Capacidade | SaaS / Platform | ERP | Painel antigo do site (`/admin/grupos`) |
|---|---|---|---|
| Administradora, grupo e tipo | Completo | Completo | Completo |
| Taxa administrativa | Sim | Sim | Sim |
| Fundo de reserva | Sim | Não edita | Sim |
| Seguro | Percentual | Não edita | Percentual, fixo e pós-contemplação |
| Capacidade e vagas | Sim | Somente leitura | Não edita |
| Primeira assembleia | Sim | Não edita | Não edita |
| Parcelas realizadas/base | Parcialmente visualizado | Não edita | Sim |
| Modalidades Integral/60–99/<59 | N:N canônica | Exibe seleção, mas a action não persiste a seleção N:N | Estrutura legada própria |
| Produtos/valores de crédito | Completo | Somente leitura | Completo em modelo legado |
| Valor da parcela por modalidade | Completo | Somente leitura | Não usa integralmente a N:N canônica |
| Estatísticas, lances e contemplados | Completo | Não edita | Parcial, sem histórico mensal equivalente |
| Governança | Aprova/promove | Cria local pendente | Cadastro restrito a Superadmin |

### Defeitos funcionais confirmados

1. O ERP insere diretamente em `grupos_consorcio` com
   `LOCAL/PENDENTE_PLATFORM`. Isso mistura proposta não homologada com catálogo.
2. A promoção atual apenas troca origem/status do mesmo registro. Ela não
   procura grupo global equivalente, não funde produtos e não evita duplicidade.
3. Não existe índice único de identidade comercial em `grupos_consorcio`.
4. O formulário do ERP mostra checkboxes de modalidades, mas
   `salvarGrupoLocalAction` não grava `grupos_modalidades_disponiveis`.
5. O ERP não permite cadastrar produtos, parcelas por modalidade, fundo,
   seguro, capacidade, vagas, assembleia ou estatísticas suficientes para uma
   homologação completa.
6. O painel antigo do site tem outro formulário e outra semântica. Franquias não
   podem usá-lo para enviar proposta porque as mutações exigem Superadmin.
7. `grupoElegivelCatalogo` verifica ativo/status/administradora, mas não a
   homologação. `listGruposAutorizadosForEmpresa` também aceita registros
   `LEGADO` e o registro `LOCAL` da própria empresa.
8. Sem linha em `empresa_grupos_config`, a visibilidade local assume `true`.
   Portanto ausência de configuração não protege grupo pendente.
9. A home Gauchinho e `/simulador` usam configurações gerais em
   `configuracoes_sistema`, não derivam automaticamente um grupo real.
10. O template institucional Racon usado por outros sites calcula exemplos com
    fatores e prazos fixos no componente. Ele não representa necessariamente
    taxas, vagas ou parcelas homologadas do catálogo.
11. `/grupos`, propostas e contratações usam o catálogo compartilhado, mas a
    home/hero e o simulador rápido não são integralmente canônicos.
12. O número `5388` existe para Veículo e Moto. A identidade externa não pode ser
    somente `codigo_grupo`; deve considerar ao menos administradora + código +
    tipo oficial, até confirmação da matriz.

## 4. Arquitetura recomendada

### 4.1 Fonte única

- `grupos_consorcio`: somente catálogo canônico homologado ou legado aprovado.
- `grupos_cotas`, `grupos_modalidades_disponiveis` e
  `grupo_cota_modalidade_valores`: filhos exclusivamente do grupo canônico.
- `empresa_administradoras`: define quais franquias recebem o catálogo.
- `empresa_grupos_config`: somente apresentação local — visibilidade, destaque,
  ordem, título e descrição. Taxa, seguro, vagas, parcelas e estatísticas devem
  permanecer globais, salvo exceção comercial formal e auditada.

### 4.2 Área de propostas

Criar estruturas de staging independentes:

- `catalogo_grupo_propostas`;
- `catalogo_grupo_proposta_produtos`;
- `catalogo_grupo_proposta_modalidades`;
- `catalogo_grupo_proposta_anexos`;
- `catalogo_grupo_proposta_eventos` append-only.

Cada proposta registra `empresa_origem_id`, administradora, canal
(`ERP`, `SITE_ADMIN`, `API_RACON`), autor, grupo canônico sugerido, snapshot,
versão e chave idempotente. Estados recomendados:

```text
RASCUNHO → PENDENTE_HOMOLOGACAO → EM_ANALISE
         → DEVOLVIDO_PARA_AJUSTE → PENDENTE_HOMOLOGACAO
         → APROVADO_NOVO | APROVADO_ATUALIZACAO | VINCULADO_EXISTENTE
         → REJEITADO
```

Propostas nunca aparecem no site, em vendas ou em outras franquias.

### 4.3 Identidade e deduplicação

Chave candidata enquanto a matriz não confirma ID estável:

```text
administradora_id + codigo_externo_normalizado + tipo_administradora_id
```

Quando a API Racon fornecer `codigo_produto`, os produtos passam a usar:

```text
grupo_canonico_id + codigo_produto_externo
```

A homologação deve oferecer três decisões explícitas:

- criar novo grupo global;
- atualizar/fundir com grupo existente, mostrando diff campo a campo;
- vincular a proposta a um grupo já existente sem duplicar.

Não deve existir botão que apenas transforme uma linha local em global.

### 4.4 Um formulário para ERP e site administrativo

Criar um componente e um schema de validação compartilhados com seções:

1. identidade: administradora, código e tipo;
2. operação: status, prazo, assembleias, capacidade e vagas;
3. custos: taxa, fundo e seguro com unidade explícita;
4. modalidades: Integral, 60–99% e abaixo de 59%;
5. produtos: código externo, crédito, parcela e parcelas restantes;
6. lances/estatísticas;
7. origem/evidências e observação para homologação.

ERP e painel administrativo do site chamam a mesma server action e gravam a
mesma proposta. Se a empresa possui ERP, os dois canais exibem o mesmo rascunho
e histórico; não existem cópias “do site” e “do ERP”.

### 4.5 Publicação e propagação

Ao aprovar, uma RPC transacional deve:

1. bloquear a proposta e a identidade canônica;
2. validar duplicidade, tipo, modalidades e produtos;
3. criar/atualizar o catálogo global com diff auditado;
4. preservar snapshots históricos de vendas;
5. marcar a proposta com grupo canônico e versão publicada;
6. invalidar cache dos sites e ERPs das franquias concedidas;
7. emitir um evento/outbox para propagação e reprocessamento;
8. nunca alterar comissão ou venda histórica.

Não é necessário copiar grupos para cada franquia: todas leem o mesmo UUID
global através da concessão. Isso é o que realmente evita divergência.

## 5. Alinhamento seguro dos dados atuais

Não se deve ocultar imediatamente os 18 grupos legados, pois o site Gauchinho
usa hoje seus 176 produtos. A transição recomendada é:

1. congelar novos cadastros diretos nas tabelas canônicas para usuários tenant;
2. gerar relatório de prontidão dos 19 grupos;
3. decidir a identidade do `5388` por tipo;
4. preencher primeira assembleia dos quatro incompletos;
5. migrar parcelas legadas para as três modalidades canônicas, com conferência;
6. homologar os 18 legados em lote controlado, preservando UUIDs;
7. criar configurações de apresentação Gauchinho somente quando necessárias;
8. depois ativar filtro público estrito `GLOBAL/HOMOLOGADO`;
9. substituir simuladores fixos por seleção/estimativa derivada de produto global;
10. validar home, `/grupos`, proposta, contratação e ERP com os mesmos UUIDs.

## 6. Ordem recomendada de implementação

### Fase A — Proteção e staging

- migrations das propostas, eventos, idempotência e chave canônica;
- impedir tenant de inserir/editar catálogo global diretamente;
- manter leitura atual durante a reconciliação, por feature flag controlada.

### Fase B — Formulário único

- substituir cadastro ERP e cadastro administrativo do site pelo editor de
  proposta compartilhado;
- completar todos os campos e produtos/modalidades;
- mostrar claramente “não publicado” e status da análise.

### Fase C — Homologação SaaS

- fila, comparação, merge, devolução, rejeição e aprovação transacional;
- histórico e auditoria com responsável e justificativa;
- bloquear promoção cega e duplicidades.

### Fase D — Reconciliação Gauchinho

- homologar os 19 grupos existentes sem trocar UUIDs;
- normalizar produtos/modalidades e resolver `5388`;
- conferir valores exibidos no site antes do corte.

### Fase E — Consumo estrito e simuladores

- site, ERP, proposta e contratação leem apenas catálogo homologado;
- home e simuladores deixam de usar fatores comerciais fixos quando houver
  produto real elegível;
- sites sem ERP continuam funcionando pelo mesmo serviço de catálogo.

### Fase F — API Racon

- ajustar o contrato para identidade composta se a matriz não fornecer ID único;
- entrada da API também cria versão candidata/auditada ou atualização automática
  conforme política de confiança homologada;
- falhas ficam na auditoria e nunca publicam conteúdo parcial inválido.

## 7. Critérios de aceite

- cadastrar o mesmo grupo no ERP e painel do site retorna a mesma proposta;
- nova submissão equivalente vincula/atualiza, sem duplicar;
- grupo pendente não aparece em site, simulador, proposta ou outra franquia;
- aprovação torna o mesmo UUID disponível a todas as franquias Racon concedidas;
- franquia sem concessão não vê o grupo;
- site-only recebe grupos normalmente;
- ERP e site exibem os mesmos valores de crédito, parcelas, taxas e vagas;
- override visual não modifica dado financeiro/operacional global;
- alterações preservam vendas e comissões históricas;
- 5388 Moto e 5388 Veículo permanecem distinguíveis e auditáveis;
- reprocessamento é idempotente.

## 8. Evidências técnicas

- consultas somente leitura no Supabase principal;
- revisão das rotas `/platform/grupos`, `/erp/grupos`, `/admin/grupos`, `/grupos`,
  home e APIs públicas;
- revisão das migrations 076, 085 e 086;
- testes direcionados: 3 arquivos e 38 testes aprovados;
- nenhuma migration, dado ou runtime alterado nesta auditoria.

## 9. Verificação após “Atualizar visualização” no ERP

Após o acionamento pelo usuário, o catálogo público foi conferido em Produção e
continuou exibindo os grupos e produtos Racon cadastrados. Os 38 testes
direcionados de autorização, configuração local e cálculo de linhas também
permaneceram aprovados.

O botão atual não realiza sincronização nem homologação: a action somente executa
`revalidatePath` nas páginas de grupos, simulador, ERP e Platform. Portanto, ele
é seguro como **recarregamento de visualização**, mas não atende ao futuro fluxo
“franquia envia proposta → SaaS homologa → rede recebe”. Esse fluxo continua
dependente das Fases A–E descritas neste relatório.

A tela autenticada do ERP não pôde ser inspecionada diretamente na sessão
isolada, que redirecionou corretamente para o login. A validação desta subetapa
foi feita pelo código da página/action, pelo catálogo público atualizado e pelos
testes automatizados, sem inserir credenciais nem modificar dados.
