import { TIPOS_CONFIG } from '@shared/config/index';
import type { Anexo } from '../fluxo/estadoApp';

/** Texto do selo de estado de um anexo na lista. */
export function seloDe(a: Anexo): string {
  if (a.classificacao.estado === 'pendente' || a.classificacao.estado === 'classificando') return 'Classificando...';
  if (a.tipo && a.classificacao.tipoDetectado === a.tipo) return `${TIPOS_CONFIG[a.tipo].rotulo}, detectado`;
  if (a.tipo) return TIPOS_CONFIG[a.tipo].rotulo;
  return 'Escolha o tipo';
}
