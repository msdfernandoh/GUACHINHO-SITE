import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { encryptCredential, decryptCredential } from "@/lib/automacoes/robos/cryptoService";
import { INSTANCIA_COLUNAS, type InstanciaView } from "./types";
import { numerosConferem } from "./validation";
export async function listarInstancias(empresa: string): Promise<InstanciaView[]> {
    const { data, error } = await createAdminClient().from("whatsapp_instancias").select(INSTANCIA_COLUNAS + ",modelo:whatsapp_instancia_modelos(*)").eq("empresa_id", empresa).eq("ativo", true).order("created_at");
    if (error)
        throw new Error("Não foi possível carregar instâncias. Confira a migration 332 no Supabase.");
    return (data || []) as unknown as InstanciaView[];
}
export async function getInstancia(empresa: string, id: string) {
    const { data, error } = await createAdminClient().from("whatsapp_instancias").select("*,modelo:whatsapp_instancia_modelos(*)").eq("empresa_id", empresa).eq("id", id).maybeSingle();
    if (error || !data || !data.ativo)
        throw new Error("Instância indisponível para esta empresa.");
    return data as InstanciaView & {
        token_cifrado: string | null;
        destinatarios_teste: string[];
        revisao: number;
    };
}
export function tokenDaInstancia(i: {
    token_cifrado: string | null;
    token_expira_em: string | null;
}) {
    if (!i.token_cifrado || (i.token_expira_em && Date.parse(i.token_expira_em) <= Date.now()))
        throw new Error("Token ausente ou expirado. Solicite configuração ao administrador SaaS.");
    return decryptCredential(i.token_cifrado);
}
export async function salvarConexao(input: {
    instancia: Awaited<ReturnType<typeof getInstancia>>;
    waba: string;
    phone: string;
    token: string;
    numero: string;
    nome?: string;
    expira?: string | null;
    usuario: string;
    aviso?: string | null;
}) {
    const i = input.instancia;
    const alerta = numerosConferem(i.numero_celular, input.numero) ? null : "O número conectado pela Meta difere do número cadastrado pelo SaaS. Confira antes de usar.";
    const { data, error } = await createAdminClient().from("whatsapp_instancias").update({ waba_id: input.waba, phone_number_id: input.phone, token_cifrado: encryptCredential(input.token), numero_exibicao: input.numero, verified_name: input.nome || null, token_expira_em: input.expira || null, alerta_numero: alerta, ultimo_erro: input.aviso || null, status: "conectado", conectado_por_id: input.usuario, conectado_em: new Date().toISOString(), updated_at: new Date().toISOString(), revisao: i.revisao + 1 }).eq("id", i.id).eq("empresa_id", i.empresa_id).eq("revisao", i.revisao).neq("status", "suspenso").eq("ativo", true).select("id");
    if (error || !data?.length)
        throw new Error("A instância foi alterada pelo SaaS ou o número já está em uso. Atualize a tela e tente novamente.");
    return alerta;
}
