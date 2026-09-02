import { describe, expect, test } from 'vitest';
import type { DadosVideoGeral } from '../../tipos';
import { naoOk, ok } from '../testes/fixtures';
import { verificarCupomFiscal, verificarEntregadores, verificarTrezentosMl } from './declarativas';

describe('cupom fiscal (13)', () => {
  test('sim sem ressalva é conforme', () => expect(verificarCupomFiscal(ok()).status).toBe('conforme'));
  test('resposta condicional é atenção e cita o texto', () => {
    const v = verificarCupomFiscal(naoOk());
    expect(v.status).toBe('atencao');
    expect(v.observado).toContain('porém');
  });
  test.each(['Sim, mas ainda não validei', 'em processo de homologação', 'aguardando certificado', 'pendente', 'falta configurar'])('"%s" é condicional', (obs) => {
    const e = ok(); e.formulario = { ...e.formulario, cupomFiscalObs: obs };
    expect(verificarCupomFiscal(e).status).toBe('atencao');
  });
  test('"emito desde 2024" não é condicional', () => {
    const e = ok(); e.formulario = { ...e.formulario, cupomFiscalObs: 'emito desde 2024' };
    expect(verificarCupomFiscal(e).status).toBe('conforme');
  });
  test('declarou não é atenção', () => {
    const e = ok(); e.formulario = { ...e.formulario, cupomFiscal: 'nao', cupomFiscalObs: '' };
    expect(verificarCupomFiscal(e).status).toBe('atencao');
  });
});

describe('entregadores (14)', () => {
  test('motos e bags no vídeo: conforme', () => expect(verificarEntregadores(ok()).observado).toBe('2 moto(s), 1 bag(s), 0 pessoa(s) entregando'));
  test('sem vídeo ou sem nenhuma evidência: não verificável', () => {
    const semVideo = ok(); semVideo.observacoes = semVideo.observacoes.filter((o) => o.tipo !== 'video_geral');
    expect(verificarEntregadores(semVideo).status).toBe('nao_verificavel');
    const zero = ok(); (zero.observacoes.find((o) => o.tipo === 'video_geral')!.dados as unknown as DadosVideoGeral).entregadores = { motos: 0, bags: 0, pessoas_entregando: 0 };
    expect(verificarEntregadores(zero).status).toBe('nao_verificavel');
  });
  test('declarado abaixo do mínimo da região é atenção', () => {
    const e = ok(); e.formulario = { ...e.formulario, qtdEntregadores: 0 };
    expect(verificarEntregadores(e).status).toBe('atencao');
  });
});

describe('300 ml (15)', () => {
  test('NF com itens de 300 ml: conforme', () => expect(verificarTrezentosMl(ok()).status).toBe('conforme'));
  test('só a foto do refrigerador cita 300 ml: conforme pela foto', () => {
    const e = ok();
    e.observacoes = e.observacoes.filter((o) => o.tipo !== 'nf_ambev');
    const v = verificarTrezentosMl(e);
    expect(v.status).toBe('conforme');
    expect(v.observado).toMatch(/geladeira-2\.jpeg/);
  });
  test('sem evidência: não verificável', () => expect(verificarTrezentosMl(naoOk()).status).toBe('nao_verificavel'));
  test('evidência existe mas PDV declarou não: atenção', () => {
    const e = ok(); e.formulario = { ...e.formulario, trabalha300ml: 'nao' };
    expect(verificarTrezentosMl(e).status).toBe('atencao');
  });
});
