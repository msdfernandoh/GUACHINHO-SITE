# ERP Clientes Operacional — fase de Preview

## Arquitetura encontrada

`clientes` não existia como entidade canônica. Lead, proposta e contratação continuam entidades distintas. A condição canônica para efetivação é `contratacoes_online.contrato_assinado = true`, com `contrato_assinado_em` como referência histórica. A cota real continua em `cotas_definitivas`, derivada de `vendas`; `grupos_cotas` permanece opção comercial.

## Mudanças da fase

A migration forward-only `071_erp_clientes_operacional.sql` cria `clientes` tenant-aware, `clientes_historico` append-only e FKs compostas tenant-aware em propostas, contratações e vendas. Não cria cotas, vendas, administradoras, grupos, produtos comerciais ou arquivos de Storage.

O trigger de contratação assinada normaliza CPF/CNPJ, cria/reutiliza cliente por `empresa_id + documento_normalizado`, liga a contratação e registra histórico. Sem CPF/CNPJ, o contrato conserva sua própria identidade: não há deduplicação insegura por nome ou telefone. `contrato_assinado_em` é preservado em `contrato_assinado_referencia_em`.

## Cadastro manual e UX

Foram criadas as rotas `/erp/clientes`, `/erp/clientes/novo`, `/erp/clientes/[id]` e `/erp/clientes/[id]/editar`. A listagem mostra apenas clientes, com busca, PF/PJ, status, consultor, quantidade de cotas e ações. A interface é clara, com cabeçalho operacional, métricas e botões grandes.

O detalhe organiza dados cadastrais, cotas reais, propostas, documentos e histórico. Documentos reutilizam `contratacoes_documentos` e o bucket privado existente; nenhum objeto é copiado nem exposto publicamente. Inativação preserva histórico; não há delete de cliente.

## Nova Cota

O botão inicia a rota canônica de nova proposta com `cliente_id` na URL. Esta fase não cria venda/cota diretamente e não altera os motores 060–063. O pré-preenchimento final do formulário de proposta depende de suporte explícito daquela tela e permanece pendência de integração, para não introduzir escrita paralela neste módulo.

## Segurança

RLS usa policies explícitas de SELECT/INSERT/UPDATE para `clientes`, SELECT/INSERT para histórico e os helpers `can_read_tenant_internal`/`can_write_tenant_internal`. Não há `FOR ALL`, policy permissiva nem delete autenticado. FKs compostas impedem vínculo cross-tenant.

## Backfill histórico

Nenhum backfill foi executado. Antes de qualquer backfill real será necessário produzir, no ambiente autorizado, a contagem de contratações assinadas, documentos ausentes, CPF/CNPJ duplicados/conflitantes e contratos sem documento. A migration não varre nem altera registros históricos.

## Testes e Preview

O teste de contrato `src/lib/erp/clientes-contract.test.ts` cobre assinatura, idempotência documental por CPF/CNPJ, preservação de cotas/produtos e RLS/UX estrutural. O build local foi aprovado. Migration 071 não foi aplicada em Production, não houve merge em `main`, deploy Production ou alteração de outros módulos.

## Pendências para homologação

- aplicar 071 somente no ambiente Preview/isolado autorizado;
- executar testes integrados com duas empresas e o fluxo real de assinatura;
- homologar sessão autenticada, documentos privados e a nova proposta pré-preenchida;
- apresentar auditoria de backfill antes de qualquer escrita histórica.
