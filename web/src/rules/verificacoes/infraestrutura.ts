import type { DadosCamaraFria, DadosEquipamentos, DadosFachada, DadosRefrigerador, DadosVideoGeral, Verificacao } from '../../tipos';
import { formatarTimestamp, montar, observacoesDe, simNao, type EntradaMotor } from '../base';

const primeiroVideo = (e: EntradaMotor) => observacoesDe<DadosVideoGeral>(e, 'video_geral')[0];
const CATEGORIA: Record<string, string> = {
  expositor_vertical: 'expositor vertical', freezer_horizontal: 'freezer horizontal', geladeira_domestica: 'geladeira doméstica', freezer_gelo: 'freezer de gelo', outro: 'outro',
};
const EQUIPAMENTO: Record<string, string> = { camara: 'câmara frigorífica', freezer_gelo: 'freezer de gelo', container: 'contêiner', outro: 'outro equipamento' };
const LOCAL: Record<string, string> = {
  loja_aberta: 'Loja aberta ao público', loja_fechada: 'Loja fechada no momento da foto', galpao_deposito: 'Galpão ou depósito', residencia: 'Residência', indefinido: 'Local indefinido',
};

export function contarRefrigeradores(e: EntradaMotor): { total: number; detalhe: string; evidencia: string } {
  const fotos = observacoesDe<DadosRefrigerador>(e, 'refrigerador').filter((o) => o.aderente_ao_tipo);
  const nasFotos = fotos.reduce((acc, o) => acc + o.dados.unidades.filter((u) => u.categoria !== 'freezer_gelo').length, 0);
  const video = primeiroVideo(e);
  const doVideo = (video?.dados.refrigeradores ?? []).filter((r) => r.categoria !== 'freezer_gelo');
  const evidencia = doVideo.map((r) => `${formatarTimestamp(r.timestamp_s)} ${CATEGORIA[r.categoria]}${r.marca ? ` ${r.marca}` : ''}`).join(', ');
  return { total: Math.max(nasFotos, doVideo.length), detalhe: `${doVideo.length} no vídeo, ${nasFotos} nas fotos`, evidencia };
}

export function verificarRefrigeradores(e: EntradaMotor): Verificacao {
  const declarado = e.formulario.qtdRefrigeradores;
  const min = e.parametros.minRefrigeradores;
  const rotulo = `${declarado} (mínimo da região: ${min})`;
  if (!observacoesDe(e, 'refrigerador').length && !primeiroVideo(e)) return montar(7, 'nao_verificavel', rotulo, 'Sem fotos de refrigerador nem vídeo geral');
  const { total, detalhe, evidencia } = contarRefrigeradores(e);
  const status = total >= min && total >= declarado - 1 ? 'conforme' : 'divergente';
  return montar(7, status, rotulo, `${total} observado(s): ${detalhe}`, evidencia);
}

export function verificarCamaraFria(e: EntradaMotor): Verificacao {
  const declarouSim = e.formulario.camaraFria === 'sim';
  const obrigatoria = e.parametros.camaraFriaObrigatoria;
  const rotulo = `${simNao(e.formulario.camaraFria)} (${obrigatoria ? 'obrigatória' : 'não obrigatória'} na região)`;
  const anexos = observacoesDe<DadosCamaraFria>(e, 'camara_fria');
  const video = primeiroVideo(e);
  const noAnexo = anexos.find((o) => o.dados.e_camara_frigorifica);
  const noVideo = video?.dados.camara_fria.presente === true;
  const existe = Boolean(noAnexo) || noVideo;
  const evidencia = noAnexo?.nome ?? (noVideo && video?.dados.camara_fria.timestamp_s != null ? `${video.nome} ${formatarTimestamp(video.dados.camara_fria.timestamp_s)}` : '');
  const equipamento = anexos[0] ? EQUIPAMENTO[anexos[0].dados.tipo_equipamento] : '';

  if (declarouSim) {
    if (existe) return montar(8, 'conforme', rotulo, 'Câmara frigorífica identificada', evidencia);
    if (!anexos.length && !video) return montar(8, 'nao_verificavel', rotulo, 'Sem foto ou vídeo da câmara');
    return montar(8, 'divergente', rotulo, anexos.length ? `Equipamento enviado é ${equipamento}, não câmara frigorífica` : 'Câmara não aparece no vídeo', anexos[0]?.nome ?? video?.nome ?? '');
  }
  if (obrigatoria) return montar(8, 'divergente', rotulo, existe ? 'Câmara aparece no material, mas o PDV declarou não ter' : 'Câmara obrigatória na região e não declarada', evidencia);
  if (anexos.length && !noAnexo) return montar(8, 'atencao', rotulo, `Anexo rotulado como câmara fria mostra ${equipamento}`, anexos[0].nome);
  return montar(8, 'conforme', rotulo, existe ? 'Câmara aparece no vídeo embora não declarada' : 'Não declarada e não exigida na região', evidencia);
}

export function verificarFachada(e: EntradaMotor): Verificacao {
  const fachada = observacoesDe<DadosFachada>(e, 'fachada')[0];
  const video = primeiroVideo(e);
  if (!fachada && !video) return montar(9, 'nao_verificavel', 'Loja aberta ao público', 'Foto ou vídeo da fachada não enviado');
  const ambiente = video?.dados.ambiente;
  const tipoLocal = fachada?.dados.tipo_local ?? (ambiente === 'loja' ? 'loja_aberta' : ambiente === 'deposito' ? 'galpao_deposito' : 'indefinido');
  const partes = [LOCAL[tipoLocal]];
  if (fachada?.dados.letreiro) partes.push(`letreiro "${fachada.dados.letreiro}"`);
  if (fachada) partes.push(`porta ${fachada.dados.porta.replace('_', ' ')}`);
  if (ambiente) partes.push(`vídeo mostra ambiente de ${ambiente}`);
  return montar(9, tipoLocal === 'loja_aberta' ? 'conforme' : 'atencao', 'Loja aberta ao público', partes.join('; '), fachada?.nome ?? video?.nome ?? '');
}

function equipamentos(e: EntradaMotor): { fotos: DadosEquipamentos[]; video: DadosEquipamentos | undefined; nomes: string } {
  const obs = observacoesDe<DadosEquipamentos>(e, 'equipamentos');
  const video = primeiroVideo(e);
  return { fotos: obs.map((o) => o.dados), video: video?.dados.equipamentos, nomes: [...obs.map((o) => o.nome), video?.nome].filter(Boolean).join(', ') };
}

export function verificarMaquininhas(e: EntradaMotor): Verificacao {
  const declarado = e.formulario.qtdMaquininhas;
  const { fotos, video, nomes } = equipamentos(e);
  if (!fotos.length && !video) return montar(10, 'nao_verificavel', `${declarado}`, 'Sem foto do balcão nem vídeo geral');
  const nasFotos = fotos.reduce((acc, d) => acc + d.maquininhas.length, 0);
  const noVideo = video?.maquininhas.length ?? 0;
  const total = Math.max(nasFotos, noVideo);
  const marcas = [...new Set([...fotos.flatMap((d) => d.maquininhas), ...(video?.maquininhas ?? [])].map((m) => m.marca).filter(Boolean))].join(', ');
  const status = total >= 1 && total >= declarado - 1 ? 'conforme' : 'divergente';
  return montar(10, status, `${declarado}`, `${total} observada(s)${marcas ? ` (${marcas})` : ''}`, nomes);
}

function verificarEquipamento(id: number, declarado: 'sim' | 'nao', presente: boolean | undefined, nome: string, nota: string, nomes: string): Verificacao {
  if (presente === undefined) return montar(id, 'nao_verificavel', simNao(declarado), 'Sem foto do balcão nem vídeo geral');
  if (declarado === 'sim') return montar(id, presente ? 'conforme' : 'divergente', 'Sim', presente ? `${nome} visível${nota ? `; ${nota}` : ''}` : `${nome} não aparece no material`, nomes);
  return montar(id, 'atencao', 'Não', presente ? `PDV declarou não ter, mas ${nome.toLowerCase()} aparece no material` : `PDV declarou não ter ${nome.toLowerCase()}`, nomes);
}

export function verificarComputador(e: EntradaMotor): Verificacao {
  const { fotos, video, nomes } = equipamentos(e);
  const presente = !fotos.length && !video ? undefined : fotos.some((d) => d.computador) || video?.computador === true;
  const roteador = fotos.some((d) => d.roteador) || video?.roteador === true;
  return verificarEquipamento(11, e.formulario.computadorInternet, presente, 'Computador', roteador ? 'roteador visível' : 'internet não é verificável pela imagem', nomes);
}

export function verificarImpressora(e: EntradaMotor): Verificacao {
  const { fotos, video, nomes } = equipamentos(e);
  const todas = [...fotos.map((d) => d.impressora_termica), ...(video ? [video.impressora_termica] : [])];
  const presente = !fotos.length && !video ? undefined : todas.some((i) => i.presente);
  const marca = todas.find((i) => i.presente && i.marca)?.marca;
  return verificarEquipamento(12, e.formulario.impressoraTermica, presente, 'Impressora térmica', marca ? `marca ${marca}` : '', nomes);
}
