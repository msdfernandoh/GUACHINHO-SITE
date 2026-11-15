import { createHmac,timingSafeEqual } from "node:crypto";
type ConviteFixo={empresaId:string;responsavelId:string;perfil:"PRODUCAO";v:1};
function chave(secret?:string){const value=secret??process.env.SUPABASE_SERVICE_ROLE_KEY;if(!value)throw new Error("Convites indisponíveis.");return value;}
export function gerarConviteFixo(empresaId:string,responsavelId:string,secret?:string){const payload:ConviteFixo={empresaId,responsavelId,perfil:"PRODUCAO",v:1};const body=Buffer.from(JSON.stringify(payload)).toString("base64url");const assinatura=createHmac("sha256",chave(secret)).update("convite-colaborador-fixo:"+body).digest("base64url");return body+"."+assinatura;}
export function validarConviteFixo(token:string,empresaId:string,secret?:string):ConviteFixo|null{
 if(typeof token!=="string"||token.length>1000||!/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(token))return null;
 const [body,assinatura]=token.split(".");const expected=createHmac("sha256",chave(secret)).update("convite-colaborador-fixo:"+body).digest();const actual=Buffer.from(assinatura,"base64url");if(actual.length!==expected.length||!timingSafeEqual(actual,expected))return null;
 try{const data=JSON.parse(Buffer.from(body,"base64url").toString("utf8"));if(data.v!==1||data.perfil!=="PRODUCAO"||data.empresaId!==empresaId||typeof data.responsavelId!=="string"||!/^[0-9a-f-]{36}$/i.test(data.responsavelId))return null;return data;}catch{return null;}
}
