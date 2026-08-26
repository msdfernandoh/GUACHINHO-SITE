# Fase 128 — Hardening de Contas a Pagar, Privacidade e Isolamento Tenant

Data de implementação local: 26/08/2026  
Migration: `128_financeiro_contas_pagar_hardening_privacidade_tenant.sql`  
Estado: implementada e validada localmente; aplicação no Supabase Production ainda pendente.

## Objetivo

Eliminar exposições e referências cruzadas no módulo de Contas a Pagar antes da implantação de recorrências, fechamento dos sócios e importação de carteira legada.

## Problemas corrigidos

1. O bucket `contas-pagar-documentos` era público e as notas fiscais eram armazenadas como URLs públicas permanentes.
2. Centro de custo, conta bancária e fornecedor podiam chegar ao backend como UUIDs sem prova completa de pertencimento à empresa ativa.
3. A página ainda considerava `usuarios.perfil = master` para autoridade financeira.
4. O banco não possuía uma barreira única que impedisse referências de outra empresa em novos lançamentos financeiros.
5. Faltavam índices específicos para consultas de contas por empresa, período e status.

## Alterações de banco

- bucket convertido para privado, preservando os objetos existentes;
- remoção das políticas públicas/amplas da migration 118;
- políticas tenant-aware baseadas no primeiro segmento `empresa_id` do caminho;
- leitura limitada ao vínculo da empresa;
- escrita limitada à permissão `gerenciar_financeiro`;
- trigger `trg_validar_referencias_conta_pagar_tenant` para impedir referências cruzadas de:
  - centro de custo;
  - conta bancária;
  - fornecedor;
  - sócio pagador;
  - caminho de documento;
- índices por empresa, vencimento, status, pagamento e data de caixa.

O trigger é forward-only: fatos históricos foram preservados, mas qualquer novo `INSERT` ou `UPDATE` incompatível é rejeitado.

## Alterações da aplicação

- upload com bucket privado;
- limite de 20 MB e allowlist de MIME;
- nome físico gerado com UUID;
- `upsert = false`, evitando sobrescrita silenciosa;
- novos registros guardam caminho privado, não URL pública;
- URLs legadas são convertidas para caminho ao abrir;
- acesso feito por URL assinada de 60 segundos, após validar conta e empresa;
- remoção/substituição de anexo elimina o objeto anterior quando possível;
- referências recebidas do formulário são verificadas por `id + empresa_id`;
- autorização de escrita usa `requireTenantPermission('gerenciar_financeiro')`;
- `usuarios.perfil` deixou de conceder autoridade na página de Contas a Pagar;
- `pode_estornar_contas` passa a fazer parte do contexto tenant carregado.

## Validação executada

- `npm run build`: aprovado;
- teste contratual `financeiro-contas-pagar-hardening-128-contract.test.ts`: 6 testes aprovados;
- TypeScript e geração das 146 páginas: aprovados.

## Aplicação segura em Production

1. Fazer backup/verificação do bucket e das tabelas financeiras.
2. Executar a migration 128 completa, sem recortar blocos.
3. Confirmar `storage.buckets.public = false` para `contas-pagar-documentos`.
4. Testar abertura de um documento legado e upload de um documento novo.
5. Testar que usuário sem `gerenciar_financeiro` não grava nem abre documento.
6. Testar que um UUID de centro/banco/fornecedor de outra empresa é rejeitado.

## Fora do escopo desta subfase

- recorrências e duplicação em lote;
- fechamento imutável dos sócios;
- paginação server-side completa;
- carteira e comissões legadas;
- integração futura com APIs de administradoras.

Esses itens permanecem nas próximas fases e só serão construídos após este hardening.
