import { NextResponse } from "next/server";
import { authorizePublicIngress } from "@/lib/security/public-ingress";
import { createAdminClient } from "@/lib/supabase/admin";

const digits = (value: unknown) => String(value ?? "").replace(/\D/g, "");

function cpfValido(cpf: string) {
  if (!/^\d{11}$/.test(cpf) || /^(\d)\1{10}$/.test(cpf)) return false;
  for (let tamanho = 9; tamanho <= 10; tamanho += 1) {
    let soma = 0;
    for (let i = 0; i < tamanho; i += 1) soma += Number(cpf[i]) * (tamanho + 1 - i);
    const digito = ((soma * 10) % 11) % 10;
    if (digito !== Number(cpf[tamanho])) return false;
  }
  return true;
}

function ocultarNome(nome: string) {
  const partes = nome.trim().split(/\s+/).filter(Boolean);
  return partes.map((p, i) => i === 0 ? p : `${p[0]?.toUpperCase() ?? ""}.`).join(" ");
}

export async function POST(request: Request) {
  const ingress = await authorizePublicIngress(request, "programa_indicacao", { limit: 8, windowSeconds: 60 });
  if (!ingress.ok) return ingress.response;
  const body = await request.json().catch(() => ({})) as Record<string, unknown>;
  const acao = String(body.acao ?? "");
  const admin = createAdminClient();

  if (acao === "localizar") {
    const cpf = digits(body.cpf);
    const telefone = digits(body.telefone);
    if (!cpfValido(cpf) && telefone.length < 10) return NextResponse.json({ encontrado: false });
    let query = admin.from("programa_indicadores").select("id,participante:participantes_comerciais(nome),cpf,telefone").eq("empresa_id", ingress.empresaId).eq("ativo", true);
    query = cpfValido(cpf) ? query.eq("cpf", cpf) : query.eq("telefone", telefone);
    const { data } = await query.maybeSingle();
    const participante = Array.isArray(data?.participante) ? data?.participante[0] : data?.participante;
    return NextResponse.json({ encontrado: Boolean(data), indicadorId: data?.id ?? null, nome: participante?.nome ?? null });
  }

  if (acao === "consultar") {
    const cpf = digits(body.cpf);
    if (!cpfValido(cpf)) return NextResponse.json({ error: "Informe um CPF válido." }, { status: 400 });
    const { data: indicador } = await admin.from("programa_indicadores").select("id").eq("empresa_id", ingress.empresaId).eq("cpf", cpf).eq("ativo", true).maybeSingle();
    if (!indicador) return NextResponse.json({ encontrado: false, indicacoes: [] });
    const { data, error } = await admin.from("programa_indicacoes")
      .select("id,status,created_at,lead:leads(nome),venda:vendas(valor_credito)")
      .eq("empresa_id", ingress.empresaId).eq("indicador_id", indicador.id).order("created_at", { ascending: false }).limit(100);
    if (error) return NextResponse.json({ error: "Não foi possível consultar agora." }, { status: 500 });
    const indicacoes = (data ?? []).map((item) => {
      const lead = Array.isArray(item.lead) ? item.lead[0] : item.lead;
      const venda = Array.isArray(item.venda) ? item.venda[0] : item.venda;
      return { id: item.id, nome: ocultarNome(lead?.nome ?? "Indicado"), status: item.status, criadoEm: item.created_at, valorVenda: venda?.valor_credito ?? null };
    });
    return NextResponse.json({ encontrado: true, indicacoes });
  }

  if (acao === "cadastrar") {
    const nome = String(body.nome ?? "").trim();
    const cpf = digits(body.cpf); const telefone = digits(body.telefone);
    const chavePix = String(body.chavePix ?? "").trim(); const empresaTrabalho = String(body.empresaTrabalho ?? "").trim();
    if (nome.split(/\s+/).length < 2) return NextResponse.json({ error: "Informe o nome completo." }, { status: 400 });
    if (!cpfValido(cpf)) return NextResponse.json({ error: "Informe um CPF válido." }, { status: 400 });
    if (telefone.length < 10) return NextResponse.json({ error: "Informe um telefone válido." }, { status: 400 });
    if (chavePix.length < 3) return NextResponse.json({ error: "Informe a chave PIX para recebimento." }, { status: 400 });
    const { data: mesmoTelefone } = await admin.from("programa_indicadores").select("id,cpf").eq("empresa_id", ingress.empresaId).eq("telefone", telefone).maybeSingle();
    if (mesmoTelefone && mesmoTelefone.cpf !== cpf) return NextResponse.json({ error: "Este telefone está vinculado a outro CPF. Procure a equipe para regularizar o cadastro." }, { status: 409 });
    const { data: mesmoCpf } = await admin.from("programa_indicadores").select("id,telefone").eq("empresa_id", ingress.empresaId).eq("cpf", cpf).maybeSingle();
    if (mesmoCpf && mesmoCpf.telefone !== telefone) return NextResponse.json({ error: "Este CPF já possui outro telefone. Procure a equipe para atualizar o cadastro." }, { status: 409 });
    if (mesmoCpf) {
      await admin.from("programa_indicacoes").update({ indicador_id: mesmoCpf.id }).eq("empresa_id", ingress.empresaId).is("indicador_id", null).eq("indicador_telefone_snapshot", telefone);
      return NextResponse.json({ ok: true, indicadorId: mesmoCpf.id, existente: true });
    }

    const { data: participante, error: participanteError } = await admin.from("participantes_comerciais").insert({ empresa_id: ingress.empresaId, nome, nome_exibicao: nome, cpf, telefone, whatsapp: telefone, status: "ATIVO", cargo: "Indicador do programa" }).select("id").single();
    if (participanteError || !participante) return NextResponse.json({ error: participanteError?.message ?? "Falha ao criar indicador." }, { status: 500 });
    const { error: tipoError } = await admin.from("participante_tipos").insert({ empresa_id: ingress.empresaId, participante_id: participante.id, tipo_codigo: "INDICADOR" });
    const { data: indicador, error: indicadorError } = await admin.from("programa_indicadores").insert({ empresa_id: ingress.empresaId, participante_id: participante.id, cpf, telefone, chave_pix: chavePix, empresa_trabalho: empresaTrabalho || null }).select("id").single();
    if (tipoError || indicadorError || !indicador) {
      await admin.from("participantes_comerciais").delete().eq("id", participante.id).eq("empresa_id", ingress.empresaId);
      return NextResponse.json({ error: tipoError?.message ?? indicadorError?.message ?? "Falha ao concluir cadastro." }, { status: 500 });
    }
    const { data: perfilIndicador } = await admin.from("comissao_perfis").select("id").eq("empresa_id", ingress.empresaId).eq("papel_base", "INDICADOR").eq("nome", "Indicador Padrão").eq("ativo", true).maybeSingle();
    if (perfilIndicador) {
      await admin.from("participante_comissao_perfis").insert({ empresa_id: ingress.empresaId, participante_id: participante.id, papel_tipo: "INDICADOR", perfil_id: perfilIndicador.id, vigencia_inicio: new Date().toISOString().slice(0, 10), ativo: true });
    }
    await admin.from("programa_indicacoes").update({ indicador_id: indicador.id }).eq("empresa_id", ingress.empresaId).is("indicador_id", null).eq("indicador_telefone_snapshot", telefone);
    return NextResponse.json({ ok: true, indicadorId: indicador.id, existente: false });
  }
  return NextResponse.json({ error: "Ação inválida." }, { status: 400 });
}
