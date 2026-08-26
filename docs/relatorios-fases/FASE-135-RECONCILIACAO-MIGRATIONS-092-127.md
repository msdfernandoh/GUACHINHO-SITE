# Fase 135 — Reconciliação das migrations 092–127

**Data:** 26/08/2026  
**Projeto Supabase:** `eaeuoynprurmmulzhydt` (`Gauchinho-Site`, Production)  
**Migration forward-only:** `133_reconciliacao_historico_092_127_objetos_ausentes.sql`  
**Status:** banco aplicado e pós-check aprovado; promoção do repositório registrada no fechamento desta fase.

## 1. Objetivo

Eliminar a divergência entre o histórico local e o metadata do Supabase sem
reaplicar cegamente migrations antigas, sem apagar fatos e sem sobrescrever as
correções canônicas das fases 126–134.

Antes desta fase, o histórico remoto possuía `001–091` e `128–132`, mas não
registrava `092–127`. O repositório também continha dois arquivos com o prefixo
`101`, o que tornava a sequência impossível de representar corretamente no
metadata do Supabase.

## 2. Diagnóstico comprovado

A consulta read-only `supabase/tests/reconciliacao_migrations_092_127.sql`
confrontou tabelas, colunas, constraints, triggers, buckets, funções e grants do
schema real de Production.

### Objetos já presentes antes da correção

As sentinelas das migrations `097`, `099–105`, `107–116` e `118–127` já estavam
presentes. Esses arquivos não foram reaplicados.

### Contratos ausentes ou parciais

Foram comprovadas ausências nas entregas históricas:

- `092`: criação/exclusão operacional de módulos e planos;
- `093`: RPCs do HUB de franquias;
- `094`: governança de usuários, responsável principal e convites;
- `095`: estrutura e RPCs de overrides;
- `096`: identidade visual de sites de parceiros;
- `098/106`: campos operacionais de participantes, lances e respectivos RPCs;
- `117`: RPC de obtenção/criação de fornecedor, embora tabela e FK já existissem.

A RPC `rpc_platform_salvar_assinatura` e a versão canônica de
`rpc_platform_alterar_modelo_empresa` já existiam e foram preservadas. Em
especial, a função da fase 134 continuou escrevendo em `empresa_site_modelos`;
a implementação histórica que usava `empresa_branding.modelo_id` não foi
restaurada.

## 3. Alteração aplicada

A migration 133 restaurou somente os contratos comprovadamente ausentes e
incluiu hardening adicional:

- funções de usuário exigem autenticação e autorização interna;
- `PUBLIC`, `anon` e `service_role` não executam as RPCs restauradas;
- `authenticated` recebe apenas `EXECUTE` nas funções previstas;
- funções restauradas ficaram com `search_path = pg_catalog`;
- o bucket `lances-comprovantes` passou a validar o UUID da empresa no primeiro
  segmento do path e a permissão `gerenciar_lances`;
- nenhuma venda, cota, previsão, comissão ou movimento de caixa foi recalculado;
- o backfill de fornecedores usa empresa + nome e é idempotente;
- nenhuma função canônica das migrations 126–132 foi substituída.

## 4. Validação

1. A migration completa foi executada em Production dentro de uma transação
   terminada em `ROLLBACK`: compilação aprovada.
2. Dentro do mesmo dry-run, todas as sentinelas `092–127` retornaram `true`.
3. A migration foi executada com `COMMIT` no projeto Production.
4. O pós-check retornou `true` para `092–127` e para a sentinela de segurança
   `133`.
5. A sentinela 133 confirmou:
   - ausência de `EXECUTE` para `anon` e `service_role` nas funções restauradas;
   - `search_path=pg_catalog`;
   - preservação de `empresa_site_modelos` na troca canônica de template.
6. `supabase migration list --linked` passou a apresentar a sequência contínua
   `001–133` depois do repair de metadata.
7. O contrato automatizado de vínculo canônico foi atualizado para validar a
   implementação vigente da migration 127, sem depender do arquivo 101
   supersedido.
8. `npm test`: **183 arquivos aprovados**, 9 ignorados; **1.016 testes
   aprovados**, 37 ignorados.
9. `npm run build`: compilação, TypeScript e geração das 146 páginas concluídos
   com sucesso em modo de produção.

## 5. Colisão da migration 101

O arquivo oficial mantido na pasta ativa é
`101_contas_pagar_governanca_permissoes_estorno.sql`.

O antigo `101_vinculo_canonico_saas_grupos_cotas_vendas.sql` foi retirado da
pasta ativa porque sua implementação foi supersedida por `126–127`. A decisão e
os commits históricos estão registrados em
`docs/migrations-historicas/101-VINCULO-CANONICO-SUPERSEDIDA.md`.

Não houve remoção de schema ou dados no Supabase por causa dessa organização do
repositório.

## 6. Entregue

- inventário real e reproduzível das migrations `092–127`;
- migration corretiva forward-only 133;
- teste SQL permanente de sentinelas;
- metadata remoto contínuo `001–133`;
- colisão local de versão 101 eliminada;
- contratos Platform/ERP ausentes restaurados;
- grants e `search_path` endurecidos;
- documentação oficial atualizada.

## 7. Não pertence a esta fase

Esta fase não implementa o novo fechamento societário. Ela apenas remove o
bloqueio de baseline que precisava ser resolvido antes de criar novas estruturas
financeiras.

Também não implementa integrações de API com administradoras, importação de
clientes legados ou conciliação bancária completa.

## 8. Próxima fase programada

**Fase 136 — Cadastro societário por empresa e fechamento financeiro imutável.**

Decisão de negócio já confirmada pelo usuário:

- sócios serão cadastrados no SaaS dentro da empresa;
- cada sócio terá identidade, contas/dados financeiros permitidos, vigência e
  percentual de participação;
- a soma vigente deverá fechar em 100%;
- o ERP consumirá essa configuração por `empresa_id`;
- fechamentos serão históricos, auditáveis e não dependerão de nomes fixos como
  Fernando/Eroni nem de divisão fixa 50/50;
- a execução seguirá a ordem planejada, sem antecipar esta fase sobre o baseline.

Depois da fase societária permanecem, na ordem já documentada:

1. homologação autenticada de todos os menus e papéis;
2. importação de clientes/comissões legadas após receber amostra do relatório;
3. conciliação bancária e projeção de caixa;
4. saneamento progressivo do lint e testes regressivos;
5. integrações com administradoras quando existirem APIs documentadas.
