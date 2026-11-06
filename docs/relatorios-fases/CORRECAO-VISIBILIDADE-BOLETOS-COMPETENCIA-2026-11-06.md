# Relatório — Correção de visibilidade dos boletos

Data: 06/11/2026

## Problema identificado

O robô gravava o boleto na competência do processamento, mas a tela de Vendas &
Cotas montava as competências apenas pelas datas das vendas. Quando o mês do
boleto era diferente do mês da venda, ele ficava fora da competência selecionada
e não aparecia no filtro nem nas ações de download.

Também havia registros com `arquivo_storage_path` preenchido e `arquivo_url`
vazio. Nesses casos, a tela não identificava o arquivo como disponível.

## Correção

- Competências agora incluem os meses de `vendas_boletos_envios`.
- “Com boleto” considera `arquivo_url` ou `arquivo_storage_path`.
- A página recompõe a URL pública do bucket `boletos-cotas` quando necessário.
- A consolidação entre `cotas_boletos` e `vendas_boletos_envios` preserva PDF,
  Pix e linha digitável.

## Validação

- Testes de persistência/contrato: 16 aprovados.
- `npx tsc --noEmit`: aprovado.
- `npm run build`: aprovado, 173 páginas geradas.

Código validado localmente; ainda não publicado.
