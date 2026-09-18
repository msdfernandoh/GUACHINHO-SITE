# Fase 245 — Participantes principais por perfil homologado

Data: 18/09/2026

## Diagnóstico

Laura e Douglas estavam ativos e possuíam regras homologadas nos programas
Racon Imóvel e Racon Veículo. Laura possui o perfil `SDR Padrão`; Douglas, o
perfil `Parceiro Padrão`. O seletor do fechamento escondia ambos porque aceitava
como principal somente vínculos cujo texto do papel fosse `CONSULTOR`, `GESTOR`
ou `MICROFRANQUIA`.

Essa restrição existia apenas na interface. O motor canônico trabalha com o
perfil e sua regra homologada, independentemente do nome legado do papel.

## Correção

O seletor principal agora lista participantes ativos que possuam vínculo vigente
com um perfil de comissão. Depois da escolha, a elegibilidade continua exigindo
regra homologada compatível com programa, tipo de bem e modalidade da venda.
Assim:

- Laura pode ser principal usando `SDR Padrão` e o percentual desse perfil;
- Douglas pode ser principal usando `Parceiro Padrão` e o percentual desse
  perfil;
- ambos continuam disponíveis como secundários quando aplicável;
- nenhuma regra ou percentual foi alterado.

O rótulo da tela passou de “Consultor Principal” para “Participante Comercial
Principal”, refletindo as funções realmente aceitas pelo motor.
