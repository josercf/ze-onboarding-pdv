import { describe, expect, test } from 'vitest';
import { carregarRecursos } from './recursos';

describe('carregarRecursos', () => {
  const r = carregarRecursos();
  test('carrega o prompt, o schema e o modelo da classificação', () => {
    expect(r.prompts.classificar).toContain('Tipos possíveis');
    expect(r.schemas.classificacao.required).toEqual(['tipo_detectado', 'confianca', 'motivo']);
    expect(r.modelos.classificacao).toBe('google/gemini-2.5-flash');
  });
  test('continua carregando os prompts dos sete tipos, do sistema e do parecer', () => {
    expect(Object.keys(r.prompts).sort()).toEqual(['camara_fria', 'cartao_cnpj', 'classificar', 'equipamentos', 'fachada', 'nf_ambev', 'parecer', 'refrigerador', 'system', 'video_geral']);
  });
});
