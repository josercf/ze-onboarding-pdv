// web/src/ui/EtapaAnexos.tsx
import { useEffect, useRef, useState } from 'react';
import { TIPOS_CONFIG } from '@shared/config/index';
import { TIPOS } from '@shared/schemas/index';
import type { ClienteN8n } from '../api/clienteN8n';
import { obterDuracaoVideo } from '../anexos/duracaoVideo';
import { seloDe } from '../anexos/seloDe';
import { formatarMb, inferirMime, validarArquivo, validarArquivoBasico } from '../anexos/validarArquivo';
import { CLASSIFICACAO_PENDENTE, CLASSIFICACAO_VIDEO, faltantes, podeAvancar, type Acao, type Anexo, type EstadoApp } from '../fluxo/estadoApp';
import { executarFilaClassificacao, type ItemClassificacao } from '../fluxo/filaClassificacao';
import type { TipoAnexo } from '../tipos';
import { Botoes } from './componentes';
import { PainelDocumentos } from './PainelDocumentos';

interface Props { estado: EstadoApp; despachar: (a: Acao) => void; cliente: Pick<ClienteN8n, 'classificarArquivo'>; obterDuracao?: (arquivo: File) => Promise<number | null> }

const AVISO_TOKEN = 'Token do n8n ausente ou inválido. Verifique a configuração (VITE_N8N_TOKEN); enquanto isso, escolha os tipos à mão.';

function Miniatura({ arquivo }: { arquivo: File }) {
  const [url] = useState(() => URL.createObjectURL(arquivo));
  useEffect(() => () => URL.revokeObjectURL(url), [url]);
  return <img src={url} alt="" width={64} height={64} />;
}

const classificando = (a: Anexo) => a.classificacao.estado === 'pendente' || a.classificacao.estado === 'classificando';

export function EtapaAnexos({ estado, despachar, cliente, obterDuracao = obterDuracaoVideo }: Props) {
  const [recusados, setRecusados] = useState<string[]>([]);
  const [errosLinha, setErrosLinha] = useState<Record<string, string>>({});
  const entradaRef = useRef<HTMLInputElement>(null);
  const tipoSugerido = useRef<TipoAnexo | null>(null);
  const [estreito] = useState(() => typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(max-width: 720px)').matches);

  function escolherDocumento(tipo: TipoAnexo) {
    tipoSugerido.current = tipo;
    entradaRef.current?.click();
  }

  const semTokenValido = estado.anexos.some((a) => a.classificacao.estado === 'falhou' && a.classificacao.erroCodigo === 'auth');

  function classificar(anexos: Anexo[]) {
    if (anexos.length === 0) return;
    if (semTokenValido) {
      for (const a of anexos) despachar({ tipo: 'anexo_classificacao', arquivoId: a.arquivoId, valor: { estado: 'falhou', erro: 'Token do n8n ausente ou inválido', erroCodigo: 'auth' } });
      return;
    }
    const itens: ItemClassificacao[] = anexos.map((a) => ({ arquivoId: a.arquivoId, arquivo: a.arquivo, nome: a.nome, estado: 'pendente' }));
    void executarFilaClassificacao(itens, (item) => cliente.classificarArquivo({ arquivo: item.arquivo, nome: item.nome, arquivoId: item.arquivoId }), {
      aoMudar: (item) => despachar({
        tipo: 'anexo_classificacao', arquivoId: item.arquivoId,
        valor: item.estado === 'concluida' && item.resultado
          ? { estado: 'concluida', tipoDetectado: item.resultado.tipo_detectado, confianca: item.resultado.confianca, motivo: item.resultado.motivo, erro: undefined, erroCodigo: undefined }
          : { estado: item.estado, erro: item.erro, erroCodigo: item.erroCodigo },
      }),
    });
  }

  async function adicionar(arquivos: FileList | File[]) {
    const motivos: string[] = [];
    const novos: Anexo[] = [];
    for (const arquivo of Array.from(arquivos)) {
      const basico = validarArquivoBasico(arquivo);
      if (!basico.ok) { motivos.push(`${arquivo.name}: ${basico.motivo}`); continue; }
      const mime = inferirMime(arquivo);
      const video = mime.startsWith('video/');
      const duracaoS = video ? await obterDuracao(arquivo) : null;
      const sugerido = tipoSugerido.current;
      const tipo: TipoAnexo | null = video ? 'video_geral' : sugerido && validarArquivo(arquivo, sugerido).ok ? sugerido : null;
      const anexo: Anexo = {
        arquivoId: crypto.randomUUID(), arquivo, nome: arquivo.name, mime, tipo, duracaoS, estado: 'na_fila',
        classificacao: video ? CLASSIFICACAO_VIDEO : CLASSIFICACAO_PENDENTE,
      };
      despachar({ tipo: 'anexo_adicionar', valor: anexo });
      if (!video) novos.push(anexo);
    }
    tipoSugerido.current = null;
    setRecusados(motivos);
    classificar(novos);
  }

  function mudarTipo(anexo: Anexo, valor: string) {
    if (!valor) return;
    const tipo = valor as TipoAnexo;
    const r = validarArquivo(anexo.arquivo, tipo);
    if (!r.ok) {
      setErrosLinha((e) => ({ ...e, [anexo.arquivoId]: r.motivo }));
      despachar({ tipo: 'anexo_tipo', arquivoId: anexo.arquivoId, valor: null });
      return;
    }
    setErrosLinha((e) => { const { [anexo.arquivoId]: _r, ...resto } = e; return resto; });
    despachar({ tipo: 'anexo_tipo', arquivoId: anexo.arquivoId, valor: tipo });
  }

  const pendentes = faltantes(estado);
  const motivoBloqueio = estado.anexos.length === 0 ? 'Adicione ao menos um arquivo'
    : estado.anexos.some(classificando) ? 'Aguarde a classificação terminar'
      : estado.anexos.some((a) => a.tipo === null) ? 'Escolha o tipo dos arquivos sem tipo'
        : pendentes.length ? `Falta: ${pendentes.map((t) => TIPOS_CONFIG[t].rotulo).join(', ')}` : '';

  return (
    <section aria-labelledby="t-anexos" className="etapa-anexos">
      <div className="coluna-arquivos">
        <h2 id="t-anexos">2. Fotos, vídeos e documentos</h2>
        <p>Adicione os arquivos em lote. Cada um é classificado automaticamente; confira o tipo e corrija se precisar.</p>

        <div className="zona" onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); void adicionar(e.dataTransfer.files); }}>
          <label htmlFor="arquivos">Adicionar arquivos</label>
          <input ref={entradaRef} id="arquivos" type="file" multiple accept=".mp4,.jpg,.jpeg,.png,.pdf" onChange={(e) => { if (e.target.files) void adicionar(e.target.files); e.target.value = ''; }} />
          <small>Arraste aqui ou toque para escolher. MP4 até 11 MB; JPEG, PNG e PDF até 8 MB.</small>
        </div>

        {recusados.length > 0 && <ul className="erros" role="alert">{recusados.map((m) => <li key={m}>{m}</li>)}</ul>}
        {semTokenValido && <p role="alert" className="aviso">{AVISO_TOKEN}</p>}

        <ul className="anexos" aria-label="Arquivos adicionados">
          {estado.anexos.map((a) => (
            <li key={a.arquivoId} aria-label={a.nome} className={`classificacao-${a.classificacao.estado}`}>
              {a.mime.startsWith('image/') ? <Miniatura arquivo={a.arquivo} /> : <span className="icone">{a.mime.startsWith('video/') ? 'Vídeo' : 'PDF'}</span>}
              <div className="detalhes">
                <strong>{a.nome}</strong>
                <small>{formatarMb(a.arquivo.size)}{a.duracaoS != null && <> · <span>{a.duracaoS} s</span></>}</small>
                <span className="selo">{seloDe(a)}</span>
                <select aria-label={`Tipo de ${a.nome}`} value={a.tipo ?? ''} disabled={classificando(a)} onChange={(e) => mudarTipo(a, e.target.value)}>
                  <option value="">Escolha o tipo</option>
                  {TIPOS.map((t) => <option key={t} value={t}>{TIPOS_CONFIG[t].rotulo}</option>)}
                </select>
                {a.classificacao.estado === 'falhou' && <small className="erro">Não foi possível classificar automaticamente.</small>}
                {a.classificacao.estado === 'concluida' && a.tipo === null && a.classificacao.motivo && <small className="motivo">{a.classificacao.motivo}</small>}
                {errosLinha[a.arquivoId] && <small className="erro">{errosLinha[a.arquivoId]}</small>}
              </div>
              <button type="button" onClick={() => despachar({ tipo: 'anexo_remover', arquivoId: a.arquivoId })}>Remover</button>
            </li>
          ))}
        </ul>

        <Botoes>
          <button type="button" onClick={() => despachar({ tipo: 'etapa', valor: 1 })}>Voltar</button>
          <button type="button" disabled={!podeAvancar(estado)} onClick={() => despachar({ tipo: 'etapa', valor: 3 })}>Continuar</button>
          <small className="motivo-bloqueio" role="status">{motivoBloqueio}</small>
        </Botoes>
      </div>
      <aside className="coluna-painel">
        <PainelDocumentos estado={estado} aberto={!estreito} aoEscolher={escolherDocumento} />
      </aside>
    </section>
  );
}
