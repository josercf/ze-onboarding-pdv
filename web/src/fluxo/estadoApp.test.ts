import { describe, expect, test } from 'vitest';
import type { Receita } from '../tipos';
import { anexosParaMotor, errosFormulario, estadoInicial, podeAvancar, reduzir, type Anexo, type EstadoApp } from './estadoApp';

const arquivo = new File(['x'], 'fachada.jpeg', { type: 'image/jpeg' });
const anexo = (id: string, tipo: Anexo['tipo'] = 'fachada'): Anexo => ({ arquivoId: id, arquivo, nome: `${id}.jpeg`, mime: 'image/jpeg', tipo, duracaoS: null, estado: 'na_fila' });
const receita: Receita = {
  cnpj: '11222333000181', razaoSocial: 'EXEMPLO LTDA', nomeFantasia: '', situacao: 'ATIVA', dataSituacao: '', dataInicio: '', porte: '', naturezaJuridica: '', mei: false,
  cnaePrincipal: { codigo: 4723700, descricao: '' }, cnaesSecundarios: [], qsa: [],
  endereco: { logradouro: 'RUA EXEMPLO', numero: '40', complemento: '', bairro: 'CENTRO', municipio: 'VOLTA REDONDA', uf: 'RJ', cep: '27250000' },
};
const formularioValido = () => ({ ...estadoInicial().formulario, cnpj: '11222333000181', responsavel: 'Maria Exemplo', qtdRefrigeradores: 4, qtdEntregadores: 1, qtdMaquininhas: 1, codigoParceiro: '0011223', horarioDelivery: 'seg a dom, 10h às 23h' });

describe('errosFormulario e podeAvancar na etapa 1', () => {
  test('formulário vazio acumula erros em pt-BR', () => {
    const erros = errosFormulario(estadoInicial().formulario);
    expect(erros).toContain('Informe um CNPJ válido.');
    expect(erros).toContain('Informe o nome completo do responsável pelo CNPJ.');
    expect(erros).toContain('Informe o código de parceiro Ambev.');
    expect(erros).toContain('Informe dias e horário de funcionamento do delivery.');
  });
  test('quantidade negativa ou fracionária é erro', () => {
    expect(errosFormulario({ ...formularioValido(), qtdRefrigeradores: -1 })).toHaveLength(1);
    expect(errosFormulario({ ...formularioValido(), qtdMaquininhas: 1.5 })).toHaveLength(1);
  });
  test('código de parceiro só é obrigatório para parceiro Ambev', () => {
    expect(errosFormulario({ ...formularioValido(), parceiroAmbev: 'nao', codigoParceiro: '' })).toEqual([]);
  });
  test('formulário válido permite avançar', () => {
    const e = reduzir(estadoInicial(), { tipo: 'formulario', valor: formularioValido() });
    expect(podeAvancar(e)).toBe(true);
  });
});

describe('receita', () => {
  test('preenche o endereço vazio com o da Receita e guarda erro quando falha', () => {
    let e = reduzir(estadoInicial(), { tipo: 'receita', valor: receita });
    expect(e.formulario.endereco.logradouro).toBe('RUA EXEMPLO');
    e = reduzir(e, { tipo: 'formulario', valor: { endereco: { ...e.formulario.endereco, numero: '42' } } });
    e = reduzir(e, { tipo: 'receita', valor: receita });
    expect(e.formulario.endereco.numero).toBe('42');
    e = reduzir(e, { tipo: 'receita', valor: null, erro: 'CNPJ não encontrado na Receita Federal.' });
    expect(e.receita).toBeNull();
    expect(e.receitaErro).toBe('CNPJ não encontrado na Receita Federal.');
  });
});

describe('anexos', () => {
  test('adicionar, retipar (volta para a fila) e remover', () => {
    let e = reduzir(estadoInicial(), { tipo: 'anexo_adicionar', valor: anexo('a1') });
    e = reduzir(e, { tipo: 'anexo_adicionar', valor: anexo('a1') });
    expect(e.anexos).toHaveLength(1);
    e = reduzir(e, { tipo: 'anexo_estado', valor: { arquivoId: 'a1', estado: 'concluido', observacao: { arquivo_id: 'a1' } as never } });
    e = reduzir(e, { tipo: 'anexo_tipo', arquivoId: 'a1', valor: 'refrigerador' });
    expect(e.anexos[0]).toMatchObject({ tipo: 'refrigerador', estado: 'na_fila', observacao: undefined });
    e = reduzir(e, { tipo: 'anexo_remover', arquivoId: 'a1' });
    expect(e.anexos).toEqual([]);
  });
  test('etapa 2 exige ao menos um anexo e todos com tipo; etapa 3 exige fila terminada', () => {
    let e = { ...estadoInicial(), etapa: 2 as const } as EstadoApp;
    expect(podeAvancar(e)).toBe(false);
    e = reduzir(e, { tipo: 'anexo_adicionar', valor: anexo('a1', null) });
    expect(podeAvancar(e)).toBe(false);
    e = reduzir(e, { tipo: 'anexo_tipo', arquivoId: 'a1', valor: 'fachada' });
    expect(podeAvancar(e)).toBe(true);
    e = { ...e, etapa: 3 } as EstadoApp;
    expect(podeAvancar(e)).toBe(false);
    e = reduzir(e, { tipo: 'anexo_estado', valor: { arquivoId: 'a1', estado: 'falhou', erro: 'x' } });
    expect(podeAvancar(e)).toBe(true);
    expect(anexosParaMotor(e)).toEqual([{ arquivoId: 'a1', tipo: 'fachada', nome: 'a1.jpeg', duracaoS: null, falhou: true }]);
  });
});

test('reiniciar volta ao estado inicial', () => {
  let e = reduzir(estadoInicial(), { tipo: 'anexo_adicionar', valor: anexo('a1') });
  e = reduzir(e, { tipo: 'etapa', valor: 4 });
  expect(reduzir(e, { tipo: 'reiniciar' })).toEqual(estadoInicial());
});
