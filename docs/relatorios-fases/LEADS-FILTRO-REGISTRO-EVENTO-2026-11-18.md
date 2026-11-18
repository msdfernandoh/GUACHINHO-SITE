# Filtro de registro no evento em Leads · 18/11/2026

Na lista administrativa, **Registro no evento** aceita cadastro sem check-in,
check-in realizado ou indicação. O filtro se combina com **Evento** e segue
para as exportações CSV e XLS. Um cadastro deixa de entrar no primeiro grupo
quando há presença ou qualificação registrada no evento selecionado. As
indicações incluem os vínculos do sorteio e do check-in SPL.

A consulta aplica os filtros no servidor, antes do limite da lista, com o
escopo de empresa existente. Não houve migração nem escrita operacional.
No teste de leitura com o evento Herança Inteligente, a API retornou 15
cadastros sem check-in, 13 check-ins e seis indicações.
