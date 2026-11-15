import { NextResponse } from "next/server";
import { authorizePublicIngress } from "@/lib/security/public-ingress";
import { validarConviteFixo } from "@/lib/app-indicador/convite-fixo";
import { cadastrarColaborador } from "@/lib/microfranquia/cadastro";
export async function POST(request:Request){const ingress=await authorizePublicIngress(request,"cadastro_colaborador_fixo",{limit:5,windowSeconds:60});if(!ingress.ok)return ingress.response;try{const input=await request.json();const convite=validarConviteFixo(String(input.token??""),ingress.empresaId);if(!convite)return NextResponse.json({error:"Convite inválido ou indisponível."},{status:404});await cadastrarColaborador(ingress.empresaId,convite.responsavelId,{...input,perfil:"GERADOR_OPORTUNIDADES"},undefined,{somenteProducao:true});return NextResponse.json({ok:true});}catch(e){return NextResponse.json({error:e instanceof Error?e.message:"Não foi possível cadastrar."},{status:400});}}
