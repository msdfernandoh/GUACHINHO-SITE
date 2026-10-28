import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import vm from 'node:vm';

// Reproduz o extrator legado do commit 3fdb0c42 anterior à correção, sem portal, rede ou banco.
const source = execFileSync('git', ['show', '3fdb0c42:scripts/robo-simulador-service.mjs'], { encoding:'utf8' });
const start = source.indexOf('const planosList = await page.evaluate(() => {');
const end = source.indexOf('}).catch(() => [])', start);
assert.ok(start >= 0 && end > start, 'Bloco do extrator não encontrado');
const body = source.slice(start + 'const planosList = await page.evaluate(() => {'.length, end);
function extract(texts) {
  return vm.runInNewContext(`(() => { ${body} })()`, {
    document: { querySelectorAll: () => texts.map(innerText => ({ innerText })) },
  });
}
const menor = 'Crédito R$ 36.561,63\nParcela R$ 353,43 / mês\nReduzida 60%\nSimular';
const outro = 'Crédito R$ 57.453,99\nParcela R$ 925,65 / mês\nIntegral\nSimular';
const integralMenor = 'Crédito R$ 36.561,63\nParcela R$ 589,05 / mês\nIntegral\nSimular';
const reducaoMaior = 'Crédito R$ 57.453,99\nParcela R$ 647,96 / mês\nReduzida 70%\nSimular';
const casos = [
  { nome: 'cartão isolado', textos: [menor], validar(rows) {
    assert.equal(rows.length, 1); assert.equal(rows[0].creditoStr, '36.561,63');
    assert.equal(rows[0].parcelaStr, '353,43'); assert.equal(rows[0].tipoReducao, '60');
  } },
  { nome: 'ancestral associa primeiro crédito à primeira parcela de outro plano',
    textos: ['Crédito R$ 36.561,63\n' + outro, menor, outro], validar(rows) {
      assert.equal(rows[0].creditoStr, '36.561,63');
      assert.equal(rows[0].parcelaStr, '925,65');
      assert.equal(rows[1].parcelaStr, '353,43');
    } },
  { nome: 'ancestral reclassifica parcela integral como reduzida de 70%',
    textos: [integralMenor + '\n' + reducaoMaior, integralMenor, reducaoMaior], validar(rows) {
      assert.equal(rows[0].creditoStr, '36.561,63');
      assert.equal(rows[0].parcelaStr, '589,05');
      assert.equal(rows[0].tipoReducao, '70');
      assert.equal(rows[1].tipoReducao, 'INTEGRAL');
    } },
];
for (const caso of casos) {
  const rows = extract(caso.textos); caso.validar(rows);
  console.log(JSON.stringify({ caso: caso.nome, confirmado: true, extraidos: rows }));
}
const round = n => Math.round(n * 100) / 100;
for (const c of [{ credito:36561.63, saldo:42411.49, exibida:1195.05 }, { credito:57453.99, saldo:66646.63, exibida:582.05 }]) {
  const seguro = round(c.saldo * 0.0004);
  const baseTeorica = round(round(c.saldo / 72) * 0.6);
  console.log(JSON.stringify({ evidenciaImagem:c, seguroInicial:seguro, baseImplicita:round(c.exibida-seguro), referenciaFormula72Meses60:round(baseTeorica+seguro) }));
}
console.log('3 reproduções aprovadas; evidenciam defeitos do extrator, sem afirmar quais linhas remotas foram afetadas.');
