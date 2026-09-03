import { describe, expect, test, vi } from 'vitest';
import type { Contexto } from '../tipos';
import { ErroApi, criarClienteN8n, mapearStatus } from './clienteN8n';

const contexto: Contexto = { cnpj: '11222333000181', razao_social: 'EXEMPLO LTDA', codigo_parceiro_declarado: '0011223', qtd_refrigeradores_declarada: 6, camara_fria_declarada: 'sim' };
const observacao = { arquivo_id: 'a1', tipo: 'fachada', resumo: 'ok' };
const json = (status: number, corpo: unknown) => new Response(JSON.stringify(corpo), { status, headers: { 'Content-Type': 'application/json' } });
const dormir = vi.fn(async () => {});

function cliente(fetchFn: unknown, extra = {}) {
  return criarClienteN8n({ baseUrl: 'https://n8n.exemplo.com/', token: 'tok', fetchFn: fetchFn as typeof fetch, dormir, ...extra });
}
const params = () => ({ arquivo: new Blob(['x'], { type: 'image/jpeg' }), nome: 'fachada.jpeg', tipo: 'fachada' as const, arquivoId: 'a1', contexto });

describe('analisarArquivo', () => {
  test('envia multipart com token e devolve a observação', async () => {
    const fetchFn = vi.fn(async () => json(200, observacao));
    const r = await cliente(fetchFn).analisarArquivo(params());
    expect(r).toEqual(observacao);
    const [url, init] = fetchFn.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://n8n.exemplo.com/webhook/analisar-arquivo');
    expect((init.headers as Record<string, string>)['X-Api-Token']).toBe('tok');
    const fd = init.body as FormData;
    expect(fd.get('tipo')).toBe('fachada');
    expect(fd.get('arquivo_id')).toBe('a1');
    expect(JSON.parse(fd.get('contexto') as string)).toEqual(contexto);
    expect((fd.get('arquivo') as File).name).toBe('fachada.jpeg');
  });
  test('502 é repetido uma vez após a espera e depois devolve', async () => {
    dormir.mockClear();
    const fetchFn = vi.fn().mockResolvedValueOnce(json(502, { erro: { codigo: 'modelo', mensagem: 'OpenRouter falhou' } })).mockResolvedValueOnce(json(200, observacao));
    await expect(cliente(fetchFn).analisarArquivo(params())).resolves.toEqual(observacao);
    expect(fetchFn).toHaveBeenCalledTimes(2);
    expect(dormir).toHaveBeenCalledWith(3000);
  });
  test('400 não é repetido e traz a mensagem do corpo', async () => {
    const fetchFn = vi.fn(async () => json(400, { erro: { codigo: 'tipo_invalido', mensagem: 'Tipo não reconhecido' } }));
    const erro = await cliente(fetchFn).analisarArquivo(params()).catch((e) => e);
    expect(erro).toBeInstanceOf(ErroApi);
    expect(erro).toMatchObject({ codigo: 'entrada', mensagem: 'Tipo não reconhecido', status: 400 });
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });
  test('401 vira auth, 413 vira payload, 504 vira tempo (repetido uma vez)', async () => {
    await expect(cliente(vi.fn(async () => json(401, {}))).analisarArquivo(params())).rejects.toMatchObject({ codigo: 'auth' });
    await expect(cliente(vi.fn(async () => json(413, {}))).analisarArquivo(params())).rejects.toMatchObject({ codigo: 'payload' });
    const f504 = vi.fn(async () => json(504, {}));
    await expect(cliente(f504).analisarArquivo(params())).rejects.toMatchObject({ codigo: 'tempo' });
    expect(f504).toHaveBeenCalledTimes(2);
  });
  test('falha de rede vira rede e é repetida', async () => {
    const fetchFn = vi.fn(async () => { throw new TypeError('Failed to fetch'); });
    await expect(cliente(fetchFn).analisarArquivo(params())).rejects.toMatchObject({ codigo: 'rede' });
    expect(fetchFn).toHaveBeenCalledTimes(2);
  });
  test('sem resposta dentro do timeout vira tempo', async () => {
    const fetchFn = vi.fn((_url: string, init: RequestInit) => new Promise((_, rej) => init.signal!.addEventListener('abort', () => rej(Object.assign(new Error('abortado'), { name: 'AbortError' })))));
    await expect(cliente(fetchFn, { timeoutMs: 5 }).analisarArquivo(params())).rejects.toMatchObject({ codigo: 'tempo' });
  });
  test('2xx com corpo inválido rejeita com ErroApi código servidor', async () => {
    const fetchFn = vi.fn(async () => new Response('não é json', { status: 200 }));
    const erro = await cliente(fetchFn).analisarArquivo(params()).catch((e) => e);
    expect(erro).toBeInstanceOf(ErroApi);
    expect(erro).toMatchObject({ codigo: 'servidor', mensagem: 'Resposta inválida do serviço' });
    expect(fetchFn).toHaveBeenCalledTimes(2);
  });
  test('cancelamento durante a espera do retry não dispara a segunda chamada', async () => {
    const controlador = new AbortController();
    const fetchFn = vi.fn(async () => json(502, { erro: { codigo: 'modelo', mensagem: 'Erro temporário' } }));
    const dormir_mock = vi.fn(async () => {
      controlador.abort();
    });
    await expect(cliente(fetchFn, { dormir: dormir_mock }).analisarArquivo(params(), controlador.signal)).rejects.toMatchObject({ codigo: 'servidor' });
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });
});

describe('consolidar', () => {
  test('envia JSON e devolve o parecer', async () => {
    const parecer = { parecer: 'x', pontos_de_atencao: [], recomendacao_sugerida: 'apto', justificativa: 'y', modelo: 'm', tokens: { entrada: 1, saida: 1 } };
    const fetchFn = vi.fn(async () => json(200, parecer));
    const payload = { formulario: {}, receita: null, parametros_regiao: {}, observacoes: [], verificacoes: [], recomendacao_regras: 'apto' } as never;
    await expect(cliente(fetchFn).consolidar(payload)).resolves.toEqual(parecer);
    const [url, init] = fetchFn.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://n8n.exemplo.com/webhook/consolidar');
    expect((init.headers as Record<string, string>)['Content-Type']).toBe('application/json');
    expect(JSON.parse(init.body as string).recomendacao_regras).toBe('apto');
  });
});

test('mapearStatus', () => {
  expect([400, 401, 403, 413, 500, 502, 504, 524].map(mapearStatus)).toEqual(['entrada', 'auth', 'auth', 'payload', 'servidor', 'servidor', 'tempo', 'tempo']);
});
