import { extractText, getDocumentProxy } from "unpdf";
import { extrairLinhaDigitavel } from "@/lib/erp/boleto-linha-digitavel";
import { requireErpRouteAccess } from "@/lib/erp/erp-acesso-server";
export async function GET(request: Request) {
 await requireErpRouteAccess("vendas");
 const params = new URL(request.url).searchParams;
 const nome = params.get("nome") || "";
 const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
 let url: URL;
 try { url = new URL(params.get("url") || ""); } catch { return new Response("URL inválida", {status:400}); }
 if (!base || url.origin !== new URL(base).origin || !url.pathname.startsWith("/storage/v1/object/public/boletos-cotas/") || url.username || url.password || !/^[a-zA-Z0-9_-]+\.pdf$/.test(nome)) return new Response("Arquivo inválido", {status:400});
 url.search = "";
 const pdf = await fetch(url, {cache:"no-store",redirect:"error"});
 if (!pdf.ok) return new Response("PDF indisponível", {status:502});
 if (params.get("codigo") === "1") {
   try {
     const limite = 10 * 1024 * 1024;
     const reader = pdf.body?.getReader();
     if (!reader) throw new Error("PDF vazio.");
     const chunks: Uint8Array[] = []; let size = 0;
     while (true) {
       const {done, value} = await reader.read();
       if (done) break;
       size += value.length;
       if (size > limite) { await reader.cancel(); throw new Error("PDF excede o limite de leitura."); }
       chunks.push(value);
     }
     const bytes = new Uint8Array(size); let offset = 0;
     for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
     const doc = await getDocumentProxy(bytes);

       const result = await extractText(doc, {mergePages:true});
       return Response.json({linha_digitavel: extrairLinhaDigitavel(result.text), origem:"pdf", validacao:"mod10_mod11"}, {headers:{"Cache-Control":"private, no-store"}});

   } catch (error) {
     return Response.json({erro: error instanceof Error ? error.message : "Não foi possível validar o PDF."}, {status:422, headers:{"Cache-Control":"private, no-store"}});
   }
 }
 return new Response(pdf.body, {headers:{"Content-Type":"application/pdf","Content-Disposition":`inline; filename="${nome}"`,"Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff"}});
}
