# Fase 212 — visibilidade do parceiro, modelo, domínio e ERP

## Diagnóstico

A conversão da Racon Sinop foi persistida corretamente, porém a tela da Master
Gauchinho consultava `organizacoes_parceiras.nome`, coluna inexistente. O erro
era silencenciado e toda a coleção aparecia vazia, fazendo os indicadores
mostrarem zero parceiros e zero domínios próprios.

O site parceiro estava vinculado ao modelo publicado **Racon Inspired**, mas a
interface usava como fallback o modelo da Master (**Gauchinho Default**). O
domínio parceiro também não participava da aba geral de domínios.

O único responsável da antiga Master foi convertido com papel
`parceiro_comercial` e lista vazia de módulos. Esse papel é propositalmente
restrito à área comercial e não preservava o acesso administrativo que o usuário
possuía antes da conversão.

## Correções

- A consulta usa `nome_fantasia`, falha explicitamente se o carregamento quebrar
  e inclui o modelo e os domínios do site parceiro.
- A tela apresenta **Racon Inspired**, o domínio `raconsinop.com.br`, o parceiro
  Racon Sinop e contabiliza o domínio próprio nos indicadores.
- A aba Domínios distingue registros da Master e de parceiros.
- Na conversão assistida específica, o responsável original recebe o papel
  `admin_empresa` no ERP compartilhado da Gauchinho e herda todos os módulos
  habilitados no tenant (`erp_modulos_visiveis = NULL`).
- A comparação com Racon Sorriso confirmou que ambos usam o mesmo modelo ativo
  **Racon Inspired v2**. A diferença estava no renderer reduzido do parceiro.
  O carregador agora lê do modelo publicado o catálogo de menus, as seções, o
  logotipo padrão e o rodapé, entregando a experiência completa também ao site
  convertido.
- Rotas públicas do modelo (`/simulador`, `/grupos`, `/consorcio`, `/indicar`,
  `/area-parceiro` e `/login`) preservam a identidade e atribuição do parceiro,
  mas utilizam os dados operacionais da Master anfitriã.

## Segurança

A promoção administrativa é limitada pelos IDs auditados da origem, destino e
usuário, exige a conversão registrada e confirma que o usuário era o responsável
principal da antiga Master. A operação fica registrada em auditoria.
