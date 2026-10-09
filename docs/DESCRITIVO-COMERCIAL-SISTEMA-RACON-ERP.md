# 🌟 Ecossistema Integrado de Gestão & Vendas de Consórcios — Racon
### *Descritivo Comercial, Funcional e Estratégico do Site, Portais de Acesso e ERP Operacional (`raconsinop.com.br`)*

---

## 🎯 1. Visão Geral do Produto (Pitch Executivo)

O ecossistema **Racon / Plataforma Consórcios SaaS** é uma solução *all-in-one* de ponta a ponta projetada especificamente para o mercado de **administração, corretagem e franquias de consórcios e soluções financeiras**.

Diferente de ERPs e CRMs genéricos de mercado, a plataforma une em uma única arquitetura em nuvem:
1. **Máquina Pública de Atração e Conversão:** Portal de alta conversão, simuladores dinâmicos multi-segmento, propostas personalizadas em PDF, catálogo vivo de cotas/grupos, vitrine imobiliária e eventos interativos com sorteios em tempo real.
2. **Portais de Parcerias & App do Indicador:** Aplicativo web leve para corretores, imobiliárias e parceiros indicarem clientes, com fracionamento de comissões personalizado, dashboards transparentes e gestão de estornos.
3. **ERP Operacional e Financeiro Especializado:** CRM com Kanban customizado para consórcios, esteira digital de contratações, esteira de parcelas de comissão da franquia até a última parcela com regras configuráveis, estornos automatizados e conciliação bancária.
4. **Inteligência de Longo Prazo & Previsibilidade de Caixa:** Fluxo de projeção de receitas futuras (comissões recorrentes, parcela nº 30, comissões na contemplação) cruzado com despesas operacionais e tetos orçamentários.
5. **Arquitetura Multiempresa (Multi-tenant):** Gestão centralizada ou independente de múltiplas filiais e franquias com isolamento rigoroso de dados.

---

## 🌐 2. O Site Público: Máquina de Captação e Conversão

O portal público (`raconsinop.com.br`) funciona como um **funil comercial automatizado** 24 horas por dia.

```
       [ Visitante / Lead ]
                │
   ┌────────────┼────────────┐
   ▼            ▼            ▼
[Simulador]  [Catálogo]  [Eventos/Telão]
   │            │            │
   └────────────┬────────────┘
                ▼
  [ Cadastro Automático no CRM ]
                ▼
  [ Distribuição para Consultor ]
                ▼
  [ Proposta em PDF Personalizada ]
```

### 🔹 Simulador Inteligente Multi-Segmento
* **Segmentos Atendidos:** Imóveis, Automóveis, Caminhões/Pesados, Máquinas Agrícolas e Serviços.
* **Cálculo em Tempo Real:** Simulação de crédito, prazo, valor de parcelas reduzidas/integrais e impacto de lances embutidos.
* **Captura Instantânea de Lead:** O cliente simula seu objetivo e os dados caem instantaneamente no CRM da equipe com o perfil exato do consórcio desejado.

### 🔹 Propostas em PDF Personalizadas e Ricas
* **Geração Instantânea em PDF:** Criação de propostas comerciais de alto padrão visual com a identidade da Racon, prontas para download ou envio direto via WhatsApp.
* **Comparativos Financeiros:** Demonstrativos claros comparando o custo do consórcio contra o financiamento bancário tradicional, evidenciando a economia de juros.
* **Link de Assinatura e Aceite Digital (`/proposta/[token]`):** O cliente pode revisar a proposta personalizada online e avançar diretamente para a contratação digital.

### 🔹 Catálogo Inteligente de Grupos e Cotas
* Exibição pública atualizada dos grupos abertos com filtros por administradora, taxa de administração, fundo de reserva, prazo e vagas.
* Transparência que gera autoridade imediata para o cliente final.

### 🔹 Vitrine de Imóveis & Cartas Contempladas
* **Oportunidades Imobiliárias:** Apresentação de imóveis integrados com simulações de parcelas via consórcio, demonstrando a economia real frente ao financiamento tradicional.
* **Cartas Contempladas:** Divulgação de cartas prontas para transferência e uso imediato do crédito.

### 🔹 Módulo de Eventos, Check-in e Telão ao Vivo
* **Página do Evento:** Inscrição online de participantes para workshops, noites de negócios e palestras.
* **Telão de Sorteio Interativo (`/eventos/[slug]/telao`):** Ferramenta para projeção ao vivo em eventos presenciais. Realiza check-in por QR Code e sorteios animados em tela cheia, gerando engajamento e captando centenas de contatos qualificados em minutos.
* **NPS Pós-Evento:** Avaliação de satisfação automatizada enviada aos participantes.

### 🔹 Ferramentas de Conteúdo e Autoridade
* **Dicas Racon:** Blog educativo especializado em inteligência financeira, estratégias de lances e investimentos em consórcio.
* **Casos de Sucesso e Depoimentos:** Prova social em vídeo e depoimentos de clientes contemplados.
* **Calculadoras Comparativas:** Ferramenta interativa que prova matematicamente as vantagens do consórcio frente aos juros bancários.

---

## 🤝 3. Rede de Parcerias & App do Indicador com Regras Avançadas

O sistema possui uma estrutura dedicada a potencializar vendas através de parceiros comerciais (corretores, imobiliárias, correspondentes e promotores), garantindo transparência e controle financeiro total.

```
   [ Indicador / Corretor ] ──────── (App Mobile-First / CPF)
              │
              ├── Cadastra Indicação em segundos
              ├── Acompanha Status no Funil em tempo real
              ├── Visualiza Dashboard de Comissões e Fracionamentos
              └── Gestão de Estornos com Histórico Claro
```

### 🔹 App do Indicador (`/app-indicador`)
* **Acesso Simplificado por CPF:** Sem necessidade de download em lojas de apps — funciona diretamente no navegador do smartphone como PWA leve e rápido.
* **Indicação em 3 Passos:** O parceiro informa nome, telefone e interesse do cliente em segundos.
* **Transparência de Etapas:** O indicador acompanha em tempo real quando o cliente foi contactado, quando recebeu a proposta e quando a venda foi concretizada.

### 🔹 Configurações Personalizadas & Fracionamento de Pagamentos
* **Regras Customizadas por Parceiro:** Definição de percentuais e regras individuais de comissionamento de acordo com o acordo comercial com cada imobiliária ou parceiro.
* **Fracionamento de Comissões:** Pagamento parcelado da comissão do indicador vinculado ao pagamento real das parcelas pelo cliente ou repasses da administradora.
* **Dashboard Financeiro do Parceiro:** Extrato em tempo real com valores já pagos, parcelas a liberar e datas previstas.
* **Gestão Transparente de Estornos:** Em caso de cancelamento da cota pelo cliente nas parcelas iniciais, o sistema calcula e exibe o estorno proporcional de forma clara e auditada, sem surpresas nem atritos.

### 🔹 Landings de Parceiros Personalizadas (`/parceiro/[slug]`)
* Cada parceiro ou consultor possui sua própria página de captura com foto, bio, botões de WhatsApp direto e simulador vinculado ao seu código de consultor.

---

## ⚙️ 4. O ERP Operacional Especializado em Consórcios

O coração da gestão administrativa e comercial (`/admin` e `/erp`) foi desenhado para eliminar planilhas paralelas e automatizar todo o ciclo de vida da cota.

| Módulo ERP | O que Faz na Prática | Benefício para a Operação |
| :--- | :--- | :--- |
| **CRM & Pipeline Kanban** | Gestão visual de leads em colunas (Novo, Contato, Simulação, Proposta, Fechamento). | Nenhum lead fica esquecido; tempo de resposta reduzido em até 70%. |
| **Esteira de Propostas em PDF** | Geração instantânea de propostas ricas e personalizadas em PDF com envio por WhatsApp/Email. | Acelera a decisão do cliente com apresentação visual impecável. |
| **Gestão de Cotas & Lances** | Acompanhamento de cotas ativas, histórico de lances livres/embutidos e resultados de assembleias. | Consultoria proativa para contemplação rápida dos clientes da carteira. |
| **Importador de Contatos** | Importação de listas de contatos via CSV, VCF (iCloud/Google) com deduplicação inteligente. | Ativação rápida de bases de prospecção para a equipe de vendas. |
| **Agenda & Tarefas** | Calendário integrado de reuniões, follow-ups e visitas com horários disponíveis. | Organização rigorosa da rotina diária dos consultores. |
| **Metas Comerciais** | Gestão de metas por consultor e equipe (volume de crédito, número de cotas e faturamento). | Dashboard em tempo real com ranking de performance e engajamento da equipe. |

---

## 💰 5. Gestão de Comissões da Franquia, Estornos e Longo Prazo

O grande motor financeiro do sistema acompanha com precisão matemática cada centavo do comissionamento da franquia, da 1ª parcela até o encerramento do contrato.

```
                    ┌─────────────────────────┐
                    │   Repasse da Franquia   │
                    │      (Racon Sinop)      │
                    └────────────┬────────────┘
                                 │
           ┌─────────────────────┴─────────────────────┐
           ▼                                           ▼
┌───────────────────────────────┐           ┌───────────────────────────────┐
│ Controle até a Última Parcela │           │  Regras Flexíveis & Estornos  │
│ - Parcela 1 a 4 (Iniciais)    │           │  - Estorno por Cancelamento   │
│ - Parcela 30 (Pós-Venda)      │           │  - Compensação Automática     │
│ - Bônus na Contemplação       │           │  - Trava de Parcela Paga      │
└──────────────┬────────────────┘           └──────────────┬────────────────┘
               └─────────────────────┬─────────────────────┘
                                     ▼
                    ┌─────────────────────────────────┐
                    │   Fluxo de Receitas Futuras     │
                    │   Projeção Mês a Mês da Carteira│
                    └─────────────────────────────────┘
```

### 🔹 Controle de Comissões até a Última Parcela
* **Configuração de Regras Dinâmicas:** Definição personalizada de percentuais por administradora, tipo de produto (Imóvel, Auto, Pesado), volume de vendas e perfil do consultor.
* **Acompanhamento Parcela a Parcela:** Controle individual de cada parcela de repasse (da entrada até a parcela final do contrato).
* **Comissões Especiais de Longo Prazo:**
  * **Comissões por Contemplação:** Mapeamento e alerta de recebimento de bônus quando as cotas da carteira são contempladas.
  * **Comissões Tardias (ex: Parcela nº 30):** Rastreamento de remunerações de fidelidade e pós-venda que ocorrem anos após a venda inicial.
* **Gestão Automatizada de Estornos:** Tratamento rigoroso de estornos quando ocorrem inadimplências ou cancelamentos nas parcelas de carência, com compensação em repasses futuros e proteção das parcelas já pagas.

---

## 📈 6. Previsibilidade de Caixa x Despesas & Fechamento dos Sócios

O sistema entrega um **painel executivo de previsibilidade financeira**, permitindo aos diretores saberem exatamente quanto a empresa tem a receber e a pagar nos próximos meses e anos.

```
┌────────────────────────────────────────────────────────────────────────┐
│                   PREVISIBILIDADE FINANCEIRA & CAIXA                   │
├──────────────────────────────────┬─────────────────────────────────────┤
│  RECEITAS FUTURAS PREVISTAS      │  DESPESAS OPERACIONAIS PROJETADAS   │
│  • Parcelas de Comissões Mês N   │  • Custos Fixos & Equipe            │
│  • Previsão de Contemplações     │  • Tetos por Centro de Custo        │
│  • Comissões Tardias (Parc. 30)  │  • Despesas de Eventos e Mídia      │
├──────────────────────────────────┴─────────────────────────────────────┤
│                      = RESULTADO LÍQUIDO PROJETADO                     │
│                  - Reserva Fiscal Blindada (Impostos)                  │
│                  - Lucro Remanescente para Sócios / Caixa              │
└────────────────────────────────────────────────────────────────────────┘
```

### 🔹 Curva de Previsão de Receita (Mês a Mês)
* Projeção detalhada de entradas de comissões futuras geradas pela carteira ativa de clientes.
* Visão consolidada da receita recorrente da corretora para os próximos 6, 12, 24 e 36 meses.

### 🔹 Cruzamento Caixa x Despesas & Tetos Orçamentários
* **Ponto de Equilíbrio Futuro:** Comparação em tempo real entre a curva de comissões a receber e a projeção de custos fixos/variáveis.
* **Tetos por Centro de Custo (`/erp/fechamento-socios`):** Alertas em tempo real quando despesas em categorias como Administrativo, Eventos, Investimentos e Salários atingem 80% ou 100% do limite estipulado.

### 🔹 Fechamento Societário com Lacre Imutável
* **Rateio Justo:** Despesas pagas da empresa abatem primeiro a margem comercial comum da operação antes do rateio entre os sócios.
* **Reserva Fiscal Blindada:** Separação contábil automática dos impostos antes de qualquer divisão de lucros.
* **Retirada Atômica com Comprovante:** Registro transacional que vincula o comprovante bancário à baixa do pró-labore/lucro.
* **Lacre de Período:** Trava no banco de dados que impede alterações retroativas em meses já fechados e auditados.

---

## 🏢 7. Plataforma SaaS & Governança Multiempresa (`/platform`)

Arquitetura **Multi-Tenant N:N**, pronta para expansão em rede de franquias e filiais.

* **Isolamento de Dados com RLS:** Cada unidade franqueada acessa exclusivamente seus próprios leads, contratos e finanças.
* **Gestão Modular:** Ativação granular de módulos ERP de acordo com a maturidade e plano de cada unidade.
* **Auditoria Completa:** Log completo com data, horário, IP e autor de cada ação crítica no sistema.

---

## 🏆 8. Resumo dos Diferenciais Comerciais para Venda

| Pilar do Sistema | Como Transforma a Operação? |
| :--- | :--- |
| **Propostas Ricas em PDF** | Eleva a autoridade visual da corretora e fecha vendas mais rápido com propostas completas e comparativos. |
| **Comissões até a Última Parcela** | Zero perda de repasses da administradora, acompanhamento da parcela 1 à 30 e bônus de contemplação. |
| **Gestão de Estornos** | Elimina prejuízos com cancelamentos de clientes através de estornos claros para consultores e parceiros. |
| **App & Dashboard de Parceiros** | Fideliza imobiliárias e corretores com transparência de pagamentos fracionados e extrato na palma da mão. |
| **Previsibilidade Caixa x Despesas** | Visão cristalina da saúde financeira da empresa a curto, médio e longo prazo com controle rígido de teto de gastos. |
