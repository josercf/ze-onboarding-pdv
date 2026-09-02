import { describe, expect, test } from 'vitest';
import { TIPOS } from '../schemas/index';
import { TIPOS_CONFIG, cnaes, limites, modelos, regiaoDefault, verificacoes } from './index';

const FORMATOS = ['video/mp4', 'image/jpeg', 'image/png', 'application/pdf'];

describe('configuração compartilhada', () => {
  test('tipos.json cobre exatamente os sete tipos', () => {
    expect(Object.keys(TIPOS_CONFIG).sort()).toEqual([...TIPOS].sort());
  });
  test('formatos permitidos por tipo estão na lista global', () => {
    for (const cfg of Object.values(TIPOS_CONFIG)) for (const f of cfg.formatos) expect(FORMATOS).toContain(f);
  });
  test('limites conforme a spec', () => {
    expect(limites).toMatchObject({ maxBytesVideo: 11534336, maxBytesImagemPdf: 8388608, concorrencia: 2, timeoutFetchMs: 95000, esperaRetryMs: 3000, duracaoMinimaVideoS: 10, diasValidadeDocumento: 90 });
  });
  test('itens críticos e obrigatórios estão entre 1 e 16', () => {
    for (const n of [...verificacoes.criticos, ...verificacoes.obrigatorios]) expect(n).toBeGreaterThanOrEqual(1), expect(n).toBeLessThanOrEqual(16);
    expect(verificacoes.criticos).toEqual([1, 6, 7, 8]);
  });
  test('CNAEs e padrões regionais', () => {
    expect(cnaes.codigos).toContain(4723700);
    expect(cnaes.prefixos).toContain('56112');
    expect(regiaoDefault).toEqual({ minRefrigeradores: 4, camaraFriaObrigatoria: false, minEntregadores: 1 });
    expect(modelos.analise).toBe('google/gemini-2.5-flash');
    expect(modelos.parecer).toBe('google/gemini-2.5-pro');
  });
});
