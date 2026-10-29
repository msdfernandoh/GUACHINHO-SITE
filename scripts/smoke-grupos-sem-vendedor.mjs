import { createRequire } from 'node:module'
import fs from 'node:fs'
import assert from 'node:assert/strict'
const require=createRequire(new URL('../gauchinho-app/package.json',import.meta.url))
const {chromium}=require('playwright-core')
const browser=await chromium.launch({headless:true,channel:'chrome'})
const publicMode=process.env.SMOKE_PUBLIC==='1'
fs.mkdirSync('tmp/contratar-sem-vendedor',{recursive:true})
try {
 for(const host of (process.argv.length>2?process.argv.slice(2):['raconsinop.com.br','raconsorriso.com.br'])){
  const context=await browser.newContext({viewport:{width:1440,height:1000}})
  const page=await context.newPage()
  const errors=[],requests=[]
  page.on('pageerror',e=>errors.push(e.message))
  page.on('request',r=>requests.push(r.url()))
  if(!publicMode) await page.route(`http://${host}/**`,async route=>{
   const req=route.request(),url=new URL(req.url())
   const response=await context.request.fetch('http://127.0.0.1:3101'+url.pathname+url.search,{
    method:req.method(),headers:{...req.headers(),host},data:req.postDataBuffer()??undefined,maxRedirects:0,timeout:90000,
   })
   await route.fulfill({response})
  })
  await page.goto(`${publicMode?'https':'http'}://${host}/grupos`,{waitUntil:'domcontentloaded',timeout:90000})
  const row=page.locator('tr').filter({hasText:'5388'}).first()
  await row.waitFor({timeout:30000})
  const select=row.locator('select').first()
  const option=await select.locator('option').evaluateAll(els=>els.find(el=>el.value)?.value)
  assert.ok(option,'Cota de teste disponível')
  await select.selectOption(option)
  await row.locator('input').first().fill('1')
  await page.getByRole('button',{name:'Contratar agora',exact:true}).filter({visible:true}).click()
  const dialog=page.getByRole('dialog',{name:'Contratar agora'})
  await dialog.waitFor()
  assert.equal(await dialog.locator('select').count(),0)
  assert.equal(await dialog.getByRole('link',{name:'Entrar',exact:true}).getAttribute('href'),'/login?next=%2Fgrupos')
  assert.equal(requests.filter(url=>url.includes('/api/public/consultores')).length,0)
  await page.screenshot({path:`tmp/contratar-sem-vendedor/${host}-modal.png`})
  const responsePromise=page.waitForResponse(r=>r.url().includes('/api/public/contratacoes/iniciar'))
  await dialog.getByRole('button',{name:'Continuar sem vendedor'}).click()
  const response=await responsePromise
  const body=await response.json()
  assert.equal(response.status(),200,JSON.stringify(body))
  assert.equal(body.draftPayload.consultor_id,undefined)
  await page.waitForURL('**/proposta/rascunho',{timeout:30000})
  const draft=await page.evaluate(()=>JSON.parse(sessionStorage.getItem('gauchinho_contratacao_draft_v1')))
  assert.equal(draft.consultor_id,undefined)
  const privacy=await page.evaluate(async()=>{const r=await fetch('/api/public/consultores');return {status:r.status,body:await r.json()}})
  assert.equal(privacy.status,401)
  assert.equal(privacy.body.consultores,undefined)
  assert.deepEqual(errors,[])
  console.log(JSON.stringify({host,modalSemLista:true,semConsultaPublica:true,inicio:response.status(),rascunhoSemVendedor:true,listaProtegida:privacy.status,errosJS:errors.length}))
  await context.close()
 }
}finally{await browser.close()}
