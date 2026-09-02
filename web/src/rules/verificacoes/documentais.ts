import { cnaes, limites } from '@shared/config/index';
import { formatarCnpj, somenteDigitos } from '../../cnpj/validarCnpj';
import type { DadosCartaoCnpj, DadosNfAmbev, StatusVerificacao, Verificacao } from '../../tipos';
import { diasEntre, montar, observacoesDe, parseData, simNao, type EntradaMotor } from '../base';
import { melhorSimilaridade, semZerosAEsquerda, similaridadeNome } from '../normalizar';

const SEM_RECEITA = 'Receita Federal indisponível na consulta';

export function formatarCnae(codigo: number): string {
  const s = String(codigo).padStart(7, '0');
  return `${s.slice(0, 2)}.${s.slice(2, 4)}-${s.slice(4, 5)}/${s.slice(5, 7)}`;
}

export function cnaeDeBebidas(codigo: number): boolean {
  return cnaes.codigos.includes(codigo) || cnaes.prefixos.some((p) => String(codigo).startsWith(p));
}

export function verificarCnpjAtivo(e: EntradaMotor): Verificacao {
  const declarado = formatarCnpj(e.formulario.cnpj);
  if (!e.receita) return montar(1, 'nao_verificavel', declarado, SEM_RECEITA);
  const ativa = e.receita.situacao.toUpperCase() === 'ATIVA';
  return montar(1, ativa ? 'conforme' : 'divergente', declarado, `Situação cadastral ${e.receita.situacao || 'não informada'}`, 'BrasilAPI');
}

export function verificarCnae(e: EntradaMotor): Verificacao {
  const declarado = simNao(e.formulario.cnaeBebidas);
  if (!e.receita) return montar(2, 'nao_verificavel', declarado, SEM_RECEITA);
  const todos = [e.receita.cnaePrincipal, ...e.receita.cnaesSecundarios];
  const achado = todos.find((c) => cnaeDeBebidas(c.codigo));
  if (!achado) {
    return montar(2, 'divergente', declarado, `Nenhum CNAE de bebidas ou alimentos; principal ${formatarCnae(e.receita.cnaePrincipal.codigo)} ${e.receita.cnaePrincipal.descricao}`, 'BrasilAPI');
  }
  const status: StatusVerificacao = e.formulario.cnaeBebidas === 'sim' ? 'conforme' : 'atencao';
  return montar(2, status, declarado, `CNAE ${formatarCnae(achado.codigo)} ${achado.descricao}`, 'BrasilAPI');
}

export function verificarResponsavel(e: EntradaMotor): Verificacao {
  const declarado = e.formulario.responsavel;
  if (!e.receita) return montar(3, 'nao_verificavel', declarado, SEM_RECEITA);
  const fontes = [e.receita.razaoSocial, ...e.receita.qsa.map((s) => s.nome)];
  const sim = melhorSimilaridade(declarado, fontes);
  const pct = `${Math.round(sim * 100)}%`;
  return montar(3, sim >= 0.8 ? 'conforme' : 'divergente', declarado,
    sim >= 0.8 ? `Nome consta na Receita (similaridade ${pct})` : `Nome não consta na razão social nem no QSA (similaridade ${pct})`, fontes.join('; '));
}

export function verificarSocio(e: EntradaMotor): Verificacao {
  const declarado = simNao(e.formulario.possuiSocio);
  if (!e.receita) return montar(4, 'nao_verificavel', declarado, SEM_RECEITA);
  const individual = e.receita.mei || /individual/i.test(e.receita.naturezaJuridica);
  const temSocio = !individual && e.receita.qsa.length >= 2;
  const observado = individual ? 'Empresário individual, sem quadro societário' : `${e.receita.qsa.length} pessoa(s) no QSA`;
  const coerente = (e.formulario.possuiSocio === 'sim') === temSocio;
  return montar(4, coerente ? 'conforme' : 'divergente', declarado, observado, 'BrasilAPI');
}

function validade(e: EntradaMotor, data: string | null, rotulo: string): string | null {
  const d = parseData(data);
  if (!d) return `${rotulo} com data de emissão ilegível`;
  const dias = diasEntre(e.hoje, d);
  return dias > limites.diasValidadeDocumento ? `${rotulo} emitido há ${dias} dias (limite ${limites.diasValidadeDocumento})` : null;
}

export function verificarCartaoCnpj(e: EntradaMotor): Verificacao {
  const declarado = formatarCnpj(e.formulario.cnpj);
  const cartoes = observacoesDe<DadosCartaoCnpj>(e, 'cartao_cnpj');
  if (!cartoes.length) return montar(5, 'nao_verificavel', declarado, 'Cartão CNPJ não enviado');
  const { dados: d, nome } = cartoes[0];
  const divergencias: string[] = [];
  if (somenteDigitos(d.cnpj ?? '') !== e.formulario.cnpj) divergencias.push(`CNPJ do cartão (${d.cnpj ?? 'ilegível'}) difere do informado`);
  if (e.receita && similaridadeNome(e.receita.razaoSocial, d.razao_social ?? '') < 0.8) divergencias.push('razão social do cartão difere da Receita');
  if (d.situacao && d.situacao.toUpperCase() !== 'ATIVA') divergencias.push(`situação ${d.situacao} no cartão`);
  if (divergencias.length) return montar(5, 'divergente', declarado, divergencias.join('; '), nome);
  const alerta = validade(e, d.data_emissao, 'Cartão');
  if (alerta) return montar(5, 'atencao', declarado, alerta, nome);
  return montar(5, 'conforme', declarado, `Cartão de ${d.data_emissao} confere com a Receita`, nome);
}

export function verificarNfAmbev(e: EntradaMotor): Verificacao {
  const parceiro = e.formulario.parceiroAmbev === 'sim';
  const declarado = parceiro ? `Parceiro Ambev, código ${e.formulario.codigoParceiro || 'não informado'}` : 'Não é parceiro Ambev';
  const nfs = observacoesDe<DadosNfAmbev>(e, 'nf_ambev');
  if (!parceiro) return montar(6, 'nao_verificavel', declarado, nfs.length ? 'NF enviada, mas o PDV declarou não ser parceiro' : 'Nada a comprovar: o PDV declarou não ser parceiro');
  if (!nfs.length) return montar(6, 'nao_verificavel', declarado, 'NF Ambev não enviada');
  const { dados: d, nome } = nfs[0];
  if (!d.legivel) return montar(6, 'atencao', declarado, 'NF ilegível; peça uma foto nítida da nota', nome);
  const divergencias: string[] = [];
  if (!/AMBEV|CRBS/i.test(d.emitente.nome ?? '')) divergencias.push(`emitente ${d.emitente.nome ?? 'não identificado'} não é Ambev nem CRBS`);
  if (somenteDigitos(d.destinatario.cnpj ?? '') !== e.formulario.cnpj) divergencias.push(`destinatário ${d.destinatario.nome ?? ''} (CNPJ ${d.destinatario.cnpj ?? 'ilegível'}) difere do PDV`);
  if (semZerosAEsquerda(d.destinatario.codigo_cliente) !== semZerosAEsquerda(e.formulario.codigoParceiro)) divergencias.push(`código do cliente ${d.destinatario.codigo_cliente ?? 'ilegível'} difere do declarado`);
  if (divergencias.length) return montar(6, 'divergente', declarado, divergencias.join('; '), nome);
  const alerta = validade(e, d.data_emissao, 'NF');
  if (alerta) return montar(6, 'atencao', declarado, alerta, nome);
  return montar(6, 'conforme', declarado, `NF ${d.numero ?? ''} de ${d.data_emissao} emitida pela ${d.emitente.nome} para o CNPJ do PDV, código ${d.destinatario.codigo_cliente}`, nome);
}
