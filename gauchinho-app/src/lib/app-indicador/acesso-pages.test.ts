import {describe,it,expect,vi} from "vitest";
const m=vi.hoisted(()=>({from:vi.fn(),rpc:vi.fn()}));
vi.mock("next/navigation",()=>({redirect:(url:string)=>{throw new Error("REDIRECT:"+url);}}));
vi.mock("@/lib/tenant/context",()=>({getCurrentTenantContext:async()=>({empresaAtiva:{id:"empresa"},usuario:{id:"usuario"}}),requireCurrentTenantContext:async()=>({empresaAtiva:{id:"empresa"},usuario:{id:"usuario"}})}));
vi.mock("@/lib/app-indicador/perfil-acesso",()=>({obterPerfilAcessoApp:async()=>"PRODUCAO"}));
vi.mock("@/lib/supabase/admin",()=>({createAdminClient:()=>({from:m.from,rpc:m.rpc})}));
vi.mock("@/lib/supabase/server",()=>({createClient:async()=>({from:m.from,rpc:m.rpc})}));
import Comissoes from "@/app/app-indicador/comissoes/page";
import Simulacao from "@/app/app-indicador/simulacao/page";
import Parceria from "@/app/app-indicador/parceria/page";
import {confirmarRecebimentoNoAppAction} from "@/app/app-indicador/comissoes/actions";
import {aceitarTermoAction} from "@/app/app-indicador/parceria/actions";
describe("Bloqueio de URLs e acoes financeiras",()=>{
 it.each([["comissoes",Comissoes],["simulacao",Simulacao],["parceria",Parceria]] as const)("bloqueia %s antes de consultar dados",async(_,page)=>{await expect(page()).rejects.toThrow("REDIRECT:/app-indicador");expect(m.from).not.toHaveBeenCalled();});
 it("nao confirma comissao nem aceita termo",async()=>{expect(await confirmarRecebimentoNoAppAction("previsao")).toMatchObject({ok:false});await expect(aceitarTermoAction(new FormData())).rejects.toThrow("sem acesso");expect(m.from).not.toHaveBeenCalled();expect(m.rpc).not.toHaveBeenCalled();});
});
