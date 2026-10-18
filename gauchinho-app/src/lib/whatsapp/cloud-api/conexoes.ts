import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { encryptCredential, decryptCredential } from "@/lib/automacoes/robos/cryptoService";

export type WhatsappConexao = {
  id: string;
  empresa_id: string;
  waba_id: string;
  phone_number_id: string;
  numero_exibicao: string | null;
  verified_name: string | null;
  token_tipo: string;
  token_expira_em: string | null;
  coexistencia: boolean;
  status: string;
  ultimo_erro: string | null;
};

const PUBLIC_COLS =
  "id,empresa_id,waba_id,phone_number_id,numero_exibicao,verified_name,token_tipo,token_expira_em,coexistencia,status,ultimo_erro";

/** Conexão da franquia (sem token). */
export async function getConexaoPorEmpresa(empresaId: string): Promise<WhatsappConexao | null> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("empresa_whatsapp_conexoes")
    .select(PUBLIC_COLS)
    .eq("empresa_id", empresaId)
    .maybeSingle();
  return (data as WhatsappConexao) ?? null;
}

/** Resolve a empresa dona de um phone_number_id (usado no webhook). */
export async function getConexaoPorPhoneNumberId(phoneNumberId: string): Promise<WhatsappConexao | null> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("empresa_whatsapp_conexoes")
    .select(PUBLIC_COLS)
    .eq("phone_number_id", phoneNumberId)
    .maybeSingle();
  return (data as WhatsappConexao) ?? null;
}

/** Token descriptografado — somente servidor, nunca enviar ao client. */
export async function getTokenDaConexao(empresaId: string): Promise<string | null> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("empresa_whatsapp_conexoes")
    .select("token_cifrado")
    .eq("empresa_id", empresaId)
    .maybeSingle();
  if (!data?.token_cifrado) return null;
  return decryptCredential(data.token_cifrado);
}

export async function getTokenPorPhoneNumberId(phoneNumberId: string): Promise<string | null> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("empresa_whatsapp_conexoes")
    .select("token_cifrado")
    .eq("phone_number_id", phoneNumberId)
    .maybeSingle();
  if (!data?.token_cifrado) return null;
  return decryptCredential(data.token_cifrado);
}

export type SalvarConexaoInput = {
  empresaId: string;
  wabaId: string;
  phoneNumberId: string;
  token: string;
  numeroExibicao?: string | null;
  verifiedName?: string | null;
  tokenExpiraEm?: string | null;
  conectadoPorId?: string | null;
};

/** Cria/atualiza a conexão da franquia (upsert por empresa_id), token cifrado. */
export async function salvarConexao(input: SalvarConexaoInput): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin.from("empresa_whatsapp_conexoes").upsert(
    {
      empresa_id: input.empresaId,
      waba_id: input.wabaId,
      phone_number_id: input.phoneNumberId,
      numero_exibicao: input.numeroExibicao ?? null,
      verified_name: input.verifiedName ?? null,
      token_cifrado: encryptCredential(input.token),
      token_expira_em: input.tokenExpiraEm ?? null,
      conectado_por_id: input.conectadoPorId ?? null,
      status: "conectado",
      ultimo_erro: null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "empresa_id" },
  );
  if (error) throw new Error(`Falha ao salvar conexão WhatsApp: ${error.message}`);
}

export async function marcarErroConexao(empresaId: string, erro: string): Promise<void> {
  const admin = createAdminClient();
  await admin
    .from("empresa_whatsapp_conexoes")
    .update({ status: "erro", ultimo_erro: erro, updated_at: new Date().toISOString() })
    .eq("empresa_id", empresaId);
}
