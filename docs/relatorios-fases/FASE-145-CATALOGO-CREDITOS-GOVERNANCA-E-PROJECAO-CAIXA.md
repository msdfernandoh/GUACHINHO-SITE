# Fase 145 — Catálogo de créditos, governança local e projeção de caixa

Data: 26/08/2026

## Resultado

O catálogo compartilhado passou a tratar `grupos_cotas` como lista de **créditos comerciais**, sem exigir ou editar parcelas prontas. O site continua sendo o único motor do cálculo comercial e a proposta aceita mantém snapshot assinado e imutável para o ERP.

## Entregas

- categorias N:N (`grupos_categorias`) permitem publicar o mesmo grupo em Automóvel e Moto sem duplicação;
- créditos ficam dentro do grupo; a entrada “Produtos comerciais” foi retirada do menu;
- zero vagas não despublica: a UI mostra “Aguardando novas vagas”;
- a franquia pode reduzir localmente Integral, Reduzida e Personalizada, nunca ampliar o catálogo oficial;
- edição estrutural no ERP cria alteração candidata local e solicitação de homologação;
- a Platform possui fila para aprovar, devolver ou rejeitar a solicitação e publicar para a rede;
- grupo ausente na importação legada recebe cadastro básico com `status='Inativo'`, invisível ao site, mas utilizável pela carteira histórica;
- importação seleciona preferencialmente regra Reduzida 60%, permite troca e gera somente etapas futuras pelo valor contratado;
- projeção de caixa de 12 meses usa comissões líquidas previstas e contas abertas da empresa;
- conciliação e sincronização bancária permanecem deliberadamente fora do escopo;
- contratos Platform historicamente quebrados foram saneados sem remover dados.

## Banco de dados

Migrations aplicadas no Supabase principal: `139` a `144`.

Objetos principais: `catalogo_grupo_categorias`, `grupos_categorias`, `catalogo_grupo_solicitacoes`, `empresa_quotas`, RPCs `rpc_configurar_grupo_franquia`, `rpc_submeter_alteracao_grupo_franquia`, `rpc_platform_decidir_solicitacao_grupo`, `rpc_projetar_caixa` e `rpc_preparar_catalogo_importacao_legado_racon`.

## Segurança e invariantes

- autorização tenant deriva de `empresa_usuarios` e `can_read/can_write_tenant_internal`;
- homologação global exige `is_platform_superadmin()`;
- payload local usa lista positiva de campos e não aceita IDs ou governança injetados;
- grupo básico legado fica inativo comercialmente;
- nenhuma migration apaga fatos, previsões, vendas ou clientes;
- projeção de caixa é somente leitura e não altera o livro razão append-only.

## Validação

- `npm run lint:errors`: aprovado;
- `vitest`: 189 arquivos aprovados, 9 ignorados; 1.039 testes aprovados, 37 ignorados;
- `next build`: aprovado, 148 páginas;
- `supabase db lint --linked --level error`: zero erros;
- migrations `001–144` alinhadas no Supabase principal.
- código funcional publicado em `main@4a3d3ee` e deployment `dpl_GRV1UgjBzLvwg4j3AZZgMcm1FjcW` em estado `READY`.

## Itens externos intencionalmente não implantados

- API das administradoras: aguarda contrato e credenciais;
- conciliação/importação/sincronização bancária: excluída por decisão do produto.
