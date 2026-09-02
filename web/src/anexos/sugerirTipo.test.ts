import { describe, expect, test } from 'vitest';
import { sugerirTipo } from './sugerirTipo';

describe('sugerirTipo', () => {
  test.each([
    ['fachada 2 120973.jpeg', 'image/jpeg', 'fachada'],
    ['frezzer 120973.jpeg', 'image/jpeg', 'refrigerador'],
    ['camera fria 120973.jpeg', 'image/jpeg', 'camara_fria'],
    ['Câmara Fria.jpeg', 'image/jpeg', 'camara_fria'],
    ['computador 120973.jpeg', 'image/jpeg', 'equipamentos'],
    ['nf ambev 120973.jpeg', 'image/jpeg', 'nf_ambev'],
    ['Nota ambev.jpeg', 'image/jpeg', 'nf_ambev'],
    ['CARTAO 120973.pdf', 'application/pdf', 'cartao_cnpj'],
    ['VIDEO 120973.mp4', 'video/mp4', 'video_geral'],
    ['geladeira da entrada.jpeg', 'image/jpeg', 'refrigerador'],
  ])('%s vira %s', (nome, mime, esperado) => expect(sugerirTipo(nome, mime)).toBe(esperado));

  test('vídeo sem palavra-chave vira video_geral', () => expect(sugerirTipo('IMG_2201.mp4', 'video/mp4')).toBe('video_geral'));
  test('imagem sem palavra-chave não sugere nada', () => {
    expect(sugerirTipo('gelo 120973.jpeg', 'image/jpeg')).toBeNull();
    expect(sugerirTipo('WhatsApp Image 2026-08-31 at 11.17.19.jpeg', 'image/jpeg')).toBeNull();
  });
  test('"info" não casa com "nf"', () => expect(sugerirTipo('info loja.jpeg', 'image/jpeg')).toBeNull());
  test('rejeita tipo compatível por mime incompatível', () => expect(sugerirTipo('visão geral da loja.jpeg', 'image/jpeg')).toBeNull());
  test('fallback video_geral mesmo com palavra de tipo incompatível', () => expect(sugerirTipo('geladeira tour.mp4', 'video/mp4')).toBe('video_geral'));
});
