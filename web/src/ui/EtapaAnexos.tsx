// web/src/ui/EtapaAnexos.tsx
import { useState } from 'react';
import { TIPOS_CONFIG } from '@shared/config/index';
import { TIPOS } from '@shared/schemas/index';
import { obterDuracaoVideo } from '../anexos/duracaoVideo';
import { sugerirTipo } from '../anexos/sugerirTipo';
import { formatarMb, inferirMime, validarArquivo, validarArquivoBasico } from '../anexos/validarArquivo';
import { podeAvancar, type Acao, type Anexo, type EstadoApp } from '../fluxo/estadoApp';
import type { TipoAnexo } from '../tipos';
import { Botoes } from './componentes';

interface Props { estado: EstadoApp; despachar: (a: Acao) => void; obterDuracao?: (arquivo: File) => Promise<number | null> }

export function EtapaAnexos({ estado, despachar, obterDuracao = obterDuracaoVideo }: Props) {
  const [recusados, setRecusados] = useState<string[]>([]);
  const [errosLinha, setErrosLinha] = useState<Record<string, string>>({});

  async function adicionar(arquivos: FileList | File[]) {
    const motivos: string[] = [];
    for (const arquivo of Array.from(arquivos)) {
      const basico = validarArquivoBasico(arquivo);
      if (!basico.ok) { motivos.push(`${arquivo.name}: ${basico.motivo}`); continue; }
      const mime = inferirMime(arquivo);
      const sugerido = sugerirTipo(arquivo.name, mime);
      const tipo = sugerido && validarArquivo(arquivo, sugerido).ok ? sugerido : null;
      const duracaoS = mime.startsWith('video/') ? await obterDuracao(arquivo) : null;
      const anexo: Anexo = { arquivoId: crypto.randomUUID(), arquivo, nome: arquivo.name, mime, tipo, duracaoS, estado: 'na_fila' };
      despachar({ tipo: 'anexo_adicionar', valor: anexo });
    }
    setRecusados(motivos);
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

  const presentes = new Set(estado.anexos.map((a) => a.tipo));
  const obrigatorios = TIPOS.filter((t) => TIPOS_CONFIG[t].obrigatorio);

  return (
    <section aria-labelledby="t-anexos">
      <h2 id="t-anexos">2. Fotos, vídeos e documentos</h2>
      <p>Envie a fachada, cada refrigerador, a câmara fria (se houver), o balcão com computador, impressora e maquininhas, a NF Ambev, o cartão CNPJ e um vídeo percorrendo a loja.</p>

      <div className="zona" onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); void adicionar(e.dataTransfer.files); }}>
        <label htmlFor="arquivos">Adicionar arquivos</label>
        <input id="arquivos" type="file" multiple accept=".mp4,.jpg,.jpeg,.png,.pdf" onChange={(e) => { if (e.target.files) void adicionar(e.target.files); e.target.value = ''; }} />
        <small>MP4 até 11 MB; JPEG, PNG e PDF até 8 MB.</small>
      </div>

      {recusados.length > 0 && <ul className="erros" role="alert">{recusados.map((m) => <li key={m}>{m}</li>)}</ul>}

      <ul className="anexos" aria-label="Arquivos adicionados">
        {estado.anexos.map((a) => (
          <li key={a.arquivoId} aria-label={a.nome}>
            {a.mime.startsWith('image/') ? <img src={URL.createObjectURL(a.arquivo)} alt="" width={64} height={64} /> : <span className="icone">{a.mime.startsWith('video/') ? 'Vídeo' : 'PDF'}</span>}
            <div className="detalhes">
              <strong>{a.nome}</strong>
              <small>{formatarMb(a.arquivo.size)}{a.duracaoS != null && <> · <span>{a.duracaoS} s</span></>}</small>
              <select aria-label={`Tipo de ${a.nome}`} value={a.tipo ?? ''} onChange={(e) => mudarTipo(a, e.target.value)}>
                <option value="">Escolha o tipo</option>
                {TIPOS.map((t) => <option key={t} value={t}>{TIPOS_CONFIG[t].rotulo}</option>)}
              </select>
              {errosLinha[a.arquivoId] && <small className="erro">{errosLinha[a.arquivoId]}</small>}
            </div>
            <button type="button" onClick={() => despachar({ tipo: 'anexo_remover', arquivoId: a.arquivoId })}>Remover</button>
          </li>
        ))}
      </ul>

      <ul className="checklist" aria-label="Checklist de anexos">
        {obrigatorios.map((t) => (
          <li key={t} className={presentes.has(t) ? 'ok' : 'faltando'}>{TIPOS_CONFIG[t].rotulo}: {presentes.has(t) ? 'ok' : 'faltando'}</li>
        ))}
      </ul>
      {obrigatorios.some((t) => !presentes.has(t)) && estado.anexos.length > 0 && <p className="aviso">Tipos faltando entram como "Atenção" no relatório.</p>}

      <Botoes>
        <button type="button" onClick={() => despachar({ tipo: 'etapa', valor: 1 })}>Voltar</button>
        <button type="button" disabled={!podeAvancar(estado)} onClick={() => despachar({ tipo: 'etapa', valor: 3 })}>Continuar</button>
      </Botoes>
    </section>
  );
}
