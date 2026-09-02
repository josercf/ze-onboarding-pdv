const IGNORAR = new Set(['de', 'da', 'do', 'das', 'dos', 'e', 'ltda', 'me', 'epp', 'sa', 'eireli', 'cia']);

export function tokensNome(nome: string): string[] {
  return nome
    .normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/[^a-z\s]/g, ' ')
    .split(/\s+/)
    .filter((t) => t && !IGNORAR.has(t));
}

export function similaridadeNome(candidato: string, fonte: string): number {
  const c = tokensNome(candidato);
  if (!c.length) return 0;
  const f = new Set(tokensNome(fonte));
  return c.filter((t) => f.has(t)).length / c.length;
}

export function melhorSimilaridade(candidato: string, fontes: string[]): number {
  return Math.max(0, ...fontes.map((f) => similaridadeNome(candidato, f)));
}

export function semZerosAEsquerda(codigo: string | null | undefined): string {
  return (codigo ?? '').replace(/\D/g, '').replace(/^0+/, '');
}
