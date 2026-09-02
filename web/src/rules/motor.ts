import type { Recomendacao, Verificacao } from '../tipos';
import type { EntradaMotor } from './base';
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
  const verificacoes = VERIFICACOES.map((fn) => fn(e));
  return { verificacoes, recomendacao: calcularRecomendacao(verificacoes) };
}
