import type { Recomendacao, Verificacao } from '../tipos';
import { montar, type EntradaMotor } from './base';
import { calcularRecomendacao } from './recomendacao';
import { verificarAnexos } from './verificacoes/anexos';
import { verificarCupomFiscal, verificarEntregadores, verificarTrezentosMl } from './verificacoes/declarativas';
import { verificarCartaoCnpj, verificarCnae, verificarCnpjAtivo, verificarNfAmbev, verificarResponsavel, verificarSocio } from './verificacoes/documentais';
import { verificarCamaraFria, verificarComputador, verificarFachada, verificarImpressora, verificarMaquininhas, verificarRefrigeradores } from './verificacoes/infraestrutura';

export type { EntradaMotor } from './base';
export interface ResultadoMotor { verificacoes: Verificacao[]; recomendacao: Recomendacao }

const VERIFICACOES = [
  verificarCnpjAtivo, verificarCnae, verificarResponsavel, verificarSocio, verificarCartaoCnpj, verificarNfAmbev,
  verificarRefrigeradores, verificarCamaraFria, verificarFachada, verificarMaquininhas, verificarComputador, verificarImpressora,
  verificarCupomFiscal, verificarEntregadores, verificarTrezentosMl, verificarAnexos,
];

export function avaliar(e: EntradaMotor): ResultadoMotor {
  const verificacoes = VERIFICACOES.map((fn, i) => {
    try {
      return fn(e);
    } catch (erro) {
      const mensagem = erro instanceof Error ? erro.message : String(erro);
      return montar(i + 1, 'nao_verificavel', '', `Erro interno na verificação: ${mensagem}`);
    }
  });
  return { verificacoes, recomendacao: calcularRecomendacao(verificacoes) };
}
