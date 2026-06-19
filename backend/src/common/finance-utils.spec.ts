import * as fc from 'fast-check';
import {
  calcularDiferenca,
  calcularEconomiaOuSobrepreco,
  calcularJurosEfetivos,
  calcularPercentualProgresso,
} from './finance-utils';

describe('Finance Utils - Property-Based Testing', () => {
  
  it('calcularDiferenca deve satisfazer a propriedade: orcado - pago = diferenca', () => {
    fc.assert(
      fc.property(fc.nat(), fc.nat(), (orcado, pago) => {
        const diff = calcularDiferenca(orcado, pago);
        expect(diff).toBe(orcado - pago);
      }),
    );
  });

  it('calcularDiferenca deve retornar 0 se houver entrada negativa', () => {
    fc.assert(
      fc.property(
        fc.integer({ max: -1 }),
        fc.integer(),
        (negativo, qualquer) => {
          expect(calcularDiferenca(negativo, qualquer)).toBe(0);
          expect(calcularDiferenca(qualquer, negativo)).toBe(0);
        },
      ),
    );
  });

  it('calcularEconomiaOuSobrepreco deve garantir que economia e sobrepreco sejam mutualmente exclusivos ou ambos 0', () => {
    fc.assert(
      fc.property(fc.nat(), fc.nat(), (orcado, pago) => {
        const { economia, sobrepreco } = calcularEconomiaOuSobrepreco(orcado, pago);
        
        if (pago < orcado) {
          expect(economia).toBe(orcado - pago);
          expect(sobrepreco).toBe(0);
        } else if (pago > orcado) {
          expect(economia).toBe(0);
          expect(sobrepreco).toBe(pago - orcado);
        } else {
          expect(economia).toBe(0);
          expect(sobrepreco).toBe(0);
        }
      }),
    );
  });

  it('calcularJurosEfetivos deve calcular a diferenca entre total parcelado e valor a vista', () => {
    fc.assert(
      fc.property(
        fc.nat(),
        fc.integer({ min: 1, max: 24 }),
        fc.nat(),
        (valorParcela, parcelas, valorAVista) => {
          const juros = calcularJurosEfetivos(valorParcela, parcelas, valorAVista);
          const totalParcelado = valorParcela * parcelas;

          if (totalParcelado > valorAVista) {
            expect(juros).toBe(totalParcelado - valorAVista);
          } else {
            expect(juros).toBe(0);
          }
        },
      ),
    );
  });

  it('calcularPercentualProgresso deve retornar valores entre 0 e 100 baseados no orcado', () => {
    fc.assert(
      fc.property(
        fc.nat(),
        fc.integer({ min: 1 }), // orcado deve ser maior que 0
        (comprado, orcado) => {
          const progresso = calcularPercentualProgresso(comprado, orcado);
          
          expect(progresso).toBeGreaterThanOrEqual(0);
          expect(progresso).toBeLessThanOrEqual(100);
          
          const progressoManual = (comprado / orcado) * 100;
          const progressoEsperado = Math.min(100, Math.max(0, Math.round(progressoManual * 100) / 100));
          expect(progresso).toBe(progressoEsperado);
        },
      ),
    );
  });
});
