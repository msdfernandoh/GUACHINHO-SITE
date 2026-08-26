# Contrato de Integração — API Racon v1

| Metadado | Valor |
|---|---|
| Versão do contrato | 1.0.0-candidato |
| Data | 26/08/2026 |
| Status | Pronto para análise técnica da matriz; endpoints ainda não ativados |
| Responsável consumidor | Plataforma SaaS Gauchinho Consórcios |
| Responsável provedor | Racon Consórcios |

## 1. Objetivo

Este contrato define o envio seguro e idempotente, pela Racon, do catálogo oficial
de grupos, produtos/cotas comerciais, modalidades de parcela e estatísticas de
contemplação. A integração alimentará uma única fonte global Racon no SaaS.

As franquias com concessão Racon ativa, inclusive franquias que possuam apenas
site e não ERP, passam a consumir a mesma informação oficial. A API não recebe
`administradora_id`, `empresa_id`, `franquia_id` nem UUID interno: o endpoint e a
credencial identificam exclusivamente o conector Racon.

## 2. Escopo da versão 1

Incluído:

- grupos, situação, prazos e assembleias;
- capacidade total e vagas disponíveis;
- taxa de administração, fundo de reserva e seguro prestamista;
- produtos/cotas comerciais e respectivos valores de crédito;
- parcelas Integral, Reduzida de 60% a 99% e Reduzida abaixo de 59%;
- tipos e características de contemplação/lance;
- média mensal de lance livre e quantidade de contemplados;
- eventos individuais de contemplação, quando disponibilizados pela Racon;
- auditoria por lote e item, idempotência, consulta de processamento e
  reprocessamento interno controlado.

Fora do escopo:

- clientes, CPF/CNPJ, telefone ou qualquer dado pessoal;
- contratos, boletos, pagamentos, vendas, leads e propostas;
- regras, percentuais ou pagamentos de comissão;
- definição de quais franquias podem trabalhar com a Racon;
- alteração de customizações locais das franquias;
- exclusão física automática de registros.

## 3. Ambientes e versionamento

Base de produção proposta:

```text
https://gauchinhoconsorcios.com.br/api/integracoes/racon/v1
```

A URL de homologação e as credenciais serão fornecidas em canal seguro após a
aprovação deste contrato. A versão principal fica no caminho (`/v1`). Mudanças
compatíveis adicionam apenas campos opcionais. Remoção, renomeação, mudança de
tipo ou semântica exige uma nova versão principal e janela formal de migração.

Todos os requests devem usar HTTPS/TLS 1.2 ou superior e `Content-Type:
application/json; charset=utf-8`.

## 4. Autenticação e assinatura

O modelo recomendado é HMAC-SHA256, com um `key_id` público e um segredo
compartilhado diferente por ambiente. O segredo nunca é enviado na requisição.

Headers obrigatórios:

| Header | Regra |
|---|---|
| `X-Racon-Key-Id` | Identificador da credencial fornecido pelo SaaS |
| `X-Racon-Timestamp` | Unix epoch em segundos; tolerância máxima de 300 segundos |
| `X-Racon-Nonce` | UUID v4 novo em cada tentativa |
| `X-Racon-Signature` | `sha256=<hex minúsculo>` |
| `Idempotency-Key` | UUID v4; deve ser igual ao `lote_id` |
| `X-Correlation-Id` | UUID v4 para rastreamento ponta a ponta |
| `Content-Type` | `application/json; charset=utf-8` |

String canônica assinada, sem normalizar ou reformatar o JSON:

```text
<timestamp>\n<nonce>\n<METODO_HTTP>\n<CAMINHO>\n<SHA256_DO_CORPO_BRUTO>
```

Assinatura:

```text
HMAC_SHA256(segredo, string_canonica)
```

Requisições fora da janela, nonces reutilizados ou assinaturas inválidas são
recusadas. Rotação de segredo terá sobreposição de até sete dias. Lista de IPs
de origem pode ser adotada como camada adicional, nunca como única autenticação.

## 5. Convenções de dados

- JSON em UTF-8; nomes dos campos em `snake_case`.
- Datas: `YYYY-MM-DD`.
- Instantes: ISO 8601 UTC, por exemplo `2026-08-26T18:30:00Z`.
- Competência: `YYYY-MM`.
- Valores monetários: número JSON em BRL, até duas casas; nunca texto formatado.
- Percentuais: pontos percentuais. `20` significa 20%; `0.04` significa 0,04%.
- Identificadores externos são strings, mesmo quando contêm somente números.
- Campo ausente em envio incremental significa “preservar valor atual”.
- `null` significa “limpar valor”, somente em campo expressamente anulável.
- Arrays enviados substituem integralmente a coleção daquele registro.
- O fuso para datas de negócio é `America/Sao_Paulo`; timestamps continuam UTC.

Limites propostos: corpo de até 10 MiB, até 500 grupos e 5.000 produtos por lote,
60 requests por minuto por credencial. A matriz deve dividir volumes maiores.

## 6. Endpoint de catálogo

### `POST /lotes/catalogo`

Recebe um snapshot completo ou atualização incremental de grupos e produtos.
Retorna `202 Accepted` quando o lote é autenticado, validado estruturalmente e
enfileirado. A aceitação HTTP não significa que todos os itens foram aplicados.

### Envelope

| Campo | Tipo | Obrigatório | Regra |
|---|---|---:|---|
| `schema_version` | string | sim | `1.0` |
| `lote_id` | UUID | sim | igual ao `Idempotency-Key` |
| `modo_envio` | enum | sim | `COMPLETO` ou `INCREMENTAL` |
| `gerado_em` | datetime | sim | momento de geração na origem |
| `sequencia` | inteiro | sim | crescente por ambiente/origem |
| `grupos` | array | sim | 1 a 500 itens |

`COMPLETO` exige todos os campos obrigatórios de cada grupo. Ausência de um grupo
no snapshot não o exclui nem o inativa. Inativação precisa ser explícita por
`status: "ENCERRADO"` ou `ativo: false`.

### Grupo

| Campo | Tipo | Obrigatório | Regra |
|---|---|---:|---|
| `codigo_grupo` | string | sim | chave natural estável na Racon, 1–50 caracteres |
| `tipo_bem` | enum | sim | `IMOVEL` ou `AUTOMOVEIS`; novos códigos serão homologados |
| `status` | enum | sim | `ATIVO`, `SUSPENSO` ou `ENCERRADO` |
| `ativo` | boolean | sim | controla oferta comercial |
| `prazo_total` | inteiro | sim | 1–600 meses |
| `assembleias_realizadas` | inteiro | sim | 0 até `prazo_total` |
| `data_primeira_assembleia` | date/null | sim | `null` somente se ainda não definida |
| `capacidade_total` | inteiro | sim | total oficial de vagas, >= 0 |
| `vagas_disponiveis` | inteiro | sim | 0 até `capacidade_total` |
| `taxa_administrativa_percentual` | decimal | sim | 0–100, pontos percentuais |
| `fundo_reserva_percentual` | decimal | sim | 0–100, pontos percentuais |
| `seguro_prestamista` | objeto | sim | contrato descrito abaixo |
| `modalidades_parcela` | array | sim | modalidades válidas do grupo |
| `tipos_lance` | array | sim | pode ser vazio, nunca `null` |
| `estatisticas_mes` | objeto/null | sim | estatística da competência informada |
| `produtos` | array | sim | cotas/opções comerciais, pode ser vazio |
| `origem_atualizado_em` | datetime | sim | última alteração na Racon |
| `versao_registro` | inteiro | sim | crescente por `codigo_grupo` |

### Seguro prestamista

```json
{
  "habilitado": true,
  "tipo_calculo": "PERCENTUAL_SALDO_DEVEDOR_MENSAL",
  "taxa_mensal_percentual": 0.04,
  "valor_fixo_mensal": null,
  "incide_pos_contemplacao": true
}
```

`tipo_calculo` aceita `PERCENTUAL_SALDO_DEVEDOR_MENSAL`, `VALOR_FIXO_MENSAL` ou
`NAO_APLICAVEL`. Somente o campo correspondente ao tipo pode possuir valor.

### Modalidades de parcela

Códigos canônicos desta versão:

| Código | Semântica |
|---|---|
| `INTEGRAL` | parcela cheia, 100% |
| `REDUZIDA_60_99` | parcela reduzida entre 60% e 99% |
| `REDUZIDA_ABAIXO_59` | parcela reduzida abaixo de 59% |

Cada item informa `codigo`, `ativo`, `percentual_padrao`, `percentual_minimo` e
`percentual_maximo`. Percentuais não podem se contradizer.

### Tipos de lance

Cada item informa `codigo`, `nome`, `ativo` e, quando existir, `percentual`.
Códigos inicialmente reconhecidos: `SORTEIO`, `LANCE_LIVRE`, `LANCE_FIXO`,
`LANCE_EMBUTIDO` e `FIDELIDADE`. Código desconhecido deixa o item pendente para
homologação, sem descartar o restante do grupo.

### Estatísticas mensais

| Campo | Tipo | Regra |
|---|---|---|
| `competencia` | `YYYY-MM` | mês de referência |
| `media_lance_livre_percentual` | decimal/null | pontos percentuais |
| `contemplados_total` | inteiro | >= 0 |
| `contemplados_por_tipo` | objeto | contagens por código de lance |
| `observacoes` | string/null | até 1.000 caracteres, sem dados pessoais |

### Produto/cota comercial

`produto` representa uma opção comercial de crédito do grupo, não uma cota já
vendida a um cliente.

| Campo | Tipo | Obrigatório | Regra |
|---|---|---:|---|
| `codigo_produto` | string | sim | chave externa estável; não usar valor como ID |
| `valor_credito` | decimal | sim | > 0 |
| `ativo` | boolean | sim | disponibilidade comercial |
| `vagas_disponiveis` | inteiro/null | não | quando a origem controlar vagas por produto |
| `parcelas_restantes` | inteiro | sim | 0 até `prazo_total` |
| `modalidades` | array | sim | valores de parcela por modalidade |
| `origem_atualizado_em` | datetime | sim | última alteração na origem |
| `versao_registro` | inteiro | sim | crescente por produto |

Cada modalidade de produto contém `codigo`, `ativo`, `valor_parcela` e
`percentual_parcela`. O valor de parcela é independente do valor do crédito e do
número de parcelas restantes.

### Exemplo completo de catálogo

> Todos os valores abaixo são meramente ilustrativos.

```json
{
  "schema_version": "1.0",
  "lote_id": "4fc55817-c7a5-49f2-b693-9794be22db92",
  "modo_envio": "INCREMENTAL",
  "gerado_em": "2026-08-26T18:30:00Z",
  "sequencia": 18452,
  "grupos": [
    {
      "codigo_grupo": "1403",
      "tipo_bem": "IMOVEL",
      "status": "ATIVO",
      "ativo": true,
      "prazo_total": 200,
      "assembleias_realizadas": 35,
      "data_primeira_assembleia": "2023-10-10",
      "capacidade_total": 1000,
      "vagas_disponiveis": 84,
      "taxa_administrativa_percentual": 20,
      "fundo_reserva_percentual": 2,
      "seguro_prestamista": {
        "habilitado": true,
        "tipo_calculo": "PERCENTUAL_SALDO_DEVEDOR_MENSAL",
        "taxa_mensal_percentual": 0.04,
        "valor_fixo_mensal": null,
        "incide_pos_contemplacao": true
      },
      "modalidades_parcela": [
        {"codigo": "INTEGRAL", "ativo": true, "percentual_padrao": 100, "percentual_minimo": 100, "percentual_maximo": 100},
        {"codigo": "REDUZIDA_60_99", "ativo": true, "percentual_padrao": 60, "percentual_minimo": 60, "percentual_maximo": 99},
        {"codigo": "REDUZIDA_ABAIXO_59", "ativo": true, "percentual_padrao": 50, "percentual_minimo": 1, "percentual_maximo": 59}
      ],
      "tipos_lance": [
        {"codigo": "SORTEIO", "nome": "Sorteio", "ativo": true, "percentual": null},
        {"codigo": "LANCE_LIVRE", "nome": "Lance livre", "ativo": true, "percentual": null},
        {"codigo": "LANCE_FIXO", "nome": "Lance fixo 25%", "ativo": true, "percentual": 25}
      ],
      "estatisticas_mes": {
        "competencia": "2026-08",
        "media_lance_livre_percentual": 47.35,
        "contemplados_total": 9,
        "contemplados_por_tipo": {"SORTEIO": 3, "LANCE_LIVRE": 3, "LANCE_FIXO": 3},
        "observacoes": null
      },
      "produtos": [
        {
          "codigo_produto": "1403-205000",
          "valor_credito": 205000,
          "ativo": true,
          "vagas_disponiveis": null,
          "parcelas_restantes": 165,
          "modalidades": [
            {"codigo": "INTEGRAL", "ativo": true, "valor_parcela": 1560.25, "percentual_parcela": 100},
            {"codigo": "REDUZIDA_60_99", "ativo": true, "valor_parcela": 936.15, "percentual_parcela": 60},
            {"codigo": "REDUZIDA_ABAIXO_59", "ativo": true, "valor_parcela": 780.13, "percentual_parcela": 50}
          ],
          "origem_atualizado_em": "2026-08-26T18:20:00Z",
          "versao_registro": 21
        }
      ],
      "origem_atualizado_em": "2026-08-26T18:20:00Z",
      "versao_registro": 91
    }
  ]
}
```

## 7. Endpoint de contemplações individuais

### `POST /lotes/contemplacoes`

Este endpoint é usado somente se a Racon disponibilizar eventos individuais. A
estatística agregada continua no catálogo. Não devem ser enviados nome, CPF,
telefone ou outros dados pessoais.

```json
{
  "schema_version": "1.0",
  "lote_id": "a2309911-32c5-48f3-b094-f3121864881d",
  "competencia": "2026-08",
  "gerado_em": "2026-08-26T18:35:00Z",
  "sequencia": 782,
  "eventos": [
    {
      "evento_id": "RACON-1403-202608-000123",
      "codigo_grupo": "1403",
      "numero_cota": "260",
      "data_assembleia": "2026-08-20",
      "tipo_contemplacao": "LANCE_LIVRE",
      "percentual_lance": 47.35,
      "valor_lance": null,
      "status": "CONFIRMADA",
      "origem_atualizado_em": "2026-08-26T18:25:00Z",
      "versao_registro": 1
    }
  ]
}
```

`evento_id` é a chave idempotente estável. `status` aceita `CONFIRMADA` ou
`CANCELADA`. Uma correção reutiliza o mesmo `evento_id`, aumenta
`versao_registro` e atualiza `origem_atualizado_em`.

O SaaS tenta localizar a cota definitiva pelo par Racon `codigo_grupo` +
`numero_cota`. Evento sem correspondência fica pendente na auditoria; ele não
cria cliente, venda, cota ou comissão automaticamente. Contemplações recebidas
por esta API nunca antecipam comissão sem uma regra operacional separada e uma
ação autorizada no ERP.

## 8. Respostas e consulta do lote

Resposta de aceitação (`202`):

```json
{
  "lote_id": "4fc55817-c7a5-49f2-b693-9794be22db92",
  "status": "RECEBIDO",
  "recebido_em": "2026-08-26T18:30:01Z",
  "correlation_id": "5be5d6db-ccf6-4621-b5aa-53be121c378c",
  "status_url": "/api/integracoes/racon/v1/lotes/4fc55817-c7a5-49f2-b693-9794be22db92"
}
```

### `GET /lotes/{lote_id}`

Estados: `RECEBIDO`, `VALIDANDO`, `PROCESSANDO`, `CONCLUIDO`,
`CONCLUIDO_COM_PENDENCIAS` ou `FALHOU`.

```json
{
  "lote_id": "4fc55817-c7a5-49f2-b693-9794be22db92",
  "tipo": "CATALOGO",
  "status": "CONCLUIDO_COM_PENDENCIAS",
  "recebidos": 20,
  "aplicados": 19,
  "ignorados_por_versao": 0,
  "pendentes": 1,
  "erros": 0,
  "iniciado_em": "2026-08-26T18:30:02Z",
  "finalizado_em": "2026-08-26T18:30:04Z",
  "correlation_id": "5be5d6db-ccf6-4621-b5aa-53be121c378c",
  "itens": [
    {
      "referencia": "grupo:1403/produto:1403-205000",
      "status": "PENDENTE",
      "codigo": "MODALIDADE_DESCONHECIDA",
      "mensagem": "Modalidade recebida ainda não foi homologada."
    }
  ]
}
```

O detalhamento pode ser paginado por `?cursor=<token>&limite=100`. O cursor é
opaco. O limite máximo é 500.

## 9. Idempotência, ordem e reprocessamento

1. Mesmo `lote_id`/`Idempotency-Key` e mesmo hash retorna o lote existente, sem
   duplicar histórico.
2. Mesmo identificador com corpo diferente retorna `409 IDEMPOTENCY_CONFLICT`.
3. `sequencia` menor que a última processada é aceita para auditoria, mas não
   substitui dados mais novos.
4. `versao_registro` menor ou igual é ignorada por item e contabilizada.
5. Falha de conexão antes de receber `202` deve ser repetida com o mesmo corpo,
   `lote_id` e `Idempotency-Key`, mas novo nonce/timestamp/assinatura.
6. Falha após `202` deve ser consultada em `GET /lotes/{lote_id}`.
7. O reprocessamento é uma ação autenticada da tela interna de auditoria. Ele
   reutiliza o payload imutável armazenado e cria uma nova tentativa vinculada;
   não exige reenvio nem autoriza edição silenciosa do conteúdo original.

## 10. Erros

Erros HTTP usam formato compatível com RFC 9457:

```json
{
  "type": "https://gauchinhoconsorcios.com.br/problemas/assinatura-invalida",
  "title": "Assinatura inválida",
  "status": 401,
  "code": "INVALID_SIGNATURE",
  "detail": "Não foi possível validar a assinatura da requisição.",
  "correlation_id": "5be5d6db-ccf6-4621-b5aa-53be121c378c"
}
```

| HTTP | Código | Situação |
|---:|---|---|
| 400 | `INVALID_JSON` | JSON inválido |
| 400 | `SCHEMA_VALIDATION_FAILED` | contrato estrutural inválido |
| 401 | `INVALID_CREDENTIAL` | credencial desconhecida/inativa |
| 401 | `INVALID_SIGNATURE` | assinatura divergente |
| 401 | `REPLAY_DETECTED` | nonce repetido ou timestamp expirado |
| 404 | `LOT_NOT_FOUND` | lote não localizado |
| 409 | `IDEMPOTENCY_CONFLICT` | mesmo ID com payload diferente |
| 413 | `PAYLOAD_TOO_LARGE` | corpo acima do limite |
| 422 | `BUSINESS_VALIDATION_FAILED` | conteúdo semanticamente inválido |
| 429 | `RATE_LIMIT_EXCEEDED` | limite temporário excedido |
| 500 | `INTERNAL_ERROR` | falha inesperada, retry permitido |
| 503 | `TEMPORARILY_UNAVAILABLE` | indisponibilidade temporária |

Em `429` e `503`, a resposta traz `Retry-After`. Retries devem usar backoff
exponencial com jitter: 2s, 5s, 15s, 30s e 60s, no máximo cinco tentativas.

## 11. Aplicação dos dados no SaaS

- `codigo_grupo` resolve a identidade natural dentro do catálogo global Racon;
  os UUIDs permanecem internos.
- Atualizações globais tornam-se visíveis para todas as franquias com concessão
  Racon ativa e para seus sites autorizados, mesmo que não tenham ERP.
- Uma franquia que trabalha com várias administradoras continua enxergando cada
  catálogo e cada programa de comissão independentemente.
- `empresa_grupos_config.usar_dados_globais=true` consome os dados Racon. Quando
  houver override local autorizado, ele permanece separado e não é sobrescrito.
- Produtos são conciliados por `codigo_produto`, nunca apenas pelo valor de
  crédito. Mudanças de valor geram histórico, não um novo UUID arbitrário.
- Dados mensais são históricos por grupo + competência; o mês anterior não é
  reescrito por uma competência diferente.
- Nenhuma mensagem desta API altera venda, contrato, faturamento, caixa,
  comissão ou snapshot histórico.
- Valores inválidos ou relações desconhecidas ficam pendentes; o lote válido não
  é perdido por causa de um item isolado.

## 12. Auditoria e observabilidade

A tela interna será entregue inicialmente desativada para operação, mas pronta
para homologação. Ela deve mostrar:

- lote, ambiente, tipo, sequência, hash, horários e correlation ID;
- quantidade recebida, aplicada, ignorada, pendente e com erro;
- erro por grupo/produto/evento, sem expor segredo;
- tentativas, perda de conexão, duração e resposta HTTP;
- comparação entre valor anterior e novo para campos alterados;
- ação explícita “Reprocessar” com justificativa e usuário responsável;
- filtros por período, status, grupo e código de erro;
- alerta de ausência de atualização dentro do SLA acordado.

O corpo bruto é cifrado em repouso e retido pelo prazo operacional acordado. Os
metadados de auditoria e hashes permanecem por período maior. Segredos,
assinaturas e headers de autenticação nunca entram em log.

## 13. Disponibilidade e frequência propostas

- atualização incremental: sempre que houver mudança ou a cada 15 minutos;
- snapshot completo de reconciliação: uma vez ao dia;
- estatísticas/contemplações: após o fechamento da assembleia e eventuais
  correções;
- SLA inicial de recepção: 99,5% mensal, excluindo manutenção programada;
- timeout do cliente: 30 segundos; processamento permanece assíncrono após 202.

Frequência e SLA serão confirmados com a matriz antes da ativação.

## 14. Checklist para aprovação da matriz

Solicita-se confirmar:

1. possibilidade de assinatura HMAC-SHA256 e rotação de segredo;
2. disponibilidade de `codigo_produto` estável por produto/cota comercial;
3. unidade exata do seguro e possibilidade de enviar a taxa mensal percentual;
4. códigos oficiais de tipo de bem, modalidade e lance;
5. disponibilidade de `versao_registro`, `origem_atualizado_em` e sequência;
6. disponibilidade de eventos individuais de contemplação sem dados pessoais;
7. frequência, volume máximo e horários de atualização;
8. IPs de saída para allowlist, se aplicável;
9. contatos técnicos e operacionais para incidentes;
10. prazo de retenção de payloads e logs aceito pelas partes.

Após essas respostas, o contrato será congelado como `1.0.0`, a URL de
homologação será provisionada e serão executados os cenários de aceite.

## 15. Critérios de aceite da homologação

- assinatura válida/ inválida, replay e rotação testados;
- retry do mesmo lote não duplica grupo, produto, estatística ou evento;
- lote fora de ordem não sobrescreve dado mais novo;
- erro isolado aparece na auditoria e pode ser reprocessado;
- queda de conexão após envio é recuperada por consulta/idempotência;
- grupo global atualizado aparece em duas franquias Racon autorizadas;
- franquia sem concessão Racon não recebe o catálogo;
- site-only recebe catálogo autorizado sem depender do ERP;
- override local permanece intacto;
- contemplação desconhecida fica pendente e não gera comissão;
- nenhum UUID interno ou dado pessoal aparece no contrato externo.

## 16. Artefato legível por máquina

O arquivo [`openapi-racon-v1.yaml`](./openapi-racon-v1.yaml) descreve os
endpoints, autenticação, envelopes principais e respostas para importação em
Swagger UI, Postman ou ferramentas de geração de cliente.
