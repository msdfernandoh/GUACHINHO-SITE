# Projeto — Tour guiado do SaaS e ERP

**Estado:** especificação para implementação

**Piloto:** Racon Sorriso (`sorriso`)

**Data:** 26/09/2026

## 1. Objetivo e medida de sucesso

Permitir que uma pessoa conheça o fluxo real do produto em poucos minutos, sem precisar receber treinamento oral nem alterar dados para entender o sistema. O tour apresenta **onde encontrar**, **para que serve** e **qual é o próximo passo** em cada área. Na Racon Sorriso, usa apenas registros marcados `[DEMO]`.

Uma sessão inicial deve caber em **4 minutos e até 10 etapas**. O conteúdo dos demais menus fica acessível sob demanda por um botão **Ajuda desta página**; a cobertura completa não transforma o primeiro acesso em uma sequência longa de telas.

**Aceite de produto:** uma pessoa com acesso administrativo à Sorriso encontra clientes, funil, propostas, vendas, comissões e contas a pagar sem assistência; identifica os dados fictícios e entende que uma previsão de comissão não é pagamento recebido.

## 2. Público e alcance

| Público | Experiência prevista | Entrada |
| --- | --- | --- |
| Administrador da master | Tour comercial e ERP completo, filtrado pelo plano e papel | `/admin` → `/erp` |
| Gestor, consultor ou visualizador | Somente etapas e páginas autorizadas | Portal ou ERP, conforme vínculo |
| Superadministrador SaaS | Tour separado de governança, empresas, planos e concessões | `/platform` |
| Revisor técnico | Orientação curta de leitura na revisão técnica, sem ações de edição | `/platform/revisao` |
| Parceiro e indicador | Trilhas próprias quando as respectivas áreas forem incluídas | `/area-parceiro`, `/app-indicador` |

**Lançamento:** piloto no tenant Sorriso, depois extensão para outras masters. O componente e o catálogo de conteúdo serão reutilizáveis e não conterão nomes, IDs ou cores fixos da Sorriso. Site público, simulador e contratação pública ficam fora do piloto; recebem projeto próprio de ajuda contextual se houver demanda.

## 3. Percurso principal do piloto

| Etapa | Âncora/rota | Mensagem objetiva | Exemplo mostrado |
| --- | --- | --- | --- |
| 1. Boas-vindas | `/admin` | Portal e ERP são áreas da mesma master; os dados `[DEMO]` são fictícios. | Aviso de demonstração |
| 2. Visão geral | Dashboard admin | Indicadores resumem o comercial da empresa ativa. | 5 leads de exemplo |
| 3. Funil | `/admin/crm/pipeline` | Cada oportunidade passa por etapas; filtros e busca ajudam a encontrá-la. | Lead `[DEMO]` |
| 4. Propostas | `/admin/propostas` ou `/erp/propostas` | A proposta registra crédito, prazo e situação; um rascunho não é contrato. | Proposta `[DEMO]` |
| 5. Entrada no ERP | Botão `ERP Sistema` | O ERP reúne operação, carteira e financeiro conforme o plano. | Menu ERP |
| 6. Clientes | `/erp/clientes` | A carteira contém clientes da master ativa; abra um cadastro de exemplo. | Cliente `[DEMO]` |
| 7. Vendas e cotas | `/erp/vendas` | Venda e cota formalizada têm estados próprios; a amostra não compõe faturamento real. | Venda fictícia |
| 8. Comissões | `/erp/comissoes` | Diferenciar valor previsto, recebido, liquidado e repassado. | Previsão fictícia de R$ 1.200 |
| 9. Contas a pagar | `/erp/contas-pagar` | Baixa de uma despesa gera movimento no caixa; os três pagamentos da amostra são simulados. | Contas `[DEMO]` |
| 10. Encerramento | ERP | Mostrar onde reiniciar o tour e abrir ajuda contextual. | Botões Ajuda e Reiniciar |

O roteiro é **descritivo**: não clica em botões de salvar, baixar, contratar, enviar PDF, estornar ou repassar. Se uma etapa não for autorizada ou sua âncora não existir, ela é omitida e a numeração se ajusta. A etapa inicial e o encerramento sempre permanecem acessíveis.

## 4. Cobertura integral por catálogo contextual

O catálogo é indexado por **ID estável do menu**, rota, público, permissão, título, frase de função, exemplo e alerta quando houver impacto financeiro ou envio externo. A matriz abaixo deve ser usada como checklist de conteúdo; cada item visível precisa ter uma ficha de ajuda e cada ficha deve apontar para uma rota real. Menus ocultos por plano ou papel nunca aparecem no tour.

| Área | Menus a cobrir com ajuda contextual |
| --- | --- |
| Portal administrativo — comercial | Dashboard; CRM — Vendas; Pipeline Funil; Lista de Leads; Meus contatos; Performance CRM; Materiais & Scripts; Agenda; Disponibilidade; Eventos; Dashboard NPS; Listas convidados; Relatórios; Propostas; Contratações |
| Portal administrativo — catálogo e gestão | Catálogo de grupos; Cartas Contempladas; Imobiliárias; Seguradoras; Imóveis; Conteúdo; Usuários; Índices financeiros; Configurações; QR Codes únicos; atalhos SaaS de empresa e administradoras quando exibidos |
| ERP — módulos base | Painel; Leads / CRM; Propostas; Contratações; Vendas e Cotas; Grupos; Comissões; Financeiro e Caixa; Relatórios; Metas; Tarefas; Usuários |
| ERP — operação | Clientes e carteira; Consultores; Lances e estratégias; Assembleias / Pedras; Regras de comissão; Repasse da franquia; Minhas comissões; Contas a pagar; Conta-corrente sócios |
| Plataforma SaaS | Dashboard; Master Franquias; Revisão técnica; Acesso de revisão; Usuários / Responsáveis; Domínios; Administradoras; Grupos e créditos; Sites / Portais; Modelos de Site; Catálogo de módulos; Liberações e overrides; Planos; Assinaturas SaaS; Auditoria; Configurações |
| Área do parceiro | Painel; Leads; Propostas, quando liberados para o parceiro |
| App do indicador | Painel; Indicar; Comissões; Lista de convidados do evento, conforme acesso |
| Site público | Home, grupos, simulador, conteúdo, parceiros e contratação, somente quando presentes no modelo e nos menus publicados do tenant |

As fichas de **Plataforma**, **Parceiro**, **Indicador** e **Site público** serão publicadas em trilhas próprias após o piloto da master, sem copiar textos do tour administrativo. O catálogo deve sinalizar itens sem página utilizável ou indisponíveis por configuração, para não induzir navegação quebrada.

## 5. Experiência de uso

- Entrada discreta: botão **Conhecer o sistema** no portal e no ERP; convite opcional apenas no primeiro acesso após habilitação, sem bloquear trabalho.
- Cartão curto com título, até duas frases, contador de etapas, **Voltar**, **Próximo**, **Pular** e **Encerrar**. Sem setas piscando nem animações obrigatórias.
- **Ajuda desta página** abre a ficha do menu atual; busca por assunto oferece acesso às demais fichas autorizadas. **Reiniciar tour** permanece disponível.
- Âncora visual no elemento real. Em celular, o menu é aberto antes de posicionar a âncora; se o elemento não existir, usar destaque na página e texto de fallback.
- Pausa ao sair da rota; ao voltar, oferecer **Continuar de onde parou**. Nunca reabrir automaticamente após o usuário encerrar.
- Antes de mostrar dados de exemplo, selo visível **Demonstração — dados fictícios**. O saldo negativo da amostra financeira deve ser explicado como três saídas simuladas sem entrada simulada.
- Conteúdo em português claro, sem prometer uma função que a página ou o perfil não oferece. Identidade visual vem do tenant ativo.

## 6. Desenho técnico e limites de acesso

1. Montar o percurso no servidor a partir de `empresa_id` do host, vínculo ativo em `empresa_usuarios`, papel, permissões canônicas, plano e `allowedAccess` do ERP. A lista enviada ao navegador contém apenas etapas já autorizadas. O parâmetro de URL ou estado local não pode escolher outro tenant.
2. Manter fichas versionadas em código por `tourId`/`stepId` e `menuId`; adicionar `data-tour-id` estável a âncoras dos sidebars e blocos principais. Não depender de texto da interface, posição DOM ou classes CSS.
3. Persistir progresso por **usuário + escopo + tour + versão** no banco, com RLS de leitura e escrita do próprio usuário. Escopo de master usa `empresa_id`; a trilha global da Plataforma usa um escopo global explícito, sem inventar vínculo com empresa. Concluir, pular e reiniciar são estados distintos. Não usar apenas `localStorage`, pois o usuário pode trocar de dispositivo.
4. Revalidar a autorização a cada navegação. Se plano, papel, vínculo ou menu mudar, reconstruir o roteiro; nunca exibir conteúdo de outra empresa nem deixar um link de tour contornar `requireErpRouteAccess` ou guardas equivalentes.
5. Os IDs de registros `[DEMO]` são apenas exemplos opcionais. Se forem removidos, a etapa mostra a explicação genérica. Não criar, editar nem consultar clientes reais para completar o tour.
6. Telemetria mínima: abertura, avanço, pulo, conclusão, falha de âncora e versão; somente IDs técnicos de etapa e tenant. Sem nome, e-mail, telefone, CPF, texto de proposta ou valores de clientes.

## 7. Entregas e ordem de execução

| Fase | Entrega verificável | Condição para avançar |
| --- | --- | --- |
| 0. Inventário | Catálogo de menus/rotas e matriz de papel, plano e tenant revisados contra a navegação renderizada | Nenhum menu visível sem ficha; nenhuma ficha aponta para rota inexistente |
| 1. Base | Componente acessível, âncoras estáveis, progresso versionado e autorização no servidor | Retomar, pular, reiniciar e troca de tenant testados |
| 2. Piloto Sorriso | 10 etapas do percurso, fichas contextuais de Admin e ERP, aviso `[DEMO]` | Homologação no desktop e celular com Fernando e um perfil limitado |
| 3. Cobertura SaaS | Trilhas separadas de Plataforma, revisor, parceiro e indicador | Cada público vê apenas seus próprios menus |
| 4. Operação | Métricas de uso, revisão editorial e rotina para atualização de fichas quando surgirem menus | Checklist incorporado ao processo de release |

## 8. Critérios de aceite e testes necessários

- **Cobertura:** comparação automatizada entre IDs dos menus renderizáveis e catálogo; falha de CI se surgir menu sem ficha ou ficha órfã. A cobertura é por menu autorizado, não por todas as páginas internas.
- **Permissões:** testar `admin_empresa`, gestor, consultor, visualizador, revisor técnico e parceiro; plano completo, plano parcial, módulo desligado e lista explícita vazia. Uma etapa nunca deve revelar nem abrir menu negado.
- **Isolamento:** alternar Gauchinho e Sorriso com o mesmo usuário; progresso e exemplos permanecem separados por `empresa_id`. A Sorriso não pode mostrar clientes ou valores da Gauchinho.
- **Fluxo:** iniciar, voltar, avançar, pular, encerrar, retomar após recarga, reiniciar após conclusão e alterar versão do tour.
- **Resiliência:** âncora ausente, página lenta, erro de carregamento, janela estreita, menu recolhido e remoção dos dados `[DEMO]` não travam a navegação.
- **Acessibilidade:** teclado, foco visível, Escape, leitor de tela, contraste, zoom de 200% e preferência por movimento reduzido. A rolagem até a âncora não deve roubar o foco sem aviso.
- **Segurança de operação:** durante o tour, nenhum e-mail, WhatsApp, PDF, contrato, baixa, repasse ou estorno é disparado. O tour não amplia permissões.
- **Homologação editorial:** cada texto descreve a página publicada e responde em linguagem simples “o que vejo aqui?” e “o que faço depois?”.

## 9. Fora do projeto de implementação inicial

Vídeo obrigatório, assistente que executa ações pelo usuário, criação automática de dados em produção, alterações em contratos e mensagens externas. O guia pode futuramente apontar para vídeos ou documentação, mas a experiência principal funciona sem eles.
