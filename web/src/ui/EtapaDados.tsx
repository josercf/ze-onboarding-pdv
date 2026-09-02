// web/src/ui/EtapaDados.tsx
import { useState } from 'react';
import { ErroBrasilApi, consultarCnpj as consultarPadrao } from '../cnpj/brasilapi';
import { formatarCnpj, somenteDigitos, validarCnpj } from '../cnpj/validarCnpj';
import { errosFormulario, type Acao, type EstadoApp } from '../fluxo/estadoApp';
import { formatarCnae } from '../rules/verificacoes/documentais';
import type { Endereco, Formulario, Receita } from '../tipos';
import { Botoes, Campo, CampoNumero, CampoTexto, SelecaoSimNao } from './componentes';

interface Props { estado: EstadoApp; despachar: (a: Acao) => void; consultar?: (cnpj: string) => Promise<Receita> }

export function EtapaDados({ estado, despachar, consultar = consultarPadrao }: Props) {
  const { formulario: f, receita, receitaErro, parametros } = estado;
  const [erros, setErros] = useState<string[]>([]);
  const [consultando, setConsultando] = useState(false);
  const mudar = (valor: Partial<Formulario>) => despachar({ tipo: 'formulario', valor });
  const mudarEndereco = (valor: Partial<Endereco>) => mudar({ endereco: { ...f.endereco, ...valor } });

  async function aoMudarCnpj(texto: string) {
    const digitos = somenteDigitos(texto);
    mudar({ cnpj: digitos });
    if (digitos.length !== 14 || !validarCnpj(digitos)) return;
    setConsultando(true);
    try {
      despachar({ tipo: 'receita', valor: await consultar(digitos) });
    } catch (e) {
      despachar({ tipo: 'receita', valor: null, erro: e instanceof ErroBrasilApi ? e.message : 'Não foi possível consultar a Receita agora.' });
    } finally {
      setConsultando(false);
    }
  }

  function continuar() {
    const lista = errosFormulario(f);
    setErros(lista);
    if (!lista.length) despachar({ tipo: 'etapa', valor: 2 });
  }

  return (
    <section aria-labelledby="t-dados">
      <h2 id="t-dados">1. Dados do PDV</h2>
      <Campo id="cnpj" rotulo="CNPJ" ajuda={consultando ? 'Consultando a Receita Federal...' : receitaErro ?? undefined}>
        <input id="cnpj" inputMode="numeric" autoComplete="off" value={formatarCnpj(f.cnpj)} onChange={(e) => void aoMudarCnpj(e.target.value)} />
      </Campo>

      {receita && (
        <dl className="cartao" aria-label="Dados da Receita">
          <dt>Razão social</dt><dd>{receita.razaoSocial}</dd>
          <dt>Situação cadastral</dt><dd>{receita.situacao}</dd>
          <dt>CNAE principal</dt><dd>{formatarCnae(receita.cnaePrincipal.codigo)} {receita.cnaePrincipal.descricao}</dd>
          <dt>Porte</dt><dd>{receita.porte}</dd>
          <dt>Natureza jurídica</dt><dd>{receita.naturezaJuridica}</dd>
          <dt>Quadro societário</dt><dd>{receita.qsa.length ? receita.qsa.map((s) => s.nome).join(', ') : 'Sem sócios registrados'}</dd>
        </dl>
      )}

      <CampoTexto id="responsavel" rotulo="Nome completo do responsável pelo CNPJ" valor={f.responsavel} aoMudar={(v) => mudar({ responsavel: v })} />
      <SelecaoSimNao id="possuiSocio" rotulo="Possui sócio no mesmo CNPJ?" valor={f.possuiSocio} aoMudar={(v) => mudar({ possuiSocio: v })} />
      <SelecaoSimNao id="contaCorrente" rotulo="Possui conta corrente vinculada ao CNPJ?" valor={f.contaCorrente} aoMudar={(v) => mudar({ contaCorrente: v })} />
      <CampoNumero id="qtdRefrigeradores" rotulo="Quantidade de refrigeradores" valor={f.qtdRefrigeradores} aoMudar={(v) => mudar({ qtdRefrigeradores: v })} />
      <SelecaoSimNao id="camaraFria" rotulo="Câmara frigorífica" valor={f.camaraFria} aoMudar={(v) => mudar({ camaraFria: v })} />
      <CampoNumero id="qtdEntregadores" rotulo="Quantidade de entregadores" valor={f.qtdEntregadores} aoMudar={(v) => mudar({ qtdEntregadores: v })} />
      <CampoNumero id="qtdMaquininhas" rotulo="Quantidade de máquinas de cartão" valor={f.qtdMaquininhas} aoMudar={(v) => mudar({ qtdMaquininhas: v })} />
      <SelecaoSimNao id="computadorInternet" rotulo="Computador e internet" valor={f.computadorInternet} aoMudar={(v) => mudar({ computadorInternet: v })} />
      <SelecaoSimNao id="impressoraTermica" rotulo="Impressora térmica" valor={f.impressoraTermica} aoMudar={(v) => mudar({ impressoraTermica: v })} />
      <SelecaoSimNao id="cupomFiscal" rotulo="Emite cupom fiscal?" valor={f.cupomFiscal} aoMudar={(v) => mudar({ cupomFiscal: v })} />
      <CampoTexto id="cupomFiscalObs" rotulo="Observação sobre o cupom fiscal" valor={f.cupomFiscalObs} aoMudar={(v) => mudar({ cupomFiscalObs: v })} multilinha ajuda="Se houver alguma condição (certificado pendente, homologação em andamento), descreva aqui." />
      <SelecaoSimNao id="cnaeBebidas" rotulo="Possui CNAE de venda de bebidas e comida?" valor={f.cnaeBebidas} aoMudar={(v) => mudar({ cnaeBebidas: v })} />
      <SelecaoSimNao id="parceiroAmbev" rotulo="É parceiro Ambev?" valor={f.parceiroAmbev} aoMudar={(v) => mudar({ parceiroAmbev: v })} />
      {f.parceiroAmbev === 'sim' && <CampoTexto id="codigoParceiro" rotulo="Código de parceiro Ambev" valor={f.codigoParceiro} aoMudar={(v) => mudar({ codigoParceiro: v })} />}
      <SelecaoSimNao id="trabalha300ml" rotulo="Trabalha com garrafa de 300 ml?" valor={f.trabalha300ml} aoMudar={(v) => mudar({ trabalha300ml: v })} />
      <SelecaoSimNao id="lojaAtivaZe" rotulo="Já possui loja ativa no Zé?" valor={f.lojaAtivaZe} aoMudar={(v) => mudar({ lojaAtivaZe: v })} />
      <CampoTexto id="horarioDelivery" rotulo="Dias e horário de funcionamento do delivery" valor={f.horarioDelivery} aoMudar={(v) => mudar({ horarioDelivery: v })} />

      <fieldset>
        <legend>Endereço do ponto de venda</legend>
        <CampoTexto id="logradouro" rotulo="Logradouro" valor={f.endereco.logradouro} aoMudar={(v) => mudarEndereco({ logradouro: v })} />
        <CampoTexto id="numero" rotulo="Número" valor={f.endereco.numero} aoMudar={(v) => mudarEndereco({ numero: v })} />
        <CampoTexto id="complemento" rotulo="Complemento" valor={f.endereco.complemento} aoMudar={(v) => mudarEndereco({ complemento: v })} />
        <CampoTexto id="bairro" rotulo="Bairro" valor={f.endereco.bairro} aoMudar={(v) => mudarEndereco({ bairro: v })} />
        <CampoTexto id="municipio" rotulo="Município" valor={f.endereco.municipio} aoMudar={(v) => mudarEndereco({ municipio: v })} />
        <CampoTexto id="uf" rotulo="UF" valor={f.endereco.uf} aoMudar={(v) => mudarEndereco({ uf: v.toUpperCase().slice(0, 2) })} />
        <CampoTexto id="cep" rotulo="CEP" valor={f.endereco.cep} aoMudar={(v) => mudarEndereco({ cep: v.replace(/\D/g, '').slice(0, 8) })} />
      </fieldset>

      <details className="parametros">
        <summary>Parâmetros de avaliação</summary>
        <p>Requisitos da região usados no relatório. Ajuste conforme a praça do PDV.</p>
        <CampoNumero id="minRefrigeradores" rotulo="Mínimo de refrigeradores na região" valor={parametros.minRefrigeradores} aoMudar={(v) => despachar({ tipo: 'parametros', valor: { minRefrigeradores: v } })} />
        <div className="campo">
          <input id="camaraFriaObrigatoria" type="checkbox" checked={parametros.camaraFriaObrigatoria} onChange={(e) => despachar({ tipo: 'parametros', valor: { camaraFriaObrigatoria: e.target.checked } })} />
          <label htmlFor="camaraFriaObrigatoria">Câmara fria obrigatória na região</label>
        </div>
        <CampoNumero id="minEntregadores" rotulo="Mínimo de entregadores na região" valor={parametros.minEntregadores} aoMudar={(v) => despachar({ tipo: 'parametros', valor: { minEntregadores: v } })} />
      </details>

      {erros.length > 0 && (
        <ul className="erros" role="alert">{erros.map((e) => <li key={e}>{e}</li>)}</ul>
      )}
      <Botoes><button type="button" onClick={continuar}>Continuar</button></Botoes>
    </section>
  );
}
