import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { carregarRecursos, type Recursos } from '../n8n/recursos';

interface No { lib: string; wrapper: string }

const NOS: Record<string, No> = {
  'validar-entrada': {
    lib: 'validar-entrada',
    wrapper: `const item = $input.first();
const binario = item.binary ? (item.binary.arquivo || Object.values(item.binary)[0]) : undefined;
return [{ json: validarEntrada({ body: item.json.body, base64: item.json.arquivo_base64, binario }, RECURSOS) }];`,
  },
  'montar-requisicao': {
    lib: 'montar-requisicao',
    wrapper: `const cfg = $('Config').first().json;
if (cfg.modelo_analise) RECURSOS.modelos.analise = cfg.modelo_analise;
return [{ json: montarRequisicao($input.first().json.entrada, RECURSOS) }];`,
  },
  'validar-saida': {
    lib: 'validar-saida',
    wrapper: `const entrada = $('validar-entrada').first().json.entrada;
return [{ json: validarObservacao($input.first().json, entrada, RECURSOS) }];`,
  },
  'montar-prompt-parecer': {
    lib: 'montar-prompt-parecer',
    wrapper: `const cfg = $('Config').first().json;
if (cfg.modelo_parecer) RECURSOS.modelos.parecer = cfg.modelo_parecer;
return [{ json: montarPromptParecer($input.first().json.body, RECURSOS) }];`,
  },
  'validar-parecer': {
    lib: 'validar-saida',
    wrapper: `return [{ json: validarParecer($input.first().json, RECURSOS) }];`,
  },
  'validar-entrada-classificacao': {
    lib: 'validar-entrada',
    wrapper: `const item = $input.first();
const binario = item.binary ? (item.binary.arquivo || Object.values(item.binary)[0]) : undefined;
return [{ json: validarEntradaClassificacao({ body: item.json.body, base64: item.json.arquivo_base64, binario }, RECURSOS) }];`,
  },
  'montar-requisicao-classificacao': {
    lib: 'montar-requisicao',
    wrapper: `const cfg = $('Config').first().json;
if (cfg.modelo_classificacao) RECURSOS.modelos.classificacao = cfg.modelo_classificacao;
return [{ json: montarRequisicaoClassificacao($input.first().json.entrada, RECURSOS) }];`,
  },
  'validar-classificacao': {
    lib: 'validar-saida',
    wrapper: `const entrada = $('validar-entrada-classificacao').first().json.entrada;
return [{ json: validarClassificacao($input.first().json, entrada, RECURSOS) }];`,
  },
};

export function gerarCodigoNo(nome: string, recursos: Recursos = carregarRecursos()): string {
  const no = NOS[nome];
  if (!no) throw new Error(`Sem wrapper para o nó ${nome}`);
  const lib = readFileSync(join('n8n/lib', `${no.lib}.js`), 'utf8').replace(/^export\s+/gm, '');
  return [
    `// Gerado por scripts/build-n8n.ts a partir de n8n/lib/${no.lib}.js. Não editar no n8n: rode pnpm build:n8n e reimporte.`,
    `const RECURSOS = ${JSON.stringify(recursos)};`,
    lib.trim(),
    no.wrapper,
  ].join('\n') + '\n';
}

export function gerarWorkflow(templateJson: string, recursos: Recursos = carregarRecursos()): string {
  const wf = JSON.parse(templateJson) as { nodes?: Array<{ parameters?: Record<string, unknown> }> };
  for (const node of wf.nodes ?? []) {
    const codigo = node.parameters?.jsCode;
    const m = typeof codigo === 'string' ? /^__NO__([\w-]+)__$/.exec(codigo.trim()) : null;
    if (m && node.parameters) node.parameters.jsCode = gerarCodigoNo(m[1], recursos);
  }
  return `${JSON.stringify(wf, null, 2)}\n`;
}

export function construirTodos(dirTemplates = 'n8n/templates', dirSaida = 'n8n/workflows'): string[] {
  mkdirSync(dirSaida, { recursive: true });
  const recursos = carregarRecursos();
  const nomes: string[] = [];
  for (const arquivo of readdirSync(dirTemplates).filter((f) => f.endsWith('.template.json'))) {
    const nome = arquivo.replace('.template.json', '');
    writeFileSync(join(dirSaida, `${nome}.json`), gerarWorkflow(readFileSync(join(dirTemplates, arquivo), 'utf8'), recursos));
    nomes.push(nome);
  }
  return nomes;
}

if (process.argv[1]?.endsWith('build-n8n.ts')) {
  console.log('Workflows gerados:', construirTodos().join(', '));
}
