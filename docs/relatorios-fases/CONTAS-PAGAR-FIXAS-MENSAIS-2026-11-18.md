# Programações fixas mensais em Contas a Pagar

Em 18/11/2026, a tela Contas a Pagar recebeu o botão **Listar fixas mensais**.
A lista mostra uma linha por série mensal com pelo menos uma conta em aberto,
incluindo contas vencidas. Cada linha exibe a descrição, o primeiro vencimento
em aberto, o valor desse lançamento e sua posição na série. Séries geradas
por duplicação mensal aparecem identificadas.

A consulta é paginada e independente dos filtros da lista de despesas. Ela
reutiliza as séries da migration 129 e restringe séries e ocorrências à
empresa ativa com sessão autenticada e RLS. A alteração é somente de leitura
e dispensa migração de banco.

O TypeScript e os 17 testes existentes de recorrência, consulta paginada e
permissões passaram. A validação da nova consulta com sessão autenticada em
produção permanece pendente.
