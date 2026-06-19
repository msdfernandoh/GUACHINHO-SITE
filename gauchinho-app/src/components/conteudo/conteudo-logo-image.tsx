import Image from "next/image";
import { cn } from "@/lib/utils/cn";
import { isSupabaseStoragePublicUrl, normalizeConteudoImageUrl } from "@/lib/conteudo/normalize-image-url";

export { normalizeConteudoImageUrl } from "@/lib/conteudo/normalize-image-url";

type Props = {
  src: string;
  alt: string;
  className?: string;
  fill?: boolean;
  sizes?: string;
  priority?: boolean;
};

export function ConteudoLogoImage({ src, alt, className, fill, sizes = "120px", priority }: Props) {
  const url = normalizeConteudoImageUrl(src);
  if (!url) return null;

  const imgClass = cn("object-contain", fill ? "h-full w-full" : className);

  if (url.startsWith("/") || isSupabaseStoragePublicUrl(url)) {
    if (fill) {
      return (
        <Image
          src={url}
          alt={alt}
          fill
          className={imgClass}
          sizes={sizes}
          priority={priority}
          unoptimized={url.endsWith(".svg")}
        />
      );
    }
    return (
      <Image
        src={url}
        alt={alt}
        width={120}
        height={48}
        className={imgClass}
        sizes={sizes}
        priority={priority}
        unoptimized={url.endsWith(".svg")}
      />
    );
  }

  if (fill) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={url} alt={alt} className={imgClass} loading="lazy" referrerPolicy="no-referrer" />;
  }

  // eslint-disable-next-line @next/next/no-img-element
  return <img src={url} alt={alt} className={imgClass} loading="lazy" referrerPolicy="no-referrer" />;
}
