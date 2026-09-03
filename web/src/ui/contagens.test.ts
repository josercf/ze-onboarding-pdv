import { describe, expect, test } from 'vitest';
import type { Verificacao } from '../tipos';
import { contarPorStatus } from './contagens';

const v = (id: number, status: Verificacao['status']): Verificacao =>
  ({ id, item: `Item ${id}`, declarado: '', observado: '', status, evidencia: '', critico: false, obrigatorio: false });

describe('contarPorStatus', () => {
  test('lista vazia devolve zero em todas as situações', () => {
    expect(contarPorStatus([])).toEqual({ conforme: 0, divergente: 0, atencao: 0, nao_verificavel: 0 });
  });

  test('conta cada situação e a soma bate com o total', () => {
    const lista = [v(1, 'conforme'), v(2, 'conforme'), v(3, 'divergente'), v(4, 'atencao'), v(5, 'nao_verificavel'), v(6, 'atencao')];
    const c = contarPorStatus(lista);
    expect(c).toEqual({ conforme: 2, divergente: 1, atencao: 2, nao_verificavel: 1 });
    expect(Object.values(c).reduce((a, b) => a + b, 0)).toBe(lista.length);
  });
});
