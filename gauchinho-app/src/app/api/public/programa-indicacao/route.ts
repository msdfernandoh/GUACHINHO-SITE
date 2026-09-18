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

    const { data: perfilIndicador, error: perfilError } = await admin.from("comissao_perfis")
      .select("id")
      .eq("empresa_id", ingress.empresaId)
      .eq("papel_base", "INDICADOR")
      .eq("nome", "Indicador")
      .eq("ativo", true)
      .maybeSingle();
    if (perfilError || !perfilIndicador) {
      return NextResponse.json({ error: "O perfil de comissão Indicador não está disponível. Procure a equipe para concluir o cadastro." }, { status: 503 });
    }

    const { data: participante, error: participanteError } = await admin.from("participantes_comerciais").insert({ empresa_id: ingress.empresaId, nome, nome_exibicao: nome, cpf, telefone, whatsapp: telefone, status: "ATIVO", cargo: "Indicador do programa", escopo_visualizacao: "VINCULADOS", modulos_permitidos: ["minhas-comissoes"] }).select("id").single();
    if (participanteError || !participante) return NextResponse.json({ error: participanteError?.message ?? "Falha ao criar indicador." }, { status: 500 });
    const { error: tipoError } = await admin.from("participante_tipos").insert({ empresa_id: ingress.empresaId, participante_id: participante.id, tipo_codigo: "INDICADOR" });
    const { data: indicador, error: indicadorError } = await admin.from("programa_indicadores").insert({ empresa_id: ingress.empresaId, participante_id: participante.id, cpf, telefone, chave_pix: chavePix, empresa_trabalho: empresaTrabalho || null }).select("id").single();
    if (tipoError || indicadorError || !indicador) {
      await admin.from("participantes_comerciais").delete().eq("id", participante.id).eq("empresa_id", ingress.empresaId);
      return NextResponse.json({ error: tipoError?.message ?? indicadorError?.message ?? "Falha ao concluir cadastro." }, { status: 500 });
    }
    const { error: vinculoError } = await admin.from("participante_comissao_perfis").insert({ empresa_id: ingress.empresaId, participante_id: participante.id, papel_tipo: "INDICADOR", perfil_id: perfilIndicador.id, vigencia_inicio: new Date().toISOString().slice(0, 10), ativo: true });
    if (vinculoError) {
      await admin.from("programa_indicadores").delete().eq("id", indicador.id).eq("empresa_id", ingress.empresaId);
      await admin.from("participantes_comerciais").delete().eq("id", participante.id).eq("empresa_id", ingress.empresaId);
      return NextResponse.json({ error: "Falha ao vincular o perfil de comissão Indicador. Tente novamente." }, { status: 500 });
    }
    await admin.from("programa_indicacoes").update({ indicador_id: indicador.id }).eq("empresa_id", ingress.empresaId).is("indicador_id", null).eq("indicador_telefone_snapshot", telefone);
    return NextResponse.json({ ok: true, indicadorId: indicador.id, existente: false });
  }
  if (acao === "cadastrar_parceiro") {
    const nome = String(body.nome ?? "").trim(); const cpf = digits(body.cpf); const telefone = digits(body.whatsapp);
    const email = String(body.email ?? "").trim().toLowerCase(); const senha = String(body.senha ?? "");
    const chavePix = String(body.chavePix ?? "").trim();
    const modelo = String(body.modeloInteresse ?? "GERADOR_POSSIBILIDADES");
    const redeRelacionamento = Array.isArray(body.redeRelacionamento)
      ? body.redeRelacionamento.map((item) => String(item).trim()).filter(Boolean).slice(0, 12)
      : [];
    if (nome.split(/\s+/).length < 2 || !cpfValido(cpf) || telefone.length < 10 || !email.includes("@") || senha.length < 8 || chavePix.length < 3) {
      return NextResponse.json({ error: "Preencha nome, CPF, WhatsApp, e-mail, senha de 8 caracteres e chave PIX." }, { status: 400 });
    }
    if (!['MICROFRANQUEADO','GERADOR_NEGOCIOS','GERADOR_POSSIBILIDADES','CONVERSAR_EQUIPE'].includes(modelo)) return NextResponse.json({ error: "Modelo de parceria inválido." }, { status: 400 });
    const { data: existente } = await admin.from("programa_indicadores").select("id,participante_id").eq("empresa_id", ingress.empresaId).eq("cpf", cpf).maybeSingle();
    if (existente) {
      const requerAnalise = modelo === "MICROFRANQUEADO" || modelo === "GERADOR_NEGOCIOS";
      const statusSolicitacao = requerAnalise ? "EM_ANALISE" : "APROVADO_NIVEL_1";
      const { error: atualizacaoError } = await admin.from("programa_indicadores").update({
        telefone,
        chave_pix: chavePix,
        modelo_interesse: modelo,
        status_solicitacao_modelo: statusSolicitacao,
        cidade: String(body.cidade ?? "").trim() || null,
        estado: String(body.estado ?? "").trim() || null,
        profissao: String(body.profissao ?? "").trim() || null,
        observacao_cadastro: String(body.observacao ?? "").trim() || null,
        ja_vende_consorcio: String(body.jaVendeConsorcio ?? "").trim() || null,
        rede_relacionamento: redeRelacionamento,
        potencial_mensal: String(body.potencialMensal ?? "").trim() || null,
        interesse_network: String(body.interesseNetwork ?? "").trim() || null,
        origem_cadastro: "LANDING_PARCEIROS",
        pagina_origem: String(body.paginaOrigem ?? "").trim().slice(0, 255) || null,
        utm_source: String(body.utmSource ?? "").trim().slice(0, 255) || null,
        utm_medium: String(body.utmMedium ?? "").trim().slice(0, 255) || null,
        utm_campaign: String(body.utmCampaign ?? "").trim().slice(0, 255) || null,
      }).eq("empresa_id", ingress.empresaId).eq("id", existente.id);
      if (atualizacaoError) return NextResponse.json({ error: "Não foi possível atualizar seu cadastro agora." }, { status: 500 });
      if (existente.participante_id) {
        await admin.from("participantes_comerciais").update({ nome, nome_exibicao: nome, telefone, whatsapp: telefone }).eq("empresa_id", ingress.empresaId).eq("id", existente.participante_id);
      }
      if (requerAnalise) {
        await admin.from("programa_indicadores_solicitacoes").upsert({ empresa_id: ingress.empresaId, indicador_id: existente.id, modelo_solicitado: modelo }, { onConflict: "empresa_id,indicador_id,modelo_solicitado,status", ignoreDuplicates: true });
      }
      return NextResponse.json({ ok: true, indicadorId: existente.id, existente: true, atualizado: true, acesso: "/app-indicador/login" });
    }
    const { data: perfil } = await admin.from("comissao_perfis").select("id").eq("empresa_id", ingress.empresaId).eq("papel_base", "INDICADOR").eq("nome", "Indicador").eq("ativo", true).maybeSingle();
    const { data: papel } = await admin.from("papeis").select("id").eq("escopo", "COMPANY").eq("codigo", "consultor").is("empresa_id", null).maybeSingle();
    if (!perfil || !papel) return NextResponse.json({ error: "Configuração de acesso indisponível. Procure a equipe." }, { status: 503 });
    // O e-mail real é a identidade de Auth do parceiro para que a recuperação
    // de senha seja entregue no endereço informado. O login continua por CPF.
    const loginEmail = email;
    const { data: auth, error: authError } = await admin.auth.admin.createUser({ email: loginEmail, password: senha, email_confirm: true, user_metadata: { email_contato: email, cpf } });
    if (authError || !auth.user) return NextResponse.json({ error: authError?.message ?? "Não foi possível criar o acesso." }, { status: 409 });
    try {
      // O perfil legado parceiro não concede permissões de equipe; o escopo real
      // é definido pelo vínculo N:N e por `erp_modulos_visiveis`.
      const { data: usuario, error: usuarioError } = await admin.from("usuarios").insert({ auth_user_id: auth.user.id, nome, email, telefone, perfil: "parceiro", ativo: true, is_consultor: true, leads_apenas_proprios: true }).select("id").single();
      if (usuarioError || !usuario) throw new Error(usuarioError?.message ?? "Falha ao criar usuário.");
      const { error: vinculoError } = await admin.from("empresa_usuarios").insert({ empresa_id: ingress.empresaId, usuario_id: usuario.id, papel_id: papel.id, ativo: true, origem: "LANDING_PARCEIROS", erp_modulos_visiveis: ["minhas-comissoes"] });
      if (vinculoError) throw new Error(vinculoError.message);
      const { data: participante, error: participanteError } = await admin.from("participantes_comerciais").insert({ empresa_id: ingress.empresaId, usuario_id: usuario.id, nome, nome_exibicao: nome, cpf, telefone, whatsapp: telefone, status: "ATIVO", cargo: "Gerador de Possibilidades", escopo_visualizacao: "VINCULADOS", modulos_permitidos: ["minhas-comissoes"] }).select("id").single();
      if (participanteError || !participante) throw new Error(participanteError?.message ?? "Falha ao criar participante.");
      const requerAnalise = modelo === "MICROFRANQUEADO" || modelo === "GERADOR_NEGOCIOS";
      const statusSolicitacao = requerAnalise ? "EM_ANALISE" : "APROVADO_NIVEL_1";
      const { data: indicador, error: indicadorError } = await admin.from("programa_indicadores").insert({
        empresa_id: ingress.empresaId,
        participante_id: participante.id,
        cpf,
        telefone,
        chave_pix: chavePix,
        modelo_interesse: modelo,
        status_solicitacao_modelo: statusSolicitacao,
        cidade: String(body.cidade ?? "").trim() || null,
        estado: String(body.estado ?? "").trim() || null,
        profissao: String(body.profissao ?? "").trim() || null,
        observacao_cadastro: String(body.observacao ?? "").trim() || null,
        ja_vende_consorcio: String(body.jaVendeConsorcio ?? "").trim() || null,
        rede_relacionamento: redeRelacionamento,
        potencial_mensal: String(body.potencialMensal ?? "").trim() || null,
        interesse_network: String(body.interesseNetwork ?? "").trim() || null,
        origem_cadastro: "LANDING_PARCEIROS",
        pagina_origem: String(body.paginaOrigem ?? "").trim().slice(0, 255) || null,
        utm_source: String(body.utmSource ?? "").trim().slice(0, 255) || null,
        utm_medium: String(body.utmMedium ?? "").trim().slice(0, 255) || null,
        utm_campaign: String(body.utmCampaign ?? "").trim().slice(0, 255) || null,
      }).select("id").single();
      if (indicadorError || !indicador) throw new Error(indicadorError?.message ?? "Falha ao criar cadastro.");
      const { error: perfilError } = await admin.from("participante_comissao_perfis").insert({ empresa_id: ingress.empresaId, participante_id: participante.id, papel_tipo: "INDICADOR", perfil_id: perfil.id, vigencia_inicio: new Date().toISOString().slice(0, 10), ativo: true });
      if (perfilError) throw new Error(perfilError.message);
      if (requerAnalise) await admin.from("programa_indicadores_solicitacoes").insert({ empresa_id: ingress.empresaId, indicador_id: indicador.id, modelo_solicitado: modelo });
      return NextResponse.json({ ok: true, indicadorId: indicador.id, acesso: "/app-indicador/login" });
    } catch (error) {
      await admin.auth.admin.deleteUser(auth.user.id);
      return NextResponse.json({ error: error instanceof Error ? error.message : "Falha ao concluir cadastro." }, { status: 500 });
    }
  }
  return NextResponse.json({ error: "Ação inválida." }, { status: 400 });
}
