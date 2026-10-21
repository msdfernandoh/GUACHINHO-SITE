# Remoção do quadro antigo de equalização — 20/10/2026

## Solicitação e alteração
Removido de Contas a Pagar o quadro escuro “Fechamento & Equalização entre Sócios” identificado na imagem do usuário: total do período, demonstrativo individual e sugestões de transferências diretas entre sócios. Essa prévia considerava despesas pessoais e podia ser confundida com a posição completa de comissões, impostos e transferências do fechamento.

Removido também o contador calculado usado exclusivamente nesse quadro. Mantidos os demais componentes de Contas a Pagar e o acesso à tela própria `/erp/fechamento-socios`.

## Preservação
Nenhuma migration, alteração de regra financeira ou escrita no banco. Contas, pagamentos, comissões, transferências e histórico preservados.

## Verificação
- TypeScript (`tsc --noEmit --pretty false`): aprovado.
- ESLint do arquivo alterado: aprovado, sem avisos.
- Revisão do diff: somente remoção do quadro e contador exclusivo.
- Build de produção (`npm run build`): aprovado.
- Implantação e verificação visual em produção não realizadas nesta etapa.
