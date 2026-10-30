# Dashboard: leads recebidos no dia, semana e mês — 29/10/2026

Primeiro card de /admin substitui a contagem acumulada de status Novo por três números reais de leads recebidos, identificados como Dia, Semana e Mês. Os demais sete cards permanecem com seu comportamento anterior.

Contagens usam created_at, sem filtrar o status atual: um lead recebido no período continua contado após avançar no atendimento. Dia inicia à meia-noite em America/Cuiaba; semana inicia na segunda-feira; mês inicia no dia 1. O fim é o instante da consulta, compartilhado entre as três contagens. Semana pode abranger o mês anterior.

Três consultas de contagem exata/head são executadas em paralelo às estatísticas existentes, preservando escopo de empresa, regra legada de empresa_id nulo somente para Gauchinho e restrição srd_responsavel_id dos usuários com leads_apenas_proprios. Não houve alteração em permissões, dados de leads ou schema. A estatística antiga leadsNovos permanece no contrato de servidor para compatibilidade, mas não é mais a exibida no primeiro card.

Dois testes aprovados para limites de Cuiabá e transição de semana/mês/ano. TypeScript e lint direcionado aprovados; build de produção compilou e validou tipos. Não foi usada uma sessão de usuário real para conferir contagens privadas em produção.

## Publicação conferida em 30/10/2026

Commit 53c2f4dcaf485ffa9921821966a73e1f440f366a enviado à main. Deployment automático de produção guachinho-site-mag7gyqxk-hugo-8097s-projects.vercel.app confirmado READY com o mesmo SHA. Implementação concluída e publicada; os valores privados do usuário não foram consultados usando sessão real.
