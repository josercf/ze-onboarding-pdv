import { describe, expect, test, vi } from 'vitest';
import type { Observacao } from '../tipos';
import { executarFila, type ItemFila } from './filaAnalise';

const arquivo = new File(['x'], 'a.jpeg', { type: 'image/jpeg' });
const item = (id: string, estado: ItemFila['estado'] = 'na_fila'): ItemFila => ({ arquivoId: id, arquivo, nome: `${id}.jpeg`, tipo: 'fachada', estado });
const obs = (id: string) => ({ arquivo_id: id }) as unknown as Observacao;

function controlavel() {
  const pendentes = new Map<string, { resolve: (v: Observacao) => void; reject: (e: Error) => void }>();
  const analisar = vi.fn((i: ItemFila) => new Promise<Observacao>((resolve, reject) => pendentes.set(i.arquivoId, { resolve, reject })));
  return { analisar, pendentes };
}

describe('executarFila', () => {
  test('mantém no máximo 2 análises simultâneas e a ordem de entrada', async () => {
    const { analisar, pendentes } = controlavel();
    const itens = ['a', 'b', 'c', 'd'].map((id) => item(id));
    const execucao = executarFila(itens, analisar);
    expect(analisar).toHaveBeenCalledTimes(2);
    expect(itens.map((i) => i.estado)).toEqual(['analisando', 'analisando', 'na_fila', 'na_fila']);
    pendentes.get('a')!.resolve(obs('a'));
    await vi.waitFor(() => expect(analisar).toHaveBeenCalledTimes(3));
    pendentes.get('b')!.resolve(obs('b'));
    await vi.waitFor(() => expect(analisar).toHaveBeenCalledTimes(4));
    pendentes.get('c')!.resolve(obs('c'));
    pendentes.get('d')!.resolve(obs('d'));
    const resultado = await execucao;
    expect(resultado.map((i) => i.estado)).toEqual(['concluido', 'concluido', 'concluido', 'concluido']);
    expect(analisar.mock.calls.map(([i]) => i.arquivoId)).toEqual(['a', 'b', 'c', 'd']);
    expect(resultado[0].observacao).toEqual(obs('a'));
  });

  test('falha em um item não interrompe os demais e registra a mensagem', async () => {
    const aoMudar = vi.fn();
    const analisar = vi.fn(async (i: ItemFila) => { if (i.arquivoId === 'b') throw new Error('Falha simulada'); return obs(i.arquivoId); });
    const itens = ['a', 'b', 'c'].map((id) => item(id));
    await executarFila(itens, analisar, { aoMudar });
    expect(itens.map((i) => i.estado)).toEqual(['concluido', 'falhou', 'concluido']);
    expect(itens[1].erro).toBe('Falha simulada');
    expect(aoMudar.mock.calls.filter(([i]) => i.arquivoId === 'b').map(([i]) => i.estado)).toEqual(['analisando', 'falhou']);
  });

  test('reexecução só processa itens na fila ou com falha', async () => {
    const analisar = vi.fn(async (i: ItemFila) => obs(i.arquivoId));
    const itens = [item('a', 'concluido'), item('b', 'falhou'), item('c', 'na_fila')];
    itens[0].observacao = obs('a');
    await executarFila(itens, analisar);
    expect(analisar.mock.calls.map(([i]) => i.arquivoId)).toEqual(['b', 'c']);
    expect(itens.every((i) => i.estado === 'concluido')).toBe(true);
  });

  test('concorrência configurável', async () => {
    const { analisar, pendentes } = controlavel();
    const itens = ['a', 'b', 'c'].map((id) => item(id));
    const execucao = executarFila(itens, analisar, { concorrencia: 1 });
    expect(analisar).toHaveBeenCalledTimes(1);
    for (const id of ['a', 'b', 'c']) { await vi.waitFor(() => expect(pendentes.has(id)).toBe(true)); pendentes.get(id)!.resolve(obs(id)); }
    await execucao;
  });
});
