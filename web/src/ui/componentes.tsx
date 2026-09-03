// web/src/ui/componentes.tsx
import type { ReactNode } from 'react';
import type { SimNao } from '../tipos';

export type Largura = 'curto' | 'medio' | 'largo' | 'longo';

export function Secao({ titulo, descricao, children }: { titulo: string; descricao?: string; children: ReactNode }) {
  return (
    <fieldset className="secao">
      <legend>{titulo}</legend>
      {descricao && <p className="descricao">{descricao}</p>}
      <div className="grade">{children}</div>
    </fieldset>
  );
}

export function Campo({ id, rotulo, ajuda, largura = 'longo', children }: { id: string; rotulo: string; ajuda?: string; largura?: Largura; children: ReactNode }) {
  return (
    <div className={`campo campo-${largura}`}>
      <label htmlFor={id}>{rotulo}</label>
      {children}
      {ajuda && <small id={`${id}-ajuda`}>{ajuda}</small>}
    </div>
  );
}

export function CampoTexto({ id, rotulo, valor, aoMudar, ajuda, multilinha = false, largura = 'longo' }: { id: string; rotulo: string; valor: string; aoMudar: (v: string) => void; ajuda?: string; multilinha?: boolean; largura?: Largura }) {
  return (
    <Campo id={id} rotulo={rotulo} ajuda={ajuda} largura={largura}>
      {multilinha
        ? <textarea id={id} value={valor} rows={2} onChange={(e) => aoMudar(e.target.value)} />
        : <input id={id} type="text" value={valor} onChange={(e) => aoMudar(e.target.value)} />}
    </Campo>
  );
}

export function CampoNumero({ id, rotulo, valor, aoMudar, largura = 'curto' }: { id: string; rotulo: string; valor: number; aoMudar: (v: number) => void; largura?: Largura }) {
  return (
    <Campo id={id} rotulo={rotulo} largura={largura}>
      <input id={id} type="number" inputMode="numeric" min={0} step={1} value={valor} onChange={(e) => aoMudar(e.target.value === '' ? 0 : Number(e.target.value))} />
    </Campo>
  );
}

export function SelecaoSimNao({ id, rotulo, valor, aoMudar, largura = 'curto' }: { id: string; rotulo: string; valor: SimNao; aoMudar: (v: SimNao) => void; largura?: Largura }) {
  return (
    <Campo id={id} rotulo={rotulo} largura={largura}>
      <select id={id} value={valor} onChange={(e) => aoMudar(e.target.value as SimNao)}>
        <option value="sim">Sim</option>
        <option value="nao">Não</option>
      </select>
    </Campo>
  );
}

export function Botoes({ children }: { children: ReactNode }) {
  return <div className="botoes">{children}</div>;
}
