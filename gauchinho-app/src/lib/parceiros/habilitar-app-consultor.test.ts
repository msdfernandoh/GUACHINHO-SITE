import { beforeEach, describe, expect, it, vi } from "vitest";
const m=vi.hoisted(()=>({auth:vi.fn(),session:vi.fn(),superadmin:vi.fn(),queries:[] as Array<[string,string,unknown]>,crossTenant:true}));
vi.mock("server-only",()=>({}));
vi.mock("@/lib/auth/is-superadmin",()=>({isPlatformSuperadmin:m.superadmin}));
vi.mock("./indicador-app-session",()=>({resolveIndicadorAppSession:m.session}));
vi.mock("@/lib/supabase/admin",()=>({createAdminClient:()=>({from:(table:string)=>{
 const q={select:()=>q,eq:(field:string,value:unknown)=>{m.queries.push([table,field,value]);return q;},single:async()=>({data:{id:"participante",nome:"Teste",cpf:"12345678900",email:"teste@example.com",whatsapp:"66999999999",usuario_id:"usuario",status:"ATIVO"}}),then:(resolve:(v:unknown)=>unknown)=>Promise.resolve({data:m.crossTenant?[{empresa_id:"outra",papel:{codigo:"consultor"}}]:[{empresa_id:"empresa",papel:{codigo:"admin_empresa"}}]}).then(resolve)};return q;},auth:{admin:{updateUserById:m.auth,createUser:m.auth}}})}));
import { habilitarAppConsultor } from "./habilitar-app-consultor";
describe("Proteção de credenciais compartilhadas",()=>{
 beforeEach(()=>{vi.clearAllMocks();m.queries=[];m.superadmin.mockResolvedValue(false);m.crossTenant=true;});
 it("consulta participante pela empresa e impede reset de usuário de outra empresa",async()=>{await expect(habilitarAppConsultor("empresa","participante","senha1234")).rejects.toThrow("outras empresas");expect(m.queries).toContainEqual(["participantes_comerciais","empresa_id","empresa"]);expect(m.auth).not.toHaveBeenCalled();});
 it("protege contas administrativas contra gestor comum",async()=>{m.crossTenant=false;await expect(habilitarAppConsultor("empresa","participante","senha1234")).rejects.toThrow("administrativo");expect(m.auth).not.toHaveBeenCalled();});
 it("rejeita senha curta antes de alterar credenciais",async()=>{await expect(habilitarAppConsultor("empresa","participante","123")).rejects.toThrow("8 caracteres");expect(m.auth).not.toHaveBeenCalled();});
});
