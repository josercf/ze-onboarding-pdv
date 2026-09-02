import type { Recomendacao, Verificacao } from '../tipos';

export function calcularRecomendacao(verificacoes: Verificacao[]): Recomendacao {
  if (verificacoes.some((v) => v.critico && v.status === 'divergente')) return 'nao_apto';
  if (verificacoes.some((v) => v.status === 'divergente')) return 'revisao_manual';
  if (verificacoes.some((v) => v.obrigatorio && (v.status === 'atencao' || v.status === 'nao_verificavel'))) return 'revisao_manual';
  return 'apto';
}
