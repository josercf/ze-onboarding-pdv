import { TIPOS_CONFIG, limites, tiposObrigatorios } from '@shared/config/index';
import type { DadosVideoGeral, Verificacao } from '../../tipos';
import { montar, observacoesDe, type EntradaMotor } from '../base';

export function verificarAnexos(e: EntradaMotor): Verificacao {
  const obrigatorios = tiposObrigatorios(e.formulario);
  const presentes = new Set(e.anexosEnviados.map((a) => a.tipo));
  const problemas: string[] = [];

  const faltando = obrigatorios.filter((t) => !presentes.has(t));
  if (faltando.length) problemas.push(`faltam: ${faltando.map((t) => TIPOS_CONFIG[t].rotulo).join(', ')}`);

  const falhos = e.anexosEnviados.filter((a) => a.falhou).length;
  if (falhos) problemas.push(`${falhos} arquivo(s) não analisado(s) por falha`);

  for (const o of e.observacoes) {
    if (!o.aderente_ao_tipo) problemas.push(`${o.nome} não corresponde ao tipo ${TIPOS_CONFIG[o.tipo].rotulo}`);
    if (o.qualidade.nitidez === 'ruim') problemas.push(`${o.nome} com nitidez ruim`);
    if (o.qualidade.iluminacao === 'ruim') problemas.push(`${o.nome} com iluminação ruim`);
    for (const a of o.alertas) if (a.codigo === 'foto_de_tela' || a.codigo === 'imagem_internet') problemas.push(`${o.nome}: ${a.descricao}`);
  }

  for (const v of observacoesDe<DadosVideoGeral>(e, 'video_geral')) {
    const duracao = v.dados.duracao_s ?? e.anexosEnviados.find((a) => a.arquivoId === v.arquivo_id)?.duracaoS ?? null;
    if (duracao != null && duracao < limites.duracaoMinimaVideoS) problemas.push(`${v.nome} com ${duracao} s (mínimo ${limites.duracaoMinimaVideoS} s)`);
  }

  const declarado = `${e.anexosEnviados.length} arquivo(s); ${obrigatorios.length} tipos obrigatórios`;
  return montar(16, problemas.length ? 'atencao' : 'conforme', declarado, problemas.length ? problemas.join('; ') : 'Todos os tipos obrigatórios presentes, com qualidade adequada');
}
