# Fase 205 — Inativação de perfis, vínculos e programas de comissão

## Objetivo

Evitar que configurações antigas ou duplicadas participem de novas comissões sem
apagar previsões, pagamentos ou vínculos históricos.

## Entregas

- Perfil de comissão pode ser inativado e reativado diretamente no card.
- Vínculo participante–função–perfil mantém sua própria inativação independente.
- Perfis inativos não aparecem em novas regras ou vínculos, mas continuam visíveis
  ao editar registros históricos que já os utilizam.
- Regra da franqueadora pode ser inativada; sua reabertura volta como rascunho e
  exige nova conferência/homologação.
- Programa antigo pode ser reservado como `uso_exclusivo_importacao_legado`.
  Essa operação inativa suas regras de franquia e participante, preservando dados.
- O importador histórico lista somente programas explicitamente reservados para
  importação antiga; fluxos operacionais listam somente programas ativos.
- A aba Franqueadora ganhou o quadro **Comissões atualmente usadas**, calculado com
  programa ativo, regra ativa/homologada e vigência atual. Escopos simultâneos
  equivalentes são sinalizados para revisão, sem limpeza destrutiva automática.

## Segurança de dados

Nenhuma previsão ou pagamento é removido. As ações atualizam estado e trilha de
origem; a separação operacional/legado usa a coluna canônica já existente em
`comissao_programas`, portanto não exige nova migration.

## Validação

- contrato automatizado `inativacao-perfis-programas-205-contract.test.ts`;
- TypeScript sem erros;
- build de produção.
