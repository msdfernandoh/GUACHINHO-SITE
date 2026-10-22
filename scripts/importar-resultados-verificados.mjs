import {createRequire} from 'node:module'; import fs from 'node:fs'; import path from 'node:path';
import {indicadoresContemplacoes,resultadosVigentes} from '../gauchinho-app/src/lib/erp/contemplacoes.ts';
const req=createRequire(new URL('../gauchinho-app/package.json',import.meta.url));
const env=Object.fromEntries(fs.readFileSync('gauchinho-app/.env.local','utf8').split(/\r?\n/).flatMap(l=>{const m=l.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);return m?[[m[1],(m[2]||'').replace(/^["']|["']$/g,'').trim()]]:[]}));
const sb=req('@supabase/supabase-js').createClient(env.NEXT_PUBLIC_SUPABASE_URL,env.SUPABASE_SERVICE_ROLE_KEY);
const ids=process.argv.filter(a=>/^[0-9a-f-]{36}$/.test(a)); if(!ids.length) throw Error('Informe execuções verificadas.');
const {data:execs,error:ee}=await sb.from('robo_execucoes').select('id,robo_config_id,status').in('id',ids);if(ee||execs.length!==ids.length)throw Error('Execuções não localizadas');
const {data:configs,error:ce}=await sb.from('robo_configuracoes').select('id,administradora_id,nome').in('id',execs.map(e=>e.robo_config_id));if(ce||configs.some(c=>!/contempla/i.test(c.nome)||!c.administradora_id))throw Error('Origem não autorizada');
const {data:grupos,error:ge}=await sb.from('grupos_consorcio').select('id,codigo_grupo,administradora_id,dados_estatisticos').in('administradora_id',configs.map(c=>c.administradora_id));if(ge)throw ge;
const seen=new Set();const rows=[];const concluidos=new Set();
async function ciclo(){
 let novos=[];
 for(const id of ids){const dir=path.resolve('tmp/robo-downloads/contemplacoes-v2',id);if(!fs.existsSync(dir))continue;
  for(const file of fs.readdirSync(dir).filter(f=>f.endsWith('.json'))){const key=id+'/'+file;if(seen.has(key))continue;
   let s;try{s=JSON.parse(fs.readFileSync(path.join(dir,file),'utf8'));}catch{continue;}
   const grupo=grupos.find(g=>g.id===s.grupo_id);const exec=execs.find(e=>e.id===id);const config=configs.find(c=>c.id===exec.robo_config_id);
   if(!grupo||grupo.administradora_id!==config.administradora_id||s.execucao_id!==id||s.versao!==2||!Number.isInteger(s.assembleia_numero)||s.assembleia_numero<1||!/^\d{4}-\d{2}-\d{2}$/.test(s.assembleia_data)||!Array.isArray(s.cotas))throw Error('Snapshot inválido: '+key);
   for(const c of s.cotas){if(!/^\d{3,5}-\d{2}$/.test(c.cota)||!['ATIVA','CANCELADA','DESCLASSIFICADA'].includes(c.situacao_cota)||!Number.isFinite(c.percentual_lance)||c.percentual_lance<0||c.percentual_lance>100)throw Error('Cota inválida: '+key);}
   novos.push(s);seen.add(key);rows.push({...s,id:key,criado_em:fs.statSync(path.join(dir,file)).mtime.toISOString()});
  }
 }
 for(let i=0;i<novos.length;i+=50){const {error}=await sb.from('grupo_assembleias_resultados').upsert(novos.slice(i,i+50),{onConflict:'grupo_id,assembleia_numero,execucao_id',ignoreDuplicates:true});if(error)throw error;}
 for(const g of grupos){if(concluidos.has(g.id))continue;const rr=resultadosVigentes(rows.filter(r=>r.grupo_id===g.id));if(!rr.length)continue;const ultima=Math.max(...rr.map(a=>a.assembleia_numero));const stats=indicadoresContemplacoes(rr,ultima,g.dados_estatisticos?.cotas_ativas??null);if(!stats.historico_completo)continue;
  const {media_lance_1m,media_lance_3m,media_lance_6m,media_lance_12m}=stats;
  const {error}=await sb.from('grupos_consorcio').update({media_lance_1m,media_lance_3m,media_lance_6m,media_lance_12m,ultima_assembleia_numero:ultima,ultima_assembleia_data:rr[0].assembleia_data,contemplacoes_atualizado_em:new Date().toISOString(),contemplacoes_resumo:{versao:2,historico_completo:true,total_assembleias_historicas:rr.length,assembleias_verificadas:rr.map(a=>a.assembleia_numero),execucoes_origem:ids,atualizado_em:new Date().toISOString()}}).eq('id',g.id).eq('administradora_id',g.administradora_id);if(error)throw error;
  concluidos.add(g.id);console.log(JSON.stringify({grupo:g.codigo_grupo,assembleias:rr.length,...stats}));
 }
 console.log(JSON.stringify({snapshots:seen.size,grupos_completos:concluidos.size,novos:novos.length}));
}
do {await ciclo();if(!process.argv.includes('--watch'))break;const {data,error}=await sb.from('robo_execucoes').select('status').in('id',ids);if(error)throw error;if(data.every(e=>e.status!=='PROCESSANDO')){await ciclo();break;}await new Promise(r=>setTimeout(r,15000));}while(true);
