"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizarString = normalizarString;
exports.distanciaLevenshtein = distanciaLevenshtein;
exports.calcularSimilaridade = calcularSimilaridade;
function normalizarString(str) {
    return str
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9\s]/g, '')
        .trim();
}
function distanciaLevenshtein(s1, s2) {
    const a = normalizarString(s1);
    const b = normalizarString(s2);
    const custos = [];
    for (let i = 0; i <= a.length; i++) {
        let valorAnterior = i;
        for (let j = 0; j <= b.length; j++) {
            if (i === 0) {
                custos[j] = j;
            }
            else {
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
function calcularSimilaridade(s1, s2) {
    const norm1 = normalizarString(s1);
    const norm2 = normalizarString(s2);
    if (norm1.length === 0 || norm2.length === 0) {
        return 0;
    }
    if (norm1.includes(norm2) || norm2.includes(norm1)) {
        const ratio = Math.min(norm1.length, norm2.length) / Math.max(norm1.length, norm2.length);
        return 0.5 + ratio * 0.5;
    }
    const maxLen = Math.max(norm1.length, norm2.length);
    const dist = distanciaLevenshtein(s1, s2);
    return (maxLen - dist) / maxLen;
}
//# sourceMappingURL=string-utils.js.map