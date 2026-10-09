import fs from "fs";
import path from "path";

const targetPath = path.resolve("gauchinho-app/src/app/erp/vendas/actions.ts");
let content = fs.readFileSync(targetPath, "utf8");

const actionCode = `
export async function registrarStatusBoletoAction(formData: FormData) {
  const { empresaAtiva, usuario } = await requireVendaWrite();
  if (!empresaAtiva) throw new Error("Tenant não identificado.");

  const vendaId = val(formData, "venda_id");
  const cotaId = val(formData, "cota_id") || null;
  const competencia = val(formData, "competencia");
  const acao = val(formData, "acao"); // 'BAIXAR', 'ENVIAR', 'DESFAZER'
  const canal = val(formData, "canal") || "whatsapp";
  const observacao = val(formData, "observacao") || null;

  if (!vendaId || !competencia) {
    throw new Error("Venda e competência são obrigatórios para registrar o boleto.");
  }

  const admin = createAdminClient();
  const agora = new Date().toISOString();
  const usuarioNome = usuario?.nome || usuario?.email || "Consultor";

  let query = admin
    .from("vendas_boletos_envios")
    .select("id, status_boleto, baixado_em, enviado_em, baixado_por_id, baixado_por_nome")
    .eq("empresa_id", empresaAtiva.id)
    .eq("venda_id", vendaId)
    .eq("competencia", competencia);

  if (cotaId) {
    query = query.eq("cota_id", cotaId);
  } else {
    query = query.is("cota_id", null);
  }

  const { data: existente } = await query.maybeSingle();

  if (acao === "DESFAZER") {
    if (existente?.id) {
      await admin.from("vendas_boletos_envios").delete().eq("id", existente.id);
    }
  } else if (acao === "BAIXAR") {
    if (existente?.id) {
      await admin
        .from("vendas_boletos_envios")
        .update({
          status_boleto: existente.enviado_em ? "enviado" : "baixado",
          baixado_em: existente.baixado_em || agora,
          baixado_por_id: usuario?.id || null,
          baixado_por_nome: usuarioNome,
          updated_at: agora,
        })
        .eq("id", existente.id);
    } else {
      await admin.from("vendas_boletos_envios").insert({
        empresa_id: empresaAtiva.id,
        venda_id: vendaId,
        cota_id: cotaId,
        competencia,
        status_boleto: "baixado",
        baixado_em: agora,
        baixado_por_id: usuario?.id || null,
        baixado_por_nome: usuarioNome,
        canal,
        observacao,
      });
    }
  } else if (acao === "ENVIAR") {
    if (existente?.id) {
      await admin
        .from("vendas_boletos_envios")
        .update({
          status_boleto: "enviado",
          baixado_em: existente.baixado_em || agora,
          baixado_por_id: existente.baixado_por_id || usuario?.id || null,
          baixado_por_nome: existente.baixado_por_nome || usuarioNome,
          enviado_em: agora,
          enviado_por_id: usuario?.id || null,
          enviado_por_nome: usuarioNome,
          canal,
          observacao: observacao || null,
          updated_at: agora,
        })
        .eq("id", existente.id);
    } else {
      await admin.from("vendas_boletos_envios").insert({
        empresa_id: empresaAtiva.id,
        venda_id: vendaId,
        cota_id: cotaId,
        competencia,
        status_boleto: "enviado",
        baixado_em: agora,
        baixado_por_id: usuario?.id || null,
        baixado_por_nome: usuarioNome,
        enviado_em: agora,
        enviado_por_id: usuario?.id || null,
        enviado_por_nome: usuarioNome,
        canal,
        observacao,
      });
    }
  }

  revalidatePath("/erp/vendas");
  revalidatePath("/admin/vendas");
  return { ok: true };
}
`;

if (!content.includes("registrarStatusBoletoAction")) {
  const insertIndex = content.lastIndexOf("function NULLIF_OR_VAL");
  if (insertIndex !== -1) {
    content = content.slice(0, insertIndex) + actionCode + "\n" + content.slice(insertIndex);
    fs.writeFileSync(targetPath, content, "utf8");
    console.log("registrarStatusBoletoAction added to actions.ts!");
  } else {
    content += "\n" + actionCode;
    fs.writeFileSync(targetPath, content, "utf8");
    console.log("registrarStatusBoletoAction appended to actions.ts!");
  }
}
