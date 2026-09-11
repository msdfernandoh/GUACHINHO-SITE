export interface FaviconConfigInput {
  isRacon: boolean;
  customFavicon?: string | null;
}

export interface FaviconConfigResult {
  iconList: Array<{ url: string; sizes?: string; type?: string }>;
  shortcut: string;
  apple: string;
}

export function resolveFaviconConfig(input: FaviconConfigInput): FaviconConfigResult {
  const customFavicon = input.customFavicon?.trim() || null;
  const isRacon = input.isRacon;

  const shortcut = customFavicon || (isRacon ? "/racon/favicon-racon.png" : "/favicon.ico");
  const apple = customFavicon || (isRacon ? "/racon/favicon-racon.png" : "/apple-touch-icon.png");

  const iconList = customFavicon
    ? [{ url: customFavicon }]
    : isRacon
    ? [{ url: "/racon/favicon-racon.png", type: "image/png" }]
    : [
        { url: "/favicon.ico" },
        { url: "/favicon-gauchinho.png", sizes: "512x512", type: "image/png" },
      ];

  return {
    iconList,
    shortcut,
    apple,
  };
}
