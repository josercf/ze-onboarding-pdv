import { describe, expect, test } from 'vitest';
import { formatarCnpj, somenteDigitos, validarCnpj } from './validarCnpj';

describe('validarCnpj', () => {
  test.each(['11222333000181', '12345678000195', '11.222.333/0001-81'])('aceita %s', (v) => expect(validarCnpj(v)).toBe(true));
  test.each(['11222333000180', '00000000000000', '1122233300018', 'abc'])('rejeita %s', (v) => expect(validarCnpj(v)).toBe(false));
});

describe('formatarCnpj', () => {
  test('máscara completa', () => expect(formatarCnpj('11222333000181')).toBe('11.222.333/0001-81'));
  test('máscara progressiva enquanto digita', () => {
    expect(formatarCnpj('1')).toBe('1');
    expect(formatarCnpj('112223')).toBe('11.222.3');
    expect(formatarCnpj('112223330001')).toBe('11.222.333/0001');
  });
  test('somenteDigitos remove máscara e corta em 14', () => expect(somenteDigitos('11.222.333/0001-81x9')).toBe('11222333000181'));
});
