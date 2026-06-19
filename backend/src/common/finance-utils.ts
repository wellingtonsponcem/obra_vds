/**
 * Funções utilitárias puras para cálculos financeiros em centavos (BRL).
 * Essas funções são testadas usando Property-Based Testing com fast-check.
 */

/**
 * Calcula a diferença entre o valor orçado e o valor pago.
 * Valores positivos representam economia; valores negativos representam sobrepreço.
 */
export function calcularDiferenca(orcadoCentavos: number, pagoCentavos: number): number {
  if (orcadoCentavos < 0 || pagoCentavos < 0) {
    return 0; // valores negativos são inválidos na nossa lógica de compras
  }
  return orcadoCentavos - pagoCentavos;
}

/**
 * Calcula explicitamente a economia ou o sobrepreço de um item.
 */
export function calcularEconomiaOuSobrepreco(
  orcadoCentavos: number,
  pagoCentavos: number,
): { economia: number; sobrepreco: number } {
  if (orcadoCentavos < 0 || pagoCentavos < 0) {
    return { economia: 0, sobrepreco: 0 };
  }
  
  if (pagoCentavos < orcadoCentavos) {
    return {
      economia: orcadoCentavos - pagoCentavos,
      sobrepreco: 0,
    };
  } else {
    return {
      economia: 0,
      sobrepreco: pagoCentavos - orcadoCentavos,
    };
  }
}

/**
 * Calcula os juros efetivos de um parcelamento em cartão de crédito.
 * Se o total das parcelas for menor ou igual ao valor à vista, juros é 0.
 */
export function calcularJurosEfetivos(
  valorParcelaCentavos: number,
  numParcelas: number,
  valorAVistaCentavos: number,
): number {
  if (valorParcelaCentavos < 0 || numParcelas < 0 || valorAVistaCentavos < 0) {
    return 0;
  }
  const totalFinanciado = valorParcelaCentavos * numParcelas;
  if (totalFinanciado > valorAVistaCentavos) {
    return totalFinanciado - valorAVistaCentavos;
  }
  return 0;
}

/**
 * Calcula o percentual de progresso da obra em compras.
 * Retorna um número de 0 a 100 com 2 casas decimais.
 */
export function calcularPercentualProgresso(
  compradoCentavos: number,
  orcadoCentavos: number,
): number {
  if (orcadoCentavos <= 0 || compradoCentavos < 0) {
    return 0;
  }
  const progresso = (compradoCentavos / orcadoCentavos) * 100;
  return Math.min(100, Math.max(0, Math.round(progresso * 100) / 100));
}
