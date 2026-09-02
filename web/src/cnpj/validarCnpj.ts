export function somenteDigitos(valor: string): string {
  return valor.replace(/\D/g, '').slice(0, 14);
}

function digitoVerificador(base: string, pesos: number[]): number {
  const soma = base.split('').reduce((acc, c, i) => acc + Number(c) * pesos[i], 0);
  const resto = soma % 11;
  return resto < 2 ? 0 : 11 - resto;
}

export function validarCnpj(valor: string): boolean {
  const d = somenteDigitos(valor);
  if (d.length !== 14 || /^(\d)\1{13}$/.test(d)) return false;
  const p1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const dv1 = digitoVerificador(d.slice(0, 12), p1);
  const dv2 = digitoVerificador(d.slice(0, 12) + dv1, [6, ...p1]);
  return d.endsWith(`${dv1}${dv2}`);
}

export function formatarCnpj(valor: string): string {
  const d = somenteDigitos(valor);
  let s = d.slice(0, 2);
  if (d.length > 2) s += '.' + d.slice(2, 5);
  if (d.length > 5) s += '.' + d.slice(5, 8);
  if (d.length > 8) s += '/' + d.slice(8, 12);
  if (d.length > 12) s += '-' + d.slice(12, 14);
  return s;
}
