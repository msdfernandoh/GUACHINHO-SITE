"use client";
import { useState } from "react";
import { MODELOS_PROGRAMA_PARCEIROS, type ModeloParceiroId } from "@/lib/parceiros/modelos-programa";
import { calcularPlano, type ProdutoParceria, type FaixaParceria } from "@/lib/parceiros/plano-recebimento";
const brl=(v:number)=>new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL"}).format(v);
export function CalculadoraComissao({modelo,oportunidades=false}: {modelo: ModeloParceiroId;oportunidades?:boolean}) {
 const [valor,setValor]=useState("");const [produto,setProduto]=useState<ProdutoParceria>("IMOVEIS");const [faixa,setFaixa]=useState<FaixaParceria>("INTEGRAL");
 const numero=Number(valor); const valido=Number.isFinite(numero)&&numero>=0&&numero<=1e12;
 const plano=calcularPlano(modelo,produto,faixa,valido?numero:0);const dados=MODELOS_PROGRAMA_PARCEIROS.find(m=>m.id===modelo)!;
 return <section className="mt-6 space-y-4 rounded-2xl bg-zinc-900 p-5"><h1 className="text-2xl font-black">Simulação de comissão</h1><p>{oportunidades&&modelo==="GERADOR_POSSIBILIDADES"?"Gerador de Oportunidades":dados.nome} · {dados.ganho} da base líquida</p>
 <label className="block">Produto<select className="block w-full rounded-xl border bg-white p-3 text-slate-900" value={produto} onChange={e=>setProduto(e.target.value as ProdutoParceria)}><option value="IMOVEIS">Imóveis · 4% da franquia</option><option value="VEICULOS">Veículos · 3,5% da franquia</option></select></label>
 <label className="block">Plano do cliente<select className="block w-full rounded-xl border bg-white p-3 text-slate-900" value={faixa} onChange={e=>setFaixa(e.target.value as FaixaParceria)}><option value="INTEGRAL">Integral</option><option value="60_99">60% a 99%</option><option value="ABAIXO_59">Abaixo de 59%</option></select></label>
 <label className="block">Valor do crédito vendido (R$)<input className="mt-2 block w-full rounded-xl border p-3" type="number" min="0" max="1000000000000" step="0.01" value={valor} onChange={e=>setValor(e.target.value)}/></label>
 <p>Participação bruta: {brl(plano.bruto)}</p><p>Impostos (17,5%): {brl(plano.impostos)}</p><p className="text-3xl font-bold">Líquido: {brl(plano.total)}</p>
 <h2 className="text-xl font-bold">Plano de recebimento</h2><p>{modelo==="MICROFRANQUEADO"?"50% de cada etapa da tabela da franquia, com desconto de impostos. A etapa Contemplação depende da contemplação do cliente.":"Parcelas mensais iguais, com ajuste de centavos quando necessário."} Pagamento no dia 20 após o pagamento da primeira parcela do cliente, respeitando os marcos da tabela e a confirmação de recebimento.</p>
 <table className="w-full text-left text-sm"><thead><tr><th>Etapa do cliente / parcela</th><th>% bruto do crédito</th><th>Líquido</th></tr></thead><tbody>{plano.etapas.map(e=><tr key={e.etapa} className="border-t"><td className="py-2">{e.etapa}</td><td>{e.percentualBruto.toLocaleString("pt-BR",{maximumFractionDigits:5})}%</td><td>{brl(e.valor)}</td></tr>)}</tbody></table>
 <p className="text-sm text-zinc-400">Estimativa pelas tabelas de referência informadas. O valor efetivo depende da regra vigente, recebimento da administradora e eventuais estornos. Esta simulação não altera comissões ou pagamentos registrados.</p></section>;
}
