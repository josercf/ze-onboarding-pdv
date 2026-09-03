import type { StatusVerificacao, Verificacao } from '../tipos';

export type Contagens = Record<StatusVerificacao, number>;

const ZERO: Contagens = { conforme: 0, divergente: 0, atencao: 0, nao_verificavel: 0 };

/** Quantas verificações caíram em cada situação. */
export function contarPorStatus(verificacoes: Verificacao[]): Contagens {
  return verificacoes.reduce<Contagens>((acc, v) => ({ ...acc, [v.status]: acc[v.status] + 1 }), { ...ZERO });
}
