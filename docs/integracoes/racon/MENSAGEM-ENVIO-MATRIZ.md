# Mensagem para encaminhamento à matriz Racon

**Assunto:** Validação técnica do contrato de integração de grupos e contemplações — API Racon v1

Olá,

Estamos estruturando a integração entre a Racon e nossa plataforma SaaS para
receber o catálogo oficial de grupos, produtos/cotas comerciais, vagas, taxas,
seguro, modalidades de parcela, assembleias, indicadores de lance e
contemplações.

Encaminhamos para análise:

1. `CONTRATO-API-RACON-V1.md` — regras funcionais, segurança, payloads,
   idempotência, erros, auditoria e critérios de homologação;
2. `openapi-racon-v1.yaml` — especificação OpenAPI 3.1 importável em Swagger UI,
   Postman e ferramentas de desenvolvimento.

O contrato não envia identificação de administradora, franquia ou UUID interno,
pois será um conector exclusivo da Racon. Também não recebe dados pessoais,
clientes, comissões ou pagamentos.

Para congelarmos a versão 1.0.0 e iniciarmos a homologação, precisamos confirmar:

- disponibilidade dos campos propostos e do identificador estável de produto;
- unidade de cálculo do seguro prestamista;
- códigos oficiais de bem, modalidade de parcela e contemplação/lance;
- disponibilidade de versão e data de atualização de cada registro;
- possibilidade de eventos individuais de contemplação sem dados pessoais;
- frequência, volume, IPs de saída e contatos técnicos;
- compatibilidade com autenticação HMAC-SHA256.

Os exemplos contêm valores meramente ilustrativos. Estamos disponíveis para uma
reunião técnica e para adequar nomenclaturas sem alterar os requisitos de
segurança, idempotência e rastreabilidade.

Atenciosamente,

Gauchinho Consórcios
