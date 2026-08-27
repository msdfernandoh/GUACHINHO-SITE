# Fase 152 — Detalhes de grupos, tabela canônica e múltiplos lances

Data: 27/08/2026
Escopo: catálogo global de grupos, Site Admin e ERP tenant.

## Objetivo

Eliminar diferenças operacionais entre SaaS, Site e ERP nos detalhes de um
grupo e disponibilizar uma única tabela comercial atual por UUID, substituível
por usuários autorizados do Site ou ERP. Consolidar também vários tipos de
lance no cadastro SaaS sem romper o motor de cálculo já existente no site.

## Entregas

- Detalhes do Site e ERP passaram a mostrar assembleias/prazo, prazo restante,
  participantes/capacidade, vagas, taxas, seguro e observações do grupo SaaS.
- Tipos de lance de `grupos_modalidades_lance` aparecem no Site e ERP.
- Editor SaaS permite adicionar/remover vários tipos de lance, com percentual,
  recurso próprio mínimo, descrição e modalidade de parcela.
- `Salvar categorias` agora tem estado de envio e feedback explícito de sucesso
  ou erro, além de revalidar Site e ERP.
- Botões `Tabela` e `Visualizar` foram adicionados ao catálogo e aos detalhes do
  Site e ERP, sempre apontando para o mesmo documento canônico.
- A data/hora do último upload é mostrada antes da visualização.
- Novo upload substitui o documento anterior; metadados de todas as operações
  são mantidos no histórico.

## Banco e segurança

Migration: `152_grupos_tabela_canonica_e_multiplos_lances.sql`.

- `grupos_tabelas`: registro atual único por `grupo_id`.
- `grupos_tabelas_historico`: trilha imutável de metadados de upload.
- `grupos-tabelas`: bucket privado, limite de 15 MB, PDF/JPG/PNG/WEBP.
- Nenhuma policy de acesso direto ao bucket para `authenticated`.
- Leitura do arquivo somente por URL assinada de 5 minutos.
- Escrita exige `gerenciar_grupos`, tenant ativo e grupo autorizado pela
  concessão da administradora; leitura exige tenant ativo e a mesma concessão.
- RPC `rpc_platform_salvar_lances_embutidos_grupo`: substituição atômica da
  coleção, exclusiva do Platform Superadmin.

## Compatibilidade

O site já consumia `grupos_modalidades_lance`. A fase preserva `tipo_parcela` e
`percentual_parcela_reduzida`, portanto o cálculo de integral/reduzida continua
no motor do site. `permite_lance_embutido` e `percentual_lance_embutido` em
`grupos_consorcio` permanecem sincronizados como compatibilidade legada.

## Validações realizadas

- Build Next.js/TypeScript de produção: aprovado.
- ESLint do conjunto alterado: zero avisos/erros.
- ESLint completo: aprovado dentro do orçamento técnico existente (344 avisos,
  abaixo do teto temporário de 353; esta fase reduziu o total).
- Teste contratual da fase: 3 testes aprovados.

## Operação

1. No SaaS, abrir o grupo e salvar categorias/tipos de lance.
2. No Site ou ERP, clicar `Tabela` e escolher PDF ou imagem de até 15 MB.
3. Conferir a data exibida e clicar `Visualizar`.
4. Um novo upload em qualquer portal substitui o documento visível nos dois.
