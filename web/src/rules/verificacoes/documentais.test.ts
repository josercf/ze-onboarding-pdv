import { describe, expect, test } from 'vitest';
import type { DadosCartaoCnpj, DadosNfAmbev } from '../../tipos';
import { naoOk, ok } from '../testes/fixtures';
import { verificarCartaoCnpj, verificarCnae, verificarCnpjAtivo, verificarNfAmbev, verificarResponsavel, verificarSocio } from './documentais';

describe('itens 1 a 6 com as fixtures', () => {
  test('caso aprovado: tudo conforme', () => {
    const e = ok();
    for (const fn of [verificarCnpjAtivo, verificarCnae, verificarResponsavel, verificarSocio, verificarCartaoCnpj, verificarNfAmbev]) {
      const v = fn(e);
      expect(v.status, `${v.id} ${v.item}: ${v.observado}`).toBe('conforme');
    }
    expect(verificarNfAmbev(e).critico).toBe(true);
    expect(verificarSocio(e).obrigatorio).toBe(false);
  });
  test('caso reprovado: 1 a 5 conforme, NF divergente por CNPJ e código', () => {
    const e = naoOk();
    expect(verificarCnpjAtivo(e).status).toBe('conforme');
    expect(verificarCnae(e).status).toBe('conforme');
    expect(verificarResponsavel(e).status).toBe('conforme');
    expect(verificarSocio(e).status).toBe('conforme');
    expect(verificarCartaoCnpj(e).status).toBe('conforme');
    const nf = verificarNfAmbev(e);
    expect(nf.status).toBe('divergente');
    expect(nf.observado).toMatch(/difere do PDV/);
    expect(nf.observado).toMatch(/código do cliente 0045003/);
  });
});

describe('sem Receita', () => {
  test('itens 1 a 4 ficam não verificáveis', () => {
    const e = { ...ok(), receita: null };
    for (const fn of [verificarCnpjAtivo, verificarCnae, verificarResponsavel, verificarSocio]) expect(fn(e).status).toBe('nao_verificavel');
  });
});

describe('casos de borda', () => {
  test('situação BAIXADA é divergente', () => {
    const e = ok();
    e.receita = { ...e.receita!, situacao: 'BAIXADA' };
    expect(verificarCnpjAtivo(e).status).toBe('divergente');
  });
  test('CNAE 5611-2/01 (restaurante) conta pelo prefixo', () => {
    const e = ok();
    e.receita = { ...e.receita!, cnaePrincipal: { codigo: 5611201, descricao: 'Restaurantes' }, cnaesSecundarios: [] };
    expect(verificarCnae(e).status).toBe('conforme');
  });
  test('sem CNAE de bebidas é divergente mesmo declarando sim', () => {
    const e = ok();
    e.receita = { ...e.receita!, cnaePrincipal: { codigo: 6201500, descricao: 'Desenvolvimento de software' }, cnaesSecundarios: [] };
    expect(verificarCnae(e).status).toBe('divergente');
  });
  test('LTDA com dois sócios e "possui sócio: não" é divergente', () => {
    const e = ok();
    e.formulario = { ...e.formulario, possuiSocio: 'nao' };
    expect(verificarSocio(e).status).toBe('divergente');
  });
  test('cartão CNPJ com mais de 90 dias vira atenção; com CNPJ diferente vira divergente', () => {
    const antigo = ok();
    const cartao = antigo.observacoes.find((o) => o.tipo === 'cartao_cnpj')!;
    (cartao.dados as unknown as DadosCartaoCnpj).data_emissao = '2026-03-01';
    expect(verificarCartaoCnpj(antigo).status).toBe('atencao');
    const outro = ok();
    (outro.observacoes.find((o) => o.tipo === 'cartao_cnpj')!.dados as unknown as DadosCartaoCnpj).cnpj = '12345678000195';
    expect(verificarCartaoCnpj(outro).status).toBe('divergente');
  });
  test('sem cartão é não verificável', () => {
    const e = ok();
    e.observacoes = e.observacoes.filter((o) => o.tipo !== 'cartao_cnpj');
    expect(verificarCartaoCnpj(e).status).toBe('nao_verificavel');
  });
  test('NF: parceiro "não" é não verificável; NF ilegível é atenção; NF antiga é atenção', () => {
    const naoParceiro = ok();
    naoParceiro.formulario = { ...naoParceiro.formulario, parceiroAmbev: 'nao' };
    expect(verificarNfAmbev(naoParceiro).status).toBe('nao_verificavel');
    const ilegivel = ok();
    (ilegivel.observacoes.find((o) => o.tipo === 'nf_ambev')!.dados as unknown as DadosNfAmbev).legivel = false;
    expect(verificarNfAmbev(ilegivel).status).toBe('atencao');
    const antiga = ok();
    (antiga.observacoes.find((o) => o.tipo === 'nf_ambev')!.dados as unknown as DadosNfAmbev).data_emissao = '2026-01-10';
    expect(verificarNfAmbev(antiga).status).toBe('atencao');
  });
  test('código do cliente compara sem zeros à esquerda', () => {
    const e = ok();
    e.formulario = { ...e.formulario, codigoParceiro: '11223' };
    expect(verificarNfAmbev(e).status).toBe('conforme');
  });
});
