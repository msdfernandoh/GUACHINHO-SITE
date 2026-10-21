# Correção do erro #441 na transferência de sócios — 20/10/2026

## Diagnóstico
O erro #441 é o envelope de produção do React para exceções do servidor. A implementação anterior lançava erros para validações esperadas e tentava ler `e.message` no navegador. Em produção a mensagem original é ocultada, portanto testes unitários que verificavam apenas rejeições não garantiam a experiência de produção.

O código genérico sozinho não identifica qual validação bloqueou a tentativa do usuário. A consulta somente leitura a `financeiro_transferencias_contas`, limitada à empresa ativa e ao prefixo `retirada-socio:`, retornou zero registros. Nenhuma transferência deste fluxo estava registrada no momento do diagnóstico.

## Alterações
- Contrato serializável com sucesso `{ok: true, saldoSistema}` ou falha `{ok: false, mensagem}`.
- Validações esperadas chegam ao cartão sem atravessar a fronteira servidor/cliente como exceções.
- Erros SQL brutos ficam no servidor; falhas inesperadas geram referência de diagnóstico e orientação para conferir o painel antes de repetir.
- A UI trata o resultado antes de limpar campos ou anunciar sucesso. Falha de rede mostra orientação segura sem repetir mensagem minificada.
- Valor remanescente de retirada ainda digitada é identificado como previsão; não significa transferência efetivada.
- Cálculo em centavos preservado. Regressão com valores da imagem anterior: crédito R$ 11.152,69 menos retirada R$ 8.928,73 resulta em R$ 2.223,96. O texto R$ 2.224,01 reportado nesta ocorrência, isoladamente, não permite afirmar erro de cálculo sem a posição-base daquele momento.

## Preservação
Sem migration, alteração de saldo real ou execução de transferências de teste. As validações de tenant, financeiro, conciliação, reservas e idempotência foram mantidas.

## Verificação
- Regressões de mensagens serializadas, ausência de vazamento de detalhes internos e cálculo em centavos aprovadas.
- Suíte completa: 1.854 aprovados, 37 ignorados preexistentes, zero falhas.
- TypeScript, lint dos arquivos alterados (sem avisos) e build de produção aprovados.
- Implantação e reprodução autenticada em produção não verificadas nesta etapa.
