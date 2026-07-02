import type { SupabaseClient } from "@supabase/supabase-js";
import type { StorageBucketPublico } from "./imagens";

const BUCKET_META: Record<
  StorageBucketPublico,
  { public: boolean; fileSizeLimit: number; allowedMimeTypes: string[] }
> = {
  imobiliarias: {
    public: true,
    fileSizeLimit: 5_242_880,
    allowedMimeTypes: ["image/jpeg", "image/png", "image/webp", "image/gif"],
  },
  imoveis: {
    public: true,
    fileSizeLimit: 5_242_880,
    allowedMimeTypes: ["image/jpeg", "image/png", "image/webp", "image/gif"],
  },
  conteudo: {
    public: true,
    fileSizeLimit: 5_242_880,
    allowedMimeTypes: ["image/jpeg", "image/png", "image/webp", "image/gif", "image/svg+xml"],
  },
  depoimentos: {
    public: true,
    fileSizeLimit: 5_242_880,
    allowedMimeTypes: ["image/jpeg", "image/png", "image/webp", "image/gif"],
  },
  parceiros: {
    public: true,
    fileSizeLimit: 5_242_880,
    allowedMimeTypes: ["image/jpeg", "image/png", "image/webp", "image/gif", "image/svg+xml"],
  },
  seguradoras: {
    public: true,
    fileSizeLimit: 5_242_880,
    allowedMimeTypes: ["image/jpeg", "image/png", "image/webp", "image/gif"],
  },
};

/** Garante bucket público antes do upload (útil se a migration ainda não rodou). */
export async function ensurePublicStorageBucket(
  admin: SupabaseClient,
  bucketId: StorageBucketPublico,
): Promise<void> {
  const meta = BUCKET_META[bucketId];
  const { data: buckets, error: listErr } = await admin.storage.listBuckets();
  if (listErr) throw new Error(listErr.message);

  const exists = buckets?.some((b) => b.id === bucketId);
  if (!exists) {
    const { error } = await admin.storage.createBucket(bucketId, {
      public: meta.public,
      fileSizeLimit: meta.fileSizeLimit,
      allowedMimeTypes: meta.allowedMimeTypes,
    });
    if (error) throw new Error(error.message);
    return;
  }

  const { error: updateErr } = await admin.storage.updateBucket(bucketId, {
    public: meta.public,
    fileSizeLimit: meta.fileSizeLimit,
    allowedMimeTypes: meta.allowedMimeTypes,
  });
  if (updateErr && !/not found/i.test(updateErr.message)) {
    throw new Error(updateErr.message);
  }
}
