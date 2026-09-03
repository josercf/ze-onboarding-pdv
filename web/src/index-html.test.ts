// web/src/index-html.test.ts
import html from '../index.html?raw';
import { describe, expect, test } from 'vitest';

describe('web/index.html', () => {
  test('declara o idioma pt-BR', () => {
    expect(html).toContain('lang="pt-BR"');
  });
  test('título identifica o produto', () => {
    expect(html).toContain('<title>Onboarding de PDV</title>');
  });
});
