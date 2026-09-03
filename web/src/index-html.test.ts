// web/src/index-html.test.ts
import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';

const html = readFileSync('index.html', 'utf8');

describe('web/index.html', () => {
  test('declara o idioma pt-BR', () => {
    expect(html).toContain('lang="pt-BR"');
  });
  test('título identifica o produto', () => {
    expect(html).toContain('<title>Onboarding de PDV</title>');
  });
});
