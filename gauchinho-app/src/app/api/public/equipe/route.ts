import { NextResponse } from "next/server";
import { authorizePublicIngress } from "@/lib/security/public-ingress";
import { microfranquiaPorConvite } from "@/lib/microfranquia/access";
import { cadastrarColaborador } from "@/lib/microfranquia/cadastro";
export async function POST(request:Request){const ingress=await authorizePublicIngress(request,"equipe_microfranquia",{limit:5,windowSeconds:60});if(!ingress.ok)return ingress.response;try{const input=await request.json();const micro=await microfranquiaPorConvite(ingress.empresaId,String(input.codigo??""));if(!micro)return NextResponse.json({error:"Convite inválido ou indisponível."},{status:404});await cadastrarColaborador(ingress.empresaId,micro.id,input);return NextResponse.json({ok:true});}catch(e){return NextResponse.json({ok:false,error:e instanceof Error?e.message:"Não foi possível cadastrar."},{status:400});}}
