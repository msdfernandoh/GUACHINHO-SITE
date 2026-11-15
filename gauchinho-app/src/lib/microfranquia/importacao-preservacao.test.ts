import {beforeEach,describe,it,expect,vi} from "vitest";
const m=vi.hoisted(()=>({upsert:vi.fn(),insert:vi.fn(),filters:[] as Array<[string,unknown]>}));
vi.mock("@/lib/tenant/context",()=>({requireCurrentTenantContext:async()=>({empresaAtiva:{id:"empresa-sessao"},usuario:{id:"usuario"}})}));
vi.mock("@/lib/parceiros/indicador-app-session",()=>({resolveIndicadorAppSession:async()=>({participante:{id:"proprio",nome:"Titular",whatsapp:"66999999999"},indicador:{id:"indicador-proprio"}})}));
vi.mock("next/cache",()=>({revalidatePath:vi.fn()}));
vi.mock("@/lib/crm/upsert-lead",async importOriginal=>({...await importOriginal<object>(),upsertLeadPorTelefone:m.upsert}));
vi.mock("@/lib/supabase/admin",()=>({createAdminClient:()=>({from:()=>{const q={select:()=>q,eq:(k:string,v:unknown)=>{m.filters.push([k,v]);return q;},limit:async()=>({data:[{id:"lead-existente"}]}),insert:m.insert};return q;}})}));
import {importarIndicacoesPlanilhaAction} from "@/app/app-indicador/indicar/importar/actions";
describe("Importação preserva contatos cadastrados",()=>{
 beforeEach(()=>{vi.clearAllMocks();m.filters=[];});
 it("não modifica nem reatribui telefone já cadastrado",async()=>{const r=await importarIndicacoesPlanilhaAction([{linha:2,nome:"Cliente",telefone:"66988888888",email:"",valorImovel:100000,nomeImovel:"Casa"}]);expect(r[0].ok).toBe(false);expect(m.filters).toContainEqual(["empresa_id","empresa-sessao"]);expect(m.upsert).not.toHaveBeenCalled();expect(m.insert).not.toHaveBeenCalled();});
 it("limita cada lote e valida no servidor",async()=>{await expect(importarIndicacoesPlanilhaAction(Array(26).fill({}))).rejects.toThrow("25");const r=await importarIndicacoesPlanilhaAction([{linha:2,nome:"",telefone:"1",email:"",valorImovel:0,nomeImovel:""}]);expect(r[0].ok).toBe(false);expect(m.upsert).not.toHaveBeenCalled();});
});
