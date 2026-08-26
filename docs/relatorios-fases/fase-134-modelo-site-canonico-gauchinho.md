# Relatório de Conclusão — Fase 134: Modelo de Site Canônico e Runtime Gauchinho

**Data:** 26/08/2026  
**Migration:** `132_site_modelo_empresa_canonico.sql`

## Objetivo

Restaurar o site público da Gauchinho no layout operacional próprio e tornar a atribuição de modelos de site clara, segura e prática no SaaS, sem modificar o modelo das demais franquias.

## Diagnóstico confirmado

1. A Gauchinho já possuía vínculo com `site_modelos.codigo = gauchinho_default` em `empresa_site_modelos`.
2. A configuração `empresas.configuracoes.site_publico.operacional_habilitado` não estava habilitada. O roteador, corretamente fechado por padrão, entregava o site institucional destinado às demais franquias.
3. A tela Platform lia `modelo_id`, `template_codigo` e `menus` em `empresa_branding`, colunas que não existem no schema de produção.
4. O código da migration 093 duplicava a atribuição do modelo em `empresa_branding`, embora a tabela criada para esse relacionamento seja `empresa_site_modelos`.
5. Fallbacks visuais exibiam “Gauchinho Default” mesmo quando a consulta não retornava vínculo, mascarando inconsistências.

## Arquitetura corrigida

### Fonte canônica

- `site_modelos`: catálogo global, mantido pelo Platform Superadmin.
- `empresa_site_modelos`: vínculo 1:1 da empresa com o modelo escolhido e seu estado de publicação.
- `empresa_branding`: identidade e conteúdo do tenant — logotipo, cores, textos, contatos e SEO. Não decide o template.
- `empresas.configuracoes.site_publico.operacional_habilitado`: entitlement explícito do runtime operacional.

O código UUID usado em todas as alterações é o `id` de `site_modelos`, persistido em `empresa_site_modelos.modelo_id` com chave estrangeira. Nenhuma seleção depende de nome, texto visível ou posição na lista.

### Troca segura de modelo

`rpc_platform_alterar_modelo_empresa(empresa_uuid, modelo_uuid)` agora:

1. exige `PLATFORM_SUPERADMIN`;
2. valida a existência da empresa;
3. aceita somente modelo `PUBLICADO`;
4. cria ou atualiza exclusivamente o vínculo da empresa informada;
5. preserva o estado de publicação existente;
6. registra modelo anterior e novo em `plataforma_auditoria`;
7. executa tudo na mesma transação.

### Resolução do site público

O servidor resolve o modelo publicado da empresa em `empresa_site_modelos`. O runtime completo da Gauchinho somente é carregado quando duas condições independentes são verdadeiras:

- `site_publico.operacional_habilitado = true`;
- modelo publicado com código `gauchinho_default`.

Demais franquias continuam no runtime institucional. Isso impede que a simples troca de modelo libere dados operacionais da Gauchinho para outro tenant.

## UI e UX no SaaS

Na empresa, aba **Site & Identidade**, a Platform passa a mostrar:

- modelo realmente vinculado ou “Não configurado”;
- código técnico, versão, descrição e estado do vínculo;
- tipo de runtime (operacional ou institucional);
- domínio principal e acesso direto ao site;
- modelos publicados em cards com paleta visual;
- aviso explícito de que a troca afeta somente a empresa selecionada.

A listagem de empresas também usa o vínculo canônico e não aplica fallback enganoso.

## Alteração específica da Gauchinho

A migration preserva todas as configurações existentes e adiciona somente `site_publico.operacional_habilitado = true`. Também garante, de forma idempotente, o vínculo publicado da empresa `slug = gauchinho` com `gauchinho_default`.

## Regras para futuras alterações

1. Nunca adicionar `modelo_id` ou `template_codigo` a `empresa_branding`.
2. Nunca selecionar modelo por nome ou código vindo do formulário; receber UUID e validar no banco.
3. Nunca usar fallback de interface para ocultar vínculo ausente.
4. Toda troca deve usar `rpc_platform_alterar_modelo_empresa`.
5. A publicação do modelo e a publicação do site são estados distintos e devem ser validados.
6. Alterar modelo não pode habilitar ERP, dados operacionais ou permissões.
7. Sites de parceiros continuam governados por `parceiro_sites.template_codigo`; essa escolha não é o vínculo principal da empresa.

## Validações

- build Next.js e TypeScript;
- suíte automatizada, incluindo contrato da Fase 132;
- migration validada e aplicada no projeto Supabase vinculado;
- pós-check do vínculo, entitlement e isolamento das demais empresas;
- smoke test do site público e da Platform após deploy.
