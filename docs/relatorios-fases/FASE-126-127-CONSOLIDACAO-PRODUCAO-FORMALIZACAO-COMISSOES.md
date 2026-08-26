# Fases 126–127 — Consolidação de produção, formalização e comissões estritas

Data: 26/08/2026
Estado: **migrations 126–127 aplicadas e verificadas no Supabase Production**

## 1. Motivo da consolidação

A integração com a `main` revelou que a linha oficial já possuía migrations até a `125`. Arquivos locais numerados como `102–105` colidiam com essa sequência. Além disso, a execução manual do antigo `102` em Production substituiu `rpc_converter_contratacao_venda` por uma versão que ainda lia `grupos_cotas.valor_parcela`, contrariando o catálogo N:N de modalidades.

As migrations locais colidentes foram removidas. A evolução passa a ser exclusivamente forward-only em:

- `126_hardening_multitenant_escala_franquias.sql`;
- `127_formalizacao_canonica_e_comissoes_estritas.sql`.

## 2. Resultado do diagnóstico de Production

Consulta somente leitura executada no projeto Supabase Production `eaeuoynprurmmulzhydt` confirmou:

- uma empresa ativa;
- ausência da assinatura nova de `rpc_preparar_formalizacao_contratacao`;
- presença do conversor antigo;
- uso incorreto de `v_opcao.valor_parcela` no conversor vigente;
- ausência das colunas temporais de venda/cota e dos `empresa_id` incluídos pela `126`;
- ausência de `empresa_id` em `grupos_vinculacoes_legadas_historico`, causa da incompatibilidade observada no SQL legado.

## 3. Migration 126

A `126` consolida:

- permissões granulares por vínculo N:N `empresa_usuarios`;
- storage privado e repasses isolados por empresa;
- reconciliação idempotente de `grupos_vinculacoes_legadas_historico.empresa_id`;
- substituição da RPC de vínculo legado por assinatura que exige `p_empresa_id` e restringe todas as atualizações ao tenant;
- cálculo de parcelas restantes em `calcular_prazo_restante_grupo`;
- snapshots de `prazo_original_grupo`, `parcelas_restantes_venda` e `prazo_referencia_em`;
- preparação da formalização com UUID exato de grupo, produto, modalidade, participante e perfil;
- validação de concessão da administradora/grupo, vigência dos perfis e regra homologada;
- isolamento de fatos públicos, imobiliárias, imóveis e ingressos de API por empresa.

## 4. Migration 127

A `127` substitui os dois pontos críticos finais:

1. `rpc_gerar_previsoes_comissao_v2` não aceita mais percentual enviado pelo navegador nem defaults de 4%/50%. A regra deve ser homologada, vigente e corresponder exatamente a empresa, perfil, programa, administradora, tipo e modalidade.
2. `rpc_converter_contratacao_venda` não cria nem aproxima grupo/produto, não seleciona a primeira modalidade e não lê a parcela legada do produto. Crédito, parcela e prazo são resolvidos de fontes distintas e canônicas.

O snapshot imutável registra UUIDs, regra de franquia, programa, perfis, percentuais oficiais, crédito, parcela da modalidade, prazo original, saldo de parcelas e data de referência.

## 5. Aplicação

O formulário ERP:

- exige permissão `formalizar_vendas`;
- lista somente administradoras concedidas à empresa ativa;
- respeita grupos ocultos em `empresa_grupos_config`;
- pré-seleciona apenas UUIDs persistidos e válidos;
- mostra produto somente como valor de crédito;
- resolve parcela na combinação produto × modalidade;
- mostra parcelas restantes separadas do prazo original;
- exige perfil de comissão homologado;
- não envia percentual da franqueadora ao servidor.

A action usa cliente Supabase autenticado para as RPCs, mantendo `service_role` apenas nas leituras operacionais já protegidas por filtro de empresa. Não existe atualização financeira pós-conversão: o snapshot é fechado antes e consumido uma única vez pela transação.

## 6. Evidências de validação

- `npx tsc --noEmit`: aprovado;
- `npm test -- --run`: 176 arquivos aprovados, 973 testes aprovados e 37 ignorados por contrato de ambiente;
- `npm run build`: aprovado, TypeScript e 146 rotas;
- dry-run da `126` no Supabase Production: aprovado com `ROLLBACK`;
- dry-run combinado `126 + 127` no Supabase Production: aprovado com `ROLLBACK`;
- nenhum dado foi persistido durante os dry-runs.
- promoção real da `126`: aprovada;
- pós-check da `126`: nova RPC e cálculo temporal presentes; zero registros sem empresa em histórico legado, simulações, itens, eventos, imobiliárias e imóveis;
- promoção real da `127`: aprovada;
- pós-check da `127`: parcela canônica, sem escolha automática de modalidade, sem defaults 4%/50%, execução permitida a `authenticated` e negada a `anon`;
- preservação confirmada após a promoção: 4 vendas, 23 previsões da franquia e 23 previsões de participantes.

## 7. Ordem obrigatória de promoção

1. Aplicar `126`. **Concluído.**
2. Aplicar `127`. **Concluído.**
3. Rodar diagnóstico pós-migration. **Concluído.**
4. Publicar a aplicação na `main`.
5. Homologar integral, reduzida 60–99 e abaixo de 59, incluindo grupo em andamento.

Não executar novamente os antigos SQLs locais chamados `102`, `103`, `104` ou `105`.
