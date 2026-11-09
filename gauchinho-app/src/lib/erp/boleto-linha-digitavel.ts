// Cobrança bancária: três DVs módulo 10 e DV geral módulo 11.
export function validarLinhaDigitavel(linha: string): boolean {
  if (!/^\d{47}$/.test(linha) || linha[3] !== "9") return false;
  const mod10 = (campo: string) => {
    let soma = 0, peso = 2;
    for (const d of [...campo].reverse()) {
      const n = Number(d) * peso;
      soma += Math.floor(n / 10) + n % 10;
      peso = peso === 2 ? 1 : 2;
    }
    return (10 - soma % 10) % 10;
  };
  for (const [inicio, fim] of [[0, 9], [10, 20], [21, 31]]) {
    if (mod10(linha.slice(inicio, fim)) !== Number(linha[fim])) return false;
  }
  const barras = linha.slice(0, 4) + linha[32] + linha.slice(33) + linha.slice(4, 9) + linha.slice(10, 20) + linha.slice(21, 31);
  let soma = 0, peso = 2;
  for (let i = 43; i >= 0; i--) {
    if (i === 4) continue;
    soma += Number(barras[i]) * peso;
    peso = peso === 9 ? 2 : peso + 1;
  }
  const dv = 11 - soma % 11;
  return Number(barras[4]) === (dv === 0 || dv === 10 || dv === 11 ? 1 : dv);
}

export function extrairLinhaDigitavel(texto: string): string {
  // Só remove separadores conhecidos; nunca corrige ou inventa algarismos.
  const candidatos = new Set<string>();
  const padrao = /(?<!\d)\d{5}[.\s]*\d{5}\s+\d{5}[.\s]*\d{6}\s+\d{5}[.\s]*\d{6}\s+\d\s+\d{14}(?!\d)|(?<!\d)\d{47}(?!\d)/g;
  for (const match of texto.matchAll(padrao)) candidatos.add(match[0].replace(/[.\s]/g, ""));
  if (candidatos.size !== 1) throw new Error("PDF sem linha digitável única. Confira o documento original.");
  const linha = [...candidatos][0];
  if (!validarLinhaDigitavel(linha)) throw new Error("Os dígitos verificadores não conferem. A cópia foi bloqueada.");
  return linha;
}
