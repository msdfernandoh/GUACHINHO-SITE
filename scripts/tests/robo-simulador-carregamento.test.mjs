import { after, before, test } from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { carregarTodosPlanos } from '../robo-simulador-carregamento.mjs'
import { extrairPlanosSimulador, agruparPlanosSimulador } from '../robo-simulador-planos.mjs'
import { executarRobo3Simulador } from '../robo-simulador-service.mjs'
const require = createRequire(new URL('../../gauchinho-app/package.json', import.meta.url))
const { chromium } = require('playwright-core')
let browser
before(async () => { browser = await chromium.launch({ headless: true, channel: process.platform === 'win32' ? 'chrome' : undefined }) })
after(async () => { await browser?.close() })
async function pagina(run, { travar=false, outro=true }={}) {
  const page=await browser.newPage()
  try {
    await page.setContent(`<section><h2>Grupo 5388</h2><button>Ocultar planos</button><div id="planos"></div><button id="mais">Mais</button></section>
      ${outro?'<section><h2>Grupo 1081</h2><button onclick="window.outro=true">Mais</button></section>':''}
      <script>
      let n=0;function adicionar(){n++;const c=document.createElement('article');c.innerText='Crédito R$ '+(n===1?'73.123,26':n===2?'57.453,99':'36.561,63')+'\\nIntegral\\nParcela R$ 500,00/mês\\nSimular';document.querySelector('#planos').append(c)}
      adicionar();document.querySelector('#mais').onclick=()=>{${travar?'':"setTimeout(()=>{adicionar();if(n===3)document.querySelector('#mais').remove()},80)"}};
      </script>`)
    await run(page)
  } finally { await page.close() }
}
test('clica Mais repetidamente e extrai também a menor cota carregada por último',async()=>{
  await pagina(async page=>{
    const result=await carregarTodosPlanos({page,grupoEsperado:'5388'})
    assert.deepEqual(result,{planos:3,cliques:2})
    const planos=await page.evaluate(extrairPlanosSimulador,{grupoEsperado:'5388'})
    assert.equal(agruparPlanosSimulador(planos).get(36561.63).parcelaIntegral,500)
    assert.equal(await page.evaluate(()=>window.outro),undefined)
  })
})
test('botão sem novos planos interrompe a captura',async()=>{
  await pagina(page=>assert.rejects(carregarTodosPlanos({page,grupoEsperado:'5388',timeout:200}),/não carregou/),{travar:true})
})
test('limite de cliques não permite tratar captura parcial como completa',async()=>{
  await pagina(page=>assert.rejects(carregarTodosPlanos({page,grupoEsperado:'5388',limite:1}),/Limite/))
})
test('grupo não identificado não usa Mais de outro grupo',async()=>{
  await pagina(page=>assert.rejects(carregarTodosPlanos({page,grupoEsperado:'9999'}),/não identificada/))
})
test('grupo único também carrega todos os planos',async()=>{
  await pagina(async page=>assert.equal((await carregarTodosPlanos({page,grupoEsperado:'5388'})).planos,3),{outro:false})
})
test('serviço em dry-run carrega Mais e confere sem nenhuma mutação no catálogo',async()=>{
  await pagina(async page=>{
    await page.evaluate(()=>{
      for(const text of ['Veículos','Serviços','Veículos Pró-Rata Total','Imóveis','Imóveis Pró-Rata Total']){
        const produto=document.createElement('button');produto.innerText=text;document.body.append(produto)
      }
      document.querySelector('section').className='card'
      const button=document.querySelector('section button')
      button.innerText='Mostrar planos'
      button.onclick=()=>{button.innerText=button.innerText==='Mostrar planos'?'Ocultar planos':'Mostrar planos'}
      const modo=document.createElement('button');modo.innerText='Diluída';modo.onclick=()=>{
        document.querySelectorAll('article').forEach(el=>el.innerText=el.innerText.replace('Prorrogada','Diluída'))
      };document.body.append(modo)
      const prorrogada=document.createElement('button');prorrogada.innerText='Prorrogada';prorrogada.onclick=()=>{
        document.querySelectorAll('article').forEach(el=>el.innerText=el.innerText.replace('Diluída','Prorrogada'))
      };document.body.append(prorrogada)
      document.querySelector('article').innerText+='\nProrrogada'
      const observer=new MutationObserver(records=>{for(const record of records)for(const el of record.addedNodes){if(el.tagName==='ARTICLE')el.innerText+='\nProrrogada'}})
      observer.observe(document.querySelector('#planos'),{childList:true})
      const pv=document.createElement('input');pv.value='939509';document.body.append(pv)
    })
    page.goto=async()=>{}
    page.waitForTimeout=async()=>{}
    page.screenshot=async()=>{}
    let writes=0
    const logs=[]
    const admin={from(table){return {
      select(){return this},eq(){return this},
      then(resolve){return Promise.resolve(resolve({error:null,data:table==='grupos_consorcio'
        ?[{id:'fixture',codigo_grupo:'5388',tipo_administradora_id:'877a793f-21b3-4ea8-b3c3-b1e56dc216c9'},
          {id:'fixture-imovel',codigo_grupo:'5388',tipo_administradora_id:'57295700-5e68-498c-8882-2ef4ccc8c08d'}]
        :[{valor_credito:36561.63}]}))},
      insert(){writes++;throw Error('Mutação proibida')},update(){writes++;throw Error('Mutação proibida')},upsert(){writes++;throw Error('Mutação proibida')},
    }}}
    const result=await executarRobo3Simulador({page,config:{},admin,log:m=>logs.push(m),screenshotsDir:'tmp/testes-simulador',dryRun:true,grupos:['5388']})
    assert.equal(writes,0)
    assert.equal(result.totalCotasCadastradas,0)
    assert.equal(result.totalGruposProcessados,10)
    assert.ok(logs.some(m=>m.includes('3 créditos')))
    assert.ok(!logs.some(m=>m.startsWith('Erro')))
  },{outro:false})
})
