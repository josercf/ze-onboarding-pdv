import { limites } from '@shared/config/index';
import type { Contexto, Formulario, Observacao, Parecer, ParametrosRegiao, Receita, Recomendacao, TipoAnexo, Verificacao } from '../tipos';

export type CodigoErroApi = 'auth' | 'entrada' | 'payload' | 'servidor' | 'tempo' | 'rede';

export class ErroApi extends Error {
  codigo: CodigoErroApi;
  mensagem: string;
  status?: number;

  constructor(codigo: CodigoErroApi, mensagem: string, status?: number) {
    super(mensagem);
    this.codigo = codigo;
    this.mensagem = mensagem;
    this.status = status;
    this.name = 'ErroApi';
  }
}

export interface ParamsAnalisar { arquivo: Blob; nome: string; tipo: TipoAnexo; arquivoId: string; contexto: Contexto }
export interface PayloadConsolidar {
  formulario: Formulario; receita: Receita | null; parametros_regiao: ParametrosRegiao;
  observacoes: Observacao[]; verificacoes: Verificacao[]; recomendacao_regras: Recomendacao;
}
export interface ClienteN8n {
  analisarArquivo(p: ParamsAnalisar, sinal?: AbortSignal): Promise<Observacao>;
  consolidar(p: PayloadConsolidar, sinal?: AbortSignal): Promise<Parecer>;
}
export interface ConfigCliente {
  baseUrl: string; token: string; fetchFn?: typeof fetch; timeoutMs?: number; esperaRetryMs?: number; dormir?: (ms: number) => Promise<void>;
}

const RETENTAVEIS: CodigoErroApi[] = ['servidor', 'tempo', 'rede'];

export function mapearStatus(status: number): CodigoErroApi {
  if (status === 401 || status === 403) return 'auth';
  if (status === 400) return 'entrada';
  if (status === 413) return 'payload';
  if (status === 504 || status === 524) return 'tempo';
  return 'servidor';
}

export function montarContexto(f: Formulario, r: Receita | null): Contexto {
  return { cnpj: f.cnpj, razao_social: r?.razaoSocial ?? '', codigo_parceiro_declarado: f.codigoParceiro, qtd_refrigeradores_declarada: f.qtdRefrigeradores, camara_fria_declarada: f.camaraFria };
}

export function criarClienteN8n(cfg: ConfigCliente): ClienteN8n {
  const fetchFn = cfg.fetchFn ?? fetch;
  const timeoutMs = cfg.timeoutMs ?? limites.timeoutFetchMs;
  const espera = cfg.esperaRetryMs ?? limites.esperaRetryMs;
  const dormir = cfg.dormir ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  const base = cfg.baseUrl.replace(/\/+$/, '');

  async function chamar<T>(caminho: string, init: RequestInit, sinal?: AbortSignal): Promise<T> {
    const controlador = new AbortController();
    const timer = setTimeout(() => controlador.abort(), timeoutMs);
    const cancelar = () => controlador.abort();
    sinal?.addEventListener('abort', cancelar);
    try {
      let resposta: Response;
      try {
        resposta = await fetchFn(`${base}/webhook/${caminho}`, { ...init, headers: { ...(init.headers as Record<string, string> | undefined), 'X-Api-Token': cfg.token }, signal: controlador.signal });
      } catch (e) {
        if ((e as Error).name === 'AbortError') throw new ErroApi('tempo', sinal?.aborted ? 'Chamada cancelada' : `Sem resposta em ${Math.round(timeoutMs / 1000)} s`);
        throw new ErroApi('rede', 'Falha de rede ao chamar o serviço de análise');
      }
      if (!resposta.ok) {
        let mensagem = `O serviço respondeu HTTP ${resposta.status}`;
        try { mensagem = (await resposta.json())?.erro?.mensagem ?? mensagem; } catch { /* corpo sem JSON */ }
        throw new ErroApi(mapearStatus(resposta.status), mensagem, resposta.status);
      }
      return (await resposta.json()) as T;
    } finally {
      clearTimeout(timer);
      sinal?.removeEventListener('abort', cancelar);
    }
  }

  async function comRetry<T>(fn: () => Promise<T>, sinal?: AbortSignal): Promise<T> {
    try {
      return await fn();
    } catch (e) {
      if (e instanceof ErroApi && RETENTAVEIS.includes(e.codigo) && !sinal?.aborted) {
        await dormir(espera);
        return fn();
      }
      throw e;
    }
  }

  return {
    analisarArquivo(p, sinal) {
      const corpo = () => {
        const fd = new FormData();
        fd.append('arquivo', p.arquivo, p.nome);
        fd.append('tipo', p.tipo);
        fd.append('arquivo_id', p.arquivoId);
        fd.append('contexto', JSON.stringify(p.contexto));
        return fd;
      };
      return comRetry(() => chamar<Observacao>('analisar-arquivo', { method: 'POST', body: corpo() }, sinal), sinal);
    },
    consolidar(p, sinal) {
      return comRetry(() => chamar<Parecer>('consolidar', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(p) }, sinal), sinal);
    },
  };
}
