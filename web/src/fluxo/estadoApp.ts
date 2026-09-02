import { regiaoDefault } from '@shared/config/index';
import { validarCnpj } from '../cnpj/validarCnpj';
import type { AnexoEnviado, Formulario, Observacao, Parecer, ParametrosRegiao, Receita, Recomendacao, TipoAnexo, Verificacao } from '../tipos';
import type { EstadoItem } from './filaAnalise';

export type Etapa = 1 | 2 | 3 | 4;
export interface Anexo { arquivoId: string; arquivo: File; nome: string; mime: string; tipo: TipoAnexo | null; duracaoS: number | null; estado: EstadoItem; observacao?: Observacao; erro?: string }
export interface EstadoApp {
  etapa: Etapa; formulario: Formulario; receita: Receita | null; receitaErro: string | null; parametros: ParametrosRegiao;
  anexos: Anexo[]; verificacoes: Verificacao[]; recomendacao: Recomendacao | null; parecer: Parecer | null; parecerErro: string | null;
}
export type Acao =
  | { tipo: 'formulario'; valor: Partial<Formulario> }
  | { tipo: 'receita'; valor: Receita | null; erro?: string | null }
  | { tipo: 'parametros'; valor: Partial<ParametrosRegiao> }
  | { tipo: 'anexo_adicionar'; valor: Anexo }
  | { tipo: 'anexo_remover'; arquivoId: string }
  | { tipo: 'anexo_tipo'; arquivoId: string; valor: TipoAnexo }
  | { tipo: 'anexo_estado'; valor: { arquivoId: string; estado: EstadoItem; observacao?: Observacao; erro?: string } }
  | { tipo: 'resultado'; verificacoes: Verificacao[]; recomendacao: Recomendacao }
  | { tipo: 'parecer'; valor: Parecer | null; erro?: string | null }
  | { tipo: 'etapa'; valor: Etapa }
  | { tipo: 'reiniciar' };

export const FORMULARIO_VAZIO: Formulario = {
  cnpj: '', responsavel: '', possuiSocio: 'nao', contaCorrente: 'sim', qtdRefrigeradores: 0, camaraFria: 'nao', qtdEntregadores: 0, qtdMaquininhas: 0,
  computadorInternet: 'sim', impressoraTermica: 'sim', cupomFiscal: 'sim', cupomFiscalObs: '', cnaeBebidas: 'sim', parceiroAmbev: 'sim', codigoParceiro: '',
  trabalha300ml: 'sim', lojaAtivaZe: 'nao', horarioDelivery: '',
  endereco: { logradouro: '', numero: '', complemento: '', bairro: '', municipio: '', uf: '', cep: '' },
};

export function estadoInicial(): EstadoApp {
  return {
    etapa: 1, formulario: { ...FORMULARIO_VAZIO, endereco: { ...FORMULARIO_VAZIO.endereco } }, receita: null, receitaErro: null,
    parametros: { ...regiaoDefault }, anexos: [], verificacoes: [], recomendacao: null, parecer: null, parecerErro: null,
  };
}

const QUANTIDADES: Array<[keyof Formulario, string]> = [['qtdRefrigeradores', 'refrigeradores'], ['qtdEntregadores', 'entregadores'], ['qtdMaquininhas', 'máquinas de cartão']];

export function errosFormulario(f: Formulario): string[] {
  const erros: string[] = [];
  if (!validarCnpj(f.cnpj)) erros.push('Informe um CNPJ válido.');
  if (!f.responsavel.trim()) erros.push('Informe o nome completo do responsável pelo CNPJ.');
  for (const [campo, rotulo] of QUANTIDADES) {
    const v = f[campo] as number;
    if (!Number.isInteger(v) || v < 0) erros.push(`Quantidade de ${rotulo} deve ser um número inteiro maior ou igual a zero.`);
  }
  if (f.parceiroAmbev === 'sim' && !f.codigoParceiro.trim()) erros.push('Informe o código de parceiro Ambev.');
  if (!f.horarioDelivery.trim()) erros.push('Informe dias e horário de funcionamento do delivery.');
  return erros;
}

export function podeAvancar(e: EstadoApp): boolean {
  if (e.etapa === 1) return errosFormulario(e.formulario).length === 0;
  if (e.etapa === 2) return e.anexos.length > 0 && e.anexos.every((a) => a.tipo !== null);
  if (e.etapa === 3) return e.anexos.every((a) => a.estado === 'concluido' || a.estado === 'falhou');
  return false;
}

export function anexosParaMotor(e: EstadoApp): AnexoEnviado[] {
  return e.anexos.map((a) => ({ arquivoId: a.arquivoId, tipo: a.tipo as TipoAnexo, nome: a.nome, duracaoS: a.duracaoS, falhou: a.estado !== 'concluido' }));
}

export function observacoesDoEstado(e: EstadoApp): Observacao[] {
  return e.anexos.flatMap((a) => (a.estado === 'concluido' && a.observacao ? [a.observacao] : []));
}

const enderecoVazio = (f: Formulario) => Object.values(f.endereco).every((v) => v === '');

export function reduzir(e: EstadoApp, acao: Acao): EstadoApp {
  switch (acao.tipo) {
    case 'formulario': return { ...e, formulario: { ...e.formulario, ...acao.valor } };
    case 'receita': {
      const formulario = acao.valor && enderecoVazio(e.formulario) ? { ...e.formulario, endereco: { ...acao.valor.endereco } } : e.formulario;
      return { ...e, receita: acao.valor, receitaErro: acao.erro ?? null, formulario };
    }
    case 'parametros': return { ...e, parametros: { ...e.parametros, ...acao.valor } };
    case 'anexo_adicionar': return e.anexos.some((a) => a.arquivoId === acao.valor.arquivoId) ? e : { ...e, anexos: [...e.anexos, acao.valor] };
    case 'anexo_remover': return { ...e, anexos: e.anexos.filter((a) => a.arquivoId !== acao.arquivoId) };
    case 'anexo_tipo': return { ...e, anexos: e.anexos.map((a) => (a.arquivoId === acao.arquivoId ? { ...a, tipo: acao.valor, estado: 'na_fila', observacao: undefined, erro: undefined } : a)) };
    case 'anexo_estado': return { ...e, anexos: e.anexos.map((a) => (a.arquivoId === acao.valor.arquivoId ? { ...a, estado: acao.valor.estado, observacao: acao.valor.observacao, erro: acao.valor.erro } : a)) };
    case 'resultado': return { ...e, verificacoes: acao.verificacoes, recomendacao: acao.recomendacao };
    case 'parecer': return { ...e, parecer: acao.valor, parecerErro: acao.erro ?? null };
    case 'etapa': return { ...e, etapa: acao.valor };
    case 'reiniciar': return estadoInicial();
  }
}
