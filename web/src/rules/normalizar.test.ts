import { describe, expect, test } from 'vitest';
import { melhorSimilaridade, semZerosAEsquerda, similaridadeNome, tokensNome } from './normalizar';

describe('nomes', () => {
  test('tokens sem acento, sem dígitos, sem conectivos e sem sufixos societários', () => {
    expect(tokensNome('12.345.678 JOÃO EXEMPLO DE SOUZA LTDA')).toEqual(['joao', 'exemplo', 'souza']);
  });
  test('responsável igual ao sócio dá 1', () => expect(similaridadeNome('Maria Exemplo da Silva', 'MARIA EXEMPLO DA SILVA')).toBe(1));
  test('empresário individual: nome dentro da razão social dá 1', () => expect(similaridadeNome('João Exemplo de Souza', '12.345.678 JOAO EXEMPLO DE SOUZA')).toBe(1));
  test('nome sem relação com a razão social fica abaixo de 0,8', () => expect(similaridadeNome('Maria Exemplo da Silva', 'EXEMPLO COMERCIO DE BEBIDAS LTDA')).toBeLessThan(0.8));
  test('melhorSimilaridade usa a maior fonte', () => expect(melhorSimilaridade('Maria Exemplo da Silva', ['EXEMPLO COMERCIO DE BEBIDAS LTDA', 'MARIA EXEMPLO DA SILVA'])).toBe(1));
  test('candidato vazio dá 0', () => expect(similaridadeNome('', 'QUALQUER')).toBe(0));
});

describe('semZerosAEsquerda', () => {
  test.each([['0045001', '45001'], ['45001', '45001'], ['00', ''], [null, ''], ['A-0011', '11']])('%s vira %s', (v, esperado) => expect(semZerosAEsquerda(v)).toBe(esperado));
});
