import { limites } from '@shared/config/index';
import { ErroApi, type CodigoErroApi } from '../api/clienteN8n';
import type { RespostaClassificacao } from '../tipos';

export type EstadoClassificacao = 'pendente' | 'classificando' | 'concluida' | 'falhou';
export interface ItemClassificacao { arquivoId: string; arquivo: File; nome: string; estado: EstadoClassificacao; resultado?: RespostaClassificacao; erro?: string; erroCodigo?: CodigoErroApi }
export interface OpcoesFilaClassificacao { concorrencia?: number; aoMudar?: (item: ItemClassificacao) => void }

export async function executarFilaClassificacao(
  itens: ItemClassificacao[],
  classificar: (item: ItemClassificacao) => Promise<RespostaClassificacao>,
  opcoes: OpcoesFilaClassificacao = {},
): Promise<ItemClassificacao[]> {
  const concorrencia = opcoes.concorrencia ?? limites.concorrencia;
  const pendentes = itens.filter((i) => i.estado === 'pendente' || i.estado === 'falhou');
  let proximo = 0;

  async function trabalhador(): Promise<void> {
    while (proximo < pendentes.length) {
      const item = pendentes[proximo++];
      item.estado = 'classificando';
      item.erro = undefined;
      item.erroCodigo = undefined;
      opcoes.aoMudar?.({ ...item });
      try {
        item.resultado = await classificar(item);
        item.estado = 'concluida';
      } catch (e) {
        item.estado = 'falhou';
        item.erro = e instanceof Error ? e.message : String(e);
        item.erroCodigo = e instanceof ErroApi ? e.codigo : undefined;
      }
      opcoes.aoMudar?.({ ...item });
    }
  }

  await Promise.all(Array.from({ length: Math.min(concorrencia, pendentes.length) }, () => trabalhador()));
  return itens;
}
