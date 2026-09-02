// web/src/ui/componentes.tsx
import type { ReactNode } from 'react';
import type { SimNao } from '../tipos';

export function Campo({ id, rotulo, ajuda, children }: { id: string; rotulo: string; ajuda?: string; children: ReactNode }) {
  return (
    <div className="campo">
      <label htmlFor={id}>{rotulo}</label>
      {children}
      {ajuda && <small id={`${id}-ajuda`}>{ajuda}</small>}
    </div>
  );
}

export function CampoTexto({ id, rotulo, valor, aoMudar, ajuda, multilinha = false }: { id: string; rotulo: string; valor: string; aoMudar: (v: string) => void; ajuda?: string; multilinha?: boolean }) {
  return (
    <Campo id={id} rotulo={rotulo} ajuda={ajuda}>
      {multilinha
        ? <textarea id={id} value={valor} rows={2} onChange={(e) => aoMudar(e.target.value)} />
        : <input id={id} type="text" value={valor} onChange={(e) => aoMudar(e.target.value)} />}
    </Campo>
  );
}

export function CampoNumero({ id, rotulo, valor, aoMudar }: { id: string; rotulo: string; valor: number; aoMudar: (v: number) => void }) {
  return (
    <Campo id={id} rotulo={rotulo}>
      <input id={id} type="number" inputMode="numeric" min={0} step={1} value={valor} onChange={(e) => aoMudar(e.target.value === '' ? 0 : Number(e.target.value))} />
    </Campo>
  );
}

export function SelecaoSimNao({ id, rotulo, valor, aoMudar }: { id: string; rotulo: string; valor: SimNao; aoMudar: (v: SimNao) => void }) {
  return (
    <Campo id={id} rotulo={rotulo}>
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
