# Fase 271 — Check-in de evento no domínio Racon

## Problema

No domínio de parceiro `raconsinop.com.br`, o proxy tratava `/eventos/{slug}/sorteio` como uma página institucional desconhecida. A requisição era reescrita internamente para a home do site parceiro, embora o QR e o endereço exibidos no ERP estivessem corretos.

## Correção

- O prefixo público `/eventos` passou a integrar as rotas preservadas no domínio parceiro.
- O check-in, o telão e a página pública do evento chegam às rotas reais do módulo de eventos.
- Os headers internos do tenant e do site parceiro continuam presentes; por isso o layout público aplica logo, cores, navegação e rodapé do modelo Racon.
- O mesmo caminho continua funcionando no portal Gauchinho, sem duplicar eventos ou criar rotas específicas por marca.

## Segurança e isolamento

- Não houve alteração em dados, QR codes ou inscrições.
- O domínio continua resolvendo a empresa proprietária pelo proxy e respeitando o entitlement operacional antes de servir o evento.

## Validação

- Teste contratual confirma que `/eventos` não sofre rewrite para a home parceira.
- Teste contratual confirma que a página de check-in permanece no layout público com suporte ao chrome Racon.
