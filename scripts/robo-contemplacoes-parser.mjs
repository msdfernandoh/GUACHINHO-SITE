// Executado dentro do navegador: limita a leitura à grade visível da aba selecionada.
export function extrairGradeVisivel() {
  const norm = s => (s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim().toLowerCase();
  const visible = el => { for(let p=el;p;p=p.parentElement) {const s=getComputedStyle(p);if(s.display==='none'||s.visibility==='hidden')return false;} return !!el.getClientRects().length; };
  const tabelas = [...document.querySelectorAll('table')].filter(t=>visible(t));
  const candidatas = tabelas.map(t=>({t,rows:[...t.rows].filter(r=>r.closest('table')===t)})).map(x=>({...x,header:x.rows.find(r=>{let c=[...r.cells].map(e=>norm(e.innerText));return c.includes('cota')&&c.includes('modalidade');})})).filter(x=>x.header);
  if(candidatas.length!==1) throw Error('Grade de resultados visível ausente ou ambígua: '+candidatas.length);
  const {rows,header}=candidatas[0]; const headers=[...header.cells].map(e=>norm(e.innerText));
  const pctIndex=headers.findIndex(h=>h.includes('%')&&h.includes('lance'));
  const cotas=[];
  for(const row of rows){if(row===header||!visible(row))continue;const cells=[...row.cells].map(c=>(c.innerText||'').trim());if(!/^\d{3,5}-\d{2}$/.test(cells[0]||''))continue;
    const mod=norm(cells[1]);let modalidade;
    if(mod.includes('sorteio'))modalidade='SORTEIO';else if(mod.includes('fixo'))modalidade=mod.includes('2')?'SEGUNDO_LANCE_FIXO':'LANCE_FIXO';else if(mod.includes('livre'))modalidade='LANCE_LIVRE';else if(mod.includes('fidelidade'))modalidade='LANCE_FIDELIDADE';else if(mod.includes('limitado'))modalidade='LANCE_LIMITADO';else throw Error('Modalidade desconhecida: '+cells[1]);
    let percentual_lance=mod.includes('sorteio') ? 0 : null;
    if(!mod.includes('sorteio')&&pctIndex>=0){const raw=cells[pctIndex].replace('%','').trim();percentual_lance=Number(raw.includes(',')?raw.replace(/\./g,'').replace(',','.'):raw);if(!Number.isFinite(percentual_lance)||percentual_lance<0||percentual_lance>100)throw Error('Percentual inválido');}
    cotas.push({cota:cells[0],modalidade,percentual_lance});
  }
  return [...new Map(cotas.map(c=>[c.cota+':'+c.modalidade,c])).values()];
}

export async function coletarAbasResultado(page) {
  const cotas=[];
  for(const [nome,situacao] of [['Confirmadas (Ativos)','ATIVA'],['Confirmadas (Canceladas)','CANCELADA'],['Desclassificadas','DESCLASSIFICADA']]) {
    const tab=page.getByText(nome==='Confirmadas (Ativos)' ? /^Confirmadas \(Ativ[oa]s\)$/ : nome,{exact:true});
    if(await tab.count()!==1)throw Error('Aba ausente ou ambígua: '+nome);
    await tab.click();
    await page.waitForLoadState('domcontentloaded');
    await page.waitForFunction(label=>{
      const active=[...document.querySelectorAll('.ajax__tab_active, [aria-selected="true"], .ui-tabs-active')];
      return active.some(el=>/Ativ[oa]s/.test(label)?/^Confirmadas \(Ativ[oa]s\)$/.test(el.innerText.trim()):el.innerText.trim()===label);
    },nome,{timeout:15000});
    const rows=await page.evaluate(extrairGradeVisivel);
    if(situacao === 'ATIVA' && rows.some(c => c.modalidade !== 'SORTEIO' && c.percentual_lance == null)) {
      throw Error('Coluna de percentual de lance ausente nas confirmadas ativas')
    }
    cotas.push(...rows.map(c=>({...c,percentual_lance:c.percentual_lance ?? 0,situacao_cota:situacao,origem_aba:nome})));
  }
  return cotas;
}
