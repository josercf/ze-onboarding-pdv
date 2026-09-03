import { existsSync, mkdtempSync, readFileSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';
import { construirTodos, gerarCodigoNo, gerarWorkflow } from './build-n8n';

describe('gerarCodigoNo', () => {
  test.each(['validar-entrada', 'montar-requisicao', 'validar-saida', 'montar-prompt-parecer', 'validar-parecer', 'validar-entrada-classificacao', 'montar-requisicao-classificacao', 'validar-classificacao'])('%s embute recursos, remove export e é JavaScript válido', (nome) => {
    const codigo = gerarCodigoNo(nome);
    expect(codigo).toContain('const RECURSOS = {');
    expect(codigo).not.toMatch(/^export\s/m);
    expect(codigo).toContain('$input');
    const json = /const RECURSOS = (.*?);\n/s.exec(codigo)![1];
    expect(JSON.parse(json).prompts.system).toContain('auditor');
    expect(() => new Function('$input', '$', codigo)).not.toThrow();
  });
  test('nó desconhecido lança erro', () => expect(() => gerarCodigoNo('inexistente')).toThrow(/Sem wrapper/));
});

describe('gerarWorkflow', () => {
  const template = JSON.stringify({ name: 'x', nodes: [{ name: 'Webhook', parameters: { path: 'p' } }, { name: 'validar-entrada', type: 'n8n-nodes-base.code', parameters: { jsCode: '__NO__validar-entrada__' } }] });
  test('substitui só os placeholders', () => {
    const wf = JSON.parse(gerarWorkflow(template));
    expect(wf.nodes[0].parameters).toEqual({ path: 'p' });
    expect(wf.nodes[1].parameters.jsCode).toContain('validarEntrada(');
  });
  test('placeholder sem wrapper falha', () => {
    expect(() => gerarWorkflow(template.replace('validar-entrada__', 'outro__'))).toThrow(/Sem wrapper/);
  });
});

describe('workflows versionados', () => {
  test('n8n/workflows está sincronizado com templates, lib, prompts e schemas', () => {
    const templates = readdirSync('n8n/templates').filter((f) => f.endsWith('.template.json'));
    expect(templates.length, 'nenhum template exportado em n8n/templates').toBeGreaterThan(0);
    for (const t of templates) {
      const nome = t.replace('.template.json', '');
      const esperado = gerarWorkflow(readFileSync(join('n8n/templates', t), 'utf8'));
      const caminho = join('n8n/workflows', `${nome}.json`);
      expect(existsSync(caminho), `${caminho} não existe; rode pnpm build:n8n`).toBe(true);
      expect(readFileSync(caminho, 'utf8'), `${caminho} desatualizado; rode pnpm build:n8n`).toBe(esperado);
    }
  });
  test('construirTodos devolve os nomes gerados e escreve na pasta de saída informada, sem tocar n8n/workflows', () => {
    const dirSaida = mkdtempSync(join(tmpdir(), 'build-n8n-'));
    const nomes = construirTodos('n8n/templates', dirSaida);
    expect(nomes.sort()).toEqual(['analisar-arquivo', 'classificar-arquivo', 'consolidar']);
    for (const nome of nomes) {
      const caminho = join(dirSaida, `${nome}.json`);
      expect(existsSync(caminho)).toBe(true);
      expect(readFileSync(caminho, 'utf8')).toBe(readFileSync(join('n8n/workflows', `${nome}.json`), 'utf8'));
    }
  });
  test('classificar-arquivo gerado chama as três funções de classificação e responde 500 no ramo de erro', () => {
    const wf = JSON.parse(readFileSync('n8n/workflows/classificar-arquivo.json', 'utf8')) as { nodes: Array<{ name: string; parameters: Record<string, unknown> }> };
    const codigo = (nome: string) => String(wf.nodes.find((n) => n.name === nome)!.parameters.jsCode);
    expect(codigo('validar-entrada-classificacao')).toContain('validarEntradaClassificacao(');
    expect(codigo('montar-requisicao-classificacao')).toContain('montarRequisicaoClassificacao(');
    expect(codigo('validar-classificacao')).toContain('validarClassificacao(');
    expect(wf.nodes.find((n) => n.name === 'responder 500')!.parameters.options).toEqual({ responseCode: 500 });
    expect(wf.nodes.find((n) => n.name === 'Webhook')!.parameters.path).toBe('classificar-arquivo');
  });
});
