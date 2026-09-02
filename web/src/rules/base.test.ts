import { describe, expect, test } from 'vitest';
import { diasEntre, formatarTimestamp, parseData } from './base';

describe('diasEntre', () => {
  test('mesmo dia retorna 0', () => {
    expect(diasEntre(new Date('2026-09-02T12:00:00Z'), parseData('2026-09-02')!)).toBe(0);
  });
  test('exatamente 90 dias', () => {
    expect(diasEntre(new Date('2026-09-02T12:00:00Z'), parseData('2026-06-04')!)).toBe(90);
  });
});

describe('parseData', () => {
  test('formato YYYY-MM-DD', () => {
    expect(parseData('2026-07-16')).toEqual(new Date(Date.UTC(2026, 6, 16)));
  });
  test('formato DD/MM/YYYY', () => {
    expect(parseData('16/07/2026')).toEqual(new Date(Date.UTC(2026, 6, 16)));
  });
  test('texto inválido retorna null', () => {
    expect(parseData('texto')).toBe(null);
  });
});

describe('formatarTimestamp', () => {
  test('4 segundos', () => {
    expect(formatarTimestamp(4)).toBe('t=00:04');
  });
  test('65 segundos', () => {
    expect(formatarTimestamp(65)).toBe('t=01:05');
  });
});
