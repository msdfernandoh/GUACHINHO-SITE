# Fase 140 — Contrato da API Racon v1

| Metadado | Valor |
|---|---|
| Data | 26/08/2026 |
| Migration | Não aplicável |
| Status | Documentação concluída; integração externa permanece desativada |
| Commit publicado | `main@77ce0d8` |
| Deployment verificado | `dpl_HkF4FVmGHxBbXz4RY83ApJwB5sqx` (`READY`) |

## Entrega

- contrato funcional e técnico completo em
  `docs/integracoes/racon/CONTRATO-API-RACON-V1.md`;
- especificação OpenAPI 3.1 em
  `docs/integracoes/racon/openapi-racon-v1.yaml`;
- mensagem pronta de encaminhamento em
  `docs/integracoes/racon/MENSAGEM-ENVIO-MATRIZ.md`;
- integração específica Racon, sem UUID, administradora, empresa ou franquia no
  payload externo;
- catálogo global compartilhado apenas pelas franquias com concessão Racon;
- grupos, produtos comerciais, parcelas por modalidade, vagas, taxas, seguro,
  prazos, assembleias, lances, estatísticas e contemplações cobertos;
- autenticação HMAC, proteção contra replay, idempotência, ordenação, retry,
  consulta de lote e modelo de erro definidos;
- reprocessamento e tela de auditoria especificados, ainda desativados;
- ausência de exclusão implícita, dados pessoais e efeitos em comissões/caixa.

## Validação

- OpenAPI 3.1 validado pelo Redocly CLI com regras recomendadas, sem erros;
- referências, schemas, parâmetros e respostas resolvidos pelo validador;
- `git diff --check` aprovado;
- nenhuma dependência, rota, variável, migration ou dado de Produção alterado.

## Decisões de segurança e governança

- a matriz nunca conhece UUIDs internos;
- o conector/credencial resolve a Racon internamente;
- atualizações não sobrescrevem overrides locais da franquia;
- evento de contemplação sem cota correspondente fica pendente;
- contemplação via API não cria nem antecipa comissão automaticamente;
- o payload original é imutável e o reprocessamento cria tentativa auditada.

## Pendências antes da implementação

1. aprovação técnica da matriz;
2. confirmação de códigos oficiais, unidade do seguro e ID estável do produto;
3. confirmação de frequência, volume, IPs e contatos de incidente;
4. definição das URLs e credenciais de homologação;
5. congelamento do contrato como `1.0.0`;
6. somente então implementar migrations, endpoints, fila e tela de auditoria.

Nenhuma rota, banco ou integração externa foi ativada nesta fase documental.
