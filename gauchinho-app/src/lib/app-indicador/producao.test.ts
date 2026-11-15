import {describe,it,expect} from "vitest";
import {gerarConviteFixo,validarConviteFixo} from "./convite-fixo";
import {resumirIndicacao} from "./producao";
const empresa="empresa-a",responsavel="11111111-1111-4111-8111-111111111111",secret="segredo-teste";
describe("Convite exclusivo",()=>{
 it("valida assinatura e empresa",()=>{const t=gerarConviteFixo(empresa,responsavel,secret);expect(validarConviteFixo(t,empresa,secret)).toMatchObject({perfil:"PRODUCAO",responsavelId:responsavel});expect(validarConviteFixo(t,"outra",secret)).toBeNull();expect(validarConviteFixo(t,empresa,"outro")).toBeNull();});
 it("rejeita adulteracao",()=>{const t=gerarConviteFixo(empresa,responsavel,secret);expect(validarConviteFixo(t.slice(0,-3)+"abc",empresa,secret)).toBeNull();for(const t of ["","codigo-comum","a.b","x".repeat(1001)])expect(validarConviteFixo(t,empresa,secret)).toBeNull();});
});
const lead={nome:"Cliente",empresa_id:empresa,etapa_id:"etapa",status:"Em atendimento",fechado:false};const base={id:"indicacao",status:"PENDENTE",lead,venda:null};
describe("Producao e funil",()=>{
 it("mostra etapa configurada",()=>expect(resumirIndicacao(empresa,base,new Map([["etapa","Proposta enviada"]]))).toMatchObject({nome:"Cliente",etapa:"Proposta enviada",fechado:false,valorFechado:null}));
 it("mostra valor apenas com venda realizada",()=>{expect(resumirIndicacao(empresa,{...base,venda:{empresa_id:empresa,status:"ativa",valor_credito:350000}},new Map())).toMatchObject({etapa:"Fechado",fechado:true,valorFechado:350000});expect(resumirIndicacao(empresa,{...base,venda:{empresa_id:empresa,status:"rascunho",valor_credito:350000}},new Map()).valorFechado).toBeNull();});
 it("nao mostra estorno como fechado",()=>expect(resumirIndicacao(empresa,{...base,lead:{...lead,fechado:true},venda:{empresa_id:empresa,status:"estornada",valor_credito:100}},new Map())).toMatchObject({etapa:"Venda cancelada",fechado:false,valorFechado:null}));
 it("isola empresa",()=>expect(resumirIndicacao(empresa,{...base,lead:{...lead,empresa_id:"outra"},venda:{empresa_id:"outra",status:"ativa",valor_credito:100}},new Map())).toMatchObject({nome:"Indicado",fechado:false,valorFechado:null}));
});
