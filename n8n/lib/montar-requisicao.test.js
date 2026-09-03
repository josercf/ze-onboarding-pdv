import { describe, expect, test } from 'vitest';
import { carregarRecursos } from '../recursos';
import { montarRequisicao, montarRequisicaoClassificacao, preencher } from './montar-requisicao.js';

const RECURSOS = carregarRecursos();
const entrada = (tipo, mime, nome) => ({ tipo, arquivo_id: 'a1', nome, mime, base64: 'QUJD', contexto: { cnpj: '11222333000181', codigo_parceiro_declarado: '0011223' }, tamanho_bytes: 3, inicio_ms: 1 });

describe('montarRequisicao', () => {
  test('vídeo vira parte video_url em data URL, com schema estrito e provider restrito', () => {
    const { url, body } = montarRequisicao(entrada('video_geral', 'video/mp4', 'v.mp4'), RECURSOS);
    expect(url).toBe('https://openrouter.ai/api/v1/chat/completions');
    expect(body.model).toBe('google/gemini-2.5-flash');
    expect(body.messages[0]).toEqual({ role: 'system', content: RECURSOS.prompts.system });
    expect(body.messages[1].content[1]).toEqual({ type: 'video_url', video_url: { url: 'data:video/mp4;base64,QUJD' } });
    expect(body.response_format).toEqual({ type: 'json_schema', json_schema: { name: 'observacao_video_geral', strict: true, schema: RECURSOS.schemas.video_geral } });
    expect(body.provider).toEqual({ require_parameters: true, data_collection: 'deny' });
    expect(body.plugins).toBeUndefined();
  });
  test('imagem vira image_url; PDF vira file com plugin de parser nativo', () => {
    expect(montarRequisicao(entrada('fachada', 'image/jpeg', 'f.jpeg'), RECURSOS).body.messages[1].content[1]).toEqual({ type: 'image_url', image_url: { url: 'data:image/jpeg;base64,QUJD' } });
    const pdf = montarRequisicao(entrada('cartao_cnpj', 'application/pdf', 'cartao.pdf'), RECURSOS).body;
    expect(pdf.messages[1].content[1]).toEqual({ type: 'file', file: { filename: 'cartao.pdf', file_data: 'data:application/pdf;base64,QUJD' } });
    expect(pdf.plugins).toEqual([{ id: 'file-parser', pdf: { engine: 'native' } }]);
  });
  test('prompt do tipo recebe o contexto e não deixa placeholder', () => {
    const texto = montarRequisicao(entrada('nf_ambev', 'image/jpeg', 'nf.jpeg'), RECURSOS).body.messages[1].content[0].text;
    expect(texto).toContain('"codigo_parceiro_declarado":"0011223"');
    expect(texto).not.toContain('{{');
    expect(texto).toContain('Transcreva literalmente');
  });
  test('preencher mantém chaves desconhecidas', () => {
    expect(preencher('a {{x}} b {{y}}', { x: '1' })).toBe('a 1 b {{y}}');
  });
});

describe('montarRequisicaoClassificacao', () => {
  const entradaClassificacao = (mime, nome) => ({ arquivo_id: 'c1', nome, mime, base64: 'QUJD', tamanho_bytes: 3, inicio_ms: 1 });
  test('imagem vira image_url com o prompt de classificação, o modelo de classificação e o schema estrito', () => {
    const { url, body } = montarRequisicaoClassificacao(entradaClassificacao('image/jpeg', 'foto.jpeg'), RECURSOS);
    expect(url).toBe('https://openrouter.ai/api/v1/chat/completions');
    expect(body.model).toBe(RECURSOS.modelos.classificacao);
    expect(body.messages[0]).toEqual({ role: 'system', content: RECURSOS.prompts.system });
    expect(body.messages[1].content[0]).toEqual({ type: 'text', text: RECURSOS.prompts.classificar });
    expect(body.messages[1].content[1]).toEqual({ type: 'image_url', image_url: { url: 'data:image/jpeg;base64,QUJD' } });
    expect(body.response_format).toEqual({ type: 'json_schema', json_schema: { name: 'classificacao_anexo', strict: true, schema: RECURSOS.schemas.classificacao } });
    expect(body.provider).toEqual({ require_parameters: true, data_collection: 'deny' });
    expect(body.plugins).toBeUndefined();
  });
  test('PDF vira parte file com o plugin file-parser', () => {
    const { body } = montarRequisicaoClassificacao(entradaClassificacao('application/pdf', 'cartao.pdf'), RECURSOS);
    expect(body.messages[1].content[1]).toEqual({ type: 'file', file: { filename: 'cartao.pdf', file_data: 'data:application/pdf;base64,QUJD' } });
    expect(body.plugins).toEqual([{ id: 'file-parser', pdf: { engine: 'native' } }]);
  });
});
