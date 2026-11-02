import {beforeEach,describe,expect,it,vi} from "vitest";
import {NextRequest} from "next/server";
import {createHmac} from "node:crypto";
const m=vi.hoisted(()=>({guard:vi.fn(),instancia:vi.fn(),config:vi.fn(),apps:vi.fn(),send:vi.fn(),rpc:vi.fn(),from:vi.fn(),calls:[] as {table:string;op:string;value:unknown}[]}));
vi.mock("@/lib/erp/erp-acesso-server",()=>({requireErpRouteAccess:m.guard}));
vi.mock("@/lib/whatsapp/cloud-api/conexoes",()=>({getInstancia:m.instancia,tokenDaInstancia:()=>"fixture-token"}));
vi.mock("@/lib/whatsapp/cloud-api/config",()=>({getMetaAppConfig:m.config,getMetaApps:m.apps}));
vi.mock("@/lib/whatsapp/cloud-api/client",()=>({enviarMensagem:m.send}));
vi.mock("@/lib/supabase/admin",()=>({createAdminClient:()=>({from:m.from,rpc:m.rpc})}));
import {POST as enviar} from "@/app/api/erp/whatsapp/enviar/route";
import {POST as webhook} from "@/app/api/whatsapp/webhook/route";
const empresa="11111111-1111-4111-8111-111111111111",instancia="22222222-2222-4222-8222-222222222222",usuario="33333333-3333-4333-8333-333333333333",id="44444444-4444-4444-8444-444444444444";
const app={id:"app-1",appId:"123456",appSecret:"fixture-secret",origem:"https://admin.example",graphVersion:"v26.0",configId:"654321",verifyToken:"fixture-verify"};
let failPersist=false;let owner:Record<string,unknown>|null;
beforeEach(()=>{vi.clearAllMocks();m.calls.length=0;failPersist=false;owner={id:instancia,empresa_id:empresa,app_meta_id:app.id};m.guard.mockResolvedValue({usuario:{id:usuario},empresaAtiva:{id:empresa}});m.instancia.mockResolvedValue({id:instancia,empresa_id:empresa,app_meta_id:app.id,phone_number_id:"123456",status:"conectado",modelo:{modo:"meta_teste",ativo:true}});m.config.mockResolvedValue(app);m.apps.mockResolvedValue([app]);m.send.mockResolvedValue("wamid.123");m.rpc.mockResolvedValue({data:true,error:null});
 m.from.mockImplementation((table:string)=>{const r:{data:unknown;error:unknown}={data:table==="whatsapp_instancias"?owner:null,error:null};const chain={select:vi.fn(()=>chain),eq:vi.fn((key:string,value:unknown)=>{m.calls.push({table,op:"eq:"+key,value});return chain;}),maybeSingle:vi.fn(async()=>r),update:vi.fn((value:unknown)=>{m.calls.push({table,op:"update",value});return chain;}),upsert:vi.fn((value:unknown)=>{m.calls.push({table,op:"upsert",value});return chain;}),then:(resolve:(r:{data:unknown;error:unknown})=>unknown)=>resolve(failPersist?{data:null,error:{message:"fixture"}}:r)};return chain;});});
const request=()=>new Request("https://franquia.example/api/erp/whatsapp/enviar",{method:"POST",body:JSON.stringify({id_envio:id,instancia_id:instancia,para:"+5566999991234",tipo:"template",template_nome:"hello_world",idioma:"en_US"})});
describe("API de envio tenant-aware",()=>{
 it("nega usuário sem acesso ao módulo antes de consultar instância",async()=>{m.guard.mockRejectedValue(new Error("sem acesso"));expect((await enviar(request())).status).toBe(403);expect(m.instancia).not.toHaveBeenCalled();expect(m.send).not.toHaveBeenCalled();});
 it("não envia quando UUID pertence a outra franquia",async()=>{m.instancia.mockRejectedValue(new Error("Instância indisponível para esta empresa."));expect((await enviar(request())).status).toBe(400);expect(m.instancia).toHaveBeenCalledWith(empresa,instancia);expect(m.send).not.toHaveBeenCalled();});
 it("não repete envio com reserva já utilizada",async()=>{m.rpc.mockResolvedValue({data:false,error:null});expect((await enviar(request())).status).toBe(409);expect(m.send).not.toHaveBeenCalled();});
 it("reserva por empresa, instância e usuário interno e retorna somente wamid",async()=>{const r=await enviar(request());expect(r.status).toBe(200);expect(await r.json()).toEqual({ok:true,wa_message_id:"wamid.123"});expect(m.rpc.mock.calls[0][1]).toMatchObject({p_id:id,p_empresa:empresa,p_instancia:instancia,p_usuario:usuario,p_para:"5566999991234"});expect(m.send.mock.calls[0][3]).toMatchObject({type:"template",template:{name:"hello_world",language:{code:"en_US"}}});});
 it("não declara sucesso quando a Meta não confirma o envio",async()=>{m.send.mockRejectedValue(new Error("fixture"));const r=await enviar(request());expect(r.status).toBe(502);expect(await r.text()).not.toContain("fixture-token");});
});
function evento(value:object,field="messages",secret=app.appSecret){const raw=JSON.stringify({object:"whatsapp_business_account",entry:[{changes:[{field,value:{metadata:{phone_number_id:"123456"},...value}}]}]});return new NextRequest("https://admin.example/api/whatsapp/webhook",{method:"POST",headers:{"x-hub-signature-256":"sha256="+createHmac("sha256",secret).update(raw).digest("hex")},body:raw});}
describe("webhook de recebimento e coexistência",()=>{
 it("nega assinatura inválida antes de consultar o banco",async()=>{expect((await webhook(evento({},"messages","outra-chave"))).status).toBe(401);expect(m.from).not.toHaveBeenCalled();});
 it("grava resposta recebida na empresa e instância resolvidas pelo número",async()=>{expect((await webhook(evento({messages:[{id:"wamid.recebida",from:"5566999991234",type:"text",text:{body:"Recebi a demonstração"}}]}))).status).toBe(200);expect(m.calls.find(c=>c.op==="upsert")?.value).toMatchObject({empresa_id:empresa,instancia_id:instancia,direcao:"recebida",conteudo:"Recebi a demonstração"});});
 it("grava mensagens do celular como enviadas",async()=>{await webhook(evento({message_echoes:[{id:"wamid.echo",to:"5566999991234",type:"text",text:{body:"Resposta pelo celular"}}]},"smb_message_echoes"));expect(m.calls.find(c=>c.op==="upsert")?.value).toMatchObject({direcao:"enviada",contato_numero:"5566999991234"});});
 it("não aceita evento assinado por outro app para a instância",async()=>{owner={id:instancia,empresa_id:empresa,app_meta_id:"outro-app"};await webhook(evento({messages:[{id:"wamid",from:"5566999991234"}]}));expect(m.calls.filter(c=>c.op==="upsert")).toHaveLength(0);});
 it("pede retry quando o banco falha, sem falso 200",async()=>{failPersist=true;expect((await webhook(evento({messages:[{id:"wamid",from:"5566999991234"}]}))).status).toBe(503);});
 it("atualiza status com tenant e instância explícitos",async()=>{await webhook(evento({statuses:[{id:"wamid.sent",status:"delivered",recipient_id:"5566999991234"}]}));expect(m.rpc).toHaveBeenCalledWith("whatsapp_atualizar_status",expect.objectContaining({p_empresa:empresa,p_instancia:instancia,p_wamid:"wamid.sent",p_status:"delivered"}));});
});
