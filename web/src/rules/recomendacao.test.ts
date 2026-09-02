import { describe, expect, test } from 'vitest';
import type { StatusVerificacao, Verificacao } from '../tipos';
import { calcularRecomendacao } from './recomendacao';

const v = (id: number, status: StatusVerificacao, critico: boolean, obrigatorio: boolean): Verificacao => ({ id, item: `item ${id}`, declarado: '', observado: '', status, evidencia: '', critico, obrigatorio });

describe('calcularRecomendacao', () => {
  test('tudo conforme é apto', () => expect(calcularRecomendacao([v(1, 'conforme', true, true), v(14, 'conforme', false, false)])).toBe('apto'));
  test('divergente em item crítico é não apto', () => expect(calcularRecomendacao([v(6, 'divergente', true, true), v(2, 'conforme', false, true)])).toBe('nao_apto'));
  test('divergente em item não crítico é revisão manual', () => expect(calcularRecomendacao([v(3, 'divergente', false, true)])).toBe('revisao_manual'));
  test('atenção ou não verificável em item obrigatório é revisão manual', () => {
    expect(calcularRecomendacao([v(9, 'atencao', false, true)])).toBe('revisao_manual');
    expect(calcularRecomendacao([v(5, 'nao_verificavel', false, true)])).toBe('revisao_manual');
  });
  test('atenção ou não verificável só em item não obrigatório continua apto', () => {
    expect(calcularRecomendacao([v(14, 'nao_verificavel', false, false), v(15, 'atencao', false, false)])).toBe('apto');
  });
});
