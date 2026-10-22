import {createRequire} from 'node:module'; import fs from 'node:fs';
const req=createRequire(new URL('../gauchinho-app/package.json',import.meta.url));
const env=Object.fromEntries(fs.readFileSync('gauchinho-app/.env.local','utf8').split(/\r?\n/).flatMap(l=>{const m=l.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);return m?[[m[1],(m[2]||'').replace(/^["']|["']$/g,'').trim()]]:[]}));
const sb=req('@supabase/supabase-js').createClient(env.NEXT_PUBLIC_SUPABASE_URL,env.SUPABASE_SERVICE_ROLE_KEY);
async function all(table,cols){let rows=[];for(let i=0;;i+=500){let r=await sb.from(table).select(cols).order('id').range(i,i+499);if(r.error)throw Error(table+': '+r.error.message);rows.push(...r.data);if(r.data.length<500)return rows;}}
const grupos=await all('grupos_consorcio','id,codigo_grupo,administradora_id,ativo,ultima_assembleia_numero,contemplacoes_resumo');
const rows=await all('grupo_assembleias_contemplacoes','id,grupo_id,assembleia_numero,cota,modalidade,situacao_cota');
const robos=await all('robo_configuracoes','id,nome,ativo,administradora_id');
const report={projeto:new URL(env.NEXT_PUBLIC_SUPABASE_URL).hostname,em:new Date().toISOString(),robos,grupos:grupos.map(g=>{let r=rows.filter(c=>c.grupo_id===g.id);let nums=[...new Set(r.map(c=>c.assembleia_numero))].sort((a,b)=>a-b);let ultima=g.ultima_assembleia_numero||Math.max(0,...nums);return {id:g.id,codigo:g.codigo_grupo,ativo:g.ativo,ultima,ativas:g.contemplacoes_resumo?.cotas_ativas,registros:r.length,assembleias:nums.length,primeira:nums[0]??null,faltantes:Array.from({length:ultima},(_,i)=>i+1).filter(n=>!nums.includes(n)),resumo:g.contemplacoes_resumo};})};
fs.mkdirSync('tmp/contemplacoes',{recursive:true});fs.writeFileSync('tmp/contemplacoes/auditoria-2026-10-22.json',JSON.stringify(report,null,2));
console.log(JSON.stringify({projeto:report.projeto,grupos:report.grupos.length,com_historico:report.grupos.filter(g=>g.registros).length,sem_historico:report.grupos.filter(g=>!g.registros).length,com_lacunas:report.grupos.filter(g=>g.faltantes.length).length},null,2));
