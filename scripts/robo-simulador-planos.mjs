/** Função autocontida: também executada no contexto do navegador via page.evaluate. */
export function extrairPlanosSimulador({ grupoEsperado, transcorridoEsperado }) {
  const normalizarGrupo = value => String(value).replace(/^0+/, '');
  const esperado = normalizarGrupo(grupoEsperado);
  const money = value => Number(value.replace(/\./g, '').replace(',', '.'));
  const creditoRegex = /Cr[eé]dito\s+R\$\s*([\d.,]+)/gi;
  const parcelaRegex = /R\$\s*([\d.,]+)\s*\/\s*m[eê]s/gi;
  const modalidade = text => {
    const reduzidas = [...text.matchAll(/(?:parcela\s+)?reduzida\s*(?:de\s*)?(50|60|70)\s*%/gi)].map(m => m[1]);
    const tipos = new Set(reduzidas);
    if (/\bintegral\b/i.test(text)) tipos.add('INTEGRAL');
    return tipos;
  };
  const completo = el => {
    const text = el.innerText || '';
    return /Simular/i.test(text) && [...text.matchAll(creditoRegex)].length > 0 &&
      [...text.matchAll(parcelaRegex)].length > 0;
  };
  const pertenceAoGrupo = el => {
    for (let parent = el; parent; parent = parent.parentElement) {
      const grupos = new Set([...String(parent.innerText || '').matchAll(/Grupo\s+(\d{4,8})\b/gi)].map(m => normalizarGrupo(m[1])));
      if (grupos.size === 1) return grupos.has(esperado);
      if (grupos.size > 1) return false;
    }
    return false;
  };
  const result = [];
  for (const card of document.querySelectorAll('div, article')) {
    if (!card.getClientRects().length || !completo(card) || !pertenceAoGrupo(card)) continue;
    // Ancestrais agregadores não são planos: usar somente a unidade completa mais interna.
    if ([...card.querySelectorAll('div, article')].some(el => el.getClientRects().length && completo(el))) continue;
    const text = card.innerText;
    if (transcorridoEsperado) {
      const modos = new Set([...text.matchAll(/\b(prorrogada|dilu[ií]da)\b/gi)].map(m => /prorrogada/i.test(m[1]) ? 'PRORROGADA' : 'DILUIDA'));
      if (modos.size !== 1) throw new Error('Modalidade de transcorrido ausente ou ambígua no cartão; dados preservados.');
      if (!modos.has(transcorridoEsperado)) continue;
    }
    const creditos = [...text.matchAll(creditoRegex)];
    const parcelas = [...text.matchAll(parcelaRegex)];
    const tipos = modalidade(text);
    const creditosUnicos = new Set(creditos.map(m => money(m[1])));
    if (creditosUnicos.size !== 1 || parcelas.length !== 1 || tipos.size !== 1) {
      throw new Error('Plano ambíguo: crédito, parcela e modalidade devem pertencer ao mesmo cartão.');
    }
    const credito = money(creditos[0][1]);
    const parcela = money(parcelas[0][1]);
    // Grupos no fim do prazo podem ter mensalidade superior a 25% do crédito.
    if (!(Number.isFinite(credito) && Number.isFinite(parcela) && credito > 0 && parcela > 0)) {
      throw new Error('Plano com valor inválido: importação interrompida.');
    }
    const taxa = text.match(/Taxa\s+administrativa\s*:?\s*([\d.,]+)\s*%/i);
    const fundo = text.match(/Fundo\s+(?:de\s+)?reserva\s*:?\s*([\d.,]+)\s*%/i);
    result.push({ creditoStr:creditos[0][1], parcelaStr:parcelas[0][1],
      taxaAdm:taxa ? Number(taxa[1].replace(',', '.')) : null,
      fundoReserva:fundo ? Number(fundo[1].replace(',', '.')) : null,
      tipoReducao:[...tipos][0] });
  }
  if (!result.length) throw new Error('Nenhum cartão de plano inequívoco encontrado para o grupo; dados preservados.');
  return result;
}

export function agruparPlanosSimulador(planos) {
  if (!planos.length) throw new Error('Lista de planos vazia; dados preservados.');
  const result = new Map();
  for (const pl of planos) {
    const credito = Number(pl.creditoStr.replace(/\./g, '').replace(',', '.'));
    const parcela = Number(pl.parcelaStr.replace(/\./g, '').replace(',', '.'));
    if (!result.has(credito)) result.set(credito, {credito, taxaAdm:null, fundoReserva:null, parcelaIntegral:0, parcelasReduzidas:{}});
    const entry = result.get(credito);
    const anterior = pl.tipoReducao === 'INTEGRAL' ? entry.parcelaIntegral : entry.parcelasReduzidas[pl.tipoReducao];
    if (anterior != null && anterior !== 0 && Math.round(anterior * 100) !== Math.round(parcela * 100)) {
      throw new Error(`Parcelas conflitantes para crédito ${credito}, modalidade ${pl.tipoReducao}; dados preservados.`);
    }
    for (const campo of ['taxaAdm','fundoReserva']) {
      if (pl[campo] == null) continue;
      if (entry[campo] != null && entry[campo] !== pl[campo]) throw new Error(`Taxas conflitantes em ${credito}; dados preservados.`);
      entry[campo] = pl[campo];
    }
    if (pl.tipoReducao === 'INTEGRAL') entry.parcelaIntegral = parcela;
    else entry.parcelasReduzidas[pl.tipoReducao] = parcela;
  }
  // Taxas globais só são gravadas quando os cartões concordam.
  for (const campo of ['taxaAdm','fundoReserva']) {
    const values = new Set([...result.values()].map(c => c[campo]).filter(v => v != null));
    if (values.size > 1) throw new Error('Taxas divergentes entre planos do grupo; dados preservados.');
  }
  return result;
}

/** Não confundir grupos de mesmo número pertencentes a tipos diferentes. */
export function resolverGrupoSimulador(candidatos, tipoId) {
  const correspondentes = candidatos.filter(g => g.tipo_administradora_id === tipoId);
  if (correspondentes.length > 1) throw new Error('Grupo ambíguo no catálogo para número e tipo; dados preservados.');
  if (correspondentes.length === 1) return correspondentes[0];
  if (candidatos.length) throw new Error('Número de grupo existe sem correspondência comprovada de tipo; revisão necessária.');
  return null;
}
