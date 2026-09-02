import exemploOk from '@shared/fixtures/exemplo-ok.json';
import exemploNaoOk from '@shared/fixtures/exemplo-nao-ok.json';
import type { EntradaMotor } from '../base';

type Fixture = typeof exemploOk;

export function entradaDe(fx: Fixture): EntradaMotor {
  const parsed = JSON.parse(JSON.stringify(fx));
  return {
    formulario: parsed.formulario as unknown as EntradaMotor['formulario'],
    receita: parsed.receita as unknown as EntradaMotor['receita'],
    parametros: parsed.parametros,
    observacoes: parsed.observacoes as unknown as EntradaMotor['observacoes'],
    anexosEnviados: parsed.anexosEnviados as unknown as EntradaMotor['anexosEnviados'],
    hoje: new Date(`${parsed.hoje}T12:00:00Z`),
  };
}

export const ok = () => entradaDe(exemploOk);
export const naoOk = () => entradaDe(exemploNaoOk as unknown as Fixture);
export const esperadoOk = exemploOk.esperado;
export const esperadoNaoOk = exemploNaoOk.esperado;
