// web/src/ui/EtapaRelatorio.tsx
import { useEffect, useMemo, useRef } from 'react';
import { TIPOS_CONFIG } from '@shared/config/index';
import type { ClienteN8n } from '../api/clienteN8n';
import { formatarCnpj } from '../cnpj/validarCnpj';
import { observacoesDoEstado, type Acao, type EstadoApp } from '../fluxo/estadoApp';
import type { TipoDetectado } from '../tipos';
import { Botoes } from './componentes';
import { estimarCusto } from './custo';
import { ROTULO_RECOMENDACAO, ROTULO_STATUS } from './rotulos';

interface Props { estado: EstadoApp; despachar: (a: Acao) => void; cliente: ClienteN8n; agora?: () => Date }

const segundosDe = (ref: string): number | null => {
  const m = /^t=(\d{2}):(\d{2})$/.exec(ref);
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
};

const rotuloDetectado = (t: TipoDetectado) => (t === 'indefinido' ? 'indefinido' : TIPOS_CONFIG[t].rotulo);

function notaClassificacao(a: { tipo: TipoDetectado | null; classificacao: { tipoDetectado: TipoDetectado | null } }): string {
  const d = a.classificacao.tipoDetectado;
  if (!d || !a.tipo) return '';
  return d === a.tipo ? ' (detectado automaticamente)' : ` (detectado como ${rotuloDetectado(d)}, reclassificado)`;
}

export function EtapaRelatorio({ estado, despachar, cliente, agora = () => new Date() }: Props) {
  const pediu = useRef(false);
  const videos = useRef<Record<string, HTMLVideoElement | null>>({});
  const geradoEm = useMemo(() => agora(), [agora]);
  const urls = useMemo(() => Object.fromEntries(estado.anexos.map((a) => [a.arquivoId, URL.createObjectURL(a.arquivo)])), [estado.anexos]);
  useEffect(() => () => { Object.values(urls).forEach((u) => URL.revokeObjectURL(u)); }, [urls]);

  const observacoes = observacoesDoEstado(estado);
  const recomendacao = estado.recomendacao ?? 'revisao_manual';

  async function gerarParecer() {
    despachar({ tipo: 'parecer', valor: null, erro: null });
    try {
      const parecer = await cliente.consolidar({ formulario: estado.formulario, receita: estado.receita, parametros_regiao: estado.parametros, observacoes, verificacoes: estado.verificacoes, recomendacao_regras: recomendacao });
      despachar({ tipo: 'parecer', valor: parecer });
    } catch (e) {
      despachar({ tipo: 'parecer', valor: null, erro: e instanceof Error ? e.message : 'Falha ao gerar o parecer' });
    }
  }

  useEffect(() => {
    if (pediu.current || estado.parecer || estado.parecerErro) return;
    pediu.current = true;
    void gerarParecer();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function baixarJson() {
    const conteudo = { gerado_em: geradoEm.toISOString(), formulario: estado.formulario, receita: estado.receita, parametros_regiao: estado.parametros, verificacoes: estado.verificacoes, recomendacao, parecer: estado.parecer, observacoes, anexos: estado.anexos.map((a) => ({ arquivo_id: a.arquivoId, nome: a.nome, tipo: a.tipo, tipo_detectado: a.classificacao.tipoDetectado, confianca: a.classificacao.confianca })) };
    const url = URL.createObjectURL(new Blob([JSON.stringify(conteudo, null, 2)], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url; a.download = `relatorio-${estado.formulario.cnpj}.json`; a.click();
    URL.revokeObjectURL(url);
  }

  const custo = estimarCusto([...observacoes, ...(estado.parecer ? [estado.parecer] : [])]);
  const discorda = estado.parecer && estado.parecer.recomendacao_sugerida !== recomendacao;
  const classificados = estado.anexos.filter((a) => a.classificacao.estado === 'concluida' && a.mime !== 'video/mp4');
  const aceitos = classificados.filter((a) => a.classificacao.tipoDetectado === a.tipo).length;

  return (
    <section className="relatorio" aria-labelledby="t-relatorio">
      <header className="cabecalho">
        <h2 id="t-relatorio">Relatório de conformidade</h2>
        <p><strong>{estado.receita?.razaoSocial || 'PDV'}</strong><br /><span>{formatarCnpj(estado.formulario.cnpj)}</span><br /><span>{geradoEm.toLocaleString('pt-BR')}</span></p>
        <p className={`recomendacao ${recomendacao}`} data-testid="recomendacao">Recomendação: {ROTULO_RECOMENDACAO[recomendacao]}</p>
      </header>

      <div className="tabela">
        <table>
          <thead><tr><th>#</th><th>Item</th><th>Declarado</th><th>Observado</th><th>Status</th><th>Evidência</th></tr></thead>
          <tbody>
            {estado.verificacoes.map((v) => (
              <tr key={v.id} className={`status-${v.status}`}>
                <td>{v.id}</td><td>{v.item}{v.critico && <small> (crítico)</small>}</td><td>{v.declarado}</td><td>{v.observado}</td>
                <td><span className={`badge ${v.status}`}>{ROTULO_STATUS[v.status]}</span></td><td>{v.evidencia}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h3>Evidências por arquivo</h3>
      <ul className="evidencias">
        {estado.anexos.filter((a) => a.estado === 'concluido' && a.observacao).map((a) => {
          const o = a.observacao!;
          return (
            <li key={a.arquivoId}>
              {a.mime.startsWith('video/')
                ? <video controls preload="metadata" src={urls[a.arquivoId]} ref={(el) => { videos.current[a.arquivoId] = el; }} />
                : a.mime.startsWith('image/') ? <img src={urls[a.arquivoId]} alt={`Miniatura de ${a.nome}`} /> : <span className="icone">PDF</span>}
              <div>
                <strong>{a.nome}</strong> <small>{a.tipo ? TIPOS_CONFIG[a.tipo].rotulo : ''}{notaClassificacao(a)}{!o.aderente_ao_tipo && ' (não corresponde ao tipo)'}</small>
                <p>{o.resumo}</p>
                {o.alertas.length > 0 && <ul className="alertas">{o.alertas.map((al, i) => <li key={i}>{al.descricao}</li>)}</ul>}
                <ul className="lista-evidencias">
                  {o.evidencias.map((ev, i) => {
                    const s = segundosDe(ev.ref);
                    return (
                      <li key={i}>
                        {s != null && a.mime.startsWith('video/')
                          ? <button type="button" onClick={() => { const v = videos.current[a.arquivoId]; if (v) { v.currentTime = s; v.play?.(); } }}>{ev.ref}</button>
                          : <span>{ev.ref}</span>} {ev.descricao}
                      </li>
                    );
                  })}
                </ul>
              </div>
            </li>
          );
        })}
      </ul>

      <h3>Parecer</h3>
      {estado.parecer ? (
        <div className="parecer">
          <p>{estado.parecer.parecer}</p>
          {estado.parecer.pontos_de_atencao.length > 0 && <ul>{estado.parecer.pontos_de_atencao.map((p) => <li key={p}>{p}</li>)}</ul>}
          <p><small>{estado.parecer.justificativa}</small></p>
          {discorda && <p className="aviso">O modelo sugeriu "{ROTULO_RECOMENDACAO[estado.parecer.recomendacao_sugerida]}"; a recomendação oficial é a das regras.</p>}
        </div>
      ) : estado.parecerErro ? (
        <div className="parecer">
          <p role="alert">Não foi possível gerar o parecer: {estado.parecerErro}</p>
          <button type="button" onClick={() => void gerarParecer()}>Gerar parecer novamente</button>
        </div>
      ) : <p>Gerando parecer...</p>}

      <footer className="rodape">
        <small>Modelos: {custo.modelos.join(', ') || 'nenhum'} · Tokens: {custo.tokens.entrada.toLocaleString('pt-BR')} de entrada, {custo.tokens.saida.toLocaleString('pt-BR')} de saída · Custo estimado: US$ {custo.totalUsd.toFixed(3)}</small>
        <br /><small>Classificação automática: {aceitos} de {classificados.length} arquivos aceitos sem correção</small>
      </footer>

      <Botoes>
        <button type="button" onClick={() => window.print()}>Imprimir ou salvar PDF</button>
        <button type="button" onClick={baixarJson}>Baixar JSON</button>
        <button type="button" onClick={() => despachar({ tipo: 'reiniciar' })}>Nova análise</button>
      </Botoes>
    </section>
  );
}
