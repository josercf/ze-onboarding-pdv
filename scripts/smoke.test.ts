import Ajv from 'ajv';
import { describe, expect, test, vi } from 'vitest';
import {
  CODIGO_FALHA_REDE, CODIGO_HTTP_NAO_OK, CODIGO_OBSERVACAO_INVALIDA, CODIGO_PARECER_INVALIDO,
  ErroSmoke, PNG, chamar, lerConfig, montarFormDataAnalise, montarPayloadConsolidar, rodarSmoke, validarObservacao, validarParecer,
} from './smoke';

const OBSERVACAO_VALIDA = {
  arquivo_id: 'smoke-1', tipo: 'fachada', nome: 'smoke.png', mime: 'image/png',
  modelo: 'google/gemini-2.5-flash', tokens: { entrada: 100, saida: 20 }, latencia_ms: 500,
  aderente_ao_tipo: true, confianca: 0.9, resumo: 'Fachada de loja aberta.',
  qualidade: { nitidez: 'boa', iluminacao: 'boa', observacao: '' },
  dados: { tipo_local: 'loja_aberta', letreiro: 'Smoke', numero_imovel: '1', porta: 'aberta' },
  evidencias: [{ ref: 'centro', descricao: 'fachada visível' }],
  alertas: [],
};

const PARECER_VALIDO = {
  parecer: 'Texto de teste.', pontos_de_atencao: [], recomendacao_sugerida: 'apto', justificativa: 'ok',
  modelo: 'google/gemini-2.5-pro', tokens: { entrada: 500, saida: 80 },
};

const jsonResponse = (status: number, corpo: unknown) => new Response(JSON.stringify(corpo), { status, headers: { 'Content-Type': 'application/json' } });

describe('lerConfig', () => {
  test('lê base e token do ambiente, removendo barras finais da base', () => {
    expect(lerConfig({ N8N_BASE_URL: 'https://n8n.exemplo.com///', N8N_TOKEN: 'tok' })).toEqual({ base: 'https://n8n.exemplo.com', token: 'tok' });
  });
  test('sem N8N_BASE_URL lança ErroSmoke código 1', () => {
    expect(() => lerConfig({ N8N_TOKEN: 'tok' })).toThrow(ErroSmoke);
    try {
      lerConfig({ N8N_TOKEN: 'tok' });
      throw new Error('deveria ter lançado');
    } catch (e) {
      expect((e as ErroSmoke).codigo).toBe(1);
    }
  });
  test('sem N8N_TOKEN lança ErroSmoke com mensagem sobre as duas variáveis', () => {
    expect(() => lerConfig({ N8N_BASE_URL: 'https://n8n.exemplo.com' })).toThrow(/N8N_BASE_URL e N8N_TOKEN/);
  });
});

describe('montarFormDataAnalise', () => {
  test('monta o multipart com tipo fachada, arquivo_id fixo e contexto com o CNPJ do exemplo', () => {
    const fd = montarFormDataAnalise();
    expect(fd.get('tipo')).toBe('fachada');
    expect(fd.get('arquivo_id')).toBe('smoke-1');
    expect(JSON.parse(fd.get('contexto') as string)).toEqual({ cnpj: '11222333000181' });
    const arquivo = fd.get('arquivo') as File;
    expect(arquivo.name).toBe('smoke.png');
    expect(arquivo.type).toBe('image/png');
    expect(arquivo.size).toBe(PNG.length);
  });
});

describe('montarPayloadConsolidar', () => {
  test('usa formulario, receita, parametros e observações do exemplo-ok, com uma verificação e recomendação apto', () => {
    const payload = montarPayloadConsolidar();
    expect(payload.formulario).toMatchObject({ cnpj: '11222333000181' });
    expect(payload.receita).toMatchObject({ cnpj: '11222333000181' });
    expect(payload.parametros_regiao).toEqual({ minRefrigeradores: 4, camaraFriaObrigatoria: false, minEntregadores: 1 });
    expect(payload.observacoes.length).toBeGreaterThan(0);
    expect(payload.verificacoes).toEqual([
      { id: 1, item: 'CNPJ ativo', declarado: '11.222.333/0001-81', observado: 'Situação cadastral ATIVA', status: 'conforme', evidencia: 'BrasilAPI', critico: true, obrigatorio: true },
    ]);
    expect(payload.recomendacao_regras).toBe('apto');
    expect(() => JSON.stringify(payload)).not.toThrow();
  });
});

describe('chamar', () => {
  test('envia X-Api-Token junto dos headers do init, registra a linha HTTP e devolve o JSON', async () => {
    const log = vi.fn();
    const fetchFn = vi.fn(async () => jsonResponse(200, { ok: true }));
    const corpo = await chamar(
      fetchFn as unknown as typeof fetch, { base: 'https://n8n.exemplo.com', token: 'tok' }, 'analisar-arquivo',
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' }, CODIGO_OBSERVACAO_INVALIDA, log,
    );
    expect(corpo).toEqual({ ok: true });
    const [url, init] = fetchFn.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://n8n.exemplo.com/webhook/analisar-arquivo');
    expect((init.headers as Record<string, string>)['X-Api-Token']).toBe('tok');
    expect((init.headers as Record<string, string>)['Content-Type']).toBe('application/json');
    expect(log).toHaveBeenCalledWith(expect.stringMatching(/^analisar-arquivo: HTTP 200 em \d+ ms$/));
  });

  test('resposta não ok loga a linha HTTP e lança ErroSmoke código 2 com o corpo da resposta', async () => {
    const log = vi.fn();
    const fetchFn = vi.fn(async () => jsonResponse(401, { erro: { codigo: 'auth', mensagem: 'sem token' } }));
    const promessa = chamar(fetchFn as unknown as typeof fetch, { base: 'https://n8n.exemplo.com', token: 'tok' }, 'consolidar', { method: 'POST' }, CODIGO_PARECER_INVALIDO, log);
    await expect(promessa).rejects.toThrow(ErroSmoke);
    expect(log).toHaveBeenCalledWith(expect.stringMatching(/^consolidar: HTTP 401 em \d+ ms$/));
  });

  test('resposta não ok com corpo maior que 300 caracteres trunca a mensagem em 300 caracteres', async () => {
    const log = vi.fn();
    const corpoLongo = 'erro interno '.repeat(30);
    const fetchFn = vi.fn(async () => new Response(corpoLongo, { status: 500 }));
    try {
      await chamar(fetchFn as unknown as typeof fetch, { base: 'https://n8n.exemplo.com', token: 'tok' }, 'analisar-arquivo', { method: 'POST' }, CODIGO_OBSERVACAO_INVALIDA, log);
      throw new Error('deveria ter lançado');
    } catch (e) {
      expect((e as ErroSmoke).codigo).toBe(CODIGO_HTTP_NAO_OK);
      expect((e as ErroSmoke).message).toBe(corpoLongo.slice(0, 300));
      expect((e as ErroSmoke).message).toHaveLength(300);
    }
  });

  test('resposta não ok com corpo HTML substitui a mensagem por aviso de página de erro do proxy', async () => {
    const log = vi.fn();
    const corpoHtml = '<html><head><title>502 Bad Gateway</title></head><body>cloudflare</body></html>';
    const fetchFn = vi.fn(async () => new Response(corpoHtml, { status: 502 }));
    try {
      await chamar(fetchFn as unknown as typeof fetch, { base: 'https://n8n.exemplo.com', token: 'tok' }, 'analisar-arquivo', { method: 'POST' }, CODIGO_OBSERVACAO_INVALIDA, log);
      throw new Error('deveria ter lançado');
    } catch (e) {
      expect((e as ErroSmoke).codigo).toBe(CODIGO_HTTP_NAO_OK);
      expect((e as ErroSmoke).message).toBe('corpo HTML (provavelmente página de erro do proxy)');
    }
  });

  test('fetchFn rejeitando (falha de rede) não loga nada e lança ErroSmoke com o código de falha de rede e a URL na mensagem', async () => {
    const log = vi.fn();
    const fetchFn = vi.fn(async () => { throw new Error('ECONNREFUSED'); });
    try {
      await chamar(fetchFn as unknown as typeof fetch, { base: 'https://n8n.exemplo.com', token: 'tok' }, 'analisar-arquivo', { method: 'POST' }, CODIGO_OBSERVACAO_INVALIDA, log);
      throw new Error('deveria ter lançado');
    } catch (e) {
      expect((e as ErroSmoke).codigo).toBe(CODIGO_FALHA_REDE);
      expect((e as ErroSmoke).message).toContain('https://n8n.exemplo.com/webhook/analisar-arquivo');
      expect((e as ErroSmoke).message).toContain('ECONNREFUSED');
    }
    expect(log).not.toHaveBeenCalled();
  });

  test('corpo 2xx que não é JSON válido loga a linha HTTP e lança ErroSmoke com o código informado em codigoCorpoInvalido', async () => {
    const log = vi.fn();
    const fetchFn = vi.fn(async () => new Response('<html>erro</html>', { status: 200 }));
    try {
      await chamar(fetchFn as unknown as typeof fetch, { base: 'https://n8n.exemplo.com', token: 'tok' }, 'consolidar', { method: 'POST' }, CODIGO_PARECER_INVALIDO, log);
      throw new Error('deveria ter lançado');
    } catch (e) {
      expect((e as ErroSmoke).codigo).toBe(CODIGO_PARECER_INVALIDO);
      expect((e as ErroSmoke).message).toContain('não é JSON válido');
    }
    expect(log).toHaveBeenCalledWith(expect.stringMatching(/^consolidar: HTTP 200 em \d+ ms$/));
  });
});

describe('validarObservacao', () => {
  const ajv = new Ajv({ allErrors: true, strict: false });
  test('observação válida não lança', () => expect(() => validarObservacao(ajv, OBSERVACAO_VALIDA)).not.toThrow());
  test('observação sem resumo lança ErroSmoke código 3', () => {
    const { resumo: _resumo, ...semResumo } = OBSERVACAO_VALIDA;
    try {
      validarObservacao(ajv, semResumo);
      throw new Error('deveria ter lançado');
    } catch (e) {
      expect((e as ErroSmoke).codigo).toBe(3);
      expect((e as ErroSmoke).message).toContain('Observação fora do schema');
    }
  });
});

describe('validarParecer', () => {
  const ajv = new Ajv({ allErrors: true, strict: false });
  test('parecer válido não lança', () => expect(() => validarParecer(ajv, PARECER_VALIDO)).not.toThrow());
  test('recomendação fora do enum lança ErroSmoke código 4', () => {
    try {
      validarParecer(ajv, { ...PARECER_VALIDO, recomendacao_sugerida: 'talvez' });
      throw new Error('deveria ter lançado');
    } catch (e) {
      expect((e as ErroSmoke).codigo).toBe(4);
      expect((e as ErroSmoke).message).toContain('Parecer fora do schema');
    }
  });
});

describe('rodarSmoke', () => {
  const env = { N8N_BASE_URL: 'https://n8n.exemplo.com', N8N_TOKEN: 'tok' };

  test('dois HTTP 200 válidos: código 0 e as quatro linhas esperadas, nesta ordem', async () => {
    const log = vi.fn();
    const fetchFn = vi.fn().mockResolvedValueOnce(jsonResponse(200, OBSERVACAO_VALIDA)).mockResolvedValueOnce(jsonResponse(200, PARECER_VALIDO));
    const codigo = await rodarSmoke(fetchFn as unknown as typeof fetch, env, log);
    expect(codigo).toBe(0);
    expect(fetchFn).toHaveBeenCalledTimes(2);
    expect(log.mock.calls.map((c) => c[0])).toEqual([
      expect.stringMatching(/^analisar-arquivo: HTTP 200 em \d+ ms$/),
      'observação ok: Fachada de loja aberta.',
      expect.stringMatching(/^consolidar: HTTP 200 em \d+ ms$/),
      'parecer ok: apto',
    ]);
  });

  test('sem variáveis de ambiente: código 1, sem chamar fetch', async () => {
    const logErro = vi.fn();
    const fetchFn = vi.fn();
    const codigo = await rodarSmoke(fetchFn as unknown as typeof fetch, {}, vi.fn(), logErro);
    expect(codigo).toBe(1);
    expect(fetchFn).not.toHaveBeenCalled();
    expect(logErro).toHaveBeenCalledWith(expect.stringMatching(/N8N_BASE_URL e N8N_TOKEN/));
  });

  test('primeira chamada com HTTP não ok: código 2 e consolidar não é chamado', async () => {
    const fetchFn = vi.fn().mockResolvedValueOnce(jsonResponse(401, { erro: 'sem token' }));
    const codigo = await rodarSmoke(fetchFn as unknown as typeof fetch, env, vi.fn(), vi.fn());
    expect(codigo).toBe(2);
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  test('observação fora do schema: código 3 e consolidar não é chamado', async () => {
    const { resumo: _resumo, ...semResumo } = OBSERVACAO_VALIDA;
    const fetchFn = vi.fn().mockResolvedValueOnce(jsonResponse(200, semResumo));
    const codigo = await rodarSmoke(fetchFn as unknown as typeof fetch, env, vi.fn(), vi.fn());
    expect(codigo).toBe(3);
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  test('parecer fora do schema: código 4', async () => {
    const fetchFn = vi.fn().mockResolvedValueOnce(jsonResponse(200, OBSERVACAO_VALIDA)).mockResolvedValueOnce(jsonResponse(200, { ...PARECER_VALIDO, recomendacao_sugerida: 'talvez' }));
    const codigo = await rodarSmoke(fetchFn as unknown as typeof fetch, env, vi.fn(), vi.fn());
    expect(codigo).toBe(4);
    expect(fetchFn).toHaveBeenCalledTimes(2);
  });

  test('falha de rede na primeira chamada: código de falha de rede, mensagem com a causa, e consolidar não é chamado', async () => {
    const fetchFn = vi.fn().mockRejectedValueOnce(new Error('ECONNREFUSED'));
    const logErro = vi.fn();
    const codigo = await rodarSmoke(fetchFn as unknown as typeof fetch, env, vi.fn(), logErro);
    expect(codigo).toBe(CODIGO_FALHA_REDE);
    expect(fetchFn).toHaveBeenCalledTimes(1);
    expect(logErro).toHaveBeenCalledWith(expect.stringContaining('ECONNREFUSED'));
  });

  test('corpo 2xx inválido (não é JSON) na chamada de analisar-arquivo: código 3 e consolidar não é chamado', async () => {
    const fetchFn = vi.fn().mockResolvedValueOnce(new Response('<html>erro</html>', { status: 200 }));
    const codigo = await rodarSmoke(fetchFn as unknown as typeof fetch, env, vi.fn(), vi.fn());
    expect(codigo).toBe(CODIGO_OBSERVACAO_INVALIDA);
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  test('corpo 2xx inválido (não é JSON) na chamada de consolidar: código 4', async () => {
    const fetchFn = vi.fn().mockResolvedValueOnce(jsonResponse(200, OBSERVACAO_VALIDA)).mockResolvedValueOnce(new Response('<html>erro</html>', { status: 200 }));
    const codigo = await rodarSmoke(fetchFn as unknown as typeof fetch, env, vi.fn(), vi.fn());
    expect(codigo).toBe(CODIGO_PARECER_INVALIDO);
    expect(fetchFn).toHaveBeenCalledTimes(2);
  });
});
