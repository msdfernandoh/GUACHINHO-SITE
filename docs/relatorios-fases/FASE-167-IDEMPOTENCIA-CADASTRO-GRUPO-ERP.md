# Fase 167 — Idempotência do cadastro de Grupo no ERP

Data: 31/08/2026.

## Diagnóstico confirmado

O cadastro estava gravando no banco, mas não bloqueava reenvios enquanto a Server Action processava créditos e configurações. Nove registros locais pendentes de `1553 IMÓVEL`, com mesmo tenant, administradora, tipo e conteúdo, foram criados entre 11:42:20 e 11:42:38 UTC. A ausência de confirmação/navegação imediata fez o operador repetir o clique.

## Correções

- Código do grupo normalizado e chave de idempotência determinística por empresa, administradora, tipo e código.
- Busca prévia impede novo cadastro quando o grupo já existe e encaminha para o registro existente.
- Botões ficam bloqueados durante todo o envio e exibem “Salvando grupo…”.
- Sucesso sempre navega: continuar abre o grupo criado; voltar abre a lista, destaca a linha e mostra confirmação.
- Migration 166 cria proteção concorrente no banco com advisory transaction lock e bloqueio de segundo grupo local de mesma empresa/administradora/código. Ela foi aplicada e conferida no banco de produção em 31/08/2026.

## Dados existentes

Os nove registros pendentes foram identificados por leitura. Não foram excluídos automaticamente: a consolidação é uma ação destrutiva e deve preservar o registro que será homologado. A proteção de novos reenvios já está ativa no banco.

## Verificações

Testes cobrem normalização, estabilidade/separação da chave, estado pendente da interface, navegação e contrato do lock SQL. Nenhum novo grupo real foi criado durante os testes.
