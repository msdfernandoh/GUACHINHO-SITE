# Fase 143 — Fluxo da contratação, administração do site e permissões

| Metadado | Valor |
|---|---|
| Data | 26/08/2026 |
| Escopo | Cálculo no site, formalização ERP, edição de grupos e autorizações |
| Status | Auditoria e decisão recomendada; nenhuma alteração runtime/SQL |

## 1. Regra de negócio confirmada

O fluxo desejado é:

```text
Site calcula e gera a contratação
  → servidor valida e congela o cálculo
  → cliente conclui/assina
  → ERP confere grupo e produto
  → ERP informa a cota real e confirma consultores/perfis
  → ERP converte em venda, cota definitiva e comissões
```

O ERP não deve recalcular nem substituir arbitrariamente a parcela apresentada e
contratada no site. Ele deve conferir a integridade do snapshot comercial e
completar os dados que somente existem na operação real.

## 2. Estado atual encontrado

O começo do fluxo está correto:

- `/grupos` calcula crédito, saldo, parcela, seguro, lance e prazo no navegador;
- o resultado e os UUIDs do grupo/produto entram em `dados_simulacao`;
- o servidor valida se grupo e produto pertencem ao catálogo concedido ao tenant;
- a proposta e a contratação preservam o snapshot recebido;
- o ERP exige permissão `formalizar_vendas`, contrato assinado, documentos e
  cliente completo;
- a conversão cria venda e cota definitiva.

Há duas divergências importantes:

1. Na criação da proposta, o servidor confere os UUIDs, mas não recalcula e não
   compara todos os valores financeiros recebidos do navegador. Um navegador
   adulterado pode tentar enviar um resultado diferente do exibido.
2. Na formalização, `rpc_preparar_formalizacao_contratacao` exige um valor em
   `grupo_cota_modalidade_valores` e sobrescreve `dados_simulacao.valor_parcela`
   com esse valor. Portanto, hoje o ERP ainda substitui o cálculo do site e pode
   bloquear a venda com “Modalidade sem valor homologado”.

Esse comportamento não corresponde ao requisito confirmado e explica por que a
estrutura N:N incompleta representa risco operacional.

## 3. Correção recomendada do fluxo financeiro

1. O site calcula para experiência imediata usando o motor compartilhado.
2. Ao criar a proposta, o servidor recebe apenas entradas e UUIDs confiáveis,
   busca novamente grupo/produto e recalcula com o mesmo motor.
3. O servidor gera `snapshot_calculo` contendo:
   - versão do catálogo;
   - versão da fórmula;
   - UUIDs de grupo e produto;
   - modalidade de parcela;
   - entradas oficiais;
   - resultado financeiro;
   - data/hora e hash de integridade.
4. O contrato assinado referencia esse snapshot imutável.
5. O ERP valida o hash/versão e não troca o valor da parcela.
6. O ERP informa número da cota real, consultor principal/secundário, perfis de
   comissão e datas operacionais.
7. Se houver divergência entre catálogo atual e contrato, o sistema mantém o
   snapshot assinado e abre uma pendência explícita; não altera silenciosamente.

## 4. Decisão sobre o Admin do site

Recomendação: **remover para usuários da franquia qualquer editor estrutural de
grupo, cota, taxa ou regra**.

O Admin do site pode configurar somente:

- grupo visível ou oculto no próprio site;
- destaque e ordem;
- título e descrição comercial local;
- subconjunto das modalidades oficiais a exibir: Integral, Reduzida e
  Personalizada, sem mudar percentuais ou fórmula;
- botão “Solicitar correção ao SaaS”, que cria proposta auditada.

Não pode alterar:

- taxa administrativa, fundo, seguro ou prazo;
- créditos/produtos globais;
- percentual, mínimo/máximo ou fórmula das modalidades;
- capacidade, assembleias ou regras globais;
- comissão ou estratégia oficial da administradora.

Atualmente, a página já restringe o formulário estrutural a Superadmin e as
actions usam `assertCanManageGrupos`. Porém `GrupoCotasAdmin` ainda é renderizado
para usuário não-Superadmin, embora a gravação seja negada no servidor. O editor
deve ser ocultado/substituído por leitura simples para não criar falsa autonomia.

## 5. Matriz de capacidades recomendada

| Capacidade | Platform | Admin franquia | Gestor vendas | Consultor/SDR | Visualizador |
|---|---:|---:|---:|---:|---:|
| Ver catálogo concedido | Sim | Sim | Sim | Sim | Sim, se autorizado |
| Configurar apresentação do site | Não aplicável | Sim | Opcional | Não | Não |
| Solicitar alteração de catálogo | Sim | Sim | Opcional | Não | Não |
| Homologar/publicar global | Sim | Não | Não | Não | Não |
| Criar proposta/contratação | Opcional | Opcional | Sim | Sim | Não |
| Conferir contratação | Opcional | Sim, se concedido | Sim | Limitado às próprias | Não |
| Definir cota real | Opcional | Com permissão | Com permissão | Não | Não |
| Definir consultores/perfis | Opcional | Com permissão | Com permissão | Não | Não |
| Formalizar venda e comissão | Opcional | Com permissão | Com permissão | Não | Não |

Capacidades técnicas a separar:

- `catalogo_visualizar`;
- `catalogo_site_configurar`;
- `catalogo_solicitar_alteracao`;
- `catalogo_homologar` e `catalogo_publicar` — somente Platform;
- `propostas_criar` e `propostas_gerenciar`;
- `contratacoes_conferir`;
- `contratacoes_atribuir_cota_real`;
- `contratacoes_definir_participantes`;
- `formalizar_vendas`;
- `comissoes_visualizar_proprias` e `comissoes_visualizar_empresa`.

## 6. Regras obrigatórias de autorização

1. Um único usuário/identidade deve servir site administrativo e ERP.
2. O acesso vem de `empresa_usuarios(empresa_id, usuario_id, papel_id)`, nunca de
   `usuarios.company_id` isolado.
3. O módulo precisa estar liberado no plano/override da empresa.
4. O papel precisa possuir a capacidade específica.
5. A associação, empresa e usuário precisam estar ativos.
6. O escopo de dados deve limitar tenant, equipe, próprios registros ou todos.
7. Menu oculto não é segurança: página, server action, RPC e RLS precisam repetir
   a autorização.
8. O padrão deve ser negar; Superadmin não deve depender do tenant ativo.
9. Alterações de papel, permissões, aprovações e formalizações devem gerar
   auditoria append-only.
10. Aprovação global e solicitação local devem ser capacidades diferentes, sem
    um único `gerenciar_grupos` abrangente.

## 7. Critérios de aceite da futura correção

- parcela exibida, contratada e formalizada permanece idêntica;
- adulteração do payload do navegador é rejeitada pelo recálculo servidor;
- ERP não depende de valor final duplicado por modalidade/produto;
- contrato preserva catálogo e fórmula usados na data da contratação;
- usuário do site não vê editor que não pode utilizar;
- usuário sem capacidade recebe 403 mesmo acessando URL/action diretamente;
- consultor não altera participantes, perfis ou comissão;
- gestor só atua na empresa e no escopo concedidos;
- somente Platform homologa e publica regra global;
- toda mudança relevante possui autor, empresa, versão e data.

## 8. Evidências

- `GruposPublicClient` e `simulacao-linha.ts`;
- `/api/public/contratacoes/iniciar` e `proposta-flow.ts`;
- `formalizarContratacaoAction`;
- `rpc_preparar_formalizacao_contratacao` na migration 126;
- `/admin/grupos/[id]`, `GrupoEmpresaConfigSection` e actions de grupos;
- nenhuma alteração de banco ou comportamento foi executada.
