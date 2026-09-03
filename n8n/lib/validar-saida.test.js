import { describe, expect, test } from 'vitest';
import { carregarRecursos } from '../recursos';
import { extrairConteudo, validarClassificacao, validarObservacao, validarParecer } from './validar-saida.js';

const RECURSOS = carregarRecursos();
const conteudo = {
  aderente_ao_tipo: true, confianca: 1.4, resumo: 'Loja aberta.', qualidade: { nitidez: 'boa', iluminacao: 'boa', observacao: '' },
  dados: { tipo_local: 'loja_aberta', letreiro: 'Armazém', numero_imovel: null, porta: 'aberta' }, evidencias: [{ ref: 'centro', descricao: 'letreiro' }], alertas: [],
};
const resposta = (c, extra = {}) => ({ model: 'google/gemini-2.5-flash', usage: { prompt_tokens: 1200, completion_tokens: 90 }, choices: [{ message: { content: typeof c === 'string' ? c : JSON.stringify(c) } }], ...extra });
const entrada = { tipo: 'fachada', arquivo_id: 'a1', nome: 'f.jpeg', mime: 'image/jpeg', inicio_ms: Date.now() - 50 };

describe('validarObservacao', () => {
  test('monta a Observacao com metadados e confiança limitada a 1', () => {
    const o = validarObservacao(resposta(conteudo), entrada, RECURSOS);
    expect(o).toMatchObject({ arquivo_id: 'a1', tipo: 'fachada', nome: 'f.jpeg', mime: 'image/jpeg', modelo: 'google/gemini-2.5-flash', tokens: { entrada: 1200, saida: 90 }, confianca: 1, resumo: 'Loja aberta.' });
    expect(o.latencia_ms).toBeGreaterThanOrEqual(50);
    expect(o.dados.tipo_local).toBe('loja_aberta');
  });
  test('aceita conteúdo cercado por ``` e conteúdo já em objeto', () => {
    expect(validarObservacao(resposta('```json\n' + JSON.stringify(conteudo) + '\n```'), entrada, RECURSOS).resumo).toBe('Loja aberta.');
    expect(extrairConteudo({ choices: [{ message: { content: { a: 1 } } }] })).toEqual({ a: 1 });
  });
  test('campo obrigatório de dados ausente e nível inválido lançam erro descritivo', () => {
    const semPorta = { ...conteudo, dados: { tipo_local: 'loja_aberta', letreiro: null, numero_imovel: null } };
    expect(() => validarObservacao(resposta(semPorta), entrada, RECURSOS)).toThrow(/dados\.porta/);
    expect(() => validarObservacao(resposta({ ...conteudo, qualidade: { nitidez: 'otima', iluminacao: 'boa', observacao: '' } }), entrada, RECURSOS)).toThrow(/qualidade/);
    expect(() => validarObservacao(resposta('isto não é json'), entrada, RECURSOS)).toThrow(/JSON/);
    expect(() => validarObservacao({ choices: [] }, entrada, RECURSOS)).toThrow(/sem conteúdo/);
  });
});

describe('validarParecer', () => {
  const parecer = { parecer: 'Texto.', pontos_de_atencao: ['a'], recomendacao_sugerida: 'apto', justificativa: 'b' };
  test('devolve o parecer com modelo e tokens', () => {
    expect(validarParecer(resposta(parecer, { model: 'google/gemini-2.5-pro' }), RECURSOS)).toEqual({ ...parecer, modelo: 'google/gemini-2.5-pro', tokens: { entrada: 1200, saida: 90 } });
  });
  test('recomendação fora do enum lança erro', () => {
    expect(() => validarParecer(resposta({ ...parecer, recomendacao_sugerida: 'talvez' }), RECURSOS)).toThrow(/Parecer inválido/);
  });
});

describe('validarClassificacao', () => {
  const entradaClassificacao = { arquivo_id: 'c1', nome: 'foto.jpeg', mime: 'image/jpeg', inicio_ms: Date.now() - 50 };
  const classificacao = { tipo_detectado: 'fachada', confianca: 1.3, motivo: 'Frente de loja.' };
  test('devolve tipo, confiança limitada a 1, motivo e metadados', () => {
    const r = validarClassificacao(resposta(classificacao), entradaClassificacao, RECURSOS);
    expect(r).toMatchObject({ arquivo_id: 'c1', nome: 'foto.jpeg', mime: 'image/jpeg', tipo_detectado: 'fachada', confianca: 1, motivo: 'Frente de loja.', modelo: 'google/gemini-2.5-flash', tokens: { entrada: 1200, saida: 90 } });
    expect(r.latencia_ms).toBeGreaterThanOrEqual(50);
  });
  test('indefinido é aceito', () => {
    expect(validarClassificacao(resposta({ ...classificacao, tipo_detectado: 'indefinido', confianca: 0.2 }), entradaClassificacao, RECURSOS).tipo_detectado).toBe('indefinido');
  });
  test('tipo fora do enum ou confiança não numérica lançam', () => {
    expect(() => validarClassificacao(resposta({ ...classificacao, tipo_detectado: 'geladeira' }), entradaClassificacao, RECURSOS)).toThrow(/Classificação inválida/);
    expect(() => validarClassificacao(resposta({ ...classificacao, confianca: 'alta' }), entradaClassificacao, RECURSOS)).toThrow(/Classificação inválida/);
  });
});
