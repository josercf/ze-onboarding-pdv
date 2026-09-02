import observacaoModelo from './observacao.modelo.json';
import dadosFachada from './dados.fachada.json';
import dadosRefrigerador from './dados.refrigerador.json';
import dadosCamaraFria from './dados.camara_fria.json';
import dadosEquipamentos from './dados.equipamentos.json';
import dadosNfAmbev from './dados.nf_ambev.json';
import dadosCartaoCnpj from './dados.cartao_cnpj.json';
import dadosVideoGeral from './dados.video_geral.json';
import parecerModelo from './parecer.modelo.json';

export const TIPOS = ['fachada', 'refrigerador', 'camara_fria', 'equipamentos', 'nf_ambev', 'cartao_cnpj', 'video_geral'] as const;
export type TipoAnexo = (typeof TIPOS)[number];

export interface SchemaObjeto {
  type: 'object';
  additionalProperties: false;
  required: string[];
  properties: Record<string, unknown>;
  description?: string;
}

const videoGeral: SchemaObjeto = {
  ...(dadosVideoGeral as SchemaObjeto),
  properties: { ...dadosVideoGeral.properties, equipamentos: dadosEquipamentos },
};

export const DADOS: Record<TipoAnexo, SchemaObjeto> = {
  fachada: dadosFachada as SchemaObjeto,
  refrigerador: dadosRefrigerador as SchemaObjeto,
  camara_fria: dadosCamaraFria as SchemaObjeto,
  equipamentos: dadosEquipamentos as SchemaObjeto,
  nf_ambev: dadosNfAmbev as SchemaObjeto,
  cartao_cnpj: dadosCartaoCnpj as SchemaObjeto,
  video_geral: videoGeral,
};

const METADADOS: Record<string, unknown> = {
  arquivo_id: { type: 'string' },
  tipo: { type: 'string', enum: [...TIPOS] },
  nome: { type: 'string' },
  mime: { type: 'string' },
  modelo: { type: 'string' },
  tokens: {
    type: 'object', additionalProperties: false, required: ['entrada', 'saida'],
    properties: { entrada: { type: 'integer' }, saida: { type: 'integer' } },
  },
  latencia_ms: { type: 'integer' },
};

const METADADOS_PARECER: Record<string, unknown> = { modelo: METADADOS.modelo, tokens: METADADOS.tokens };

export function schemaModeloObservacao(tipo: TipoAnexo): SchemaObjeto {
  const base = observacaoModelo as SchemaObjeto;
  return { ...base, properties: { ...base.properties, dados: DADOS[tipo] } };
}

export function schemaObservacaoCompleta(tipo: TipoAnexo): SchemaObjeto {
  const base = schemaModeloObservacao(tipo);
  return {
    ...base,
    properties: { ...base.properties, ...METADADOS },
    required: [...base.required, ...Object.keys(METADADOS)],
  };
}

export const schemaParecerModelo = parecerModelo as SchemaObjeto;

export function schemaParecerCompleto(): SchemaObjeto {
  return {
    ...schemaParecerModelo,
    properties: { ...schemaParecerModelo.properties, ...METADADOS_PARECER },
    required: [...schemaParecerModelo.required, ...Object.keys(METADADOS_PARECER)],
  };
}
