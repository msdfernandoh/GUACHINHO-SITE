import { NextResponse } from "next/server";
import { authorizePublicIngress } from "@/lib/security/public-ingress";
import { createAdminClient } from "@/lib/supabase/admin";
import { upsertLeadPorTelefone } from "@/lib/crm/upsert-lead";

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

  if (acao === "indicar_por_link") {
    const codigoIndicacao = String(body.codigoIndicacao ?? "").trim().toUpperCase();
    const nome = String(body.nome ?? "").trim();
    const telefone = digits(body.telefone);
    const relacao = String(body.relacao ?? "");
    const relacaoOutro = String(body.relacaoOutro ?? "").trim();
    const produto = String(body.produto ?? "");
    const credito = Number(body.credito);
    const capacidadeMensal = Number(body.capacidadeMensal);
    const observacaoLivre = String(body.observacao ?? "").trim();
    const estrategiaCredito = String(body.estrategiaCredito ?? "").trim();
    const prazoUtilizacaoCredito = String(body.prazoUtilizacaoCredito ?? "").trim();
    const preferenciaAtendimento = String(body.preferenciaAtendimento ?? "").trim();
    const quandoAtendimento = String(body.quandoAtendimento ?? "").trim();
    const periodoContato = String(body.periodoContato ?? "").trim();
    if (!/^[A-F0-9]{10}$/.test(codigoIndicacao)) return NextResponse.json({ error: "Link de indicação inválido." }, { status: 404 });
    if (nome.length < 3 || telefone.length < 10) return NextResponse.json({ error: "Informe nome completo e telefone com DDD." }, { status: 400 });
    if (!['AMIGO', 'FAMILIAR', 'CLIENTE', 'OUTROS'].includes(relacao) || (relacao === 'OUTROS' && !relacaoOutro)) return NextResponse.json({ error: "Informe a relação com quem indicou." }, { status: 400 });
    if (!['IMOVEL', 'VEICULO', 'MOTO', 'FROTA'].includes(produto) || !Number.isFinite(credito) || credito <= 0 || !Number.isFinite(capacidadeMensal) || capacidadeMensal <= 0) return NextResponse.json({ error: "Complete as informações da indicação." }, { status: 400 });
    if (!['ACESSO_RAPIDO', 'PARCELA_CONFORTAVEL', 'EQUILIBRIO'].includes(estrategiaCredito) || !['RAPIDO', 'ATE_6_MESES', 'DE_6_A_12_MESES', 'DE_1_A_2_ANOS', 'MAIS_DE_2_ANOS', 'SEM_PRAZO'].includes(prazoUtilizacaoCredito)) return NextResponse.json({ error: "Responda as duas perguntas iniciais para continuar." }, { status: 400 });
    if (!['NETWORK', 'VISITA', 'ESCRITORIO'].includes(preferenciaAtendimento) || !['QUANTO_ANTES', 'PROXIMOS_DIAS', 'PROXIMA_SEMANA', 'COMBINAR_DEPOIS'].includes(quandoAtendimento) || !['MANHA', 'TARDE', 'NOITE', 'QUALQUER'].includes(periodoContato)) return NextResponse.json({ error: "Responda as preferências de atendimento para concluir." }, { status: 400 });

    const { data: indicador } = await admin
      .from("programa_indicadores")
      .select("id,participante_id,participante:participantes_comerciais(nome,telefone,whatsapp)")
      .eq("empresa_id", ingress.empresaId)
      .eq("codigo_indicacao_curto", codigoIndicacao)
      .eq("ativo", true)
      .maybeSingle();
    if (!indicador) return NextResponse.json({ error: "Este link de indicação não está mais disponível." }, { status: 404 });

    const participante = Array.isArray(indicador.participante) ? indicador.participante[0] : indicador.participante;
    const relacaoTexto = relacao === 'OUTROS' ? relacaoOutro : relacao.toLowerCase();
    const estrategiaTexto = { ACESSO_RAPIDO: "Buscar uma estratégia para ter acesso ao crédito mais rápido", PARCELA_CONFORTAVEL: "Ter uma parcela mais confortável para alcançar um crédito maior", EQUILIBRIO: "Encontrar equilíbrio entre prazo, parcela e valor do crédito" }[estrategiaCredito]!;
    const prazoTexto = { RAPIDO: "O mais rápido possível", ATE_6_MESES: "Até 6 meses", DE_6_A_12_MESES: "De 6 a 12 meses", DE_1_A_2_ANOS: "De 1 a 2 anos", MAIS_DE_2_ANOS: "Mais de 2 anos", SEM_PRAZO: "Ainda não tenho um prazo definido" }[prazoUtilizacaoCredito]!;
    const preferenciaTexto = { NETWORK: "Participar do Network de Negócios, realizado às terças-feiras", VISITA: "Agendar uma visita em casa ou na empresa", ESCRITORIO: "Agendar um atendimento no escritório" }[preferenciaAtendimento]!;
    const quandoTexto = { QUANTO_ANTES: "O quanto antes", PROXIMOS_DIAS: "Nos próximos dias", PROXIMA_SEMANA: "Na próxima semana", COMBINAR_DEPOIS: "Prefere combinar uma data depois" }[quandoAtendimento]!;
    const periodoTexto = { MANHA: "Manhã", TARDE: "Tarde", NOITE: "Noite", QUALQUER: "Qualquer período" }[periodoContato]!;
    const observacao = [`Indicação recebida por link público. Relação com o indicador: ${relacaoTexto}.`, `Estratégia desejada: ${estrategiaTexto}.`, `Prazo para utilizar o crédito: ${prazoTexto}.`, `Preferência de atendimento: ${preferenciaTexto}.`, `Quando deseja atendimento: ${quandoTexto}.`, `Melhor período para contato: ${periodoTexto}.`, observacaoLivre].filter(Boolean).join(" ");
    const lead = await upsertLeadPorTelefone(admin, {
      empresa_id: ingress.empresaId,
      nome,
      whatsapp: telefone,
      origem: "indicacao",
      origem_detalhe: "Link público do indicador",
      tipo_interesse: produto.toLowerCase(),
      tipo_credito: produto,
      valor_estimado: credito,
      valor_simulado: credito,
      valor_parcela: capacidadeMensal,
      status: "Novo",
      observacoes: observacao,
      estrategia_credito: estrategiaTexto,
      prazo_utilizacao_credito: prazoTexto,
      preferencia_atendimento: preferenciaTexto,
      quando_atendimento: quandoTexto,
      periodo_contato: periodoTexto,
    });
    if (!lead.ok || !lead.lead_id) return NextResponse.json({ error: lead.error ?? "Não foi possível registrar sua indicação." }, { status: 500 });
    await admin.from("leads").update({
      estrategia_credito: estrategiaTexto,
      prazo_utilizacao_credito: prazoTexto,
      preferencia_atendimento: preferenciaTexto,
      quando_atendimento: quandoTexto,
      periodo_contato: periodoTexto,
    }).eq("empresa_id", ingress.empresaId).eq("id", lead.lead_id);
    const { data: existente } = await admin.from("programa_indicacoes")
      .select("id,indicador_id,status,venda_id")
      .eq("empresa_id", ingress.empresaId).eq("lead_id", lead.lead_id).maybeSingle();
    if (existente && existente.indicador_id !== indicador.id) return NextResponse.json({ error: "Este telefone já possui uma indicação cadastrada por outro participante.", field: "telefone" }, { status: 409 });
    const valores = {
      indicador_nome_snapshot: participante?.nome ?? "Indicador",
      indicador_telefone_snapshot: digits(participante?.whatsapp ?? participante?.telefone),
      produto_interesse: produto,
      credito_desejado: credito,
      capacidade_mensal: capacidadeMensal,
      observacao_indicado: observacao,
    };
    const write = existente
      ? existente.venda_id || existente.status !== "PENDENTE"
        ? { error: { message: "Indicação em andamento" } }
        : await admin.from("programa_indicacoes").update(valores).eq("empresa_id", ingress.empresaId).eq("id", existente.id)
      : await admin.from("programa_indicacoes").insert({ empresa_id: ingress.empresaId, indicador_id: indicador.id, lead_id: lead.lead_id, ...valores });
    if (write.error) return NextResponse.json({ error: "Não foi possível concluir o vínculo da indicação." }, { status: existente ? 409 : 500 });
    await admin.from("lead_atividades").insert({
      empresa_id: ingress.empresaId,
      lead_id: lead.lead_id,
      tipo: "qualificacao_indicacao",
      titulo: "Preferências de atendimento informadas",
      descricao: `Indicador: ${participante?.nome ?? "Indicador"}\n• Atendimento: ${preferenciaTexto}\n• Quando: ${quandoTexto}\n• Melhor período: ${periodoTexto}`,
      status: "concluida",
      data_conclusao: new Date().toISOString(),
    });
    return NextResponse.json({ ok: true });
  }

  if (acao === "confirmar_network") {
    const codigoIndicacao = String(body.codigoIndicacao ?? "").trim().toUpperCase();
    const nome = String(body.nome ?? "").trim();
    const telefone = digits(body.telefone);
    const atividadeProfissional = String(body.atividadeProfissional ?? "").trim();
    const interesse = String(body.interesse ?? "").trim();
    if (!/^[A-F0-9]{10}$/.test(codigoIndicacao)) return NextResponse.json({ error: "Link de convite inválido." }, { status: 404 });
    if (nome.split(/\s+/).length < 2 || telefone.length < 10 || atividadeProfissional.length < 2) return NextResponse.json({ error: "Preencha nome completo, telefone e atividade profissional." }, { status: 400 });
    if (!['CONFIRMADO', 'MAIS_INFORMACOES'].includes(interesse)) return NextResponse.json({ error: "Confirme como deseja participar." }, { status: 400 });

    const { data: indicador } = await admin.from("programa_indicadores")
      .select("id,participante:participantes_comerciais(nome,telefone,whatsapp)")
      .eq("empresa_id", ingress.empresaId).eq("codigo_indicacao_curto", codigoIndicacao).eq("ativo", true).maybeSingle();
    if (!indicador) return NextResponse.json({ error: "Este link de convite não está mais disponível." }, { status: 404 });
    const participante = Array.isArray(indicador.participante) ? indicador.participante[0] : indicador.participante;
    const observacao = `Convite para o Network de Negócios em 29/09/2026 às 19h. Atividade: ${atividadeProfissional}. Interesse: ${interesse === 'CONFIRMADO' ? 'participação confirmada' : 'deseja mais informações'}.`;
    const lead = await upsertLeadPorTelefone(admin, {
      empresa_id: ingress.empresaId, nome, whatsapp: telefone, origem: "evento",
      origem_detalhe: "Network de Negócios — convite do indicador",
      evento_nome: "Network de Negócios — 29/09/2026",
      observacoes: observacao,
      dados_simulacao: { evento_codigo: "NETWORK_2026_09_29", atividade_profissional: atividadeProfissional, interesse_participacao: interesse, indicador_id: indicador.id },
      status: "Novo",
    });
    if (!lead.ok || !lead.lead_id) return NextResponse.json({ error: lead.error ?? "Não foi possível confirmar agora." }, { status: 500 });

    const { data: indicacaoExistente } = await admin.from("programa_indicacoes").select("id,indicador_id")
      .eq("empresa_id", ingress.empresaId).eq("lead_id", lead.lead_id).maybeSingle();
    if (indicacaoExistente && indicacaoExistente.indicador_id !== indicador.id) return NextResponse.json({ error: "Este contato já está vinculado a outro indicador." }, { status: 409 });
    const { data: conviteExistente } = await admin.from("programa_convites_network").select("id,indicador_id")
      .eq("empresa_id", ingress.empresaId).eq("evento_codigo", "NETWORK_2026_09_29").eq("telefone", telefone).maybeSingle();
    if (conviteExistente && conviteExistente.indicador_id !== indicador.id) return NextResponse.json({ error: "Este telefone já confirmou participação por outro convite." }, { status: 409 });

    if (!indicacaoExistente) {
      const { error: indicacaoError } = await admin.from("programa_indicacoes").insert({
        empresa_id: ingress.empresaId, indicador_id: indicador.id, lead_id: lead.lead_id,
        indicador_nome_snapshot: participante?.nome ?? "Indicador",
        indicador_telefone_snapshot: digits(participante?.whatsapp ?? participante?.telefone),
        observacao_indicado: observacao,
      });
      if (indicacaoError) return NextResponse.json({ error: "Não foi possível atribuir este contato ao indicador agora." }, { status: 500 });
    }

    const convitePayload = { empresa_id: ingress.empresaId, indicador_id: indicador.id, lead_id: lead.lead_id, evento_codigo: "NETWORK_2026_09_29", nome, telefone, atividade_profissional: atividadeProfissional, interesse_participacao: interesse, updated_at: new Date().toISOString() };
    const conviteWrite = conviteExistente
      ? await admin.from("programa_convites_network").update(convitePayload).eq("empresa_id", ingress.empresaId).eq("id", conviteExistente.id)
      : await admin.from("programa_convites_network").insert(convitePayload);
    if (conviteWrite.error) return NextResponse.json({ error: "Não foi possível salvar sua participação agora." }, { status: 500 });

    return NextResponse.json({ ok: true, confirmado: interesse === "CONFIRMADO" });
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
      const { error: atualizacaoError } = await admin.from("programa_indicadores").update({
        telefone,
        chave_pix: chavePix,
        modelo_interesse: modelo,
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
      return NextResponse.json({ ok: true, indicadorId: existente.id, existente: true, atualizado: true, acesso: "/app-indicador/login" });
    }
    const { data: perfil } = await admin.from("comissao_perfis").select("id").eq("empresa_id", ingress.empresaId).eq("nome", "Gerador de Oportunidades").eq("ativo", true).maybeSingle();
    const { data: papel } = await admin.from("papeis").select("id").eq("escopo", "COMPANY").eq("codigo", "consultor").is("empresa_id", null).maybeSingle();
    if (!perfil || !papel) return NextResponse.json({ error: "Configuração de acesso indisponível. Procure a equipe." }, { status: 503 });
    // O e-mail real é a identidade de Auth do parceiro para que a recuperação
    // de senha seja entregue no endereço informado. O login continua por CPF.
    const loginEmail = email;
    const { data: auth, error: authError } = await admin.auth.admin.createUser({ email: loginEmail, password: senha, email_confirm: true, user_metadata: { email_contato: email, cpf } });
    if (authError || !auth.user) return NextResponse.json({ error: "Este e-mail já possui acesso ou não pôde ser cadastrado. Entre no app ou use a recuperação de senha." }, { status: 409 });
    let usuarioNovoId: string | null = null;
    let participanteNovoId: string | null = null;
    let indicadorNovoId: string | null = null;
    try {
      // O perfil legado parceiro não concede permissões de equipe; o escopo real
      // é definido pelo vínculo N:N e por `erp_modulos_visiveis`.
      const { data: usuario, error: usuarioError } = await admin.from("usuarios").insert({ auth_user_id: auth.user.id, nome, email, telefone, perfil: "parceiro", ativo: true, is_consultor: true, leads_apenas_proprios: true }).select("id").single();
      if (usuarioError || !usuario) throw new Error(usuarioError?.message ?? "Falha ao criar usuário.");
      usuarioNovoId = usuario.id;
      const { error: vinculoError } = await admin.from("empresa_usuarios").insert({ empresa_id: ingress.empresaId, usuario_id: usuario.id, papel_id: papel.id, ativo: true, origem: "LANDING_PARCEIROS", erp_modulos_visiveis: ["minhas-comissoes"] });
      if (vinculoError) throw new Error(vinculoError.message);
      const participantePayload = { nome, nome_exibicao: nome, cpf, telefone, whatsapp: telefone, status: "ATIVO", cargo: "Consultor", escopo_visualizacao: "VINCULADOS", modulos_permitidos: ["minhas-comissoes"] };
      const { data: participanteCriadoPeloVinculo } = await admin.from("participantes_comerciais")
        .select("id").eq("empresa_id", ingress.empresaId).eq("usuario_id", usuario.id).eq("status", "ATIVO").maybeSingle();
      const participanteResult = participanteCriadoPeloVinculo
        ? await admin.from("participantes_comerciais").update(participantePayload).eq("empresa_id", ingress.empresaId).eq("id", participanteCriadoPeloVinculo.id).select("id").single()
        : await admin.from("participantes_comerciais").insert({ empresa_id: ingress.empresaId, usuario_id: usuario.id, ...participantePayload }).select("id").single();
      const { data: participante, error: participanteError } = participanteResult;
      if (participanteError || !participante) throw new Error(participanteError?.message ?? "Falha ao criar participante.");
      participanteNovoId = participante.id;
      const statusSolicitacao = "APROVADO_NIVEL_1";
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
      indicadorNovoId = indicador.id;
      const { error: perfilError } = await admin.from("participante_comissao_perfis").insert({ empresa_id: ingress.empresaId, participante_id: participante.id, papel_tipo: "INDICADOR", perfil_id: perfil.id, vigencia_inicio: new Date().toISOString().slice(0, 10), ativo: true });
      if (perfilError) throw new Error(perfilError.message);
      const { error: tipoConsultorError } = await admin.from("participante_tipos").upsert({
        empresa_id: ingress.empresaId, participante_id: participante.id, tipo_codigo: "CONSULTOR",
      }, { onConflict: "participante_id,tipo_codigo", ignoreDuplicates: true });
      if (tipoConsultorError) throw new Error(tipoConsultorError.message);
      return NextResponse.json({ ok: true, indicadorId: indicador.id, acesso: "/app-indicador/login" });
    } catch (error) {
      console.error("[programa-indicacao] falha no cadastro de parceiro", error instanceof Error ? error.message : error);
      if (indicadorNovoId) await admin.from("programa_indicadores").delete().eq("empresa_id", ingress.empresaId).eq("id", indicadorNovoId);
      if (participanteNovoId) await admin.from("participantes_comerciais").delete().eq("empresa_id", ingress.empresaId).eq("id", participanteNovoId);
      if (usuarioNovoId) {
        await admin.from("empresa_usuarios").delete().eq("empresa_id", ingress.empresaId).eq("usuario_id", usuarioNovoId);
        await admin.from("usuarios").delete().eq("id", usuarioNovoId);
      }
      await admin.auth.admin.deleteUser(auth.user.id);
      return NextResponse.json({ error: "Não foi possível concluir seu cadastro agora. Nenhum acesso incompleto foi mantido." }, { status: 500 });
    }
  }
  return NextResponse.json({ error: "Ação inválida." }, { status: 400 });
}
