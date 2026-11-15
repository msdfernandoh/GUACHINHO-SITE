import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { requireMicrofranquia } from "@/lib/microfranquia/access";
import { cadastrarColaborador } from "@/lib/microfranquia/cadastro";
export async function POST(request:Request){try{const ctx=await requireMicrofranquia();const input=await request.json();await cadastrarColaborador(ctx.empresaId,ctx.micro.id,input,ctx.usuarioId);revalidatePath("/app-indicador/equipe");return NextResponse.json({ok:true});}catch(e){return NextResponse.json({ok:false,error:e instanceof Error?e.message:"Não foi possível cadastrar."},{status:400});}}
