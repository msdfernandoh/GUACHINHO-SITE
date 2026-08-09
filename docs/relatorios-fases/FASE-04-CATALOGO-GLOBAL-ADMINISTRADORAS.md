# RELATÓRIO DA FASE 4 — ETAPA 050
## Confidencialidade de Cartas Contempladas por Concessão

> **Status oficial:** `RUNTIME 050 APROVADO EM PREVIEW COM SCHEMA REMOTO 049`  
> **Migration 050:** `LOCAL, NÃO APLICADA`  
> **Produção:** `INTACTA; NENHUM DEPLOY DE PRODUÇÃO NESTA RODADA`  
> **Data:** 08/08/2026  
> **Branch:** `feature/saas-fase-4-cartas-confidencialidade`

---

## 1. Estado Git auditado

- Base remota: `origin/main` em `c5b78e2f0c2424594a3b6085a3ce1121803e3eee`.
- Commit 050 original: `7ec6b90cea803442122eedd748164c20ed3f6a03`.
- Auditoria objetiva do commit original:
  - branch já existia no remoto; não havia push local pendente;
  - build passava;
  - `npm test` falhava em 6 testes novos (`585 passed / 6 failed`), apesar do relatório anterior afirmar 591/591;
  - home ainda usava reader global legado;
  - create/update admin enviava `administradora_id` antes de a coluna existir;
  - texto arbitrário de administradora não era rejeitado;
  - testes mockavam um módulo diferente do usado pelo runtime.
- Commit corretivo: `a416e85855045ae89f84cf7661a3e17ce56a812a`.
- O commit corretivo foi pushado somente na branch feature, sem merge/push em `main` e sem force-push.
- Arquivos não rastreados preexistentes do proprietário permaneceram fora dos commits.

## 2. Migration 050 e estratégia expand/contract

Arquivo: `supabase/migrations/050_fase4_cartas_administradora_confidencialidade.sql`.

- SHA-256 canônico com LF: `B41F0DA7F4F7743BBEBCE5DBCEE0A9CA913F4B112BD7DF4A3375AD26DD568540`.
- O checkout Windows em CRLF produz hash bruto diferente (`8EEC5DFA...A47C`); normalizado para LF, o conteúdo coincide exatamente com o hash canônico.
- Estrutura:
  - adiciona `administradora_id UUID NULL`;
  - FK para `public.administradoras(id)` com `ON DELETE SET NULL`;
  - índice `idx_cartas_contempladas_administradora_id`;
  - backfill somente para `lower(trim(administradora)) = 'racon'`;
  - preserva `administradora TEXT` como snapshot;
  - aborta se Racon global não existir ou se restarem cartas sem vínculo.
- Não altera valores comerciais, leads, propostas, contratações, concessões, grupos/cotas ou migrations anteriores.
- Não transforma a FK em `NOT NULL`.
- Importante: a 050 atual **não executa** `DROP POLICY cartas_public_read`; apenas comenta que a revogação deve ocorrer depois.

Conclusão de rollout:

- A migration 050 atual é segura como etapa **expand** aditiva.
- O runtime corrigido roda antes e depois da coluna: usa UUID quando disponível, snapshot textual validado no schema 049 e fallback de escrita somente quando o PostgREST identifica especificamente a coluna ausente.
- O fechamento **contract** precisa de migration posterior específica (recomendação: 051) para remover `cartas_public_read`, somente após runtime novo em Produção.
- Portanto, uma única migration não conclui a confidencialidade RLS; o rollout deve permanecer dividido em expand → runtime → contract.

## 3. Banco remoto e migrations — somente leitura

- `cartas_contempladas`: 4 registros.
- Administradora textual normalizada: somente `racon` (4/4).
- Status: `consultar_disponibilidade` (4/4).
- Racon global: exatamente uma, UUID `c5f8ecb4-cb5a-5014-b567-50484719b404`, slug `racon`, status `ATIVA`.
- Gauchinho (`7170f38e-15dd-4b19-8588-51e9a9cf0d4c`) → Racon: concessão `ATIVA`.
- `administradora_id` continua ausente no remoto, coerente com a 050 não aplicada.
- Policy remota de cartas continua `cartas_public_read`, para `anon, authenticated`, com `ativo = true` e status público.
- `supabase migration list --linked`: 001–049 local=remote; 050 somente local.
- `supabase db push --linked --dry-run`: enviaria somente `050_fase4_cartas_administradora_confidencialidade.sql`.
- Nenhum `db push`, `migration repair` ou alteração remota foi executado.

## 4. Runtime e testes

Superfícies tenant-scoped:

- `/cartas-contempladas`;
- cards de cartas na home;
- `/api/public/cartas/interesse`;
- reader legado `fetchPublicCartas`, agora redirecionado ao escopo resolvido por Host;
- admin create/update com validação server-side de administradora global e dual-write compatível.

Garantias testadas:

- Gauchinho + Racon `ATIVA/ATIVA`: permitido;
- Empresa B sem concessão: lista vazia e UUID Racon não resolvido;
- concessão `INATIVA` ou `SUSPENSA`: negada;
- administradora global `INATIVA`: negada;
- UUID inexistente e não autorizado: ausência uniforme;
- headers/query de tenant não substituem a autoridade do Host;
- texto arbitrário ou UUID/texto conflitantes no admin: rejeitados;
- schema pré-050: snapshot textual validado e fallback de escrita sem a coluna;
- schema pós-050: UUID estrutural + snapshot canônico.

Resultados finais locais:

- `npm test`: **601/601**, 106 arquivos, 0 falhas.
- `npm run build`: exit 0, TypeScript aprovado, 105/105 páginas geradas.

## 5. Preview Vercel homologado

- Git SHA do runtime: `a416e85855045ae89f84cf7661a3e17ce56a812a`.
- Deployment ID: `dpl_HHrjVRgfYwhNhB3Jveofd6e2i6A6`.
- URL: `https://guachinho-site-qz550bgb2-hugo-8097s-projects.vercel.app`.
- Target: Preview.
- Estado: `READY`.
- `/cartas-contempladas`: HTTP 200 e 4 cartas Racon renderizadas com o schema remoto 049.
- API autorizada com carta Racon: `{ ok: true }`; lead/eventos de homologação removidos e verificados com 0 registros remanescentes.
- UUID inexistente: `Carta indisponível`.
- Query/header forjados: mesma resposta pública; não alteraram autoridade do Host.
- Empresa B e estados de concessão/global foram homologados por testes determinísticos, pois Empresa B permanece não publicada e não possui Host público de Preview.
- Admin dual-write foi homologado por testes/mocks, sem alterar carta comercial real.

Produção permaneceu intacta:

- `gauchinhoconsorcios.com.br` e `www.gauchinhoconsorcios.com.br` continuam no deployment Production `dpl_vN3frMLHq6EZnGEDch755wVb827w` (`READY`).
- O Preview não recebeu aliases oficiais.
- Nenhum DNS, alias, env Production ou deploy Production foi alterado.

## 6. Policy de sorteios

Policy: `grupos_sorteios_loteria_public_read`, tabela `public.grupos_sorteios_loteria`, `SELECT` para `anon, authenticated`, expressão `using (true)`.

Auditoria remota: 14 linhas. Colunas públicas reais:

`id`, `grupo_id`, `periodo_ref`, `ano`, `mes`, `primeiro_premio`, `quantidade_cotas`, `palavra_chave`, `data_sorteio`, `fonte_resultado`, `resultado_buscado_automaticamente`, `observacao`, `criado_por_usuario_id`, `criado_por_nome`, `criado_por_email`, `created_at`, `updated_at`.

- Para inferência do catálogo comercial, o risco continua **baixo** após a Migration 049: `grupo_id` não permite SELECT anônimo do cadastro comercial de grupos/cotas/modalidades.
- Divergência documental: não é correto dizer que a policy expõe “somente concurso/dezenas”; `criado_por_nome` e `criado_por_email` estão preenchidos em 14/14 linhas.
- Isso constitui risco separado de privacidade/metadados autorais e deve ser saneado em hardening futuro com projeção pública mínima ou policy/RPC dedicada.
- A policy não foi alterada nesta rodada.

## 7. Estado canônico e ordem segura recomendada

**PREVIEW 050 APROVADO para o runtime**, com a ressalva estrutural de que a confidencialidade RLS direta ainda não está concluída.

Ordem segura:

1. autorizar e aplicar a Migration 050 apenas como **expand** (FK nullable + índice + backfill/asserts), mantendo `cartas_public_read`;
2. validar banco pós-050 sem perda e manter Produção atual operacional;
3. deployar o runtime `a416e85` ou sucessor em Produção;
4. homologar página/API/admin em Produção;
5. criar, revisar e aplicar uma migration **contract** posterior (recomendação: 051) removendo `cartas_public_read`;
6. repetir smokes e confirmar bloqueio anon direto.

Até nova autorização: Migration 050 **NÃO aplicada**; E7 e Fase 5 **NÃO iniciadas**.
