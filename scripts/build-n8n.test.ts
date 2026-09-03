import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';
import { construirTodos, gerarCodigoNo, gerarWorkflow } from './build-n8n';

describe('gerarCodigoNo', () => {
  test.each(['validar-entrada', 'montar-requisicao', 'validar-saida', 'montar-prompt-parecer', 'validar-parecer'])('%s embute recursos, remove export e é JavaScript válido', (nome) => {
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
  test('construirTodos devolve os nomes gerados', () => {
    expect(construirTodos().sort()).toEqual(['analisar-arquivo', 'consolidar']);
  });
});
