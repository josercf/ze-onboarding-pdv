import { TIPOS_CONFIG } from '@shared/config/index';
import type { TipoAnexo } from '../tipos';

const ORDEM: TipoAnexo[] = ['camara_fria', 'nf_ambev', 'cartao_cnpj', 'equipamentos', 'refrigerador', 'fachada', 'video_geral'];

export function normalizarTexto(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

const escapar = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function contemPalavra(texto: string, palavra: string): boolean {
  return new RegExp(`(^|[^a-z0-9])${escapar(palavra)}([^a-z0-9]|$)`).test(texto);
}

export function sugerirTipo(nome: string, mime: string): TipoAnexo | null {
  const texto = normalizarTexto(nome.replace(/\.[^.]+$/, ''));
  for (const tipo of ORDEM) {
    if (TIPOS_CONFIG[tipo].palavras.some((p) => contemPalavra(texto, normalizarTexto(p)))) return tipo;
  }
  return mime.startsWith('video/') ? 'video_geral' : null;
}
