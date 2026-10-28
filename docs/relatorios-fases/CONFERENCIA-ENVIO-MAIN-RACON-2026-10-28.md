# Conferência final e envio à main — 28/10/2026

## Escopo

Envio autorizado pelo titular: melhorias de navegação, controles de seguro no mobile, correção do extrator do simulador e documentação de diagnóstico. Não inclui recálculo de dados comerciais nem homologação do portal autenticado.

## Conferência real do catálogo

O conector Supabase voltou a responder nesta fase. Consultas exclusivamente SELECT no projeto canônico `eaeuoynprurmmulzhydt` examinaram 322 cotas ativas de 28 grupos, distribuídas em 50 combinações grupo/modalidade. A triagem de menor crédito versus próxima opção encontrou 26 inversões em 17 grupos. Valores e UUIDs estão em `AUDITORIA-MENORES-COTAS-2026-10-28.json`.

Grupos com inversões: 1041, 1071, 1081, 1193, 1253, 1270, 1273, 1283, 1453, 1463, 1473, 1503, 1533, 1543, 4088, 5388 e 5588. A comparação é triagem e não afirma que as demais cotas estão homologadas; modalidades diferentes podem ter regras próprias.

Confirmado no 5388: crédito R$ 36.561,63 possui `parcela_integral = 1963.48` e `parcela_reduzida_60 = 1178.09` tanto em Prorrogada quanto em Diluída. O valor reduzido salvo explica exatamente a primeira parcela R$ 1.195,05 da imagem após seguro inicial R$ 16,96. Na Prorrogada, a próxima cota R$ 41.784,72 possui reduzida R$ 403,92. Outra opção R$ 62.677,08 tem reduzida_60 R$ 706,87 para integral R$ 1.009,79, sugerindo classificação de 70% no campo de 60%; requer confirmação oficial.

A origem imediata está confirmada nas parcelas persistidas, e os defeitos do extrator foram reproduzidos e corrigidos localmente. Sem log/DOM original e tabela oficial, não se atribui com certeza cada valor à execução histórica do robô. Não foi aplicada substituição por fórmula, escala proporcional ou dados de outro grupo.

## Validação final

- 45 arquivos / 294 testes Vitest de Grupos e Tenant aprovados.
- 12 testes do extrator e serviço aprovados, incluindo zero gravações em entrada ambígua.
- Build de produção e TypeScript aprovados.
- Lint direcionado dos quatro arquivos TS/TSX aprovado.
- Verificação sintática dos dois módulos JavaScript e diff sem erros.
- Smoke mobile prévio documentado: botões de seguro e primeira parcela atualizam na prévia local; layout de 390 px.
- Reprodução histórica fixada no commit `3fdb0c42`, para continuar executável após o commit corretivo.

## Entrega e pendências

Branch local `main` e `origin/main` sincronizadas antes do commit, após fetch. Alterações prontas para envio sem force push. A confirmação do push é registrada no histórico Git e na resposta final.

Publicação e homologação Vercel não são confirmadas nesta fase. O runner local usa o módulo atualizado em sua próxima execução; outras instalações precisam atualizar o checkout. Nenhum robô foi disparado durante a conferência.

**Pendência de dados:** corrigir as parcelas já cadastradas continua exigindo tabela oficial por grupo/crédito/transcorrido e plano de ajuste com antes/depois. O envio do código à main não corrige retroativamente esses registros. As fases anteriores que citam indisponibilidade do conector refletem o momento daquelas tentativas e são complementadas pela leitura bem-sucedida desta fase.
