# Manual operacional — Configuração de comissões

Este roteiro usa os nomes reais da interface. O catálogo oficial começa na Platform e o ERP da empresa apenas o consome.

1. Acesse **Platform → Administradoras** e clique em **Gerenciar** na Administradora.
2. Na aba **Tipos**, clique em **Novo Tipo**, informe somente o nome e salve. O sistema gera o código técnico. Para a Racon, mantenha apenas **Imóvel** e **Automóveis** ativos.
3. Na aba **Modalidades**, cadastre **Integral**, **Reduzida 60% a 99%** e **Reduzida abaixo de 59%**.
4. Na aba **Curvas de Estorno**, informe nome, início da vigência e adicione cada linha de Mês/Percentual. Edite somente rascunhos; para uma curva vigente use **Nova versão**.
5. Na aba **Programas da Franqueadora**, crie o Programa vinculado à Administradora. Cadastre a regra selecionando Tipo, Modalidade, vigência, comissão total e cronograma.
6. Revise a regra e use **Homologar** com usuário Platform Superadmin. Regra não homologada não entra no motor.
7. Acesse **Platform → Grupos**. Use **Novo Grupo Global** para catálogo oficial ou **Editar configuração** nos legados. Todo Grupo pronto para venda precisa de Administradora, Tipo e Modalidade.
8. Na empresa, acesse **ERP → Regras de Comissão**. Cadastre uma nova vigência fiscal e confira o card **Configuração fiscal vigente** após recarregar.
9. Ainda no ERP, crie a regra do participante. Em **Automática**, informe participante/papel e percentual; o cronograma da Franqueadora é herdado. Em **Manual**, preencha o cronograma próprio de 100%.
10. Antes de vender, confira Administradora → Grupo → Tipo → Modalidade → Programa → regra homologada. Se houver ambiguidade ou configuração pendente, o motor bloqueia a venda em vez de escolher arbitrariamente.

Para depósitos reais, use **ERP → Repasse da franquia → Novo recebimento**. O recebimento cria uma entrada de Caixa; a conciliação posterior vincula previsões e classifica outros valores sem duplicar Caixa.

Para lances, use **ERP → Lances e estratégias**. A estratégia pertence à cota do cliente; o Grupo fornece somente limites. Alterações preservam histórico e não registram contemplação automaticamente.
