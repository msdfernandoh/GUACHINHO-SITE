import { AdminFormSubmitButton } from "@/components/admin/admin-form-submit-button";
import { Input, Label, Select, Textarea } from "@/components/ui/form-primitives";
import { MODALIDADES_GRUPO } from "@/lib/types";
import { GrupoModalidadesEditor } from "@/components/admin/grupo-modalidades-editor";
import { GrupoPrazoAdminPreview } from "@/components/admin/grupo-prazo-admin-preview";
import type { GrupoModalidadeLance } from "@/lib/types";

type GrupoInitial = Record<string, unknown> | undefined;

export function GrupoFormFields({
  formId = "grupo-form",
  initial,
  modalidadesInitial,
  tiposAdministradora = [],
  modalidadesComissao = [],
}: {
  formId?: string;
  initial?: GrupoInitial;
  modalidadesInitial?: GrupoModalidadeLance[];
  tiposAdministradora?: Array<{ id: string; nome: string }>;
  modalidadesComissao?: Array<{ id: string; nome: string }>;
}) {
  const g = initial ?? {};
  const dataBase =
    g.data_base_parcelas != null ? String(g.data_base_parcelas).slice(0, 10) : "";
  return (
    <>
      <section className="space-y-3 rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-900/90">
        <h2 className="font-semibold text-zinc-900 dark:text-zinc-100">Dados principais</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label>Código grupo</Label>
            <Input name="codigo_grupo" required defaultValue={String(g.codigo_grupo ?? "")} />
          </div>
          <div>
            <Label>Modalidade (tipo de bem)</Label>
            <Select name="modalidade" required defaultValue={String(g.modalidade ?? "Imóvel")}>
              {MODALIDADES_GRUPO.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label>Tipo da Administradora</Label>
            <Select name="tipo_administradora_id" required defaultValue={String(g.tipo_administradora_id ?? "")}>
              <option value="" disabled>Selecione o tipo</option>
              {tiposAdministradora.map((item) => <option key={item.id} value={item.id}>{item.nome}</option>)}
            </Select>
            {!g.tipo_administradora_id && <p className="mt-1 text-xs font-semibold text-amber-700">CONFIGURAÇÃO PENDENTE — novas vendas ficam bloqueadas.</p>}
          </div>
          <div>
            <Label>Modalidade / tabela de comissão</Label>
            <Select name="modalidade_comissao_id" required defaultValue={String(g.modalidade_comissao_id ?? "")}>
              <option value="" disabled>Selecione a modalidade</option>
              {modalidadesComissao.map((item) => <option key={item.id} value={item.id}>{item.nome}</option>)}
            </Select>
          </div>
          <div className="sm:col-span-2">
            <Label>Administradora</Label>
            <input
              type="hidden"
              name="administradora_id"
              defaultValue={String(g.administradora_id ?? "")}
            />
            <Input
              name="administradora"
              defaultValue={String(g.administradora ?? "Racon")}
              placeholder="Racon"
            />
            <p className="mt-1 text-xs text-zinc-500">
              Snapshot/exibição. A identidade estrutural usa administradora global (UUID) via
              dual-write no servidor — não é seleção de catálogo pelo tenant.
            </p>
          </div>
          <div>
            <Label>Status</Label>
            <Input name="status" defaultValue={String(g.status ?? "Disponível")} />
          </div>
          <div className="flex items-center gap-2 pt-6">
            <input
              type="checkbox"
              name="ativo"
              value="on"
              defaultChecked={g.ativo !== false}
              id="ativo"
            />
            <Label htmlFor="ativo" className="mb-0">
              Ativo
            </Label>
          </div>
          <div>
            <Label>Quantidade de participantes / cotas (sorteio)</Label>
            <Input
              name="quantidade_cotas_sorteio"
              type="number"
              min={1}
              step={1}
              inputMode="numeric"
              placeholder="Ex.: 999"
              defaultValue={
                g.quantidade_cotas_sorteio != null ? String(g.quantidade_cotas_sorteio) : ""
              }
            />
            <p className="mt-1 text-xs text-zinc-500">
              Obrigatório para registrar sorteio mensal pela Loteria Federal.
            </p>
          </div>
        </div>
        <div>
          <Label>Observações</Label>
          <Textarea name="observacoes" rows={2} defaultValue={String(g.observacoes ?? "")} />
        </div>
      </section>

      <section className="space-y-3 rounded-xl border border-blue-200 bg-blue-50/50 p-4">
        <h2 className="font-semibold text-slate-900">Configuração avançada da comissão</h2>
        <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
          <input type="checkbox" name="usar_regra_personalizada" value="on" defaultChecked={!!g.usar_regra_personalizada}/>
          Usar regra personalizada deste grupo (promoção ou exceção)
        </label>
        <div className="grid gap-3 sm:grid-cols-3">
          <div><Label>Início da vigência</Label><Input type="date" name="regra_personalizada_vigencia_inicio" defaultValue={String(g.regra_personalizada_vigencia_inicio ?? "").slice(0,10)}/></div>
          <div><Label>Fim da vigência</Label><Input type="date" name="regra_personalizada_vigencia_fim" defaultValue={String(g.regra_personalizada_vigencia_fim ?? "").slice(0,10)}/></div>
          <div><Label>Versão</Label><Input type="number" min={1} name="regra_personalizada_versao" defaultValue={String(g.regra_personalizada_versao ?? "")}/></div>
        </div>
      </section>

      <section className="space-y-3 rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-900/90">
        <h2 className="font-semibold text-zinc-900 dark:text-zinc-100">Financeiro</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <Label>Taxa admin %</Label>
            <Input
              name="taxa_administrativa_percentual"
              type="number"
              step="0.01"
              defaultValue={String(g.taxa_administrativa_percentual ?? 0)}
            />
          </div>
          <div>
            <Label>Fundo reserva %</Label>
            <Input
              name="fundo_reserva_percentual"
              type="number"
              step="0.01"
              defaultValue={String(g.fundo_reserva_percentual ?? 0)}
            />
          </div>
          <div>
            <Label>CET %</Label>
            <Input name="cet_percentual" type="number" step="0.01" defaultValue={String(g.cet_percentual ?? "")} />
          </div>
          <div>
            <Label>Prazo total</Label>
            <Input name="prazo_total" type="number" defaultValue={String(g.prazo_total ?? "")} />
          </div>
        </div>

        <div className="space-y-3 rounded-lg border border-zinc-200 p-4 dark:border-zinc-700">
          <h3 className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">
            Controle automático de parcelas
          </h3>
          <p className="text-xs text-zinc-500">
            Informe quantas parcelas já estavam realizadas na data base. O sistema atualizará
            automaticamente mês a mês o número de parcelas realizadas e restantes (sem cron — cálculo
            ao abrir a tela).
          </p>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              name="atualizacao_parcelas_automatica"
              value="on"
              defaultChecked={!!g.atualizacao_parcelas_automatica}
            />
            Atualizar parcelas automaticamente
          </label>
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <Label>Parcelas realizadas na data base</Label>
              <Input
                name="parcelas_realizadas_base"
                type="number"
                defaultValue={String(
                  g.parcelas_realizadas_base ?? g.parcelas_realizadas ?? 0,
                )}
              />
            </div>
            <div>
              <Label>Data base da informação</Label>
              <Input name="data_base_parcelas" type="date" defaultValue={dataBase} />
            </div>
          </div>
          <GrupoPrazoAdminPreview
            formId={formId}
            initial={{
              prazo_total: g.prazo_total != null ? Number(g.prazo_total) : null,
              parcelas_realizadas:
                g.parcelas_realizadas != null ? Number(g.parcelas_realizadas) : null,
              prazo_restante: g.prazo_restante != null ? Number(g.prazo_restante) : null,
              parcelas_realizadas_base:
                g.parcelas_realizadas_base != null
                  ? Number(g.parcelas_realizadas_base)
                  : null,
              data_base_parcelas: dataBase || null,
              atualizacao_parcelas_automatica: !!g.atualizacao_parcelas_automatica,
            }}
          />
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="fixar_base_parcelas" value="on" />
            Atualizar base para hoje (grava realizadas atuais e data de hoje ao salvar)
          </label>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <Label>Parcelas realizadas (manual)</Label>
            <Input
              name="parcelas_realizadas"
              type="number"
              defaultValue={String(g.parcelas_realizadas ?? 0)}
            />
            <p className="mt-1 text-xs text-zinc-500">Usado quando a atualização automática está desligada.</p>
          </div>
          <div>
            <Label>Prazo restante (manual)</Label>
            <Input name="prazo_restante" type="number" defaultValue={String(g.prazo_restante ?? "")} />
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label>Seguro mensal (0,04% a.m. da planilha)</Label>
            <Input
              name="seguro_percentual"
              type="text"
              inputMode="decimal"
              placeholder="0,0004"
              defaultValue={
                g.seguro_percentual != null && Number(g.seguro_percentual) > 0
                  ? String(g.seguro_percentual)
                  : "0,0004"
              }
            />
            <p className="mt-1 text-xs text-zinc-500">
              Use o fator da planilha <strong>0,0004</strong> (0,04% ao mês sobre o saldo). Também aceita{" "}
              <strong>0,04</strong> (= 0,04%). Não use <strong>1</strong> — isso vira 1% ao mês e infla o
              seguro (~R$ 11 mil em vez de ~R$ 444). O cliente escolhe a contratação no início da venda;
              após a contemplação o seguro é obrigatório.
            </p>
          </div>
          <div>
            <Label>Seguro valor (R$)</Label>
            <Input
              name="seguro_valor"
              type="number"
              step="0.01"
              defaultValue={String(g.seguro_valor ?? "")}
            />
          </div>
        </div>
      </section>

      <section className="space-y-3 rounded-xl border border-amber-500/25 bg-amber-500/5 p-4 dark:border-amber-500/30">
        <h2 className="font-semibold text-zinc-900 dark:text-zinc-100">Parcela reduzida personalizada</h2>
        <p className="text-xs text-zinc-500">
          Para promoções pontuais (ex.: 40% da integral). No simulador /grupos, quem ajustar a linha
          poderá escolher &quot;Personalizada&quot; e informar o percentual.
        </p>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="permite_parcela_reduzida_personalizada"
            value="on"
            defaultChecked={!!g.permite_parcela_reduzida_personalizada}
          />
          Permitir parcela reduzida personalizada neste grupo
        </label>
        <div className="max-w-xs">
          <Label>Percentual sugerido (opcional)</Label>
          <Input
            name="percentual_parcela_reduzida_personalizada"
            type="number"
            min={1}
            max={99}
            step="0.01"
            placeholder="Ex.: 40"
            defaultValue={
              g.percentual_parcela_reduzida_personalizada != null
                ? String(g.percentual_parcela_reduzida_personalizada)
                : ""
            }
          />
          <p className="mt-1 text-xs text-zinc-500">
            Pré-preenche o campo na tela de ajuste; o consultor ainda pode alterar na simulação.
          </p>
        </div>
      </section>

      <GrupoModalidadesEditor initial={modalidadesInitial} legacyGrupo={g} />

      <section className="space-y-3 rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-900/90">
        <h2 className="font-semibold text-zinc-900 dark:text-zinc-100">
          Cotas — colar créditos (uma linha = uma cota)
        </h2>
        <Textarea
          name="cotas_bulk"
          rows={6}
          placeholder={"55214,00\n65258,58\n75000,00"}
        />
        <p className="text-xs text-zinc-500">
          Opcional: cole novos créditos para adicionar cotas. Salvar funciona sem preencher este campo.
        </p>
      </section>
      <div className="flex justify-end">
        <AdminFormSubmitButton variant="gold" label="Salvar grupo" />
      </div>
    </>
  );
}
