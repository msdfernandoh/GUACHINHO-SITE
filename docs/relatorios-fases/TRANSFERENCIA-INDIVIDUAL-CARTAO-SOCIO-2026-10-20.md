# Transferência individual no cartão do sócio — 20/10/2026

## Comportamento
Adicionado “Efetivar transferência” junto ao valor da retirada e ao comprovante em cada cartão. É um registro do PIX/TED já feito pelo gestor no banco; não há integração de envio de dinheiro. Exige confirmação explícita por sócio e referência de comprovante com oito caracteres.

A saída da empresa e a entrada na conta financeira do sócio são registradas pela RPC existente `rpc_transferir_entre_contas`, na mesma transação. O cálculo canônico já reconhece esse par de movimentos e reduz o crédito do sócio. Após sucesso, valor e confirmação são limpos, saldo é recarregado e a rota é atualizada. A action de lacre recusa valores de retirada pendentes para evitar duplicação pelo fluxo antigo.

## Autorizações e integridade
- Acesso a conta-corrente-socios, gerenciar_financeiro e mesma empresa ativa.
- Conta pessoal resolvida pelo usuário vinculado ao sócio e participantes da mesma empresa. Ausência ou ambiguidade exige correção de cadastro.
- Crédito recalculado no servidor, sem aceitar o demonstrativo do navegador.
- Exige cobertura de caixa, reservas e ausência dos bloqueios de conciliação já apresentados pelo painel.
- Idempotência por sócio/período/posição de transferências; operação já existente só é reutilizada se valor, comprovante e contas coincidirem. A RPC bloqueia as contas, verifica saldo e grava os dois movimentos atomicamente.
- As validações de crédito/reservas ocorrem antes da RPC existente; outras rotas de movimentação financeira mantêm suas regras próprias. Não se introduz um novo mecanismo global de reserva bancária.
- Livros append-only, sem exclusões, migrations ou baixas novas de comissão.

## Verificação
- Testes direcionados de transferência, comissão recebida e fechamento: 26 aprovados.
- TypeScript e ESLint dos arquivos alterados: aprovados, sem avisos.
- Build de produção: aprovado.
- Suíte completa: 1.850 testes aprovados, 37 ignorados preexistentes, zero falhas.
- Nenhuma transferência real executada para testar. Implantação/validação visual em produção não realizada.
