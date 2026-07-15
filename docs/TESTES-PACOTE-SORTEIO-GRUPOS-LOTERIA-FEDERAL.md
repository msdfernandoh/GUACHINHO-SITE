# Testes — Pacote Sorteio de Grupos (Loteria Federal)

## Cadastro da quantidade de cotas

1. Admin → **Grupos** → editar um grupo.
2. Campo **Quantidade de participantes / cotas (sorteio)** — informe um inteiro &gt; 0 (ex.: `999`).
3. Salvar o grupo.

Coluna no banco: `grupos_consorcio.quantidade_cotas_sorteio`.

## Cálculo individual (página pública)

1. Abrir `/grupos`.
2. Botão **Sorteio** (staff com permissão de grupos pode salvar).
3. Selecionar grupo, período (mês/ano), 1º Prêmio com 5 dígitos (ex.: `95866`).
4. Quantidade de cotas vem do cadastro do grupo.
5. Resultado exibido: **Cota sorteada no mês** — ex. `961` para `95866` e `999` cotas.
6. **Salvar sorteio do mês** (somente usuário autorizado).

## Busca automática do 1º prêmio (admin)

1. Admin → **Grupos** → **Sorteios Loteria Federal** (ou modal Sorteio na página pública, logado como staff).
2. Informar **Data do sorteio** e clicar **Buscar 1º prêmio**.
3. O sistema consulta a API oficial da Caixa (`portaldeloterias`) e preenche o campo com 5 dígitos.
4. Revisar/editar manualmente se necessário; falha na busca não impede entrada manual.
5. Histórico grava `data_sorteio`, `fonte_resultado` e `resultado_buscado_automaticamente`.

## Calcular para todos os grupos

1. Admin → `/admin/grupos/sorteios`.
2. Marcar **Calcular para todos os grupos**.
3. Informar período e 1º Prêmio.
4. Conferir prévia (grupo, cotas, palavra-chave).
5. **Salvar sorteio do mês** — um registro por grupo ativo com cotas cadastradas.

## Consultar meses anteriores

Na página `/grupos`, seção **Histórico de sorteios**: filtros **Ano**, **Mês** e **Grupo**.  
Tabela: período, grupo, 1º prêmio (texto com zeros à esquerda), cotas, cota sorteada.

## Regra da fórmula

```
Palavra-Chave = 1º Prêmio MOD Quantidade de Cotas
```

Exemplo: `95866 % 999 = 961`.

## Zeros à esquerda

- Entrada e banco: `primeiro_premio` é **texto** (`/^\d{5}$/`).
- Cálculo: `Number(primeiroPremio) % quantidadeCotas`.
- Ex.: prêmio `00007`, cotas `999` → cota `7`; histórico exibe `00007`.

## Permissões

- **Público**: consultar histórico e simular cálculo no modal (sem salvar).
- **Master / SRD com edição de grupos**: cadastrar cotas no grupo, salvar/atualizar sorteios, buscar prêmio por data.

## Testes automatizados

```bash
cd gauchinho-app
npm test -- src/lib/grupos-sorteio/calcular-palavra-chave.test.ts
```
