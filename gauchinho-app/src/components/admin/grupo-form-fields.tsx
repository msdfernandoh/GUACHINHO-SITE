import { Button, Input, Label, Select, Textarea } from "@/components/ui/form-primitives";
import { MODALIDADES_GRUPO } from "@/lib/types";
import { GrupoModalidadesEditor } from "@/components/admin/grupo-modalidades-editor";
import { GrupoPrazoAdminPreview } from "@/components/admin/grupo-prazo-admin-preview";
import type { GrupoModalidadeLance } from "@/lib/types";

type GrupoInitial = Record<string, unknown> | undefined;

export function GrupoFormFields({
  formId = "grupo-form",
  initial,
  modalidadesInitial,
}: {
  formId?: string;
  initial?: GrupoInitial;
  modalidadesInitial?: GrupoModalidadeLance[];
}) {
  const g = initial ?? {};
  const dataBase =
    g.data_base_parcelas != null ? String(g.data_base_parcelas).slice(0, 10) : "";
  return (
    <>
      <section className="space-y-3 rounded-xl border bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="font-semibold">Dados principais</h2>
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
          <div className="sm:col-span-2">
            <Label>Administradora</Label>
            <Input name="administradora" defaultValue={String(g.administradora ?? "")} />
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
        </div>
        <div>
          <Label>Observações</Label>
          <Textarea name="observacoes" rows={2} defaultValue={String(g.observacoes ?? "")} />
        </div>
      </section>

      <section className="space-y-3 rounded-xl border bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="font-semibold">Financeiro</h2>
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
          <h3 className="text-sm font-semibold">Controle automático de parcelas</h3>
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
        <div className="flex flex-wrap gap-4">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="seguro_habilitado" value="on" defaultChecked={!!g.seguro_habilitado} />
            Seguro habilitado
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="seguro_pos_contemplacao" value="on" defaultChecked={!!g.seguro_pos_contemplacao} />
            Seguro pós-contemplação
          </label>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label>Seguro % (fator ou % — ex. 0,0004)</Label>
            <Input
              name="seguro_percentual"
              type="text"
              inputMode="decimal"
              placeholder="0,0004"
              defaultValue={String(g.seguro_percentual ?? 0)}
            />
            <p className="mt-1 text-xs text-zinc-500">
              Mensal = saldo devedor × fator (ex. 0,0004). Soma à parcela integral ou à reduzida no
              simulador e ao salvar grupo/cota.
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

      <GrupoModalidadesEditor initial={modalidadesInitial} legacyGrupo={g} />

      <section className="space-y-3 rounded-xl border bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="font-semibold">Cotas — colar créditos (uma linha = uma cota)</h2>
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
        <Button type="submit" variant="gold">
          Salvar grupo
        </Button>
      </div>
    </>
  );
}
