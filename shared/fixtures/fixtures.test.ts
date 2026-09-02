import Ajv from 'ajv';
import { describe, expect, test } from 'vitest';
import { schemaObservacaoCompleta, type TipoAnexo } from '../schemas/index';
import exemploOk from './exemplo-ok.json';
import exemploNaoOk from './exemplo-nao-ok.json';

const ajv = new Ajv({ allErrors: true, strict: false });
const STATUS = ['conforme', 'divergente', 'atencao', 'nao_verificavel'];

describe.each([['exemplo-ok', exemploOk], ['exemplo-nao-ok', exemploNaoOk]])('fixture %s', (_nome, fx) => {
  test('toda observação passa no schema completo do seu tipo', () => {
    for (const obs of fx.observacoes) {
      const ok = ajv.validate(schemaObservacaoCompleta(obs.tipo as TipoAnexo), obs);
      expect(ok, `${obs.arquivo_id}: ${ajv.errorsText()}`).toBe(true);
    }
  });
  test('anexos enviados e observações têm os mesmos ids', () => {
    expect(fx.anexosEnviados.map((a) => a.arquivoId).sort()).toEqual(fx.observacoes.map((o) => o.arquivo_id).sort());
  });
  test('esperado cobre as 16 verificações com status válidos', () => {
    expect(Object.keys(fx.esperado.status).map(Number).sort((a, b) => a - b)).toEqual(Array.from({ length: 16 }, (_, i) => i + 1));
    for (const s of Object.values(fx.esperado.status)) expect(STATUS).toContain(s);
  });
  test('CNPJ com 14 dígitos e data no formato AAAA-MM-DD', () => {
    expect(fx.formulario.cnpj).toMatch(/^\d{14}$/);
    expect(fx.hoje).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
