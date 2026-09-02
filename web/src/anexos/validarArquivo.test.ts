import { describe, expect, test } from 'vitest';
import { formatarMb, inferirMime, validarArquivo } from './validarArquivo';

const MB = 1048576;
const arq = (name: string, type: string, size: number) => ({ name, type, size });

describe('validarArquivo', () => {
  test('jpeg de 1 MB como refrigerador passa', () => expect(validarArquivo(arq('f.jpeg', 'image/jpeg', MB), 'refrigerador')).toEqual({ ok: true, mime: 'image/jpeg' }));
  test('mp4 como refrigerador falha por formato', () => {
    const r = validarArquivo(arq('v.mp4', 'video/mp4', MB), 'refrigerador');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.motivo).toContain('Formato não aceito');
  });
  test('vídeo acima de 11 MB falha com dica do WhatsApp', () => {
    const r = validarArquivo(arq('v.mp4', 'video/mp4', 12 * MB), 'video_geral');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.motivo).toContain('WhatsApp');
  });
  test('imagem acima de 8 MB falha; no limite exato passa', () => {
    expect(validarArquivo(arq('f.jpeg', 'image/jpeg', 8 * MB + 1), 'fachada').ok).toBe(false);
    expect(validarArquivo(arq('f.jpeg', 'image/jpeg', 8 * MB), 'fachada').ok).toBe(true);
    expect(validarArquivo(arq('v.mp4', 'video/mp4', 11 * MB), 'video_geral').ok).toBe(true);
  });
  test('sem mime, infere pela extensão', () => {
    expect(inferirMime(arq('VIDEO 1.MP4', '', 1))).toBe('video/mp4');
    expect(validarArquivo(arq('cartao.pdf', '', MB), 'cartao_cnpj')).toEqual({ ok: true, mime: 'application/pdf' });
  });
  test('formatarMb usa vírgula', () => expect(formatarMb(11534336)).toBe('11,0 MB'));
});

import { validarArquivoBasico } from './validarArquivo';

test('validarArquivoBasico aceita qualquer formato permitido e aplica o limite pelo mime', () => {
  expect(validarArquivoBasico(arq('x.png', 'image/png', MB))).toEqual({ ok: true, mime: 'image/png' });
  expect(validarArquivoBasico(arq('x.gif', 'image/gif', MB)).ok).toBe(false);
  expect(validarArquivoBasico(arq('v.mp4', 'video/mp4', 12 * MB)).ok).toBe(false);
});
