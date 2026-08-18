# Relatório de Fase — Platform Administradoras V2

## Estado canônico

- Base: `origin/main@2b9d1c65e1abf255135fb236f5f33942b1fa12bd`.
- Branch: `codex/platform-administradoras-v2`.
- Migration: `083_platform_administradoras_hub_catalogo.sql`.
- Production: migrations `001–082`; nenhuma aplicação da 083.
- Supabase isolado: `npcdbkgnibootdixbpwq`, branch `codex-platform-administradoras-v2-083`.
- Backfill: não executado.

## Implementação

`/platform/administradoras` tornou-se a raiz do catálogo global de cada Administradora:

- lista dedicada, criação e Dados gerais;
- Tipos com edição, ativação/inativação, duplicidade lógica e exclusão segura;
- Modalidades com edição, ativação/inativação e relacionamento N:N com Tipos;
- Curvas múltiplas e versionadas, editor estruturado de faixas, vigência, status e escopos N:N de Tipos/Modalidades;
- Modelos/Tabelas Master por Tipo e percentual de referência, com distribuição por Modalidade e referência às regras canônicas existentes;
- Programas da Franqueadora em rotas Platform-native, com Tipo, Modalidade, comissão, vigência, Curva opcional, cronograma, versão, status e ações governadas;
- Grupos internos da Administradora com Tipo, Modalidades, Produtos, status, prontidão, origem e acesso ao editor canônico do Grupo;
- histórico restrito à Administradora e às entidades relacionadas;
- prontidão separada entre catálogo-base e Grupos pendentes.

O Modelo Master não calcula comissão. A matemática permanece em `comissao_programas`, `comissao_regras_franquia` e `comissao_regra_etapas`; a 083 adiciona somente governança/referências e a Curva opcional da regra.

## Segurança e preservação

- RPCs de mutação exigem `is_platform_superadmin()`.
- Novas tabelas usam RLS com policies explícitas de `SELECT`, `INSERT`, `UPDATE` e `DELETE`; não foi criada policy genérica `FOR ALL` para elas.
- Deleções consultam Grupos, Produtos, regras, vínculos, previsões e snapshots de Venda.
- Curva, Modelo ou Programa homologado/usado evolui por inativação ou nova versão.
- Migrations 001–082 não foram alteradas.
- Nenhuma Venda, Cota, previsão, comissão, pagamento ou snapshot histórico é recalculado pela 083.

## Gates locais

| Gate | Resultado |
|---|---|
| TypeScript (`npx tsc --noEmit`) | PASSOU |
| Testes focados | 12/12 PASSARAM |
| Suíte completa | 756 passaram; 37 skipped; 0 falhas |
| Lint do escopo | PASSOU |
| Build Next.js | PASSOU; 134 páginas geradas |
| `npm audit --omit=dev` | 0 vulnerabilidades |
| `git diff --check` | PASSOU |

## Homologação Supabase e E2E

O primeiro provisionamento isolado foi criado com clone de dados. O estado final da aplicação, do histórico remoto 001–083 e dos cenários E2E será registrado nesta seção após o pipeline oficial concluir.

Casos obrigatórios:

- Administradora teste: criar, recarregar, editar, inativar e excluir sem dependências;
- Tipo e Modalidade: persistência, N:N e deleção permitida/bloqueada conforme uso;
- Curva: escopos N:N, múltiplas versões, exclusão sem uso e bloqueio após vínculo;
- Programa: detalhe Platform-native, Curva opcional, homologação, nova versão e exclusão segura;
- Racon: somente Imóvel e Automóveis ativos; modalidades Integral, Reduzida 60% a 99% e Reduzida abaixo de 59%; Modelos Master 4% e 3,5%; Programas e Curvas existentes visíveis.

## Preview e evidências visuais

O Preview deverá usar exclusivamente as variáveis do Supabase isolado `npcdbkgnibootdixbpwq`. Nenhuma URL de Preview será promovida para Production nesta fase.

## Parada

Esta entrega deve parar após Preview, screenshots e consolidação das evidências. Não estão autorizados merge em `main`, migration 083 no Supabase principal, deploy Vercel Production, backfill ou exclusão de dados reais.

