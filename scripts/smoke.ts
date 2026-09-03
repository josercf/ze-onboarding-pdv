import Ajv from 'ajv';
import { existsSync } from 'node:fs';
import exemploOk from '../shared/fixtures/exemplo-ok.json';
import { schemaObservacaoCompleta, schemaParecerCompleto } from '../shared/schemas/index';

export const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64',
);

export interface ConfigSmoke { base: string; token: string }
export type Logger = (linha: string) => void;

/** Erro com o código de saída do processo que o motivou (contrato: 1 env, 2 HTTP, 3 schema da observação, 4 schema do parecer). */
export class ErroSmoke extends Error {
  codigo: number;
  constructor(codigo: number, mensagem: string) {
    super(mensagem);
    this.codigo = codigo;
    this.name = 'ErroSmoke';
  }
}

export function lerConfig(env: NodeJS.ProcessEnv): ConfigSmoke {
  const base = (env.N8N_BASE_URL ?? '').replace(/\/+$/, '');
  const token = env.N8N_TOKEN ?? '';
  if (!base || !token) throw new ErroSmoke(1, 'Defina N8N_BASE_URL e N8N_TOKEN em .env');
  return { base, token };
}

export function montarFormDataAnalise(png: Buffer = PNG): FormData {
  const fd = new FormData();
  fd.append('arquivo', new Blob([new Uint8Array(png)], { type: 'image/png' }), 'smoke.png');
  fd.append('tipo', 'fachada');
  fd.append('arquivo_id', 'smoke-1');
  fd.append('contexto', JSON.stringify({ cnpj: '11222333000181' }));
  return fd;
}

export function montarPayloadConsolidar(exemplo: typeof exemploOk = exemploOk) {
  return {
    formulario: exemplo.formulario,
    receita: exemplo.receita,
    parametros_regiao: exemplo.parametros,
    observacoes: exemplo.observacoes,
    verificacoes: [
      { id: 1, item: 'CNPJ ativo', declarado: '11.222.333/0001-81', observado: 'Situação cadastral ATIVA', status: 'conforme', evidencia: 'BrasilAPI', critico: true, obrigatorio: true },
    ],
    recomendacao_regras: 'apto',
  };
}

export async function chamar(fetchFn: typeof fetch, cfg: ConfigSmoke, caminho: string, init: RequestInit, log: Logger = console.log): Promise<unknown> {
  const inicio = Date.now();
  const resposta = await fetchFn(`${cfg.base}/webhook/${caminho}`, {
    ...init,
    headers: { ...(init.headers as Record<string, string> | undefined), 'X-Api-Token': cfg.token },
  });
  const texto = await resposta.text();
  log(`${caminho}: HTTP ${resposta.status} em ${Date.now() - inicio} ms`);
  if (!resposta.ok) throw new ErroSmoke(2, texto);
  return JSON.parse(texto);
}

export function validarObservacao(ajv: Ajv, observacao: unknown): void {
  if (!ajv.validate(schemaObservacaoCompleta('fachada'), observacao)) {
    throw new ErroSmoke(3, `Observação fora do schema: ${ajv.errorsText()}`);
  }
}

export function validarParecer(ajv: Ajv, parecer: unknown): void {
  if (!ajv.validate(schemaParecerCompleto(), parecer)) {
    throw new ErroSmoke(4, `Parecer fora do schema: ${ajv.errorsText()}`);
  }
}

function finalizarErro(e: unknown, logErro: Logger): number {
  if (e instanceof ErroSmoke) {
    logErro(e.message);
    return e.codigo;
  }
  throw e;
}

/**
 * Chama analisar-arquivo com um PNG sintético e depois consolidar com o exemplo-ok, validando as
 * duas respostas contra os schemas de shared/schemas. Devolve o código de saída do processo:
 * 0 sucesso, 1 variáveis de ambiente ausentes, 2 HTTP não-2xx, 3 observação fora do schema, 4 parecer fora do schema.
 */
export async function rodarSmoke(fetchFn: typeof fetch, env: NodeJS.ProcessEnv, log: Logger = console.log, logErro: Logger = console.error): Promise<number> {
  try {
    const cfg = lerConfig(env);
    const ajv = new Ajv({ allErrors: true, strict: false });

    const observacao = (await chamar(fetchFn, cfg, 'analisar-arquivo', { method: 'POST', body: montarFormDataAnalise() }, log)) as Record<string, unknown>;
    validarObservacao(ajv, observacao);
    log(`observação ok: ${observacao.resumo}`);

    const parecer = (await chamar(
      fetchFn, cfg, 'consolidar',
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(montarPayloadConsolidar()) },
      log,
    )) as Record<string, unknown>;
    validarParecer(ajv, parecer);
    log(`parecer ok: ${parecer.recomendacao_sugerida}`);

    return 0;
  } catch (e) {
    return finalizarErro(e, logErro);
  }
}

if (process.argv[1]?.endsWith('smoke.ts')) {
  if (existsSync('.env')) process.loadEnvFile('.env');
  rodarSmoke(fetch, process.env).then((codigo) => process.exit(codigo));
}
