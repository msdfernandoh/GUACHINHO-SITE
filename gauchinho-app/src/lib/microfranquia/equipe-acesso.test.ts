import { beforeEach,describe,it,expect,vi } from "vitest";
const m=vi.hoisted(()=>({context:vi.fn(),cadastro:vi.fn(),convite:vi.fn(),ingress:vi.fn()}));
vi.mock("server-only",()=>({}));vi.mock("@/lib/microfranquia/access",()=>({requireMicrofranquia:m.context,microfranquiaPorConvite:m.convite}));
vi.mock("@/lib/security/public-ingress",()=>({authorizePublicIngress:m.ingress}));vi.mock("@/lib/microfranquia/cadastro",()=>({cadastrarColaborador:m.cadastro}));vi.mock("next/cache",()=>({revalidatePath:vi.fn()}));
import {POST as interno} from "@/app/api/app-indicador/equipe/route";
import {POST as publico} from "@/app/api/public/equipe/route";
describe("Escopo da equipe",()=>{
 beforeEach(()=>vi.clearAllMocks());
 it("ignora empresa e microfranquia enviadas pelo cliente",async()=>{m.context.mockResolvedValue({empresaId:"sessao",usuarioId:"usuario",micro:{id:"micro-sessao"}});m.cadastro.mockResolvedValue({ok:true});const body={empresaId:"outra",microId:"outra",nome:"Teste"};expect((await interno(new Request("https://site/api",{method:"POST",body:JSON.stringify(body)}))).status).toBe(200);expect(m.cadastro).toHaveBeenCalledWith("sessao","micro-sessao",body,"usuario");});
 it("nega usuário sem microfranquia",async()=>{m.context.mockRejectedValue(new Error("Sem acesso"));expect((await interno(new Request("https://site/api",{method:"POST",body:"{}"}))).status).toBe(400);expect(m.cadastro).not.toHaveBeenCalled();});
 it("resolve convite no tenant do host",async()=>{m.ingress.mockResolvedValue({ok:true,empresaId:"host"});m.convite.mockResolvedValue(null);expect((await publico(new Request("https://site/api",{method:"POST",body:JSON.stringify({empresaId:"outra",codigo:"CONVITE"})}))).status).toBe(404);expect(m.convite).toHaveBeenCalledWith("host","CONVITE");expect(m.cadastro).not.toHaveBeenCalled();});
 it("limita inscrições públicas antes de consultar convite",async()=>{m.ingress.mockResolvedValue({ok:false,response:new Response("Limite",{status:429})});expect((await publico(new Request("https://site/api",{method:"POST"}))).status).toBe(429);expect(m.convite).not.toHaveBeenCalled();});
});
