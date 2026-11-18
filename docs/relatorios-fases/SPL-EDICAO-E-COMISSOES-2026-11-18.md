# Edição de imobiliárias e situação do extrato SPL

O formulário de edição aplicava a máscara de telefone antes de verificar se
o campo estava preenchido. A migration 345 permite telefone, responsável,
e-mail e modelo de parceria ausentes no pré-cadastro. O formulário agora
abre com os campos ausentes vazios e valida os dados ao salvar.

O SPL já registra modelos de parceria, percentuais, rateio de vendedores,
dados de recebimento e termos. O painel lista clientes, vendedores e
situação dos atendimentos. O extrato do Programa de Indicações lê as
previsões de comissão do ERP para o participante autenticado. O SPL ainda
precisa do vínculo comercial entre imobiliária, venda e beneficiário do ERP,
da consulta das parcelas e baixas e de uma seção financeira no painel.

Correção da edição em código, sem migração ou escrita de dados. A
publicação e a conferência autenticada em produção seguem pendentes.
