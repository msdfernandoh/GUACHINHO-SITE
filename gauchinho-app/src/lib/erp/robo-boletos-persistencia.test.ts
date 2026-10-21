import { describe, expect, it } from "vitest";
import { carregarCotasBoletos, competenciaBoletos, salvarBoletoCota, selecionarPendenciaBoleto } from "../../../../scripts/robo-boletos-dados.mjs";

function banco(falha = "") {
  const tabelas: Record<string, Record<string, unknown>[]> = { vendas_boletos_envios: [], cotas_boletos: [] };
  let uploads = 0;
  const admin = {
    storage: { from: () => ({
      upload: async () => { uploads++; return { error: falha === "upload" ? { message: "storage indisponível" } : null }; },
      getPublicUrl: (path: string) => ({ data: { publicUrl: `https://storage.test/${path}` } }),
    }) },
    from: (table: string) => {
      const filtros: Record<string, unknown> = {};
      let op = "select";
      let payload: Record<string, unknown> = {};
      const q = {
        select: () => q,
        match: (value: Record<string, unknown>) => { Object.assign(filtros, value); return q; },
        eq: (key: string, value: unknown) => { filtros[key] = value; return q; },
        maybeSingle: async () => { const r = await run(); return { data: r.data?.[0] ?? null, error: r.error }; },
        insert: (value: Record<string, unknown>) => { op = "insert"; payload = value; return q; },
        update: (value: Record<string, unknown>) => { op = "update"; payload = value; return q; },
        upsert: (value: Record<string, unknown>) => { op = "upsert"; payload = value; return q; },
        then: (resolve: (value: unknown) => void) => run().then(resolve),
      };
      async function run() {
        if (falha === table && op !== "select") return { data: null, error: { message: "falha de gravação" } };
        const rows = tabelas[table];
        const encontrados = rows.filter(r => Object.entries(filtros).every(([k, v]) => r[k] === v));
        if (op === "insert") rows.push({ id: String(rows.length + 1), ...payload });
        if (op === "update") encontrados.forEach(r => Object.assign(r, payload));
        if (op === "upsert") {
          const anterior = rows.find(r => ["empresa_id", "numero_grupo", "numero_cota", "competencia"].every(k => r[k] === payload[k]));
          if (anterior) Object.assign(anterior, payload); else rows.push({ id: String(rows.length + 1), ...payload });
        }
        return { data: encontrados, error: null };
      }
      return q;
    },
  };
  return { admin, tabelas, uploads: () => uploads };
}

const item = { empresa_id: "empresa-a", venda_id: "mesma-venda", cota_definitiva_id: "cota-1", numero_grupo: "1553", numero_cota: "1" };
const dados = { linhaDigitavel: "123456", qrCodePix: null, valor: 799.54, vencimento: "2026-10-10" };
const pdfBuffer = Buffer.from("%PDF-1.7 documento de teste");
const competencia = { iso: "2026-10", brasileira: "10/2026" };

describe("boletos por cota e competência", () => {
  it("seleciona a parcela mensal e ignora diferença negativa e parcela futura", () => {
    const linhas = [
      { id: "dif", texto: "DIF 022-0 RECBTO. DIFERENCA 10/11/2026 -0,13" },
      { id: "outubro", texto: "003 001-0 RECBTO. PARCELA 13/10/2026 799,54" },
      { id: "novembro", texto: "004 001-0 RECBTO. PARCELA 10/11/2026 799,54" },
    ];
    expect(selecionarPendenciaBoleto(linhas, "2026-10")?.id).toBe("outubro");
    expect(selecionarPendenciaBoleto(linhas, "2026-12")).toBeUndefined();
    expect(selecionarPendenciaBoleto([{ ...linhas[1], desabilitado: true }], "2026-10")).toBeUndefined();
  });
  it("usa o mês civil de Cuiabá na virada UTC", () => {
    expect(competenciaBoletos(new Date("2026-11-01T01:00:00Z"))).toEqual(competencia);
  });
  it("recusa empresa ausente e lista explícita vazia não abre a carteira", async () => {
    await expect(carregarCotasBoletos({}, {})).rejects.toThrow("empresa_id");
    expect(await carregarCotasBoletos({}, { empresa_id: "a", configuracao_tarefas: { cotas_alvo_ids: [] } })).toEqual([]);
  });
  it("pagina a carteira e propaga erro de consulta sem fallback em outra tabela", async () => {
    const ranges: number[] = [];
    const filtros: Array<[string, unknown]> = [];
    let offset = 0;
    let falhar = false;
    const q = {
      select: () => q, neq: () => q, not: () => q, order: () => q,
      eq: (key: string, value: unknown) => { filtros.push([key, value]); return q; },
      range: (inicio: number) => { offset = inicio; ranges.push(inicio); return q; },
      then: (resolve: (value: unknown) => void) => Promise.resolve({
        data: falhar ? null : Array.from({ length: offset === 0 ? 500 : 1 }, (_, i) => ({
          id: `cota-${offset + i}`, empresa_id: "a", venda_id: "v", numero_grupo: "1553", numero_cota: String(offset + i),
          venda: { id: "v", cliente_nome: "Cliente" },
        })), error: falhar ? { message: "schema indisponível" } : null,
      }).then(resolve),
    };
    const admin = { from: () => q };
    expect(await carregarCotasBoletos(admin, { empresa_id: "a", administradora_id: "racon" })).toHaveLength(501);
    expect(ranges).toEqual([0, 500]);
    expect(filtros).toContainEqual(["empresa_id", "a"]);
    expect(filtros).toContainEqual(["venda.administradora_id", "racon"]);
    falhar = true;
    await expect(carregarCotasBoletos(admin, { empresa_id: "a" })).rejects.toThrow("schema indisponível");
  });
  it("salva duas cotas da mesma venda separadamente e reexecução não duplica", async () => {
    const b = banco();
    for (const cota of ["cota-1", "cota-2", "cota-1"]) {
      await salvarBoletoCota({ admin: b.admin, item: { ...item, cota_definitiva_id: cota, numero_cota: cota }, competencia, dados, pdfBuffer });
    }
    expect(b.tabelas.vendas_boletos_envios).toHaveLength(2);
    expect(b.tabelas.cotas_boletos).toHaveLength(2);
    expect(b.tabelas.vendas_boletos_envios.map(r => r.cota_id)).toEqual(["cota-1", "cota-2"]);
  });
  it("preserva status de envio e pagamento na reexecução", async () => {
    const b = banco();
    await salvarBoletoCota({ admin: b.admin, item, competencia, dados, pdfBuffer });
    b.tabelas.vendas_boletos_envios[0].status_boleto = "enviado";
    b.tabelas.cotas_boletos[0].status = "PAGO";
    await salvarBoletoCota({ admin: b.admin, item, competencia, dados, pdfBuffer });
    expect(b.tabelas.vendas_boletos_envios[0].status_boleto).toBe("enviado");
    expect(b.tabelas.cotas_boletos[0].status).toBe("PAGO");
  });
  it.each(["upload", "cotas_boletos", "vendas_boletos_envios"])("propaga erro de %s", async (falha) => {
    const b = banco(falha);
    await expect(salvarBoletoCota({ admin: b.admin, item, competencia, dados, pdfBuffer })).rejects.toThrow("Falha");
  });
  it("não envia arquivo vazio, HTML ou PDF sem identificação de boleto", async () => {
    const b = banco();
    for (const buffer of [Buffer.alloc(0), Buffer.from("<html>portal</html>")]) {
      await expect(salvarBoletoCota({ admin: b.admin, item, competencia, dados, pdfBuffer: buffer })).rejects.toThrow("PDF");
    }
    await expect(salvarBoletoCota({ admin: b.admin, item, competencia, dados: {}, pdfBuffer })).rejects.toThrow("linha digitável");
    expect(b.uploads()).toBe(0);
  });
});
