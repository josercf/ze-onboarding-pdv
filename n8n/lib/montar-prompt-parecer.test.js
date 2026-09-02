import { describe, expect, test } from 'vitest';
import exemploOk from '../../shared/fixtures/exemplo-ok.json';
import { carregarRecursos } from '../recursos';
import { montarPromptParecer } from './montar-prompt-parecer.js';

const RECURSOS = carregarRecursos();
const body = { formulario: exemploOk.formulario, receita: exemploOk.receita, parametros_regiao: exemploOk.parametros, observacoes: exemploOk.observacoes, verificacoes: [{ id: 1, item: 'CNPJ ativo', status: 'conforme' }], recomendacao_regras: 'apto' };

describe('montarPromptParecer', () => {
  test('preenche todos os placeholders com o modelo e o schema do parecer', () => {
    const r = montarPromptParecer(body, RECURSOS);
    expect(r.ok).toBe(true);
    expect(r.body.model).toBe('google/gemini-2.5-pro');
    expect(r.body.response_format.json_schema).toEqual({ name: 'parecer', strict: true, schema: RECURSOS.schemas.parecer });
    const texto = r.body.messages[0].content;
    expect(texto).not.toContain('{{');
    expect(texto).toContain('Recomendação das regras: apto');
    expect(texto).toContain('EXEMPLO COMERCIO DE BEBIDAS LTDA');
  });
  test('observações vão sem evidências e sem tokens', () => {
    const texto = montarPromptParecer(body, RECURSOS).body.messages[0].content;
    expect(texto).not.toContain('"evidencias"');
    expect(texto).not.toContain('"latencia_ms"');
    expect(texto).toContain('"resumo"');
  });
  test('campos ausentes dão 400', () => {
    expect(montarPromptParecer({ formulario: {} }, RECURSOS)).toMatchObject({ ok: false, status: 400, erro: { codigo: 'campos_ausentes' } });
    expect(montarPromptParecer({ formulario: {} }, RECURSOS).erro.mensagem).toContain('verificacoes');
  });
});
