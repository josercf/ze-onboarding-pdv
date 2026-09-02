import type { Receita } from '../tipos';
import { somenteDigitos } from './validarCnpj';

export class ErroBrasilApi extends Error {
  codigo: 'nao_encontrado' | 'indisponivel';

  constructor(codigo: 'nao_encontrado' | 'indisponivel', mensagem: string) {
    super(mensagem);
    this.name = 'ErroBrasilApi';
    this.codigo = codigo;
  }
}

const URL_BASE = 'https://brasilapi.com.br/api/cnpj/v1/';

type Bruto = Record<string, unknown>;
const texto = (v: unknown) => (typeof v === 'string' ? v : '');
const lista = (v: unknown) => (Array.isArray(v) ? (v as Bruto[]) : []);

export function mapearReceita(b: Bruto): Receita {
  return {
    cnpj: somenteDigitos(String(b.cnpj ?? '')),
    razaoSocial: texto(b.razao_social),
    nomeFantasia: texto(b.nome_fantasia),
    situacao: texto(b.descricao_situacao_cadastral),
    dataSituacao: texto(b.data_situacao_cadastral),
    dataInicio: texto(b.data_inicio_atividade),
    porte: texto(b.porte),
    naturezaJuridica: texto(b.natureza_juridica),
    mei: b.opcao_pelo_mei === true,
    cnaePrincipal: { codigo: Number(b.cnae_fiscal ?? 0), descricao: texto(b.cnae_fiscal_descricao) },
    cnaesSecundarios: lista(b.cnaes_secundarios).map((c) => ({ codigo: Number(c.codigo ?? 0), descricao: texto(c.descricao) })),
    qsa: lista(b.qsa).map((s) => ({ nome: texto(s.nome_socio), qualificacao: texto(s.qualificacao_socio) })),
    endereco: {
      logradouro: texto(b.logradouro), numero: texto(b.numero), complemento: texto(b.complemento),
      bairro: texto(b.bairro), municipio: texto(b.municipio), uf: texto(b.uf), cep: somenteDigitos(texto(b.cep)).slice(0, 8),
    },
  };
}

export async function consultarCnpj(cnpj: string, fetchFn: typeof fetch = fetch): Promise<Receita> {
  let resposta: Response;
  try {
    resposta = await fetchFn(URL_BASE + somenteDigitos(cnpj));
  } catch {
    throw new ErroBrasilApi('indisponivel', 'Não foi possível consultar a Receita agora.');
  }
  if (resposta.status === 404) throw new ErroBrasilApi('nao_encontrado', 'CNPJ não encontrado na Receita Federal.');
  if (!resposta.ok) throw new ErroBrasilApi('indisponivel', `A consulta à Receita falhou (HTTP ${resposta.status}).`);
  return mapearReceita((await resposta.json()) as Bruto);
}
