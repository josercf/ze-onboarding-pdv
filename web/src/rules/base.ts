import { verificacoes as cfg } from '@shared/config/index';
import type { AnexoEnviado, Formulario, Observacao, ParametrosRegiao, Receita, SimNao, StatusVerificacao, TipoAnexo, Verificacao } from '../tipos';

export interface EntradaMotor {
  formulario: Formulario; receita: Receita | null; parametros: ParametrosRegiao;
  observacoes: Observacao[]; anexosEnviados: AnexoEnviado[]; hoje: Date;
}

export const ITENS: Record<number, string> = {
  1: 'CNPJ ativo', 2: 'CNAE de bebidas e alimentos', 3: 'Responsável pelo CNPJ', 4: 'Sócio', 5: 'Cartão CNPJ', 6: 'NF Ambev',
  7: 'Refrigeradores', 8: 'Câmara fria', 9: 'Fachada', 10: 'Maquininhas', 11: 'Computador e internet', 12: 'Impressora térmica',
  13: 'Cupom fiscal', 14: 'Entregadores', 15: 'Garrafa de 300 ml', 16: 'Completude e qualidade dos anexos',
};

export function montar(id: number, status: StatusVerificacao, declarado: string, observado: string, evidencia = ''): Verificacao {
  return { id, item: ITENS[id], declarado, observado, status, evidencia, critico: cfg.criticos.includes(id), obrigatorio: cfg.obrigatorios.includes(id) };
}

export function observacoesDe<T>(e: EntradaMotor, tipo: TipoAnexo): Array<Observacao & { dados: T }> {
  return e.observacoes.filter((o) => o.tipo === tipo) as Array<Observacao & { dados: T }>;
}

export const simNao = (v: SimNao) => (v === 'sim' ? 'Sim' : 'Não');

export function parseData(texto: string | null | undefined): Date | null {
  if (!texto) return null;
  let m = /^(\d{4})-(\d{2})-(\d{2})/.exec(texto);
  if (m) return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  m = /^(\d{2})\/(\d{2})\/(\d{4})/.exec(texto);
  if (m) return new Date(Date.UTC(+m[3], +m[2] - 1, +m[1]));
  return null;
}

const inicioDoDiaUtc = (d: Date) => Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());

export function diasEntre(depois: Date, antes: Date): number {
  return Math.floor((inicioDoDiaUtc(depois) - inicioDoDiaUtc(antes)) / 86_400_000);
}

export function formatarTimestamp(segundos: number): string {
  const s = Math.max(0, Math.round(segundos));
  return `t=${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}
