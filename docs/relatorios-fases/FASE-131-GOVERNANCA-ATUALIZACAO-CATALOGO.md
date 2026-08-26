# Fase 131 — Governança da Atualização do Catálogo

Data de implementação local: 26/08/2026  
Migration: não aplicável  
Estado: implementada e validada localmente; sem alteração de banco.

## Problema corrigido

O botão anteriormente chamado de “Sincronizar Catálogo” executava somente `revalidatePath`. Ele não consultava Racon nem qualquer outra administradora, mas sua mensagem afirmava que Site e ERP haviam sido sincronizados. Essa semântica criava uma falsa confirmação operacional.

## Comportamento correto

A ação passa a se chamar `atualizarVisualizacaoCatalogoAction` e comunica exatamente o que faz:

- invalida o cache das páginas que leem o catálogo SaaS;
- faz Site e ERP recarregarem os registros já persistidos;
- não cria grupos, cotas, modalidades ou taxas;
- não consulta API externa;
- não afirma que houve integração com administradora.

Uma função com o nome anterior permanece somente como compatibilidade temporária para consumidores antigos e delega à ação canônica, com a mesma autorização.

## Autorização

A atualização exige uma das condições:

- usuário reconhecido por `is_platform_superadmin()`; ou
- vínculo N:N ativo no tenant com a permissão canônica `gerenciar_grupos`.

A vinculação de registros legados foi adicionalmente protegida para permitir execução apenas por superadmin da plataforma. A autoridade não usa `usuarios.perfil` nem presume `auth.uid()` como consultor.

## Preparação para APIs futuras

Uma integração futura deverá possuir fluxo próprio de importação, histórico de execuções, origem, versão do payload, idempotência, validação e publicação. A simples invalidação de cache não poderá ser reutilizada como confirmação de importação externa.

## Validação

- teste contratual específico cobrindo autorização e semântica;
- build e suíte completa executados antes do encerramento da fase.
