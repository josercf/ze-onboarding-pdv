// web/src/ui/rotulos.ts
import type { EstadoItem } from '../fluxo/filaAnalise';
import type { Recomendacao, StatusVerificacao } from '../tipos';

export const ROTULO_ESTADO_ITEM: Record<EstadoItem, string> = { na_fila: 'Na fila', analisando: 'Analisando', concluido: 'Concluído', falhou: 'Falhou' };
export const ROTULO_STATUS: Record<StatusVerificacao, string> = { conforme: 'Conforme', divergente: 'Divergente', atencao: 'Atenção', nao_verificavel: 'Não verificável' };
export const ROTULO_RECOMENDACAO: Record<Recomendacao, string> = { apto: 'Apto', revisao_manual: 'Revisão manual', nao_apto: 'Não apto' };
