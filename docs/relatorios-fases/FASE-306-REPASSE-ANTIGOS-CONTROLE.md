# Fase 306 — Relatórios antigos para controle

Data: 09/10/2026.

## Comportamento

Checkbox no importador de Repasse da Franquia habilita seleção obrigatória de
consultor para todo o arquivo. Cria clientes incompletos com tag Antigos,
vendas de controle e cotas definitivas para contemplações e boletos.
Usa a menor data de alocação encontrada por grupo/cota nos PDFs importados;
não reconstrói datas a partir do número de parcelas de comissão.
Clientes de mesmo nome dentro do arquivo compartilham o cadastro criado nessa
importação. Não funde clientes preexistentes apenas pelo nome.

Grupos ausentes são criados LOCAL, inativos, CONFIGURACAO_PENDENTE e com
cadastro_antigo, sem inventar prazo ou primeira assembleia. Exceção restrita
para esse cadastro permite a ausência de assembleia; ativação exige completar
assembleia e prazo. Catálogo existente preservado.

## Persistência e proteção financeira

Migration 306 aditiva: clientes.cadastro_antigo, vendas.somente_controle,
grupos_consorcio.cadastro_antigo e repasse_relatorios_antigos. RPC autenticada
valida permissão gerenciar_financeiro, administradora habilitada e consultor
ativo da empresa. RLS limita leitura dos relatórios à mesma permissão/empresa.
O relatório e seu resultado ficam separados das importações financeiras.

Vendas somente_controle têm afeta_faturamento=false e IMPORTACAO_LEGADO.
Não criam recebimentos, receitas, previsões de franquia ou de participantes.
Triggers impedem previsões futuras e conversão em venda com faturamento.
O caminho financeiro do formulário rejeita PDF já registrado como antigo.
Crédito, parcela e prazo não confirmados ficam em zero e pendentes, sem
converter valor-base do relatório em crédito ou estimar parcela contratual.

Idempotência por empresa/administradora/hash; trava transacional impede
concorrência entre relatórios antigos. Cotas repetidas entre PDFs reutilizadas.
Titular, versão, consultor ou grupo ambíguos interrompem a importação atômica.
Controle de boletos inclui cadastros antigos independentemente do mês da venda.

## Validação

TypeScript sem erros. Testes de ação cobrem caminho sem financeiro, consultor
obrigatório, reenvio sem conciliação e rejeição no caminho financeiro.
SQL transacional com ROLLBACK testa agrupamento, idempotência entre PDFs,
primeira data, cadastro pendente, bloqueio de comissões/conversão, anônimo,
consultor inválido, preservação do catálogo e grupo novo inativo sem prazo/data
inventados. PDFs fornecidos também executados em ROLLBACK antes da importação.

Teste legado repasse-pdf-182-contract possui falha preexistente por exigir
texto literal "qualquer competência", ausente também no HEAD anterior.
Nenhuma mudança no fluxo antigo para acomodar esse contrato desatualizado.

## Arquivos fornecidos e publicação

Usuário autorizou importar os dois PDFs para o participante com nome exato
FERNANDO, e criar grupos ausentes inativos. Conferência: 100 linhas/21 cotas
no arquivo maior; 1 linha do outro arquivo repete uma dessas cotas. 11 nomes
distintos e um grupo ausente (1253). Dados pessoais não incluídos neste relatório.

Migration 306 aplicada isoladamente e registrada em supabase_migrations, sem
executar migrations pendentes de outras fases. Importação autenticada da conta
informada pelo usuário, via RPC e upload privado em repasse-documentos.
Resultado definitivo: 2 relatórios, 11 clientes (8 PF/3 PJ, tipo pendente de
conferência), 21 vendas de controle e cotas, 1 grupo novo 1253 LOCAL/inativo.
O segundo PDF reutilizou 1 cota. Todos os vínculos usam FERNANDO, sem alterar
outros consultores. Previsões das 21 vendas: zero. Recebimentos financeiros
antes e depois: 6. Arquivos originais preservados.

17 testes de regressão passaram em 6 arquivos; TypeScript e build de produção
concluídos. Deployment dpl_AcJajeHCeoSqzDuknDEzv3wvK3F5 READY:
https://guachinho-site-gn6jmaf7e-hugo-8097s-projects.vercel.app.
Domínio www.raconsinop.com.br verificado como alias do deployment.
Smoke autenticado: /erp/repasse-franquia, /erp/vendas, /erp/clientes e
/erp/minhas-comissoes com HTTP 200. Confirmados checkbox, dois relatórios,
consultor Fernando e tag Antigos na carteira de clientes.
