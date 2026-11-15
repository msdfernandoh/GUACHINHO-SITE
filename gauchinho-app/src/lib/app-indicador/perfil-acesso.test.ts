import {beforeEach,describe,it,expect,vi} from "vitest";
const m=vi.hoisted(()=>({metadata:{} as Record<string,unknown>,erro:false}));
vi.mock("@/lib/supabase/admin",()=>({createAdminClient:()=>({from:()=>{const q={select:()=>q,eq:()=>q,single:async()=>({data:{auth_user_id:"auth",ativo:true}})};return q;},auth:{admin:{getUserById:async()=>({data:{user:{app_metadata:m.metadata,user_metadata:{perfis_app_parceiros:{empresa:"PADRAO"}}}},error:m.erro?{message:"erro"}:null})}}})}));
import {obterPerfilAcessoApp} from "./perfil-acesso";
describe("Politica do app",()=>{
 beforeEach(()=>{m.metadata={};m.erro=false;});
 it("preserva acesso e isola empresa",async()=>{expect(await obterPerfilAcessoApp("empresa","usuario")).toBe("PADRAO");m.metadata={perfis_app_parceiros:{empresa:"PRODUCAO"}};expect(await obterPerfilAcessoApp("empresa","usuario")).toBe("PRODUCAO");expect(await obterPerfilAcessoApp("outra","usuario")).toBe("PADRAO");});
 it("ignora user_metadata e falha fechado",async()=>{m.metadata={perfis_app_parceiros:{empresa:"desconhecido"}};expect(await obterPerfilAcessoApp("empresa","usuario")).toBe("PRODUCAO");m.erro=true;await expect(obterPerfilAcessoApp("empresa","usuario")).rejects.toThrow("validar");});
});
