import { describe, expect, test } from 'vitest';
import type { Receita, TipoAnexo, TipoDetectado } from '../tipos';
import { CLASSIFICACAO_PENDENTE, anexosParaMotor, errosFormulario, estadoInicial, faltantes, podeAvancar, reduzir, type Anexo, type Classificacao, type EstadoApp } from './estadoApp';

const arquivo = new File(['x'], 'fachada.jpeg', { type: 'image/jpeg' });
const classificado = (tipo: TipoDetectado, confianca = 0.9): Classificacao => ({ estado: 'concluida', tipoDetectado: tipo, confianca, motivo: 'teste' });
const anexo = (id: string, tipo: Anexo['tipo'] = 'fachada', classificacao: Classificacao = CLASSIFICACAO_PENDENTE): Anexo =>
  ({ arquivoId: id, arquivo, nome: `${id}.jpeg`, mime: 'image/jpeg', tipo, duracaoS: null, estado: 'na_fila', classificacao });
const SEIS: TipoAnexo[] = ['fachada', 'refrigerador', 'equipamentos', 'nf_ambev', 'cartao_cnpj', 'video_geral'];
const completo = (): EstadoApp => SEIS.reduce<EstadoApp>((e, t, i) => reduzir(e, { tipo: 'anexo_adicionar', valor: anexo(`a${i}`, t, classificado(t)) }), { ...estadoInicial(), etapa: 2 });
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
  test('anexo_tipo com null deixa o anexo sem tipo e na fila', () => {
    let e = reduzir(estadoInicial(), { tipo: 'anexo_adicionar', valor: anexo('a1', 'refrigerador') });
    e = reduzir(e, { tipo: 'anexo_estado', valor: { arquivoId: 'a1', estado: 'concluido', observacao: { arquivo_id: 'a1' } as never } });
    e = reduzir(e, { tipo: 'anexo_tipo', arquivoId: 'a1', valor: null });
    expect(e.anexos[0]).toMatchObject({ tipo: null, estado: 'na_fila', observacao: undefined });
    expect(podeAvancar({ ...e, etapa: 2 })).toBe(false);
  });
  test('etapa 2 exige todos os obrigatórios do formulário, tipo em todos e nenhuma classificação em andamento', () => {
    let e = { ...estadoInicial(), etapa: 2 as const } as EstadoApp;
    expect(podeAvancar(e)).toBe(false);
    expect(faltantes(e)).toEqual(SEIS);
    e = completo();
    expect(podeAvancar(e)).toBe(true);
    expect(faltantes(e)).toEqual([]);
    const semNf = reduzir(e, { tipo: 'anexo_remover', arquivoId: 'a3' });
    expect(faltantes(semNf)).toEqual(['nf_ambev']);
    expect(podeAvancar(semNf)).toBe(false);
    const classificando = reduzir(e, { tipo: 'anexo_adicionar', valor: anexo('a9', 'fachada', { ...CLASSIFICACAO_PENDENTE, estado: 'classificando' }) });
    expect(podeAvancar(classificando)).toBe(false);
    const semTipo = reduzir(e, { tipo: 'anexo_adicionar', valor: anexo('a8', null, classificado('indefinido', 0.3)) });
    expect(podeAvancar(semTipo)).toBe(false);
    const comCamara = reduzir(e, { tipo: 'formulario', valor: { camaraFria: 'sim' } });
    expect(faltantes(comCamara)).toEqual(['camara_fria']);
    expect(podeAvancar(comCamara)).toBe(false);
  });
  test('etapa 3 exige fila terminada e anexosParaMotor marca falhos', () => {
    let e = reduzir({ ...estadoInicial(), etapa: 3 as const } as EstadoApp, { tipo: 'anexo_adicionar', valor: anexo('a1', 'fachada') });
    expect(podeAvancar(e)).toBe(false);
    e = reduzir(e, { tipo: 'anexo_estado', valor: { arquivoId: 'a1', estado: 'falhou', erro: 'x' } });
    expect(podeAvancar(e)).toBe(true);
    expect(anexosParaMotor(e)).toEqual([{ arquivoId: 'a1', tipo: 'fachada', nome: 'a1.jpeg', duracaoS: null, falhou: true }]);
  });
  test('anexo_classificacao preenche o tipo quando a confiança atinge o limiar e o formato é compatível', () => {
    let e = reduzir(estadoInicial(), { tipo: 'anexo_adicionar', valor: anexo('a1', null) });
    e = reduzir(e, { tipo: 'anexo_classificacao', arquivoId: 'a1', valor: { estado: 'classificando' } });
    expect(e.anexos[0]).toMatchObject({ tipo: null, classificacao: { estado: 'classificando' } });
    e = reduzir(e, { tipo: 'anexo_classificacao', arquivoId: 'a1', valor: { estado: 'concluida', tipoDetectado: 'fachada', confianca: 0.9, motivo: 'frente de loja' } });
    expect(e.anexos[0]).toMatchObject({ tipo: 'fachada', classificacao: { estado: 'concluida', tipoDetectado: 'fachada', confianca: 0.9 } });
    const baixa = reduzir(reduzir(estadoInicial(), { tipo: 'anexo_adicionar', valor: anexo('b1', null) }), { tipo: 'anexo_classificacao', arquivoId: 'b1', valor: { estado: 'concluida', tipoDetectado: 'fachada', confianca: 0.4, motivo: 'incerto' } });
    expect(baixa.anexos[0].tipo).toBeNull();
    const indefinido = reduzir(reduzir(estadoInicial(), { tipo: 'anexo_adicionar', valor: anexo('c1', null) }), { tipo: 'anexo_classificacao', arquivoId: 'c1', valor: { estado: 'concluida', tipoDetectado: 'indefinido', confianca: 0.9, motivo: 'nada' } });
    expect(indefinido.anexos[0].tipo).toBeNull();
    const incompativel = reduzir(reduzir(estadoInicial(), { tipo: 'anexo_adicionar', valor: anexo('d1', null) }), { tipo: 'anexo_classificacao', arquivoId: 'd1', valor: { estado: 'concluida', tipoDetectado: 'video_geral', confianca: 0.95, motivo: 'jpeg como vídeo' } });
    expect(incompativel.anexos[0].tipo).toBeNull();
  });
  test('anexo_classificacao não sobrescreve o tipo escolhido pelo usuário e guarda a falha', () => {
    let e = reduzir(estadoInicial(), { tipo: 'anexo_adicionar', valor: anexo('a1', 'refrigerador') });
    e = reduzir(e, { tipo: 'anexo_classificacao', arquivoId: 'a1', valor: { estado: 'concluida', tipoDetectado: 'fachada', confianca: 0.95, motivo: 'frente' } });
    expect(e.anexos[0]).toMatchObject({ tipo: 'refrigerador', classificacao: { tipoDetectado: 'fachada' } });
    e = reduzir(e, { tipo: 'anexo_adicionar', valor: anexo('a2', null) });
    e = reduzir(e, { tipo: 'anexo_classificacao', arquivoId: 'a2', valor: { estado: 'falhou', erro: 'O serviço respondeu HTTP 500', erroCodigo: 'servidor' } });
    expect(e.anexos[1]).toMatchObject({ tipo: null, classificacao: { estado: 'falhou', erro: 'O serviço respondeu HTTP 500', erroCodigo: 'servidor' } });
  });
});

test('reiniciar volta ao estado inicial', () => {
  let e = reduzir(estadoInicial(), { tipo: 'anexo_adicionar', valor: anexo('a1') });
  e = reduzir(e, { tipo: 'etapa', valor: 4 });
  expect(reduzir(e, { tipo: 'reiniciar' })).toEqual(estadoInicial());
});
