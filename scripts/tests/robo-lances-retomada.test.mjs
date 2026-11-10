import test from 'node:test'
import assert from 'node:assert/strict'
import { encontrarOfertaComprovada, conferirTextoComprovante } from '../robo-lances-retomada.mjs'
import { extrairProtocoloAlert } from '../robo-lances-service.mjs'
test('extrai protocolo do segundo fixo com ordinal e descrição Automático', () => {
  assert.equal(extrairProtocoloAlert('Anote os números dos protocolos:\n\n2º Lance Fixo (Automático): 5792193\n'), '5792193')
  assert.equal(extrairProtocoloAlert('O valor do lance embutido 266508.25 é maior que 166567.66'), null)
})
const oferta = { tipo_lance: 'LIVRE', status: 'CONFIRMADO', protocolo: '1234567', comprovante_storage_path: 'comprovante.pdf', percentual_lance: 39.5, percentual_embutido: 25, ofertado_em: '2026-11-09T12:00:00Z' }
const agora = new Date('2026-11-10T12:00:00Z')
test('confere identificação e protocolo dentro do PDF; recusa relatório da cota anterior', () => {
  const texto = 'Cota: 707 Grupo: 001453\nDados da oferta de lance:\n12/11/2026 R$ 40.386,00 5792193 2º Lance Fixo25,0000 %'
  const esperado = { grupo: '1453 IMÓVEL', cota: '0707', tipo: 'SEGUNDO_FIXO', percentual: 25 }
  assert.deepEqual(conferirTextoComprovante(texto, esperado), { protocolo: '5792193', valorLance: 40386 })
  for (const patch of [{ cota: '0708' }, { grupo: '1463' }, { tipo: 'FIXO' }, { percentual: 50 }, { protocolo: '1111111' }]) {
    assert.throws(() => conferirTextoComprovante(texto, { ...esperado, ...patch }))
  }
})
test('dois comprovantes livres não comprovam a modalidade fixa', () => {
  assert.equal(encontrarOfertaComprovada([oferta, oferta], 'FIXO', 25, 25, null, agora), null)
  assert.equal(encontrarOfertaComprovada([oferta], 'LIVRE', 39.5, 25, null, agora)?.protocolo, '1234567')
})
test('mudança de percentual ou embutido exige nova oferta', () => {
  assert.equal(encontrarOfertaComprovada([oferta], 'LIVRE', 40, 25, null, agora), null)
  assert.equal(encontrarOfertaComprovada([oferta], 'LIVRE', 39.5, 40, null, agora), null)
})
test('arquivo sem protocolo, oferta antiga e assembleia diferente não são conciliados', () => {
  for (const patch of [{ protocolo: null }, { comprovante_storage_path: null }, { ofertado_em: '2026-04-01' }, { assembleia_data: '2026-10-12' }]) {
    assert.equal(encontrarOfertaComprovada([{ ...oferta, ...patch }], 'LIVRE', 39.5, 25, '2026-11-12', agora), null)
  }
})
