# Fase 105 — Hardening multi-tenant, formalização e prontidão para escala

Data da implementação local: 26/08/2026  
Estado: **implementado e validado localmente; ainda não promovido ao Supabase Production**

## 1. Objetivo

Eliminar vínculos implícitos, fallbacks e dados operacionais sem empresa que poderiam funcionar com uma única franquia, mas misturar informações quando novas escolas, franquias, parceiros e sites fossem ativados. Esta fase também corrige o erro funcional da formalização em que produto, valor da parcela e prazo eram tratados como uma única opção.

## 2. Contrato comercial corrigido

O fluxo canônico passa a representar quatro conceitos independentes:

1. **Grupo**: grupo real da administradora, identificado por UUID.
2. **Produto/cota comercial**: faixa de crédito disponível naquele grupo, identificada pelo UUID de `grupos_cotas`.
3. **Modalidade de venda**: integral, reduzida de 60% a 99% ou reduzida abaixo de 59%, identificada pelo UUID de `modalidades_pagamento`.
4. **Prazo no momento da venda**: prazo original do grupo, parcelas já realizadas e parcelas restantes na data de referência.

O valor da parcela não pertence mais ao rótulo do produto. Ele é resolvido pela combinação exata `grupo_id + grupo_cota_id + modalidade_pagamento_id` em `grupos_cotas_modalidades_valores`. Assim, trocar a modalidade troca o valor exibido e posteriormente congelado na venda.

## 3. Alterações de UI/UX na formalização

- O seletor **Produto / Cota Comercial** exibe somente o crédito.
- As modalidades são apresentadas separadamente, cada uma com seu valor de parcela homologado.
- A troca de grupo limpa produto e modalidade incompatíveis.
- A troca de produto limpa a modalidade anterior e exige nova escolha consciente.
- Não existe seleção automática do primeiro UUID disponível.
- O resumo mostra crédito, parcela da modalidade e `parcelas restantes / prazo original`.
- Grupos em andamento usam a base temporal ou manual do catálogo; não assumem que ainda restam todas as parcelas originais.

## 4. Persistência e invariantes

A migration `104_fix_rpc_prazo_total_e_governanca.sql` introduz `calcular_prazo_restante_grupo(uuid,date)` e corrige a conversão de contratação. A migration `105_hardening_multitenant_escala_franquias.sql` congela em vendas e cotas definitivas:

- `prazo_original_grupo`;
- `parcelas_restantes_venda`;
- `prazo_referencia_em`;
- UUIDs exatos de grupo, produto e modalidade;
- snapshot comercial suficiente para auditoria histórica.

Triggers e constraints impedem prazo restante nulo, zero ou superior ao prazo original. A RPC de formalização valida empresa, vínculo, permissão, grupo ativo, produto pertencente ao grupo, modalidade disponível e valor de parcela da combinação escolhida.

## 5. Autorização e isolamento

- O tenant ativo é o vínculo exato `empresa_usuarios(empresa_id, usuario_id, papel_id)` correspondente ao domínio resolvido.
- Não há fallback automático para a primeira empresa do usuário.
- Não se presume `consultant_id = auth.uid()`.
- Preferências e permissões operacionais foram deslocadas para o vínculo empresa × usuário.
- O acesso ao site operacional é um entitlement explícito em `empresas.configuracoes.site_publico.operacional_habilitado`; slug e UUID não concedem acesso.
- Ausência de tenant ou entitlement resulta em bloqueio, inclusive no header, footer e layout público.

## 6. Usuários imobiliários e dados públicos

`imobiliarias` e `imoveis` recebem `empresa_id` obrigatório. Uma FK composta garante que o imóvel e sua imobiliária pertençam à mesma empresa. Consultas administrativas e públicas filtram o tenant antes de ler ou gravar.

O vínculo com a imobiliária passa a existir também em `empresa_usuarios.imobiliaria_id`. Isso evita que `usuarios.imobiliaria_id`, atributo global legado, determine o acesso do mesmo usuário em todas as empresas. A função RLS `current_usuario_imobiliaria_id(empresa_id)` resolve a imobiliária dentro da empresa informada.

## 7. Integrações, APIs públicas e abuso

- Chaves de integração passam a ser registros por empresa, armazenados por hash, com prefixo, escopos, expiração, revogação, último uso e auditoria.
- APIs públicas resolvem a empresa pelo host confiável e usam rate limit durável.
- Headers internos de tenant são removidos da requisição externa e recriados pelo proxy.
- Fluxos de contratação, leads, simulações, catálogo, imóveis e eventos de analytics carregam `empresa_id`.
- A chave legada de ambiente permanece apenas como ponte de compatibilidade controlada e resolve a empresa pelo banco; não contém UUID fixo no runtime.

## 8. Comissões, financeiro e repasses

- Serviços de comissão, vendas e financeiro operam com cliente autenticado e RLS, não com `service_role` indiscriminado.
- Formalização exige `formalizar_vendas`; configuração de comissão e financeiro têm permissões próprias.
- Repasse foi movido para RPC transacional, com validação de empresa, autorização, saldo, idempotência e trilha de auditoria.
- Objetos de Storage privado usam namespace da empresa e políticas coerentes com o vínculo.

## 9. Compatibilidade e preservação

- O backfill associa fatos legados à empresa Gauchinho somente dentro da migration, preservando os registros existentes.
- Nenhuma venda histórica é recalculada.
- Nenhuma parcela/comissão paga é reescrita.
- O runtime não utiliza slug/UUID da Gauchinho como regra de autorização.
- Migrations anteriores permanecem imutáveis; a evolução é forward-only em 102–105.

## 10. Validações realizadas

- TypeScript: aprovado com `node_modules/.bin/tsc.cmd --noEmit`.
- Testes: **158 arquivos aprovados, 930 testes aprovados, 37 ignorados por contrato de ambiente**.
- Build Next.js 16: aprovado, incluindo geração das 146 páginas.
- Teste de contrato específico criado para produto, modalidade, valor de parcela e prazo restante.

## 11. Pendências para promoção

1. Aplicar 102, 103, 104 e 105 primeiro em branch/Preview Supabase compatível com o histórico de Production.
2. Executar dry-run e validar constraints/backfills sem fixtures permanentes.
3. Homologar com pelo menos: venda integral, reduzida 60–99, reduzida abaixo de 59 e grupo em andamento.
4. Confirmar que o snapshot e as previsões financeiras de cada venda usam o valor da modalidade escolhida.
5. Homologar dois tenants simultâneos, inclusive usuário compartilhado e parceiro imobiliário diferente em cada empresa.
6. Somente após aprovação, promover migrations e aplicação de forma coordenada.

Não foi executado `supabase db push`, não houve gravação no banco remoto e não houve deploy de aplicação nesta fase local.
