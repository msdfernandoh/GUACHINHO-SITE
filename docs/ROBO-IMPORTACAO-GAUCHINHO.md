# 🤖 Central de Robôs de Importação — Gauchinho Consórcios

Este módulo implementa a arquitetura de **Robô de Automação & Importação Multiportal** baseada em **Playwright**, com execução desacoplada via **Runner / Daemon**, fila transacional atômica no **Supabase** e gestão completa pelo painel administrativo do SAAS (`https://admin.gauchinhoconsorcios.com.br/`).

---

## 🏗️ 1. Arquitetura da Solução

```
 ┌─────────────────────────────────────────────────────────┐
 │ Painel Admin Gauchinho Consórcios                       │
 │ (/admin/configuracoes/robos-importacao)                 │
 └────────────────────────────┬────────────────────────────┘
                              │ 1. Cadastra credenciais (AES-256-GCM)
                              │ 2. Dispara "Executar Agora" ou programa rotina
                              ▼
 ┌─────────────────────────────────────────────────────────┐
 │ Banco de Dados Supabase (Schema 307)                    │
 │ - public.robo_configuracoes (Portais e Senhas Cifradas) │
 │ - public.robo_execucoes (Fila FOR UPDATE SKIP LOCKED)   │
 │ - public.robo_runner_lease (Coordenação Atômica)        │
 │ - public.robo_mapeamentos (Traces e Screenshots)        │
 └────────────────────────────┬────────────────────────────┘
                              │ Polling com Lock Atômico
                              ▼
 ┌─────────────────────────────────────────────────────────┐
 │ Runner / Daemon Local em Background                     │
 │ (scripts/robo-worker-daemon.mjs + Playwright Chromium)  │
 │ - Executa headless                                      │
 │ - Simula navegação, autentica e executa tarefas         │
 │ - Faz download de relatórios/extratos                   │
 │ - Atualiza logs e status em tempo real via Supabase     │
 └─────────────────────────────────────────────────────────┘
```

---

## 🔒 2. Segurança e Criptografia das Senhas

- **Algoritmo:** `AES-256-GCM` com IV aleatório de 12 bytes e Auth Tag de 16 bytes.
- **Armazenamento:** Nenhuma senha em texto puro é gravada no banco ou enviada para o frontend.
- **Variável de Ambiente:** Pode ser configurada explicitamente em `.env.local`:
  ```env
  ROBO_CREDENTIALS_ENCRYPTION_KEY=<chave_32_bytes_base64_ou_hex>
  ```
  *(Se omitida, deriva automaticamente uma chave segura baseada no `SUPABASE_SERVICE_ROLE_KEY` do servidor).*

---

## 🖥️ 3. Como Acessar e Cadastrar no Painel

1. Acesse o painel administrativo:
   - Pelo menu lateral: **Configurações → Robôs de Importação**
   - Ou diretamente pela URL: `https://admin.gauchinhoconsorcios.com.br/admin/configuracoes/robos-importacao`
2. Clique no botão **"Novo Robô"**.
3. Preencha os campos principais:
   - **Nome:** Ex: *Robô Racon — Extrato de Vendas e Boletos*
   - **Tipo de Portal:** `RACON`, `ADEMICON`, `RODOBENS`, `PORTO_SEGURO` ou `CUSTOM`
   - **URL do Site / Login:** Ex: `https://admin.gauchinhoconsorcios.com.br/login` ou URL da administradora
   - **Usuário / Login:** Seu usuário, e-mail ou CPF
   - **Senha:** A senha do portal (será criptografada instantaneamente)
   - **Senha Secundária:** Caso o portal exija segunda senha, PIN ou assinatura eletrônica
   - **Modo:** `Modo Dry Run` (simulação segura) ou `Modo Produção`
   - **Robô Ativo:** Marque para habilitar a execução automática na janela diária (04:00 e 20:00 Cuiabá).

---

## 🎯 4. Mapeamento de Tarefas e Telas

Para que o robô navegue pelas telas específicas e faça downloads, você pode configurar o campo **Mapeamento de Tarefas & Passos (JSON)**:

### Exemplo de Estrutura de Tarefas (JSON):

```json
{
  "passos": [
    {
      "tipo": "navegar",
      "url": "https://admin.gauchinhoconsorcios.com.br/admin/relatorios",
      "descricao": "Acessar menu de relatórios"
    },
    {
      "tipo": "clicar",
      "seletor": "#filtro-mes",
      "descricao": "Abrir seletor de mês"
    },
    {
      "tipo": "preencher",
      "seletor": "input[name='busca']",
      "valor": "2026-10",
      "descricao": "Filtrar competência"
    },
    {
      "tipo": "esperar",
      "ms": 2000,
      "descricao": "Aguardar carregamento da tabela"
    },
    {
      "tipo": "baixar",
      "seletor": "button:has-text('Exportar Excel')",
      "descricao": "Download do arquivo de fechamento"
    }
  ]
}
```

### Ações Suportadas:
- `navegar` / `goto`: Abre uma URL específica.
- `clicar` / `click`: Clica em um botão, link ou menu por seletor CSS ou texto.
- `preencher` / `fill`: Digita texto em um campo de formulário.
- `esperar` / `wait`: Aguarda `ms` milissegundos para transições dinâmicas.
- `baixar` / `download`: Clica no botão e aguarda o evento de download do navegador, salvando o arquivo na pasta `tmp/robo-downloads`.

---

## ⚙️ 5. Como Executar e Manter o Runner Rodando

### Opção A: Executar via Terminal (Modo Interativo para Testes)
```powershell
cd "C:\Fernando Hugo\GAUCHINHO SITE"
npm run robo:worker --prefix gauchinho-app
```
*O runner iniciará e exibirá em tempo real as tarefas reivindicadas e logs de cada passo.*

### Opção B: Executar em Segundo Plano (Silencioso sem janela)
Basta dar dois cliques no arquivo:
```
scripts/iniciar-robo-worker.vbs
```

### Opção C: Instalação Automática no Windows (Recomendado para Produção)
Para que o robô inicie automaticamente com o Windows:
```powershell
powershell -ExecutionPolicy Bypass -File "scripts/instalar-agendador-windows.ps1"
```
*Isto cria o atalho na pasta de Inicialização do Windows (`Startup`) e registra a tarefa no Agendador de Tarefas do Windows.*

---

## 🗄️ 6. Aplicação da Migration no Banco Supabase

O arquivo SQL de estrutura está em:
```
supabase/migrations/308_central_robos_importacao.sql
```

Para aplicar no banco do projeto:
- Abra o painel do Supabase do projeto Gauchinho Site (`SQL Editor`).
- Cole o conteúdo do arquivo `308_central_robos_importacao.sql` e execute (`Run`).
- Todas as tabelas (`robo_configuracoes`, `robo_execucoes`, `robo_mapeamentos`, `robo_runner_lease`), índices e funções RPC com lock transacional (`reivindicar_proxima_execucao_robo`) serão criadas com sucesso.
