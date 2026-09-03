import { describe, expect, test } from 'vitest';
import { tiposObrigatorios } from './obrigatorios';

const base = { camaraFria: 'nao', computadorInternet: 'nao', impressoraTermica: 'nao' } as const;

describe('tiposObrigatorios', () => {
  test('sem câmara fria nem equipamentos declarados, exige os cinco sempre obrigatórios na ordem da configuração', () => {
    expect(tiposObrigatorios(base)).toEqual(['fachada', 'refrigerador', 'nf_ambev', 'cartao_cnpj', 'video_geral']);
  });
  test('câmara fria declarada "sim" passa a ser obrigatória', () => {
    expect(tiposObrigatorios({ ...base, camaraFria: 'sim' })).toContain('camara_fria');
  });
  test('computador declarado torna balcão e equipamentos obrigatório', () => {
    expect(tiposObrigatorios({ ...base, computadorInternet: 'sim' })).toContain('equipamentos');
  });
  test('impressora declarada também exige equipamentos, e tudo declarado exige os sete na ordem da configuração', () => {
    expect(tiposObrigatorios({ ...base, impressoraTermica: 'sim' })).toContain('equipamentos');
    expect(tiposObrigatorios({ camaraFria: 'sim', computadorInternet: 'sim', impressoraTermica: 'sim' })).toEqual(['fachada', 'refrigerador', 'camara_fria', 'equipamentos', 'nf_ambev', 'cartao_cnpj', 'video_geral']);
  });
});
