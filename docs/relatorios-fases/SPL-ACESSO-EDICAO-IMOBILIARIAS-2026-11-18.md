# Acesso ao painel das imobiliárias pré-cadastradas no SPL

O painel retornava 404 para imobiliárias pré-cadastradas pelo evento, como a
Tozi Imóveis. A migration 345 gravou códigos de acesso hexadecimais de 64
caracteres. A leitura dos links mantinha apenas os 32 caracteres finais.

A resolução do painel aceita os dois formatos já emitidos, com ou sem o nome
da imobiliária no endereço. O painel usa o código completo validado para
salvar alterações e gerar links após uma troca de nome. A consulta continua
restrita à empresa resolvida para o domínio e às imobiliárias não inativas.

Alteração de código, sem renovação de códigos de acesso ou migração.
Os cinco testes de links passaram. Conferência autenticada em produção pendente.
