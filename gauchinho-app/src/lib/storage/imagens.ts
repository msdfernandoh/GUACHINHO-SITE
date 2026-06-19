import { createAdminClient } from "@/lib/supabase/admin";
import { ensurePublicStorageBucket } from "@/lib/storage/ensure-bucket";

const BUCKET_IMOB = "imobiliarias";
const BUCKET_IMOVEIS = "imoveis";
export type StorageBucketPublico =
  | typeof BUCKET_IMOB
  | typeof BUCKET_IMOVEIS
  | "conteudo"
  | "depoimentos"
  | "parceiros";

const ALLOWED_EXT = new Set(["jpeg", "jpg", "png", "webp", "gif", "svg"]);

function resolveStoragePath(path: string, file: File): { fullPath: string; contentType: string } {
  const extRaw = file.name.split(".").pop()?.toLowerCase() || "jpg";
  const ext = ALLOWED_EXT.has(extRaw) ? extRaw : "jpg";
  const fullPath = path.includes(".") ? path : `${path}.${ext}`;

  const contentType =
    file.type ||
    (ext === "png"
      ? "image/png"
      : ext === "webp"
        ? "image/webp"
        : ext === "gif"
          ? "image/gif"
          : ext === "svg"
            ? "image/svg+xml"
            : "image/jpeg");

  return { fullPath, contentType };
}

export async function uploadImagemPublica(
  bucket: StorageBucketPublico,
  path: string,
  file: File,
): Promise<string> {
  const admin = createAdminClient();
  await ensurePublicStorageBucket(admin, bucket);

  const buffer = Buffer.from(await file.arrayBuffer());
  const { fullPath, contentType } = resolveStoragePath(path, file);

  const { error } = await admin.storage.from(bucket).upload(fullPath, buffer, {
    contentType,
    upsert: true,
  });
  if (error) throw new Error(error.message);

  const { data } = admin.storage.from(bucket).getPublicUrl(fullPath);
  return data.publicUrl;
}
