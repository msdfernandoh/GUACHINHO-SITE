# Manual — Contratações no ERP

## Finalidade

O módulo `/erp/contratacoes` é uma fila operacional. Ele recebe contratos do site e permite transformar um contrato assinado, após conferência humana, em Cliente, Venda e Cota definitiva.

O módulo não cria vendas por mecanismo próprio. A confirmação aciona o motor transacional canônico, que também resolve os snapshots e previsões de comissão.

## Fluxo operacional

1. O site gera a proposta e a contratação.
2. O cliente envia os documentos e assina o contrato.
3. A contratação aparece no ERP como **Assinado — aguardando formalização**.
4. Clique em **Conferir e formalizar**.
5. Confira os dados cadastrais e os documentos privados.
6. Se o documento já estiver cadastrado no mesmo tenant, o cliente existente será reutilizado; caso contrário, o mecanismo canônico criará o cliente.
7. Confira ou selecione o Grupo canônico. Grupo sem Tipo/Modalidade fica bloqueado como pendência.
8. Confira o produto comercial (`grupos_cotas`). Ele não é a cota definitiva do cliente.
9. Confira o consultor principal e, quando houver venda compartilhada, o participante secundário e sua fração.
10. Confira a regra homologada apresentada somente para leitura.
11. Clique em **Confirmar e formalizar venda**.
12. O sistema cria uma Venda e uma Cota definitiva, gera previsões pelo motor canônico e marca a contratação como **Formalizada**.
13. Use os links finais para abrir Cliente, Venda ou Cota.

## Pendências operacionais

Validações esperadas aparecem na página, não como erro 500. Exemplos: cliente incompleto, documento obrigatório ausente, grupo não configurado, Tipo/Modalidade ausente, produto comercial ausente, consultor inválido e regra de comissão ausente ou ambígua.

Corrija o cadastro indicado e tente novamente. Uma tentativa repetida com a mesma contratação não duplica Cliente, Venda, Cota ou previsões.

## Número definitivo da cota

Quando a administradora ainda não informou o número, a cota nasce com número nulo/em definição. Não use número fictício; complemente-o posteriormente no fluxo canônico de cotas.

## Segurança e documentos

Os documentos continuam em `contratacoes_documentos` e no Storage privado. A tela gera acesso temporário autorizado e não copia arquivos. Usuários de outra empresa não conseguem consultar nem formalizar a contratação.
