/** Serializa JSON-LD sem permitir que dados persistidos encerrem a tag <script>. */
export function serializeJsonLd(value: unknown): string {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}
