import type { TipoAnexo } from '../schemas/index';
import tipos from './tipos.json';

export type SimNao = 'sim' | 'nao';
export interface DeclaracoesDoFormulario { camaraFria: SimNao; computadorInternet: SimNao; impressoraTermica: SimNao }

const CONFIG = tipos as Record<TipoAnexo, { obrigatorio: boolean }>;
const ORDEM = Object.keys(CONFIG) as TipoAnexo[];

/** Tipos de anexo exigidos para este PDV: os sempre obrigatórios mais os condicionados às declarações da etapa 1. */
export function tiposObrigatorios(f: DeclaracoesDoFormulario): TipoAnexo[] {
  const exigidos = new Set<TipoAnexo>(ORDEM.filter((t) => CONFIG[t].obrigatorio));
  if (f.camaraFria === 'sim') exigidos.add('camara_fria');
  if (f.computadorInternet === 'sim' || f.impressoraTermica === 'sim') exigidos.add('equipamentos');
  return ORDEM.filter((t) => exigidos.has(t));
}
