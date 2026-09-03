import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { TIPOS_CONFIG, limites, modelos } from '../shared/config/index';
import { TIPOS, schemaClassificacaoModelo, schemaModeloObservacao, schemaParecerModelo, type SchemaObjeto, type TipoAnexo } from '../shared/schemas/index';

export interface Recursos {
  prompts: Record<TipoAnexo | 'system' | 'parecer' | 'classificar', string>;
  schemas: Record<TipoAnexo | 'parecer' | 'classificacao', SchemaObjeto>;
  tipos: typeof TIPOS_CONFIG;
  limites: typeof limites;
  modelos: typeof modelos;
}

const raiz = dirname(fileURLToPath(import.meta.url));

export function carregarRecursos(): Recursos {
  const ler = (nome: string) => readFileSync(join(raiz, 'prompts', `${nome}.md`), 'utf8').trim();
  const prompts = Object.fromEntries([...TIPOS, 'system', 'parecer', 'classificar'].map((n) => [n, ler(n)])) as Recursos['prompts'];
  const schemas = Object.fromEntries([
    ...TIPOS.map((t) => [t, schemaModeloObservacao(t)]),
    ['parecer', schemaParecerModelo],
    ['classificacao', schemaClassificacaoModelo],
  ]) as Recursos['schemas'];
  return { prompts, schemas, tipos: TIPOS_CONFIG, limites, modelos };
}
