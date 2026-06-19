"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.calcularDiferenca = calcularDiferenca;
exports.calcularEconomiaOuSobrepreco = calcularEconomiaOuSobrepreco;
exports.calcularJurosEfetivos = calcularJurosEfetivos;
exports.calcularPercentualProgresso = calcularPercentualProgresso;
function calcularDiferenca(orcadoCentavos, pagoCentavos) {
    if (orcadoCentavos < 0 || pagoCentavos < 0) {
        return 0;
    }
    return orcadoCentavos - pagoCentavos;
}
function calcularEconomiaOuSobrepreco(orcadoCentavos, pagoCentavos) {
    if (orcadoCentavos < 0 || pagoCentavos < 0) {
        return { economia: 0, sobrepreco: 0 };
    }
    if (pagoCentavos < orcadoCentavos) {
        return {
            economia: orcadoCentavos - pagoCentavos,
            sobrepreco: 0,
        };
    }
    else {
        return {
            economia: 0,
            sobrepreco: pagoCentavos - orcadoCentavos,
        };
    }
}
function calcularJurosEfetivos(valorParcelaCentavos, numParcelas, valorAVistaCentavos) {
    if (valorParcelaCentavos < 0 || numParcelas < 0 || valorAVistaCentavos < 0) {
        return 0;
    }
    const totalFinanciado = valorParcelaCentavos * numParcelas;
    if (totalFinanciado > valorAVistaCentavos) {
        return totalFinanciado - valorAVistaCentavos;
    }
    return 0;
}
function calcularPercentualProgresso(compradoCentavos, orcadoCentavos) {
    if (orcadoCentavos <= 0 || compradoCentavos < 0) {
        return 0;
    }
    const progresso = (compradoCentavos / orcadoCentavos) * 100;
    return Math.min(100, Math.max(0, Math.round(progresso * 100) / 100));
}
//# sourceMappingURL=finance-utils.js.map