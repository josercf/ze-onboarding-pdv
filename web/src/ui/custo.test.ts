// web/src/ui/custo.test.ts
import { expect, test } from 'vitest';
import { estimarCusto } from './custo';

test('soma tokens por modelo e aplica os preços por milhão', () => {
  const r = estimarCusto([
    { modelo: 'google/gemini-2.5-flash', tokens: { entrada: 50_000, saida: 2_000 } },
    { modelo: 'google/gemini-2.5-pro', tokens: { entrada: 5_000, saida: 400 } },
    { modelo: 'desconhecido/x', tokens: { entrada: 1_000, saida: 100 } },
  ]);
  expect(r.tokens).toEqual({ entrada: 56_000, saida: 2_500 });
  expect(r.totalUsd).toBeCloseTo(0.02 + 0.01025, 5);
  expect(r.modelos).toEqual(['google/gemini-2.5-flash', 'google/gemini-2.5-pro', 'desconhecido/x']);
});
