import type { TipoAnexo } from '../schemas/index';
import tipos from './tipos.json';
import limites from './limites.json';
import cnaes from './cnaes.json';
import verificacoes from './verificacoes.json';
import regiaoDefault from './regiao.default.json';
import modelos from './modelos.json';

export interface ConfigTipo { rotulo: string; formatos: string[]; obrigatorio: boolean; palavras: string[] }

export const TIPOS_CONFIG = tipos as Record<TipoAnexo, ConfigTipo>;
export { limites, cnaes, verificacoes, regiaoDefault, modelos };
