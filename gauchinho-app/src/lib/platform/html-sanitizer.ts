/**
 * Sanitizador estrito de HTML e CSS para Modelos de Site Platform.
 * Garante que blocos customizados nunca executem JavaScript arbitrário,
 * nunca acessem sessões/cookies/APIs internas e nunca façam injeção de scripts.
 */

export type SanitizationResult = {
  sanitizedHtml: string;
  sanitizedCss: string;
  isSafe: boolean;
  warnings: string[];
};

export function sanitizeCustomHtml(rawHtml: string = ""): {
  html: string;
  sanitized: string;
  warnings: string[];
} {
  const warnings: string[] = [];
  let cleaned = rawHtml;

  const dangerousTagsRegex = /<\s*(script|object|embed|applet|iframe|base|meta|link(?!\s+rel=["']?stylesheet["']?))\b[^>]*>([\s\S]*?<\s*\/\s*\1\s*>)?/gi;
  const selfClosingDangerousTags = /<\s*(script|object|embed|applet|iframe|base|meta)\b[^>]*\/?>/gi;
  const inlineEventHandlers = /\s*on[a-z]+\s*=\s*(?:'[^']*'|"[^"]*"|[^\s>]+)/gi;
  const javascriptProtocols = /(?:href|src|action|data)\s*=\s*(?:'javascript:[^']*'|"javascript:[^"]*"|javascript:[^\s>]+)/gi;
  const vbscriptProtocols = /(?:href|src|action|data)\s*=\s*(?:'vbscript:[^']*'|"vbscript:[^"]*"|vbscript:[^\s>]+)/gi;
  const dataHtmlProtocols = /(?:href|src)\s*=\s*(?:'data:text\/html[^']*'|"data:text\/html[^"]*"|data:text\/html[^\s>]+)/gi;

  if (dangerousTagsRegex.test(cleaned) || selfClosingDangerousTags.test(cleaned)) {
    warnings.push("Tags perigosas (<script>, <iframe>, <object>, <embed>, <base>) foram removidas.");
    cleaned = cleaned.replace(dangerousTagsRegex, "").replace(selfClosingDangerousTags, "");
  }

  if (inlineEventHandlers.test(cleaned)) {
    warnings.push("Atributos de eventos inline (ex: onclick, onload, onerror) foram removidos.");
    cleaned = cleaned.replace(inlineEventHandlers, "");
  }

  if (javascriptProtocols.test(cleaned) || vbscriptProtocols.test(cleaned) || dataHtmlProtocols.test(cleaned)) {
    warnings.push("Protocolos executáveis inseguros (javascript:, data:text/html) foram removidos.");
    cleaned = cleaned
      .replace(javascriptProtocols, 'href="#"')
      .replace(vbscriptProtocols, 'href="#"')
      .replace(dataHtmlProtocols, 'src=""');
  }

  const finalHtml = cleaned.trim();
  return {
    html: finalHtml,
    sanitized: finalHtml,
    warnings,
  };
}

export function sanitizeCustomCss(rawCss: string = ""): {
  css: string;
  sanitized: string;
  warnings: string[];
} {
  const warnings: string[] = [];
  let cleaned = rawCss;

  const patterns = [
    { regex: /expression\s*\([^)]*\)/gi, desc: "expression()" },
    { regex: /behavior\s*:/gi, desc: "behavior:" },
    { regex: /javascript\s*:/gi, desc: "javascript:" },
    { regex: /@import\s+(?:url\([^)]+\)|["'][^"']+["']|[^;]+);?/gi, desc: "@import" },
    { regex: /-moz-binding\s*:/gi, desc: "-moz-binding" },
  ];

  for (const { regex, desc } of patterns) {
    if (regex.test(cleaned)) {
      warnings.push(`Padrão CSS inseguro detectado e removido: ${desc}`);
      cleaned = cleaned.replace(regex, "/* blocked */");
    }
  }

  const finalCss = cleaned.trim();
  return {
    css: finalCss,
    sanitized: finalCss,
    warnings,
  };
}

export function sanitizeTemplateCode(rawHtml: string = "", rawCss: string = ""): SanitizationResult {
  const htmlResult = sanitizeCustomHtml(rawHtml);
  const cssResult = sanitizeCustomCss(rawCss);
  const allWarnings = [...htmlResult.warnings, ...cssResult.warnings];

  return {
    sanitizedHtml: htmlResult.html,
    sanitizedCss: cssResult.css,
    isSafe: allWarnings.length === 0,
    warnings: allWarnings,
  };
}

