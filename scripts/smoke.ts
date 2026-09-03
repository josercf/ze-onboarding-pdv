import Ajv from 'ajv';
import { existsSync } from 'node:fs';
import exemploOk from '../shared/fixtures/exemplo-ok.json';
import { schemaObservacaoCompleta, schemaParecerCompleto } from '../shared/schemas/index';

/**
 * Códigos de saída do processo (contrato de `pnpm smoke`). `rodarSmoke` só devolve 0 a 5; o código
 * 6 só é usado pelo `.catch` do ponto de entrada de CLI, no fim deste arquivo, como último recurso
 * para um erro que não seja `ErroSmoke` (rodarSmoke relança esses erros em vez de convertê-los).
 *   0 sucesso: os dois webhooks responderam 2xx com corpo JSON válido no schema esperado.
 *   1 N8N_BASE_URL ou N8N_TOKEN ausentes em .env/ambiente (lerConfig).
 *   2 uma das duas chamadas devolveu HTTP não-2xx; a mensagem é o corpo bruto da resposta (chamar).
 *   3 resposta de analisar-arquivo com HTTP 2xx mas corpo não é JSON válido, ou a observação não
 *     passa no schema de shared/schemas (chamar / validarObservacao).
 *   4 mesma situação que o código 3, mas na resposta de consolidar (chamar / validarParecer).
 *   5 falha de rede: fetchFn rejeitou antes de haver qualquer resposta HTTP (DNS, conexão
 *     recusada, timeout de baixo nível), em qualquer uma das duas chamadas (chamar).
 *   6 erro inesperado, não classificado nos códigos acima (só no ponto de entrada de CLI).
 */
export const CODIGO_ENV_AUSENTE = 1;
export const CODIGO_HTTP_NAO_OK = 2;
export const CODIGO_OBSERVACAO_INVALIDA = 3;
export const CODIGO_PARECER_INVALIDO = 4;
export const CODIGO_FALHA_REDE = 5;
export const CODIGO_ERRO_INESPERADO = 6;

export const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64',
);

export interface ConfigSmoke { base: string; token: string }
export type Logger = (linha: string) => void;

/** Erro com o código de saída do processo que o motivou. Ver a tabela de códigos no topo do arquivo. */
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
  if (!base || !token) throw new ErroSmoke(CODIGO_ENV_AUSENTE, 'Defina N8N_BASE_URL e N8N_TOKEN em .env');
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

/**
 * Chama um webhook e devolve o corpo já parseado como JSON. `codigoCorpoInvalido` é o código de
 * saída usado quando a resposta é 2xx mas o corpo não é JSON válido (3 para analisar-arquivo, 4
 * para consolidar na chamada de rodarSmoke) - falha de rede (sem resposta) sempre usa
 * CODIGO_FALHA_REDE, e HTTP não-2xx sempre usa CODIGO_HTTP_NAO_OK, independente do chamador.
 */
export async function chamar(
  fetchFn: typeof fetch, cfg: ConfigSmoke, caminho: string, init: RequestInit, codigoCorpoInvalido: number, log: Logger = console.log,
): Promise<unknown> {
  const url = `${cfg.base}/webhook/${caminho}`;
  const inicio = Date.now();
  let resposta: Response;
  try {
    resposta = await fetchFn(url, {
      ...init,
      headers: { ...(init.headers as Record<string, string> | undefined), 'X-Api-Token': cfg.token },
    });
  } catch (e) {
    const causa = e instanceof Error ? e.message : String(e);
    throw new ErroSmoke(CODIGO_FALHA_REDE, `Falha de rede ao chamar ${url}: ${causa}`);
  }
  const texto = await resposta.text();
  log(`${caminho}: HTTP ${resposta.status} em ${Date.now() - inicio} ms`);
  if (!resposta.ok) throw new ErroSmoke(CODIGO_HTTP_NAO_OK, texto);
  try {
    return JSON.parse(texto);
  } catch {
    throw new ErroSmoke(codigoCorpoInvalido, `Corpo de ${caminho} (HTTP ${resposta.status}) não é JSON válido: ${texto.slice(0, 300)}`);
  }
}

export function validarObservacao(ajv: Ajv, observacao: unknown): void {
  if (!ajv.validate(schemaObservacaoCompleta('fachada'), observacao)) {
    throw new ErroSmoke(CODIGO_OBSERVACAO_INVALIDA, `Observação fora do schema: ${ajv.errorsText()}`);
  }
}

export function validarParecer(ajv: Ajv, parecer: unknown): void {
  if (!ajv.validate(schemaParecerCompleto(), parecer)) {
    throw new ErroSmoke(CODIGO_PARECER_INVALIDO, `Parecer fora do schema: ${ajv.errorsText()}`);
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
 * duas respostas contra os schemas de shared/schemas. Devolve o código de saída do processo (0 a
 * 5; ver a tabela no topo do arquivo). Qualquer erro que não seja ErroSmoke é relançado (a promise
 * rejeita); só o ponto de entrada de CLI abaixo trata isso, com o código 6.
 */
export async function rodarSmoke(fetchFn: typeof fetch, env: NodeJS.ProcessEnv, log: Logger = console.log, logErro: Logger = console.error): Promise<number> {
  try {
    const cfg = lerConfig(env);
    const ajv = new Ajv({ allErrors: true, strict: false });

    const observacao = (await chamar(fetchFn, cfg, 'analisar-arquivo', { method: 'POST', body: montarFormDataAnalise() }, CODIGO_OBSERVACAO_INVALIDA, log)) as Record<string, unknown>;
    validarObservacao(ajv, observacao);
    log(`observação ok: ${observacao.resumo}`);

    const parecer = (await chamar(
      fetchFn, cfg, 'consolidar',
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(montarPayloadConsolidar()) },
      CODIGO_PARECER_INVALIDO, log,
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
  rodarSmoke(fetch, process.env)
    .then((codigo) => process.exit(codigo))
    .catch((e: unknown) => {
      console.error(`Erro inesperado: ${e instanceof Error ? e.message : String(e)}`);
      process.exit(CODIGO_ERRO_INESPERADO);
    });
}
