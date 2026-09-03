import { describe, expect, test, vi } from 'vitest';
import { ErroApi } from '../api/clienteN8n';
import type { RespostaClassificacao } from '../tipos';
import { executarFilaClassificacao, type ItemClassificacao } from './filaClassificacao';

const arquivo = new File(['x'], 'a.jpeg', { type: 'image/jpeg' });
const item = (id: string, estado: ItemClassificacao['estado'] = 'pendente'): ItemClassificacao => ({ arquivoId: id, arquivo, nome: `${id}.jpeg`, estado });
const resultado = (id: string): RespostaClassificacao => ({ arquivo_id: id, nome: `${id}.jpeg`, mime: 'image/jpeg', tipo_detectado: 'fachada', confianca: 0.9, motivo: 'teste', modelo: 'm', tokens: { entrada: 1, saida: 1 }, latencia_ms: 1 });

function controlavel() {
  const pendentes = new Map<string, { resolve: (v: RespostaClassificacao) => void; reject: (e: Error) => void }>();
  const classificar = vi.fn((i: ItemClassificacao) => new Promise<RespostaClassificacao>((resolve, reject) => pendentes.set(i.arquivoId, { resolve, reject })));
  return { classificar, pendentes };
}

describe('executarFilaClassificacao', () => {
  test('mantém no máximo 2 classificações simultâneas, na ordem de entrada, e notifica cada transição', async () => {
    const { classificar, pendentes } = controlavel();
    const itens = ['a', 'b', 'c'].map((id) => item(id));
    const aoMudar = vi.fn();
    const execucao = executarFilaClassificacao(itens, classificar, { aoMudar });
    expect(classificar).toHaveBeenCalledTimes(2);
    expect(itens.map((i) => i.estado)).toEqual(['classificando', 'classificando', 'pendente']);
    pendentes.get('a')!.resolve(resultado('a'));
    await vi.waitFor(() => expect(classificar).toHaveBeenCalledTimes(3));
    pendentes.get('b')!.resolve(resultado('b'));
    pendentes.get('c')!.resolve(resultado('c'));
    const final = await execucao;
    expect(final.map((i) => i.estado)).toEqual(['concluida', 'concluida', 'concluida']);
    expect(final[0].resultado).toEqual(resultado('a'));
    expect(aoMudar).toHaveBeenCalledTimes(6);
    expect(aoMudar.mock.calls[0][0]).toMatchObject({ arquivoId: 'a', estado: 'classificando' });
  });
  test('falha registra mensagem e código do ErroApi sem interromper os demais', async () => {
    const classificar = vi.fn(async (i: ItemClassificacao) => { if (i.arquivoId === 'a') throw new ErroApi('auth', 'token inválido', 401); return resultado(i.arquivoId); });
    const final = await executarFilaClassificacao([item('a'), item('b')], classificar);
    expect(final[0]).toMatchObject({ estado: 'falhou', erro: 'token inválido', erroCodigo: 'auth' });
    expect(final[1].estado).toBe('concluida');
  });
  test('reexecução processa só pendentes e falhos', async () => {
    const classificar = vi.fn(async (i: ItemClassificacao) => resultado(i.arquivoId));
    await executarFilaClassificacao([item('a', 'concluida'), item('b', 'falhou'), item('c')], classificar);
    expect(classificar.mock.calls.map(([i]) => i.arquivoId)).toEqual(['b', 'c']);
  });
});
