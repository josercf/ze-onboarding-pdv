// web/src/ui/custo.ts
export const PRECOS_USD_POR_MILHAO: Record<string, { entrada: number; saida: number }> = {
  'google/gemini-2.5-flash': { entrada: 0.3, saida: 2.5 },
  'google/gemini-2.5-pro': { entrada: 1.25, saida: 10 },
};

export function estimarCusto(usos: Array<{ modelo: string; tokens: { entrada: number; saida: number } }>) {
  const tokens = { entrada: 0, saida: 0 };
  const modelos: string[] = [];
  let totalUsd = 0;
  for (const u of usos) {
    tokens.entrada += u.tokens.entrada;
    tokens.saida += u.tokens.saida;
    if (!modelos.includes(u.modelo)) modelos.push(u.modelo);
    const preco = PRECOS_USD_POR_MILHAO[u.modelo];
    if (preco) totalUsd += (u.tokens.entrada * preco.entrada + u.tokens.saida * preco.saida) / 1_000_000;
  }
  return { totalUsd, tokens, modelos };
}
