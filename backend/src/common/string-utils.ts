/**
 * Utilitários de strings para comparar a similaridade entre nomes de itens.
 */

export function normalizarString(str: string): string {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove acentos
    .replace(/[^a-z0-9\s]/g, '') // remove caracteres especiais
    .trim();
}

/**
 * Calcula a distância de Levenshtein entre duas strings.
 */
export function distanciaLevenshtein(s1: string, s2: string): number {
  const a = normalizarString(s1);
  const b = normalizarString(s2);

  const custos = [];
  for (let i = 0; i <= a.length; i++) {
    let valorAnterior = i;
    for (let j = 0; j <= b.length; j++) {
      if (i === 0) {
        custos[j] = j;
      } else {
        if (j > 0) {
          let novoValor = custos[j - 1];
          if (a.charAt(i - 1) !== b.charAt(j - 1)) {
            novoValor = Math.min(Math.min(novoValor, valorAnterior), custos[j]) + 1;
          }
          custos[j - 1] = valorAnterior;
          valorAnterior = novoValor;
        }
      }
    }
    if (i > 0) {
      custos[b.length] = valorAnterior;
    }
  }
  return custos[b.length];
}

/**
 * Calcula um coeficiente de similaridade de 0 a 1 entre duas strings.
 */
export function calcularSimilaridade(s1: string, s2: string): number {
  const norm1 = normalizarString(s1);
  const norm2 = normalizarString(s2);

  if (norm1.length === 0 || norm2.length === 0) {
    return 0;
  }

  // Se uma string contém a outra de forma exata, similaridade alta
  if (norm1.includes(norm2) || norm2.includes(norm1)) {
    const ratio = Math.min(norm1.length, norm2.length) / Math.max(norm1.length, norm2.length);
    return 0.5 + ratio * 0.5; // Entre 0.5 e 1.0
  }

  const maxLen = Math.max(norm1.length, norm2.length);
  const dist = distanciaLevenshtein(s1, s2);
  return (maxLen - dist) / maxLen;
}
