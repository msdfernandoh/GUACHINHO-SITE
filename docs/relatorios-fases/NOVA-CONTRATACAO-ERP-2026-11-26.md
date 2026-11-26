# Nova contratação diretamente no ERP — 26/11/2026

## Resultado

A fila `/erp/contratacoes` oferece o botão **Nova contratação** para quem pode formalizar. A entrada `/erp/contratacoes/nova` permite buscar clientes ativos por nome ou CPF/CNPJ, selecionar o cadastro existente ou abrir o formulário completo de novo cliente dentro da contratação. A busca é paginada em 20 registros e restrita à empresa ativa.

O cadastro novo reaproveita `saveClienteAction`, incluindo a verificação de documento duplicado, histórico e dados pessoais/endereço/consultor. A opção de continuação retorna à nova contratação com o cliente salvo selecionado. O cadastro comum de clientes mantém seu destino anterior.

Ao continuar, a ação existente `iniciarNovaCotaClienteAction` cria a contratação vinculada ao cliente e abre a conferência completa: grupo autorizado, produto/crédito, quantidade, modalidade, seguro, número atribuído à cota, consultores, comissão, datas de parcelas e documentos. A chave de requisição mantém a proteção existente contra repetição do mesmo envio. O botão fica desabilitado durante o envio e falhas são mostradas no formulário.

## Preservação e acesso

- Consultas usam a sessão autenticada, `empresa_id` e as políticas existentes.
- A nova página exige os acessos de Contratações e Clientes, além da permissão `formalizar_vendas`; o POST revalida o acesso e a ação canônica revalida cliente/empresa/permissão.
- Selecionar ou pesquisar cliente não cria contratação. A criação só ocorre ao clicar em Continuar.
- A contratação inicia sem assinatura. Assinatura, documento e comissionamento continuam sujeitos às validações existentes antes de gerar a venda e as cotas definitivas.
- Sem migration, alteração de políticas ou escrita em registros de produção nesta implementação.

## Verificação

Quatro testes de comportamento aprovados: busca de documento com máscara, paginação e escopo da empresa; cliente indisponível sem opção de continuar; redirecionamento da ação existente; e bloqueio do POST sem acesso. ESLint direcionado sem erros. TypeScript completo (`tsc --noEmit --incremental false`) aprovado.

A navegação autenticada em produção e a criação de uma venda real não foram executadas. Arquivos de outras entregas presentes no checkout foram preservados.