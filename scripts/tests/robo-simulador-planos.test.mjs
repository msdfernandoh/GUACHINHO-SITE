import assert from 'node:assert/strict';
import { test } from 'node:test';
import vm from 'node:vm';
import { extrairPlanosSimulador, agruparPlanosSimulador, resolverGrupoSimulador } from '../robo-simulador-planos.mjs';
import { marcarAreaPlanos } from '../robo-simulador-carregamento.mjs';

class Element {
  constructor(text='', children=[], visible=true) {
    this.text=text; this.children=children; this.visible=visible;
    for (const child of children) child.parentElement=this;
  }
  get innerText() { return [this.text,...this.children.filter(c=>c.visible).map(c=>c.innerText)].join('\n'); }
  querySelectorAll() { return this.children.flatMap(c=>[c,...c.querySelectorAll()]); }
  getClientRects() { return this.visible ? [{}] : []; }
}
const card=(credito, parcela, modo='Reduzida 60%', extra='')=>new Element(`Crédito R$ ${credito}\nParcela R$ ${parcela} / mês\n${modo}\n${extra}\nSimular`);
function extract(root,grupoEsperado='5388',transcorridoEsperado) {
  // Mesmo isolamento de page.evaluate: a função não pode depender de imports/closures.
  return vm.runInNewContext(`(${extrairPlanosSimulador.toString()})({grupoEsperado:${JSON.stringify(grupoEsperado)},transcorridoEsperado:${JSON.stringify(transcorridoEsperado)}})`,{
    document: {querySelectorAll:()=>[root,...root.querySelectorAll()]},
  });
}
test('ignora ancestral com múltiplos planos; preserva crédito e parcela das menores cotas',()=>{
  const root=new Element('Grupo 5388',[card('36.561,63','353,43'),card('57.453,99','555,39')]);
  const planos=extract(root);
  assert.equal(planos.length,2);
  const grupos=agruparPlanosSimulador(planos);
  assert.equal(grupos.get(36561.63).parcelasReduzidas['60'],353.43);
  assert.equal(grupos.get(57453.99).parcelasReduzidas['60'],555.39);
});

test('separa Prorrogada de Diluída mesmo quando o portal mostra ambas',()=>{
 const root=new Element('Grupo 5388',[card('36.561,63','353,43','Reduzida 60%','Prorrogada'),card('36.561,63','400,00','Reduzida 60%','Diluída')]);
 assert.equal(agruparPlanosSimulador(extract(root,'5388','PRORROGADA')).get(36561.63).parcelasReduzidas['60'],353.43);
 assert.equal(agruparPlanosSimulador(extract(root,'5388','DILUIDA')).get(36561.63).parcelasReduzidas['60'],400);
 assert.throws(()=>extract(new Element('Grupo 5388',[card('36.561,63','353,43')]),'5388','DILUIDA'),/transcorrido/);
});

test('mensalidade oficial de grupo no fim do prazo não é rejeitada por teto de 25%',()=>{
 const root=new Element('Grupo 4088',[card('111.542,58','41.828,47','Integral','Diluída')]);
 assert.equal(extract(root,'4088','DILUIDA')[0].parcelaStr,'41.828,47');
});
test('não associa cabeçalho de crédito à parcela de outro cartão',()=>{
  const root=new Element('Grupo 5388',[new Element('Crédito R$ 36.561,63',[card('57.453,99','925,65','Integral')]),card('36.561,63','353,43')]);
  const grupos=agruparPlanosSimulador(extract(root));
  assert.equal(grupos.get(36561.63).parcelaIntegral,0);
  assert.equal(grupos.get(57453.99).parcelaIntegral,925.65);
});
test('percentual de lance 70% não altera a modalidade reduzida 60%',()=>{
  const root=new Element('Grupo 5388',[card('36.561,63','353,43','Reduzida 60%','Lance embutido 70%')]);
  assert.equal(extract(root)[0].tipoReducao,'60');
});
test('filtra outro grupo aberto e ignora clone responsivo oculto',()=>{
  const hidden=card('36.561,63','1178,09'); hidden.visible=false;
  const root=new Element('',[new Element('Grupo 5388',[card('36.561,63','353,43'),hidden]),new Element('Grupo 5488',[card('36.561,63','900,00')])]);
  const planos=extract(root);
  assert.equal(planos.length,1); assert.equal(planos[0].parcelaStr,'353,43');
});
test('interrompe importação quando um cartão não informa modalidade',()=>{
  const root=new Element('Grupo 5388',[card('36.561,63','353,43'),card('57.453,99','555,39','')]);
  assert.throws(()=>extract(root),/ambíguo/);
});
test('rejeita cartão com duas modalidades ou duas mensalidades',()=>{
  assert.throws(()=>extract(new Element('Grupo 5388',[card('36.561,63','353,43','Reduzida 60% Integral')])),/ambíguo/);
  assert.throws(()=>extract(new Element('Grupo 5388',[card('36.561,63','353,43','Reduzida 60%','R$ 900,00 / mês')])),/ambíguo/);
});
test('não presume taxas: ausentes são null e zero explícito é preservado',()=>{
  const sem=extract(new Element('Grupo 5388',[card('36.561,63','353,43')]))[0];
  assert.equal(sem.taxaAdm,null); assert.equal(sem.fundoReserva,null);
  const com=extract(new Element('Grupo 5388',[card('36.561,63','353,43','Reduzida 60%','Taxa administrativa: 16%\nFundo de reserva: 0%')]))[0];
  assert.equal(com.taxaAdm,16); assert.equal(com.fundoReserva,0);
});
test('duplicatas idênticas são idempotentes; conflitantes abortam',()=>{
  const root=new Element('Grupo 5388',[card('36.561,63','353,43'),card('36.561,63','353,43')]);
  assert.equal(agruparPlanosSimulador(extract(root)).size,1);
  root.children.push(card('36.561,63','1178,09')); root.children.at(-1).parentElement=root;
  assert.throws(()=>agruparPlanosSimulador(extract(root)),/conflitantes/);
});
test('taxas divergentes entre créditos abortam antes de produzir o lote',()=>{
  const root=new Element('Grupo 5388',[card('36.561,63','353,43','Reduzida 60%','Taxa administrativa 16%'),card('57.453,99','555,39','Reduzida 60%','Taxa administrativa 12%')]);
  assert.throws(()=>agruparPlanosSimulador(extract(root)),/divergentes/);
});
test('sem grupo comprovado ou sem planos não há lote para gravar/inativar',()=>{
  assert.throws(()=>extract(card('36.561,63','353,43')),/Nenhum cartão/);
  assert.throws(()=>extract(new Element('Grupo 5388')),/Nenhum cartão/);
  assert.throws(()=>agruparPlanosSimulador([]),/vazia/);
});

test('5388 de tipos diferentes é resolvido pelo tipo canônico',()=>{
  const veiculo={id:'v',tipo_administradora_id:'tipo-veiculo'};
  const moto={id:'m',tipo_administradora_id:'tipo-moto'};
  assert.equal(resolverGrupoSimulador([veiculo,moto],'tipo-veiculo'),veiculo);
  assert.equal(resolverGrupoSimulador([veiculo,moto],'tipo-moto'),moto);
  assert.throws(()=>resolverGrupoSimulador([veiculo,{...veiculo,id:'v2'}],'tipo-veiculo'),/ambíguo/);
  assert.throws(()=>resolverGrupoSimulador([{id:'legado',tipo_administradora_id:null}],'tipo-veiculo'),/comprovada/);
  assert.equal(resolverGrupoSimulador([],'tipo-veiculo'),null);
});

test('serviço não grava nem inativa dados quando a extração é ambígua',async()=>{
  const { executarRobo3Simulador }=await import('../robo-simulador-service.mjs');
  const logs=[];
  const mutations=[];
  const root=new Element('Grupo 5388',[card('36.561,63','353,43','Integral Reduzida 60%')]);
  const locator=selector=>({
    locator(){return {filter(){return {async count(){return 0;}};}};},
    first(){return this;},last(){return this;},nth(){return this;},
    async isVisible(){return selector.includes('Mostrar planos') || selector.includes('button:text-is("Veículos")');},
    async count(){return selector.includes('Mostrar planos')?1:0;},
    async click(){},async evaluate(){return 'Grupo 5388';},
  });
  const page={
    async goto(){},async waitForTimeout(){},async waitForFunction(){},async screenshot(){},
    url(){return 'https://example.test/simulador';},locator,
    async evaluate(fn,args){
      if(fn===marcarAreaPlanos)return 1;
      if(fn===extrairPlanosSimulador)return extract(root,args.grupoEsperado);
      if(fn.toString().includes('pvAtual')||fn.toString().includes('939509'))return '939509';
    },
  };
  const query={select(){return this;},eq(){return this;},
    then(resolve){return Promise.resolve(resolve({data:[{id:'g',codigo_grupo:'5388',tipo_administradora_id:'877a793f-21b3-4ea8-b3c3-b1e56dc216c9'}],error:null}));},
    insert(){mutations.push('insert');throw new Error('Mutação inesperada');},
    upsert(){mutations.push('upsert');throw new Error('Mutação inesperada');},
    update(){mutations.push('update');throw new Error('Mutação inesperada');},
  };
  await assert.rejects(executarRobo3Simulador({page,config:{administradora_id:'fixture-admin'},admin:{from(){return query;}},log:m=>logs.push(m),screenshotsDir:'.'}),/ambíguo/);
  assert.equal(mutations.length,0);
  assert.ok(logs.some(m=>m.includes('ambíguo')));
});

test('cartão real repete o mesmo crédito no título e no corpo sem misturar planos',()=>{
 const root=new Element('Grupo 1081',[new Element('Crédito R$ 700.000,00\nIntegral\nProrrogada\nSimular\nCrédito\nR$ 700.000,00\nParcela\nR$ 6.562,50/mês\nTaxa administrativa\n12% total\nFundo reserva\n0,5% total')]);
 const planos=extract(root,'1081');assert.equal(planos.length,1);assert.equal(planos[0].parcelaStr,'6.562,50');assert.equal(planos[0].taxaAdm,12);
});
