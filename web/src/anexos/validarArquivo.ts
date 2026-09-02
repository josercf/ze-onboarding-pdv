import { TIPOS_CONFIG, limites } from '@shared/config/index';
import type { TipoAnexo } from '../tipos';

export interface ArquivoBasico { name: string; type: string; size: number }
export type ResultadoValidacao = { ok: true; mime: string } | { ok: false; motivo: string };

const EXTENSOES: Record<string, string> = { mp4: 'video/mp4', jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', pdf: 'application/pdf' };
const NOMES: Record<string, string> = { 'video/mp4': 'MP4', 'image/jpeg': 'JPEG', 'image/png': 'PNG', 'application/pdf': 'PDF' };

export function inferirMime(arquivo: ArquivoBasico): string {
  if (arquivo.type) return arquivo.type;
  const ext = arquivo.name.split('.').pop()?.toLowerCase() ?? '';
  return EXTENSOES[ext] ?? '';
}

export function formatarMb(bytes: number): string {
  return `${(bytes / 1048576).toFixed(1).replace('.', ',')} MB`;
}

export function validarArquivo(arquivo: ArquivoBasico, tipo: TipoAnexo): ResultadoValidacao {
  const mime = inferirMime(arquivo);
  const cfg = TIPOS_CONFIG[tipo];
  if (!cfg.formatos.includes(mime)) {
    return { ok: false, motivo: `Formato não aceito para ${cfg.rotulo}. Envie ${cfg.formatos.map((f) => NOMES[f] ?? f).join(', ')}.` };
  }
  const video = mime.startsWith('video/');
  const limite = video ? limites.maxBytesVideo : limites.maxBytesImagemPdf;
  if (arquivo.size > limite) {
    const dica = video ? 'Reenvie o vídeo pelo WhatsApp para compactar.' : 'Reduza a resolução da imagem.';
    return { ok: false, motivo: `Arquivo com ${formatarMb(arquivo.size)}; o limite é ${formatarMb(limite)}. ${dica}` };
  }
  return { ok: true, mime };
}
