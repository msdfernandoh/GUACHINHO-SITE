import { createAdminClient } from "@/lib/supabase/admin";

const BUCKET_IMOB = "imobiliarias";
const BUCKET_IMOVEIS = "imoveis";
export type StorageBucketPublico =
  | typeof BUCKET_IMOB
  | typeof BUCKET_IMOVEIS
  | "conteudo"
  | "depoimentos"
  | "parceiros";

export async function uploadImagemPublica(
  bucket: StorageBucketPublico,
  path: string,
  file: File,
): Promise<string> {
  const admin = createAdminClient();
  const buffer = Buffer.from(await file.arrayBuffer());
  const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
  const fullPath = `${path}.${ext}`.replace(/\.+/g, ".");

  const { error } = await admin.storage.from(bucket).upload(fullPath, buffer, {
    contentType: file.type || "image/jpeg",
    upsert: true,
  });
  if (error) throw new Error(error.message);

  const { data } = admin.storage.from(bucket).getPublicUrl(fullPath);
  return data.publicUrl;
}
