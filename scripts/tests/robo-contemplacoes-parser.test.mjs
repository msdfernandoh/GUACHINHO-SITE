import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {extrairGradeVisivel,coletarAbasResultado} from '../robo-contemplacoes-parser.mjs';
const req=createRequire(new URL('../../gauchinho-app/package.json',import.meta.url));
const {chromium}=req('playwright-core');
test('três abas não duplicam cotas, sequência não vira percentual e opções não entram',async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true});
 try {const page=await browser.newPage();
 await page.setContent(`<style>.hidden{display:none}</style>
 <div><span class="ajax__tab_active" onclick="sel(0)">Confirmadas (Ativos)</span><span onclick="sel(1)">Confirmadas (Canceladas)</span><span onclick="sel(2)">Desclassificadas</span></div>
 <table><tr><th>Cota</th><th>Modalidade</th><th>% Lance</th></tr><tr><td>0645-00</td><td>Sorteio</td><td>0.0000</td></tr></table>
 <table class="hidden"><tr><th>Cota</th><th>Modalidade</th><th>Sequência</th></tr><tr><td>0657-01</td><td>Sorteio</td><td>0001</td></tr></table>
 <table class="hidden"><tr><th>Cota</th><th>Modalidade</th><th>% Lance</th></tr><tr><td>0637-00</td><td>Lance Livre</td><td>52,4979</td></tr></table>
 <table><tr><th>Sit.</th><th>Seq.</th><th>Cota</th></tr><tr><td>0001</td><td>0001</td><td>0999-00</td></tr></table>
 <script>function sel(n){document.querySelectorAll('span').forEach((s,i)=>s.className=i===n?'ajax__tab_active':'');document.querySelectorAll('table').forEach((t,i)=>{if(i<3)t.className=i===n?'':'hidden'})}</script>`);
 const rows=await coletarAbasResultado(page);
 assert.deepEqual(rows.map(c=>[c.cota,c.situacao_cota,c.percentual_lance]),[['0645-00','ATIVA',0],['0657-01','CANCELADA',0],['0637-00','DESCLASSIFICADA',52.4979]]);
 await page.setContent('<table><tr><th>Cota</th><th>Modalidade</th></tr></table>');
 assert.deepEqual(await page.evaluate(extrairGradeVisivel),[]);
 }finally{await browser.close()}
});
