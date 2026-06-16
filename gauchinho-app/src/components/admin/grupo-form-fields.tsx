import { Button, Input, Label, Select, Textarea } from "@/components/ui/form-primitives";
import { MODALIDADES_GRUPO } from "@/lib/types";
import { GrupoModalidadesEditor } from "@/components/admin/grupo-modalidades-editor";
import type { GrupoModalidadeLance } from "@/lib/types";

type GrupoInitial = Record<string, unknown> | undefined;

export function GrupoFormFields({
  initial,
  modalidadesInitial,
}: {
  initial?: GrupoInitial;
  modalidadesInitial?: GrupoModalidadeLance[];
}) {
  const g = initial ?? {};
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
            <Label>Modalidade</Label>
            <Select name="modalidade" defaultValue={String(g.modalidade ?? "Imóvel")}>
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
          <div>
            <Label>Parcelas realizadas</Label>
            <Input
              name="parcelas_realizadas"
              type="number"
              defaultValue={String(g.parcelas_realizadas ?? 0)}
            />
          </div>
          <div>
            <Label>Prazo restante</Label>
            <Input name="prazo_restante" type="number" defaultValue={String(g.prazo_restante ?? "")} />
          </div>
        </div>
        <div className="flex flex-wrap gap-4">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="seguro_habilitado" value="on" defaultChecked={!!g.seguro_habilitado} />
            Seguro habilitado
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="tem_parcela_reduzida" value="on" defaultChecked={!!g.tem_parcela_reduzida} />
            Parcela reduzida
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="permite_lance_embutido" value="on" defaultChecked={!!g.permite_lance_embutido} />
            Lance embutido
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="seguro_pos_contemplacao" value="on" defaultChecked={!!g.seguro_pos_contemplacao} />
            Seguro pós-contemplação
          </label>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <Label>Seguro % (fator ou % — ex. 0,0004)</Label>
            <Input
              name="seguro_percentual"
              type="text"
              inputMode="decimal"
              placeholder="0,0004"
              defaultValue={String(g.seguro_percentual ?? 0)}
            />
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
          <div>
            <Label>% parcela reduzida</Label>
            <Input
              name="percentual_parcela_reduzida"
              type="number"
              step="0.01"
              defaultValue={String(g.percentual_parcela_reduzida ?? 0)}
            />
          </div>
          <div>
            <Label>% lance embutido</Label>
            <Input
              name="percentual_lance_embutido"
              type="number"
              step="0.01"
              defaultValue={String(g.percentual_lance_embutido ?? 0)}
            />
          </div>
          <div>
            <Label>% recurso próprio sugerido</Label>
            <Input
              name="percentual_recurso_proprio_sugerido"
              type="number"
              step="0.01"
              defaultValue={String(g.percentual_recurso_proprio_sugerido ?? 0)}
            />
          </div>
        </div>
      </section>

      <GrupoModalidadesEditor initial={modalidadesInitial} />

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
