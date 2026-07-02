# Testes — Financiamento, Eventos e Consultores

## Financiamento invertido (Imóvel × Veículo)

**Causa:** ao trocar o tipo no simulador, `aplicarDefaultsBem` usava `finCfg` do render anterior (React), aplicando taxa/prazo do tipo antigo — por exemplo Veículo ficava com taxa de Imóvel.

**Correção:** `resolveFinanciamentoCfg(configs, tipo)` é chamado dentro de `aplicarDefaultsBem` com o tipo recém-selecionado. Mapeamento central em `normalizeTipoFinanciamento()` / `tipoFinanciamentoFromBem()`.

**Como testar:** Admin → Financiamento → Imóvel 1,27% · Veículo 3,07% → `/simulador` → alternar Imóvel e Veículo e conferir taxa nos detalhes do financiamento.

```bash
npm test -- src/lib/config/financiamento-por-tipo.test.ts
```

## Admin `/admin/eventos`

Se a migration `016_eventos_agenda.sql` não foi aplicada, a listagem não derruba a página: exibe aviso para aplicar a migration.

## Consultores (Agenda / Leads)

Migration `017_usuarios_consultores.sql` adiciona `is_consultor`. Admin → Usuários → marcar **Consultor comercial**. Selects usam `listarConsultores()` (fallback para perfil `srd` se coluna ausente).

Agenda: `/admin/agenda?lead=ID_DO_LEAD` abre formulário com lead preenchido.

---

# Ativação Moto e Caminhões/Frota no simulador

- Botões **Moto** e **Caminhões e Frota** ativos (sem “Em breve”).
- Limites: Moto R$ 30.000–150.000 · Caminhões e Frota R$ 100.000–1.000.000.
- URL: `tipo=moto` ou `tipo=caminhoes_frota` (compatível `caminhonete`).

```bash
npm test -- src/lib/simulador/tipos-credito.test.ts
```
