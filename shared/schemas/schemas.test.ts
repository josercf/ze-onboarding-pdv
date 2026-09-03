import Ajv from 'ajv';
import { describe, expect, test } from 'vitest';
import {
  TIPOS, TIPOS_DETECTADOS, schemaClassificacaoCompleta, schemaClassificacaoModelo, schemaModeloObservacao, schemaObservacaoCompleta, schemaParecerModelo, schemaParecerCompleto,
  type TipoAnexo,
} from './index';

const ajv = new Ajv({ allErrors: true, strict: false });

const EQUIPAMENTOS = {
  computador: true, impressora_termica: { presente: true, marca: 'Elgin' }, maquininhas: [{ marca: 'Cielo' }], roteador: false,
};

export const DADOS_VALIDOS: Record<TipoAnexo, object> = {
  fachada: { tipo_local: 'loja_aberta', letreiro: 'Armazém Exemplo', numero_imovel: '40', porta: 'aberta' },
  refrigerador: { unidades: [{ categoria: 'expositor_vertical', marca: 'Metalfrio', ligado: true, conteudo: ['cervejas em lata'] }] },
  camara_fria: { e_camara_frigorifica: true, tipo_equipamento: 'camara', indicios: ['painéis isotérmicos', 'evaporador'], estoque_visivel: 'alto' },
  equipamentos: EQUIPAMENTOS,
  nf_ambev: {
    emitente: { nome: 'CRBS S/A', cnpj: '56228356014272' },
    destinatario: { nome: 'EXEMPLO COMERCIO DE BEBIDAS LTDA', cnpj: '11222333000181', codigo_cliente: '0011223', endereco: 'Rua Exemplo, 40' },
    numero: '387925', data_emissao: '2026-08-20', valor_total: 5595.15, itens_300ml: true, legivel: true,
  },
  cartao_cnpj: { cnpj: '11222333000181', razao_social: 'EXEMPLO COMERCIO DE BEBIDAS LTDA', situacao: 'ATIVA', cnae_principal: '47.23-7-00', endereco: 'Rua Exemplo, 40', data_emissao: '2026-08-25' },
  video_geral: {
    duracao_s: 31, refrigeradores: [{ categoria: 'expositor_vertical', marca: 'Heineken', timestamp_s: 4 }],
    camara_fria: { presente: true, timestamp_s: 20 }, ambiente: 'loja',
    entregadores: { motos: 2, bags: 1, pessoas_entregando: 0 }, equipamentos: EQUIPAMENTOS, transcricao: null,
  },
};

export function envelopeModelo(tipo: TipoAnexo, dados: object = DADOS_VALIDOS[tipo]) {
  return {
    aderente_ao_tipo: true, confianca: 0.9, resumo: 'Resumo de teste.',
    qualidade: { nitidez: 'boa', iluminacao: 'media', observacao: '' },
    dados, evidencias: [{ ref: 't=00:04', descricao: 'expositor vertical à esquerda' }], alertas: [],
  };
}

export function metadados(tipo: TipoAnexo) {
  return { arquivo_id: 'a1', tipo, nome: 'arquivo.jpeg', mime: 'image/jpeg', modelo: 'google/gemini-2.5-flash', tokens: { entrada: 1200, saida: 300 }, latencia_ms: 8000 };
}

function objetosDe(schema: unknown, caminho = 'raiz'): Array<[string, Record<string, unknown>]> {
  if (!schema || typeof schema !== 'object') return [];
  const s = schema as Record<string, unknown>;
  const achados: Array<[string, Record<string, unknown>]> = [];
  if (s.type === 'object' && s.properties) achados.push([caminho, s]);
  for (const [k, v] of Object.entries((s.properties as Record<string, unknown>) ?? {})) achados.push(...objetosDe(v, `${caminho}.${k}`));
  if (s.items) achados.push(...objetosDe(s.items, `${caminho}[]`));
  return achados;
}

describe('schemas de observação', () => {
  test.each(TIPOS)('amostra válida de %s passa no schema do modelo e no completo', (tipo) => {
    expect(ajv.validate(schemaModeloObservacao(tipo), envelopeModelo(tipo))).toBe(true);
    expect(ajv.validate(schemaObservacaoCompleta(tipo), { ...envelopeModelo(tipo), ...metadados(tipo) })).toBe(true);
  });

  test('falta de resumo invalida', () => {
    const { resumo: _r, ...semResumo } = envelopeModelo('fachada');
    expect(ajv.validate(schemaModeloObservacao('fachada'), semResumo)).toBe(false);
  });

  test('enum de nitidez fora da lista invalida', () => {
    const obs = envelopeModelo('fachada');
    obs.qualidade.nitidez = 'otima';
    expect(ajv.validate(schemaModeloObservacao('fachada'), obs)).toBe(false);
  });

  test('schema completo exige metadados do n8n', () => {
    expect(ajv.validate(schemaObservacaoCompleta('fachada'), envelopeModelo('fachada'))).toBe(false);
  });

  test('todo objeto é estrito: additionalProperties false e required igual às propriedades', () => {
    const schemas = [...TIPOS.map((t) => schemaObservacaoCompleta(t)), schemaParecerCompleto()];
    for (const schema of schemas) {
      for (const [caminho, obj] of objetosDe(schema)) {
        if (caminho.endsWith('.dados') && Object.keys(obj.properties as object).length === 0) continue;
        expect(obj.additionalProperties, caminho).toBe(false);
        expect([...(obj.required as string[])].sort(), caminho).toEqual(Object.keys(obj.properties as object).sort());
      }
    }
  });
});

describe('schema do parecer', () => {
  const parecer = { parecer: 'Texto.', pontos_de_atencao: ['NF em nome de terceiro'], recomendacao_sugerida: 'nao_apto', justificativa: 'Itens 6 e 7.' };
  test('amostra válida passa', () => {
    expect(ajv.validate(schemaParecerModelo, parecer)).toBe(true);
    expect(ajv.validate(schemaParecerCompleto(), { ...parecer, modelo: 'google/gemini-2.5-pro', tokens: { entrada: 5000, saida: 400 } })).toBe(true);
  });
  test('recomendação fora do enum invalida', () => {
    expect(ajv.validate(schemaParecerModelo, { ...parecer, recomendacao_sugerida: 'talvez' })).toBe(false);
  });
});

describe('schema da classificação', () => {
  const classificacao = { tipo_detectado: 'fachada', confianca: 0.92, motivo: 'Frente de loja com letreiro.' };
  const metadadosClassificacao = { arquivo_id: 'a1', nome: 'foto.jpeg', mime: 'image/jpeg', modelo: 'google/gemini-2.5-flash', tokens: { entrada: 1200, saida: 40 }, latencia_ms: 1800 };

  test('amostra válida passa no schema do modelo e no completo', () => {
    expect(ajv.validate(schemaClassificacaoModelo, classificacao)).toBe(true);
    expect(ajv.validate(schemaClassificacaoCompleta(), { ...classificacao, ...metadadosClassificacao })).toBe(true);
  });
  test('enum de tipo_detectado cobre os sete tipos e indefinido, e rejeita outros valores', () => {
    expect((schemaClassificacaoModelo.properties.tipo_detectado as { enum: string[] }).enum).toEqual([...TIPOS_DETECTADOS]);
    expect(ajv.validate(schemaClassificacaoModelo, { ...classificacao, tipo_detectado: 'geladeira' })).toBe(false);
  });
  test('schema completo exige metadados e todo objeto é estrito', () => {
    expect(ajv.validate(schemaClassificacaoCompleta(), classificacao)).toBe(false);
    for (const [caminho, obj] of objetosDe(schemaClassificacaoCompleta())) {
      expect(obj.additionalProperties, caminho).toBe(false);
      expect([...(obj.required as string[])].sort(), caminho).toEqual(Object.keys(obj.properties as object).sort());
    }
  });
});
