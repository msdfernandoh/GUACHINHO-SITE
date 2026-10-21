# Luiz — duas vendas, cadastro e recebimentos (21/10/2026)

Solicitação do titular: completar cadastro/proposta com documentos e e-mail
fornecidos, formalizar duas vendas para Fernando, informar números das cotas e
vincular ao repasse. Execução limitada à empresa Gauchinho; sem dados pessoais
ou documentos anexados ao Git.

## Resultado verificado no banco

| Venda | Grupo | Composição | Cotas | Parcela total preservada |
| --- | --- | --- | --- | --- |
| f5142e46-45f6-4544-b306-f991a758635c | 1553 | 3 × R$ 200.000,00 | 0467, 0515, 0656 | R$ 3.228,75 |
| 852d4a05-e8a7-4bf3-a562-9eeab2cd3175 | 1553 | 2 × R$ 250.000,00 | 0137, 0308 | R$ 2.690,63 |

Crédito total: R$ 1.100.000,00. Responsável comercial: Fernando. Data operacional
02/10/2026, conforme alocação nas linhas importadas. Proposta original mantida
para a primeira composição; segunda proposta criada para respeitar a unicidade
contratação/proposta. Cliente canônico preenchido, cadastro mínimo redundante
inativado sem exclusão. CNH e comprovante armazenados em bucket privado,
referenciados nas duas propostas/contratações; download conferido por tamanho.
Não foram inventados estado civil ou profissão ausentes das fontes.

Opção comercial 60%, percentual calculado 70% conforme instrução. Valores da
simulação original foram proporcionados à composição autorizada, sem substituir
pelo preço atual do catálogo. Simulação anterior preservada no histórico; links
de PDF comercial desatualizado removidos das propostas para evitar oferta errada.
Novo PDF comercial não foi gerado nesta intervenção.

Contratação complementar é desdobramento administrativo autorizado. A assinatura
registrada no original não é uma nova assinatura do cliente para o documento
complementar; flag e data copiados foram removidos da contratação complementar,
com evento de histórico e referência à origem. Ambas as vendas permanecem
formalizadas; não houve coleta nem criação de assinatura nova.

## Conciliação de 05/10

| Cota | Comissão do relatório | Alocado do recebimento | Diferença |
| --- | --- | --- | --- |
| 0137 | R$ 1.875,00 | R$ 1.875,00 | R$ 0,00 |
| 0308 | R$ 1.875,00 | R$ 1.875,00 | R$ 0,00 |
| 0467 | R$ 1.500,00 | R$ 1.500,00 | R$ 0,00 |
| 0515 | R$ 1.500,00 | R$ 1.500,00 | R$ 0,00 |
| 0656 | R$ 1.500,00 | R$ 534,58 | R$ 965,42 |
| Total Luiz | R$ 8.250,00 | R$ 7.284,58 | R$ 965,42 |

Todas as cinco linhas têm previsão/cota vinculada. O recebimento total de
R$ 8.352,58 já tinha R$ 1.068,00 alocados a outros clientes. Sua soma alocada
agora coincide exatamente com R$ 8.352,58. A diferença decorre de o total das
linhas importadas superar o recebimento; não prova inadimplência de Luiz nem
identifica qual linha sofreu desconto. A cota 0656 recebeu o saldo restante pela
ordem do relatório e guarda alerta explicativo; é necessária consulta ao lote
para identificar a causa dos R$ 965,42, sem presumir dinheiro recebido.

## Falha técnica encontrada e corrigida

O conversor multicotas usava reused da resposta armazenada pelo núcleo. Na
repetição com a mesma chave, a resposta append-only ainda trazia reused=false,
provocando nova geração de previsões. Após vincular recebimentos, isso tentava
apagar previsões referenciadas e falhava por chave estrangeira.

Migration 327 verifica a existência da venda sob lock antes de chamar o núcleo.
Venda existente conserva previsões e recebimentos e retorna reused=true.
Primeira conversão mantém a geração sobre o crédito total das cotas. Não altera
histórico append-only, privilégios, RLS nem dados de outras empresas.

## Validação

- Cenário real de criação, numeração, vinculação e repetição executado primeiro
  sob rollback; repetição aprovada sem duplicar vendas, cotas ou recebimentos.
- Aplicação atômica da correção e das duas vendas, com assertions de crédito,
  quantidade e preservação integral por hash de movimentos bancários/pagamentos.
- Consulta posterior confirmou duas vendas, cinco cotas, documentos nas duas
  contratações, vínculos e valores da tabela acima.
- Teste PGlite executa a função real com núcleo simulado preservando a resposta
  antiga: previsão recebida e números de cotas sobrevivem à repetição; quantidade
  divergente e outra empresa são rejeitadas.
- Sete testes passaram nos quatro arquivos de regressão; TypeScript sem erros.
- Advisors de segurança antes/depois idênticos: dois erros e 412 avisos já
  existentes, nenhum novo. RPC continua intencionalmente SECURITY DEFINER com
  verificação de usuário/permissão e empresa. Avisos históricos fora deste escopo.
- Migration 327 registrada como aplicada no projeto vinculado.

Não houve transferência bancária ao cliente ou sócio nem novo pagamento.
