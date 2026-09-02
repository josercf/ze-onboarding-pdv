import { describe, expect, test } from 'vitest';
import { esperadoNaoOk, esperadoOk, naoOk, ok } from './testes/fixtures';
import { avaliar } from './motor';

describe('avaliar', () => {
  test.each([['aprovado', ok, esperadoOk], ['reprovado', naoOk, esperadoNaoOk]])('caso %s reproduz o esperado da fixture', (_n, entrada, esperado) => {
    const r = avaliar(entrada());
    expect(r.verificacoes.map((v) => v.id)).toEqual(Array.from({ length: 16 }, (_, i) => i + 1));
    const status = Object.fromEntries(r.verificacoes.map((v) => [String(v.id), v.status]));
    expect(status).toEqual(esperado.status);
    expect(r.recomendacao).toBe(esperado.recomendacao);
  });
  test('sem Receita e sem anexos, nada é divergente e a recomendação é revisão manual', () => {
    const e = ok(); e.receita = null; e.observacoes = []; e.anexosEnviados = [];
    const r = avaliar(e);
    expect(r.verificacoes.every((v) => v.status !== 'divergente')).toBe(true);
    expect(r.recomendacao).toBe('revisao_manual');
  });
  test('exceção em uma verificação vira não verificável só naquele item, sem derrubar as outras 15', () => {
    const e = ok();
    const video = e.observacoes.find((o) => o.tipo === 'video_geral')!;
    Reflect.deleteProperty(video.dados, 'entregadores');
    const r = avaliar(e);
    expect(r.verificacoes).toHaveLength(16);
    expect(r.verificacoes.map((v) => v.id)).toEqual(Array.from({ length: 16 }, (_, i) => i + 1));
    const item14 = r.verificacoes.find((v) => v.id === 14)!;
    expect(item14.status).toBe('nao_verificavel');
    expect(item14.observado).toMatch(/^Erro interno/);
    expect(r.verificacoes.filter((v) => v.id !== 14).every((v) => v.status === 'conforme')).toBe(true);
    expect(r.recomendacao).toBe('apto');
  });
});
