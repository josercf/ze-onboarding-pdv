import { describe, expect, test } from 'vitest';
import { carregarRecursos } from '../recursos';
import { inferirMime, tamanhoBase64, validarEntrada } from './validar-entrada.js';

const RECURSOS = carregarRecursos();
const item = (extra = {}) => ({ body: { tipo: 'refrigerador', arquivo_id: 'a1', contexto: '{"cnpj":"11222333000181"}' }, base64: 'aGVsbG8=', binario: { fileName: 'freezer.jpeg', mimeType: 'image/jpeg' }, ...extra });

describe('validarEntrada', () => {
  test('entrada válida devolve os campos normalizados', () => {
    const r = validarEntrada(item(), RECURSOS);
    expect(r.ok).toBe(true);
    expect(r.entrada).toMatchObject({ tipo: 'refrigerador', arquivo_id: 'a1', contexto: { cnpj: '11222333000181' }, nome: 'freezer.jpeg', mime: 'image/jpeg', base64: 'aGVsbG8=', tamanho_bytes: 5 });
    expect(typeof r.entrada.inicio_ms).toBe('number');
  });
  test('tipo desconhecido, arquivo_id ausente, arquivo ausente e contexto inválido dão 400', () => {
    expect(validarEntrada(item({ body: { tipo: 'geladeira', arquivo_id: 'a1' } }), RECURSOS)).toMatchObject({ ok: false, status: 400, erro: { codigo: 'tipo_invalido' } });
    expect(validarEntrada(item({ body: { tipo: 'fachada' } }), RECURSOS)).toMatchObject({ ok: false, erro: { codigo: 'arquivo_id_ausente' } });
    expect(validarEntrada(item({ base64: undefined }), RECURSOS)).toMatchObject({ ok: false, erro: { codigo: 'arquivo_ausente' } });
    expect(validarEntrada(item({ body: { tipo: 'fachada', arquivo_id: 'a1', contexto: '{x' } }), RECURSOS)).toMatchObject({ ok: false, erro: { codigo: 'contexto_invalido' } });
  });
  test('contexto ausente vira objeto vazio', () => {
    expect(validarEntrada(item({ body: { tipo: 'fachada', arquivo_id: 'a1' } }), RECURSOS).entrada.contexto).toEqual({});
  });
  test('formato incompatível com o tipo dá 400; mime genérico é inferido pelo nome', () => {
    expect(validarEntrada(item({ binario: { fileName: 'v.mp4', mimeType: 'video/mp4' } }), RECURSOS)).toMatchObject({ ok: false, erro: { codigo: 'formato_invalido' } });
    const r = validarEntrada(item({ body: { tipo: 'cartao_cnpj', arquivo_id: 'a1' }, binario: { fileName: 'CARTAO.PDF', mimeType: 'application/octet-stream' } }), RECURSOS);
    expect(r.entrada.mime).toBe('application/pdf');
  });
  test('acima do limite dá 413', () => {
    const pequeno = { ...RECURSOS, limites: { ...RECURSOS.limites, maxBytesImagemPdf: 4 } };
    expect(validarEntrada(item(), pequeno)).toMatchObject({ ok: false, status: 413, erro: { codigo: 'arquivo_grande' } });
  });
});

test('tamanhoBase64 e inferirMime', () => {
  expect(tamanhoBase64('aGVsbG8=')).toBe(5);
  expect(tamanhoBase64('aGVsbG8gbXVuZG8=')).toBe(11);
  expect(inferirMime('', 'foto.JPG')).toBe('image/jpeg');
  expect(inferirMime('image/png', 'x.jpg')).toBe('image/png');
  expect(inferirMime('', 'sem-extensao')).toBe('');
});
