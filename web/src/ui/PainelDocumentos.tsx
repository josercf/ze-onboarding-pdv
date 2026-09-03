// web/src/ui/PainelDocumentos.tsx
import { TIPOS_CONFIG, tiposObrigatorios } from '@shared/config/index';
import { TIPOS } from '@shared/schemas/index';
import type { EstadoApp } from '../fluxo/estadoApp';
import type { TipoAnexo } from '../tipos';

interface Props { estado: EstadoApp; aberto: boolean; aoEscolher: (tipo: TipoAnexo) => void }

export function PainelDocumentos({ estado, aberto, aoEscolher }: Props) {
  const obrigatorios = tiposObrigatorios(estado.formulario);
  const contagem = (t: TipoAnexo) => estado.anexos.filter((a) => a.tipo === t).length;
  const ordenados = [...TIPOS].sort((a, b) => Number(obrigatorios.includes(b)) - Number(obrigatorios.includes(a)));
  const enviados = obrigatorios.filter((t) => contagem(t) > 0).length;

  return (
    <details className="painel-docs" open={aberto}>
      <summary>Documentos do PDV: {enviados} de {obrigatorios.length} obrigatórios enviados</summary>
      <ul aria-label="Checklist de documentos">
        {ordenados.map((t) => {
          const obrigatorio = obrigatorios.includes(t);
          const n = contagem(t);
          const situacao = n > 0 ? 'ok' : obrigatorio ? 'falta' : 'opcional';
          return (
            <li key={t} className={situacao}>
              <button type="button" onClick={() => aoEscolher(t)} aria-label={`Adicionar ${TIPOS_CONFIG[t].rotulo}`}>
                <span className="rotulo">{TIPOS_CONFIG[t].rotulo}</span>
                <small>{obrigatorio ? 'obrigatório' : 'opcional'} · {n} arquivo(s)</small>
                <span className="situacao">{n > 0 ? 'ok' : obrigatorio ? 'falta' : ''}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </details>
  );
}
