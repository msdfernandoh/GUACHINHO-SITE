# CHECKLIST OFICIAL DE ONBOARDING DE NOVOS TENANTS E PARCEIROS

> **Versão:** 1.0.0  
> **Objetivo:** Garantir que o processo de entrada de uma nova empresa/franqueada, usuário, parceiro ou concessão de administradora siga estritamente as regras de segurança e isolamento multi-tenant da plataforma SaaS Gauchinho Consórcios.

---

## 1. Princípio de Governança de Concessões

> **REGRA IMPERATIVA DE SEGURANÇA:**  
> A empresa/tenant **NUNCA** escolhe ou habilita administradoras por conta própria.  
> Somente o perfil **`PLATFORM_SUPERADMIN`** possui autoridade para conceder, suspender ou revogar o acesso de uma empresa a uma administradora global (`public.empresa_administradoras`).

---

## 2. Passo a Passo Completo de Onboarding de Novo Tenant (Empresa / Franqueada)

```
[FLUXO DE ONBOARDING]
PLATFORM_SUPERADMIN
  │
  ├── 1. Cadastrar Empresa (public.empresas) ── status: "em_treinamento" | "ativa"
  ├── 2. Configurar Branding e Domínio (empresa_branding / empresa_dominios)
  ├── 3. Conceder Administradora Global (public.empresa_administradoras)
  ├── 4. Habilitar Catálogo Local (public.empresa_grupos_config overlay)
  ├── 5. Criar Usuário Master e Vínculo N:N (usuarios + empresa_usuarios)
  ├── 6. Criar Participante Comercial Master (public.participantes_comerciais)
  ├── 7. Configurar Programas de Comissão da Franquia (comissao_programas_franquia)
  ├── 8. Configurar Equipes e Metas Iniciais (equipes / metas_comerciais)
  └── 9. Executar Teste de Fumaça Negativo e Ativar Operação
```

### Checklist Operacional do Tenant:

- [ ] **1. Cadastro do Tenant:**
  - Registro em `public.empresas` com `nome_fantasia`, `razao_social`, `cnpj`, `slug` único e status inicial (`em_treinamento` ou `ativa`).
- [ ] **2. Configuração de Domínio & Branding:**
  - Inserção em `public.empresa_dominios` (`dominio`, `is_principal`).
  - Personalização em `public.empresa_branding` (logotipo, cores primárias/secundárias, favicons, títulos).
- [ ] **3. Concessão de Administradora (Superadmin Only):**
  - Registro em `public.empresa_administradoras(empresa_id, administradora_id, status='ativa')`.
- [ ] **4. Overlay de Catálogo Local:**
  - Configuração de visibilidade de grupos em `public.empresa_grupos_config`.
- [ ] **5. Usuário Master & Vínculo Multi-tenant:**
  - Inserção em `public.usuarios` com `email` e `auth_user_id`.
  - Vínculo em `public.empresa_usuarios(empresa_id, usuario_id, papel_id)` com papel de Admin/Master do Tenant.
- [ ] **6. Identidade Comercial (Participante):**
  - Cadastro em `public.participantes_comerciais` apontando para o tenant. (Garantir separação entre login e participante).
- [ ] **7. Programas e Regras de Comissão:**
  - Configuração das faixas de comissão em `public.comissao_programas_franquia` e `public.comissao_regras_franquia`.
- [ ] **8. Estrutura de Vendas:**
  - Criação de equipes em `public.equipes` e metas em `public.metas_comerciais`.
- [ ] **9. Validação de Isolamento (Empresa B Dry-Run Test):**
  - Confirmar que o novo tenant enxerga **apenas** seus grupos/dados e que Empresa B continua com 0 dados.

---

## 3. Onboarding e Offboarding de Usuários

### Onboarding de Usuário:
1. Criar login no Supabase Auth.
2. Registrar perfil em `public.usuarios`.
3. Associar ao tenant em `public.empresa_usuarios` definindo o `papel_id` (Admin, Consultor, Financeiro, etc.).
4. Se o usuário for vendedor/atendente, criar registro correspondente em `public.participantes_comerciais`.

### Offboarding de Usuário:
1. Alterar status em `public.empresa_usuarios` para `inativo`.
2. Revogar sessão de autenticação.
3. **NUNCA apagar** o histórico de vendas, propostas ou caixa atribuídos ao participante comercial ligado ao usuário.

---

## 4. Onboarding e Offboarding de Organizações Parceiras (Imobiliárias / Corretores)

- **Parceiro NÃO é Tenant:** Organizações parceiras pertencem a uma empresa/franqueada. Não possuem domínio isolado nem capacidade de enxergar dados da franqueada ou de outros parceiros.
- **Onboarding:** Cadastro em `public.organizacoes_parceiras` vinculado a `empresa_id`, com participantes e chave de acesso comercial própria.
- **Offboarding:** Alterar status da organização parceira para `inativa`. Preservar integralmente o histórico de leads, propostas e comissões geradas.
