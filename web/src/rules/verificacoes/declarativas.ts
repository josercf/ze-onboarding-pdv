import { normalizarTexto } from '../../anexos/sugerirTipo';
import type { DadosNfAmbev, DadosRefrigerador, DadosVideoGeral, Verificacao } from '../../tipos';
import { montar, observacoesDe, simNao, type EntradaMotor } from '../base';

const MARCADORES = ['porem', 'mas', 'ainda', 'nao', 'em processo', 'aguardando', 'pendente', 'falta', 'vou'];

export function respostaCondicional(obs: string): boolean {
  const texto = normalizarTexto(obs);
  return MARCADORES.some((m) => new RegExp(`(^|[^a-z])${m}([^a-z]|$)`).test(texto));
}

export function verificarCupomFiscal(e: EntradaMotor): Verificacao {
  const { cupomFiscal, cupomFiscalObs } = e.formulario;
  if (cupomFiscal === 'nao') return montar(13, 'atencao', 'Não', 'PDV declarou não emitir cupom fiscal');
  if (respostaCondicional(cupomFiscalObs)) return montar(13, 'atencao', 'Sim, com ressalva', `Resposta condicional: "${cupomFiscalObs}"`);
  return montar(13, 'conforme', 'Sim', cupomFiscalObs ? `Declara emitir cupom fiscal ("${cupomFiscalObs}")` : 'Declara emitir cupom fiscal');
}

export function verificarEntregadores(e: EntradaMotor): Verificacao {
  const declarado = e.formulario.qtdEntregadores;
  const min = e.parametros.minEntregadores;
  const rotulo = `${declarado} (mínimo da região: ${min})`;
  const video = observacoesDe<DadosVideoGeral>(e, 'video_geral')[0];
  if (!video) return montar(14, 'nao_verificavel', rotulo, 'Sem vídeo geral para evidenciar entregadores');
  const { motos, bags, pessoas_entregando } = video.dados.entregadores;
  if (motos + bags + pessoas_entregando === 0) return montar(14, 'nao_verificavel', rotulo, 'Nenhuma moto, bag ou entregador aparece no vídeo', video.nome);
  return montar(14, declarado >= min ? 'conforme' : 'atencao', rotulo, `${motos} moto(s), ${bags} bag(s), ${pessoas_entregando} pessoa(s) entregando`, video.nome);
}

export function verificarTrezentosMl(e: EntradaMotor): Verificacao {
  const declarado = simNao(e.formulario.trabalha300ml);
  const nf = observacoesDe<DadosNfAmbev>(e, 'nf_ambev').find((o) => o.dados.itens_300ml);
  const foto = observacoesDe<DadosRefrigerador>(e, 'refrigerador').find((o) => o.dados.unidades.some((u) => u.conteudo.some((c) => /300\s?ml/i.test(c))));
  const fonte = nf ? `NF ${nf.nome} lista itens de 300 ml` : foto ? `Garrafas de 300 ml em ${foto.nome}` : null;
  if (!fonte) return montar(15, 'nao_verificavel', declarado, 'Nenhuma evidência de 300 ml na NF nem nos refrigeradores');
  return montar(15, e.formulario.trabalha300ml === 'sim' ? 'conforme' : 'atencao', declarado, fonte, (nf ?? foto)!.nome);
}
