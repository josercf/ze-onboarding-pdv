import { limites } from '@shared/config/index';
import type { Observacao, TipoAnexo } from '../tipos';

export type EstadoItem = 'na_fila' | 'analisando' | 'concluido' | 'falhou';
export interface ItemFila { arquivoId: string; arquivo: File; nome: string; tipo: TipoAnexo; estado: EstadoItem; observacao?: Observacao; erro?: string }
export interface OpcoesFila { concorrencia?: number; aoMudar?: (item: ItemFila) => void }

export async function executarFila(itens: ItemFila[], analisar: (item: ItemFila) => Promise<Observacao>, opcoes: OpcoesFila = {}): Promise<ItemFila[]> {
  const concorrencia = opcoes.concorrencia ?? limites.concorrencia;
  const pendentes = itens.filter((i) => i.estado === 'na_fila' || i.estado === 'falhou');
  let proximo = 0;

  async function trabalhador(): Promise<void> {
    while (proximo < pendentes.length) {
      const item = pendentes[proximo++];
      item.estado = 'analisando';
      item.erro = undefined;
      opcoes.aoMudar?.({ ...item });
      try {
        item.observacao = await analisar(item);
        item.estado = 'concluido';
      } catch (e) {
        item.estado = 'falhou';
        item.erro = e instanceof Error ? e.message : String(e);
      }
      opcoes.aoMudar?.({ ...item });
    }
  }

  await Promise.all(Array.from({ length: Math.min(concorrencia, pendentes.length) }, () => trabalhador()));
  return itens;
}
