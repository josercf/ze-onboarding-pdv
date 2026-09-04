/// <reference types="node" />

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { describe, expect, test } from 'vitest';

const __dirname = dirname(fileURLToPath(import.meta.url));
const tokens = readFileSync(join(__dirname, './tokens.css'), 'utf8');

function corDe(nome: string): string {
  const m = new RegExp(`--${nome}:\\s*(#[0-9a-fA-F]{6})`).exec(tokens);
  if (!m) throw new Error(`token --${nome} não encontrado em tokens.css`);
  return m[1];
}

function luminancia(hex: string): number {
  const canais = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const [r, g, b] = canais.map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Razão de contraste da cor contra branco, conforme a fórmula da WCAG. */
export function contrasteComBranco(hex: string): number {
  return 1.05 / (luminancia(hex) + 0.05);
}

describe('contraste das cores do sistema', () => {
  test.each(['cor-conforme', 'cor-divergente', 'cor-atencao', 'cor-neutra', 'cor-primaria'])(
    '%s atinge 4,5 para 1 sobre branco',
    (nome) => {
      expect(contrasteComBranco(corDe(nome))).toBeGreaterThanOrEqual(4.5);
    },
  );

  test('o cálculo de contraste está correto: preto contra branco dá 21', () => {
    expect(contrasteComBranco('#000000')).toBeCloseTo(21, 1);
  });

  test('cor-borda atinge o mínimo de contorno de componente, 3 para 1 sobre branco (WCAG 1.4.11)', () => {
    expect(contrasteComBranco(corDe('cor-borda'))).toBeGreaterThanOrEqual(3);
  });
});
