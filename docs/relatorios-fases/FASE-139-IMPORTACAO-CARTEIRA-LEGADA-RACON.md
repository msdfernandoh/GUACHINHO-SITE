# Fase 139 — Importação auditável da carteira legada Racon

Data: 26/08/2026  
Migrations: `136_importacao_clientes_legado_racon.sql` e `137_importacao_legado_alias_numerico_grupo.sql`

## Escopo entregue

- Tela autenticada em `/erp/clientes/importar`, protegida pela autorização canônica de Clientes.
- Leitura de `.xlsx` no navegador, sem upload permanente do arquivo.
- Prévia obrigatória, diagnóstico por linha e confirmação idempotente.
- CPF/CNPJ e telefone ausentes ou inválidos não bloqueiam: geram `PENDENTE_CPF_CNPJ` e/ou `PENDENTE_TELEFONE`.
- Grupo/cota duplicado, grupo inexistente, data, nome ou valor inválido bloqueiam o lote.
- Escolha de regra histórica Racon e beneficiário direto, ou importação sem comissão.
- Cronograma pela data do contrato: parcela 1 no contrato; até o dia 10, parcela 2 no mês seguinte; após o dia 10, no segundo mês seguinte; demais parcelas no dia 10.
- Somente etapas iguais ou posteriores à data de referência são geradas.
- Imposto vigente na data futura é congelado no snapshot.
- Cota/venda entram na carteira canônica, mas `afeta_faturamento=false` as exclui do faturamento, metas e indicadores comerciais.
- Lotes e itens possuem auditoria, idempotência e RLS por `empresa_id`.

## Planilha validada

Arquivo local preservado e não versionado: `analise/clientes_legado.xlsx`.

- 157 linhas;
- 138 registros `RACON` e 19 `Racon`, normalizados;
- 62 linhas sem documento e 2 sem telefone, aceitas com pendência;
- nenhum grupo ou cota vazio;
- nenhuma duplicidade de grupo/cota no arquivo.

O arquivo usa códigos numéricos (`1403`) e o catálogo usa descrições (`1403 IMÓVEL`). A migration 137 resolve pelo número sem renomear ou duplicar o catálogo. Dos 27 grupos distintos, 14 possuem correspondência canônica ativa com produto; 13 permanecem bloqueados até cadastro/concessão correta: `1173`, `1233`, `1403`, `1253`, `1270`, `1283`, `1001`, `1293`, `1413`, `1011`, `1041`, `1203` e `1061`.

## Segurança e evidências

- Nenhum cliente foi importado nesta fase; `lotes_importados=0` após a implantação.
- A RPC exige `can_write_tenant_internal`, revalida administradora, concessão, grupo, regra e participante.
- Empresa + grupo + cota impede reimportação cruzada entre lotes.
- O valor contratado é preservado; o saldo de parcelas usa a posição atual do grupo.
- Não há previsão da franqueadora nem entrada de caixa; a previsão futura é direta ao participante/sócio.
- Supabase principal alinhado de `001–137`; smoke remoto do schema aprovado.
- 12 regras Racon e 9 participantes ativos disponíveis para seleção.
- ESLint: 0 erros e baseline de 353 avisos.
- Vitest: 187 arquivos/1.033 testes aprovados; 9 arquivos/37 testes live ignorados.
- Build Next.js: 147 rotas, incluindo `/erp/clientes/importar`.

## Próxima operação

Cadastrar/conceder os 13 grupos ausentes no catálogo. Depois, separar a planilha por regra histórica/modalidade, executar a prévia e confirmar cada lote. Clientes contemplados devem usar “Importar sem comissão”; a contemplação será registrada depois na cota.
