# Passe de design da interface e do relatório: plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** dar à interface um sistema visual próprio, reorganizar a etapa 1 em blocos temáticos e acrescentar um resumo executivo ao relatório, sem alterar fluxo, contratos nem regras de negócio.

**Architecture:** a folha única de 71 linhas vira quatro camadas de CSS (tokens, base, componentes, impressão) importadas por `styles.css`; um componente `Secao` agrupa os campos da etapa 1 em uma grade responsiva; o relatório ganha um bloco de resumo alimentado por uma função pura sobre as verificações. As telas 2 e 3 herdam o sistema sem reescrita de lógica.

**Tech Stack:** CSS puro com variáveis (sem dependência nova), React 19, TypeScript, Vite, Vitest com Testing Library e jsdom, pnpm workspace.

**Spec:** `docs/superpowers/specs/2026-09-03-passe-de-design-design.md` (leia antes de cada tarefa).

## Global Constraints

- Textos de interface, títulos de teste, mensagens, commits e documentação em pt-BR com acentos. Nunca usar o travessão longo (em dash); reticências são três pontos.
- Nenhuma dependência nova, nenhuma fonte externa, nenhum passo de build novo. CSS puro com variáveis.
- Contraste mínimo de 4,5 para 1 sobre branco em toda cor usada como texto ou como fundo de texto branco.
- Nenhum rótulo, identificador de campo (`id`), mensagem de erro ou ordem de validação da etapa 1 pode mudar: os testes existentes consultam por rótulo.
- Frontend sem `localStorage` nem qualquer armazenamento. Nenhum segredo em código.
- Fora de escopo: tema escuro, animação, biblioteca de componentes, identidade de marca.
- Toda tarefa entrega testes (Vitest) e roda `pnpm lint && pnpm test && pnpm build` com saída limpa antes do commit. Commits em pt-BR terminados com a linha `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`.
- Trabalhar na branch `feat/passe-de-design`, criada a partir de `main` (que está em `37ede33` ou posterior).

## Estrutura de arquivos

| Arquivo | Responsabilidade |
|---|---|
| `web/src/estilos/tokens.css` (novo) | Variáveis de cor, espaço, tipografia, raio, sombra e foco |
| `web/src/estilos/base.css` (novo) | Elementos nus: corpo, títulos, tabela, controles de formulário, foco |
| `web/src/estilos/componentes.css` (novo) | Classes de componente: seção, campo, cartão, selo, painel, botões, avisos, listas |
| `web/src/estilos/impressao.css` (novo) | Bloco `@media print` |
| `web/src/styles.css` | Passa a ser só os quatro `@import` |
| `web/src/estilos/contraste.test.ts` (novo) | Prova que as cores de situação atingem o contraste mínimo |
| `web/src/ui/componentes.tsx` | Ganha `Secao` e a largura opcional dos campos |
| `web/src/ui/EtapaDados.tsx` | Reestruturada em cinco blocos |
| `web/src/ui/contagens.ts` (novo) | `contarPorStatus`, função pura sobre as verificações |
| `web/src/ui/EtapaRelatorio.tsx` | Resumo executivo no topo |
| `web/src/ui/EtapaAnexos.tsx` | Região de aviso sempre montada |
| `web/src/rules/verificacoes/anexos.ts` | Presença contada pelos anexos enviados |
| `docs/adrs/ADR-008-sistema-visual-em-css-puro.md` (novo) | Registro da decisão |

---

### Tarefa 1: tokens, camadas de CSS e contraste

**Files:**
- Create: `web/src/estilos/tokens.css`, `web/src/estilos/base.css`, `web/src/estilos/componentes.css`, `web/src/estilos/impressao.css`, `web/src/estilos/contraste.test.ts`
- Modify: `web/src/styles.css` (passa a conter só os imports)
- Test: `web/src/estilos/contraste.test.ts`

**Interfaces:**
- Consumes: nada de tarefas anteriores.
- Produces: as variáveis `--cor-conforme`, `--cor-divergente`, `--cor-atencao`, `--cor-neutra`, `--cor-primaria`, `--cor-fundo`, `--cor-texto`, `--cor-borda`, `--cor-superficie`; a escala `--espaco-1` a `--espaco-6`; `--fonte-1` a `--fonte-6`; `--raio-1` a `--raio-3`; `--sombra-1`; `--foco`. Todas as tarefas seguintes usam esses nomes.

- [ ] **Passo 1: escrever o teste de contraste**

Criar `web/src/estilos/contraste.test.ts`:

```ts
import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';

const tokens = readFileSync(new URL('./tokens.css', import.meta.url), 'utf8');

function corDe(nome: string): string {
  const m = new RegExp(`--${nome}:\\s*(#[0-9a-fA-F]{6})`).exec(tokens);
  if (!m) throw new Error(`token --${nome} não encontrado em tokens.css`);
  return m[1];
}

function luminancia(hex: string): number {
  const canais = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const [r, g, b] = canais.map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Razão de contraste da cor contra branco, conforme a fórmula da WCAG. */
export function contrasteComBranco(hex: string): number {
  return 1.05 / (luminancia(hex) + 0.05);
}

describe('contraste das cores do sistema', () => {
  test.each(['cor-conforme', 'cor-divergente', 'cor-atencao', 'cor-neutra', 'cor-primaria'])(
    '%s atinge 4,5 para 1 sobre branco',
    (nome) => {
      expect(contrasteComBranco(corDe(nome))).toBeGreaterThanOrEqual(4.5);
    },
  );

  test('o cálculo de contraste está correto: preto contra branco dá 21', () => {
    expect(contrasteComBranco('#000000')).toBeCloseTo(21, 1);
  });
});
```

- [ ] **Passo 2: rodar e ver falhar**

Run: `pnpm -C web test -- contraste`
Expected: FAIL, porque `web/src/estilos/tokens.css` ainda não existe ("token --cor-conforme não encontrado" ou erro de leitura do arquivo).

- [ ] **Passo 3: criar os tokens**

`web/src/estilos/tokens.css`:

```css
:root {
  --cor-fundo: #f6f6f4;
  --cor-superficie: #ffffff;
  --cor-texto: #1c1c1c;
  --cor-texto-fraco: #5a5a5a;
  --cor-borda: #d9d9d4;
  --cor-primaria: #1f4e79;
  --cor-primaria-clara: #eaf1f8;
  --cor-conforme: #2e7d32;
  --cor-divergente: #c62828;
  --cor-atencao: #b45309;
  --cor-neutra: #616161;

  --espaco-1: 0.25rem;
  --espaco-2: 0.5rem;
  --espaco-3: 0.75rem;
  --espaco-4: 1rem;
  --espaco-5: 1.5rem;
  --espaco-6: 2rem;

  --fonte-1: 0.75rem;
  --fonte-2: 0.875rem;
  --fonte-3: 1rem;
  --fonte-4: 1.25rem;
  --fonte-5: 1.5rem;
  --fonte-6: 1.875rem;

  --raio-1: 6px;
  --raio-2: 10px;
  --raio-3: 999px;

  --sombra-1: 0 1px 2px rgba(28, 28, 28, 0.06), 0 1px 3px rgba(28, 28, 28, 0.08);

  --foco: 0 0 0 3px rgba(31, 78, 121, 0.35);

  --largura-app: 1120px;
}
```

O único valor que muda em relação à folha antiga é `--cor-atencao`, que sai de `#ef6c00` (cerca de 3,1 para 1) para `#b45309` (cerca de 5,0 para 1).

- [ ] **Passo 4: criar a camada base**

`web/src/estilos/base.css`:

```css
* { box-sizing: border-box; }

body {
  margin: 0;
  font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  font-size: var(--fonte-3);
  line-height: 1.5;
  color: var(--cor-texto);
  background: var(--cor-fundo);
}

h1 { font-size: var(--fonte-6); line-height: 1.2; margin: 0 0 var(--espaco-2); }
h2 { font-size: var(--fonte-5); line-height: 1.25; margin: 0 0 var(--espaco-3); }
h3 { font-size: var(--fonte-4); line-height: 1.3; margin: 0 0 var(--espaco-2); }
p { margin: 0 0 var(--espaco-3); }

a { color: var(--cor-primaria); }

input, select, textarea, button { font: inherit; }

:focus-visible { outline: 2px solid var(--cor-primaria); outline-offset: 2px; box-shadow: var(--foco); border-radius: var(--raio-1); }

table { border-collapse: collapse; width: 100%; font-size: var(--fonte-2); }
th, td { text-align: left; padding: var(--espaco-2); border-bottom: 1px solid var(--cor-borda); vertical-align: top; }
th { color: var(--cor-texto-fraco); font-weight: 600; }
```

- [ ] **Passo 5: criar a camada de componentes**

`web/src/estilos/componentes.css` recebe, adaptadas aos tokens, todas as regras de classe que hoje estão em `styles.css`, mais as classes de seção e grade que a Tarefa 2 vai usar:

```css
.app { max-width: var(--largura-app); margin: 0 auto; padding: var(--espaco-5) var(--espaco-4); }

.etapas { display: flex; gap: var(--espaco-2); padding: 0; list-style: none; flex-wrap: wrap; margin: 0 0 var(--espaco-5); }
.etapas li { padding: var(--espaco-1) var(--espaco-3); border: 1px solid var(--cor-borda); border-radius: var(--raio-3); font-size: var(--fonte-2); background: var(--cor-superficie); }
.etapas li[aria-current="step"] { background: var(--cor-primaria); color: #fff; border-color: var(--cor-primaria); }

.secao { border: 1px solid var(--cor-borda); border-radius: var(--raio-2); background: var(--cor-superficie); box-shadow: var(--sombra-1); padding: var(--espaco-4); margin: 0 0 var(--espaco-5); }
.secao > legend { font-size: var(--fonte-4); font-weight: 600; padding: 0 var(--espaco-2); }
.secao .descricao { color: var(--cor-texto-fraco); font-size: var(--fonte-2); }
.grade { display: grid; grid-template-columns: repeat(6, minmax(0, 1fr)); gap: var(--espaco-3) var(--espaco-4); }

.campo { display: flex; flex-direction: column; gap: var(--espaco-1); grid-column: span 6; }
.campo-curto { grid-column: span 2; }
.campo-medio { grid-column: span 3; }
.campo-longo { grid-column: span 6; }
.campo label { font-size: var(--fonte-2); font-weight: 600; }
.campo input, .campo select, .campo textarea { padding: var(--espaco-2); border: 1px solid var(--cor-borda); border-radius: var(--raio-1); background: var(--cor-superficie); }
.campo small { color: var(--cor-texto-fraco); font-size: var(--fonte-1); }

.cartao { border: 1px solid var(--cor-borda); border-radius: var(--raio-2); padding: var(--espaco-3) var(--espaco-4); background: var(--cor-primaria-clara); display: grid; grid-template-columns: max-content 1fr; gap: var(--espaco-1) var(--espaco-4); grid-column: span 6; }
.cartao dt { color: var(--cor-texto-fraco); font-size: var(--fonte-2); }
.cartao dd { margin: 0; }

.zona { border: 2px dashed var(--cor-borda); border-radius: var(--raio-2); padding: var(--espaco-4); text-align: center; background: var(--cor-superficie); }

.anexos, .fila, .evidencias { list-style: none; padding: 0; margin: var(--espaco-4) 0; display: grid; gap: var(--espaco-2); }
.anexos li, .fila li, .evidencias li { display: flex; gap: var(--espaco-3); align-items: flex-start; padding: var(--espaco-3); border: 1px solid var(--cor-borda); border-radius: var(--raio-2); background: var(--cor-superficie); }
.anexos img, .evidencias img { width: 64px; height: 64px; object-fit: cover; border-radius: var(--raio-1); }
.evidencias video { width: 220px; max-width: 100%; }
.detalhes { flex: 1; display: flex; flex-direction: column; gap: var(--espaco-1); min-width: 0; }
.icone { font-size: var(--fonte-1); color: var(--cor-texto-fraco); }

.selo { font-size: var(--fonte-2); color: var(--cor-texto-fraco); }
.classificacao-classificando .selo, .classificacao-pendente .selo { color: var(--cor-primaria); }
.classificacao-falhou .selo { color: var(--cor-atencao); }
.motivo { color: var(--cor-texto-fraco); font-size: var(--fonte-2); }
.motivo-bloqueio { color: var(--cor-texto-fraco); align-self: center; }

.erros, .erro, [role="alert"] { color: var(--cor-divergente); }
.erros { list-style: none; padding: 0; margin: 0 0 var(--espaco-3); }
.aviso { color: var(--cor-atencao); }

.botoes { display: flex; gap: var(--espaco-3); margin: var(--espaco-5) 0 0; flex-wrap: wrap; align-items: center; }
button { padding: var(--espaco-2) var(--espaco-4); border-radius: var(--raio-1); border: 1px solid var(--cor-primaria); background: var(--cor-primaria); color: #fff; cursor: pointer; }
button:disabled { opacity: 0.5; cursor: not-allowed; }
.botoes button[type="button"]:not(:last-of-type) { background: var(--cor-superficie); color: var(--cor-primaria); }

progress { width: 100%; height: var(--espaco-3); }

.tabela { overflow-x: auto; }
.badge { padding: 0 var(--espaco-2); border-radius: var(--raio-3); color: #fff; white-space: nowrap; font-size: var(--fonte-2); border: 1px solid transparent; }
.badge.conforme { background: var(--cor-conforme); }
.badge.divergente { background: var(--cor-divergente); }
.badge.atencao { background: var(--cor-atencao); }
.badge.nao_verificavel { background: var(--cor-neutra); }

.recomendacao { font-size: var(--fonte-4); font-weight: 600; padding: var(--espaco-2) var(--espaco-4); border-radius: var(--raio-2); display: inline-block; color: #fff; }
.recomendacao.apto { background: var(--cor-conforme); }
.recomendacao.nao_apto { background: var(--cor-divergente); }
.recomendacao.revisao_manual { background: var(--cor-atencao); }

.etapa-anexos { display: grid; grid-template-columns: minmax(0, 1fr) 300px; gap: var(--espaco-5); align-items: start; }
.coluna-arquivos { min-width: 0; }
.oculto-visual { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; border: 0; }

.painel-docs { border: 1px solid var(--cor-borda); border-radius: var(--raio-2); background: var(--cor-superficie); box-shadow: var(--sombra-1); padding: var(--espaco-3); position: sticky; top: var(--espaco-4); }
.painel-docs summary { cursor: pointer; font-weight: 600; font-size: var(--fonte-2); }
.painel-docs ul { list-style: none; padding: 0; margin: var(--espaco-2) 0 0; }
.painel-docs li button { width: 100%; display: grid; grid-template-columns: 1fr auto; column-gap: var(--espaco-2); text-align: left; background: none; color: var(--cor-texto); border: 0; border-bottom: 1px solid var(--cor-borda); border-radius: 0; padding: var(--espaco-2) 0; }
.painel-docs li button small { grid-column: 1; color: var(--cor-texto-fraco); font-size: var(--fonte-1); }
.painel-docs li button .situacao { grid-column: 2; grid-row: 1 / span 2; align-self: center; font-weight: 600; font-size: var(--fonte-2); }
.painel-docs .ok .situacao { color: var(--cor-conforme); }
.painel-docs .falta .situacao { color: var(--cor-atencao); }

@media (max-width: 720px) {
  .etapa-anexos { grid-template-columns: 1fr; }
  .coluna-painel { order: -1; }
  .painel-docs { position: static; }
  .grade { grid-template-columns: 1fr; }
  .campo, .campo-curto, .campo-medio, .campo-longo, .cartao { grid-column: auto; }
}
```

- [ ] **Passo 6: criar a camada de impressão**

`web/src/estilos/impressao.css`:

```css
@media print {
  .botoes, .etapas, .zona, button, .introducao, .painel-docs { display: none !important; }
  .app { max-width: none; padding: 0; }
  .evidencias video { display: none; }
}
```

- [ ] **Passo 7: reduzir o styles.css aos imports**

`web/src/styles.css` passa a conter exatamente:

```css
@import './estilos/tokens.css';
@import './estilos/base.css';
@import './estilos/componentes.css';
@import './estilos/impressao.css';
```

- [ ] **Passo 8: rodar e ver passar**

Run: `pnpm -C web test -- contraste`
Expected: PASS (seis casos: cinco cores mais a verificação da fórmula).

- [ ] **Passo 9: rodar tudo**

Run: `pnpm lint && pnpm test && pnpm build`
Expected: PASS, sem avisos. Nenhum teste de tela deve quebrar: as classes mantiveram os mesmos nomes.

- [ ] **Passo 10: commit**

```bash
git add web/src/estilos web/src/styles.css
git commit -m "Sistema visual em tokens e camadas, com contraste mínimo garantido por teste" -m "Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Tarefa 2: etapa 1 em cinco blocos

**Files:**
- Modify: `web/src/ui/componentes.tsx` (componente `Secao` e largura dos campos), `web/src/ui/EtapaDados.tsx` (reestruturação), `web/src/estilos/componentes.css` (largura `campo-largo` e campo de caixa de seleção)
- Test: `web/src/ui/EtapaDados.test.tsx`

**Interfaces:**
- Consumes: as classes `.secao`, `.grade`, `.campo-curto`, `.campo-medio`, `.campo-longo` da Tarefa 1.
- Produces: `Secao({ titulo, descricao?, children })` renderizando `fieldset.secao > legend + p.descricao? + div.grade`; o tipo `Largura = 'curto' | 'medio' | 'largo' | 'longo'` e a prop opcional `largura` em `Campo`, `CampoTexto`, `CampoNumero` e `SelecaoSimNao`, com padrão `'longo'`.

- [ ] **Passo 1: escrever o teste dos blocos**

Em `web/src/ui/EtapaDados.test.tsx`, acrescentar `within` à importação do Testing Library e incluir este caso no `describe('EtapaDados')`:

```tsx
  test('os cinco blocos agrupam os campos da etapa 1', () => {
    render(<Harness />);
    const blocos = ['Identificação', 'Endereço do ponto de venda', 'Estrutura e equipamentos', 'Operação e entrega', 'Fiscal e comercial'];
    for (const nome of blocos) expect(screen.getByRole('group', { name: nome })).toBeInTheDocument();

    const em = (nome: string) => within(screen.getByRole('group', { name: nome }));
    expect(em('Identificação').getByLabelText('CNPJ')).toBeInTheDocument();
    expect(em('Endereço do ponto de venda').getByLabelText('Logradouro')).toBeInTheDocument();
    expect(em('Estrutura e equipamentos').getByLabelText('Quantidade de refrigeradores')).toBeInTheDocument();
    expect(em('Operação e entrega').getByLabelText('Dias e horário de funcionamento do delivery')).toBeInTheDocument();
    expect(em('Fiscal e comercial').getByLabelText('Emite cupom fiscal?')).toBeInTheDocument();
  });
```

- [ ] **Passo 2: rodar e ver falhar**

Run: `pnpm -C web test -- EtapaDados`
Expected: FAIL, porque hoje só existe um `fieldset` (o de endereço) e os demais nomes de grupo não são encontrados.

- [ ] **Passo 3: acrescentar `Secao` e a largura aos componentes**

Em `web/src/ui/componentes.tsx`, trocar `Campo` e acrescentar `Secao` e o tipo de largura. O arquivo passa a ser:

```tsx
// web/src/ui/componentes.tsx
import type { ReactNode } from 'react';
import type { SimNao } from '../tipos';

export type Largura = 'curto' | 'medio' | 'largo' | 'longo';

export function Secao({ titulo, descricao, children }: { titulo: string; descricao?: string; children: ReactNode }) {
  return (
    <fieldset className="secao">
      <legend>{titulo}</legend>
      {descricao && <p className="descricao">{descricao}</p>}
      <div className="grade">{children}</div>
    </fieldset>
  );
}

export function Campo({ id, rotulo, ajuda, largura = 'longo', children }: { id: string; rotulo: string; ajuda?: string; largura?: Largura; children: ReactNode }) {
  return (
    <div className={`campo campo-${largura}`}>
      <label htmlFor={id}>{rotulo}</label>
      {children}
      {ajuda && <small id={`${id}-ajuda`}>{ajuda}</small>}
    </div>
  );
}

export function CampoTexto({ id, rotulo, valor, aoMudar, ajuda, multilinha = false, largura = 'longo' }: { id: string; rotulo: string; valor: string; aoMudar: (v: string) => void; ajuda?: string; multilinha?: boolean; largura?: Largura }) {
  return (
    <Campo id={id} rotulo={rotulo} ajuda={ajuda} largura={largura}>
      {multilinha
        ? <textarea id={id} value={valor} rows={2} onChange={(e) => aoMudar(e.target.value)} />
        : <input id={id} type="text" value={valor} onChange={(e) => aoMudar(e.target.value)} />}
    </Campo>
  );
}

export function CampoNumero({ id, rotulo, valor, aoMudar, largura = 'curto' }: { id: string; rotulo: string; valor: number; aoMudar: (v: number) => void; largura?: Largura }) {
  return (
    <Campo id={id} rotulo={rotulo} largura={largura}>
      <input id={id} type="number" inputMode="numeric" min={0} step={1} value={valor} onChange={(e) => aoMudar(e.target.value === '' ? 0 : Number(e.target.value))} />
    </Campo>
  );
}

export function SelecaoSimNao({ id, rotulo, valor, aoMudar, largura = 'curto' }: { id: string; rotulo: string; valor: SimNao; aoMudar: (v: SimNao) => void; largura?: Largura }) {
  return (
    <Campo id={id} rotulo={rotulo} largura={largura}>
      <select id={id} value={valor} onChange={(e) => aoMudar(e.target.value as SimNao)}>
        <option value="sim">Sim</option>
        <option value="nao">Não</option>
      </select>
    </Campo>
  );
}

export function Botoes({ children }: { children: ReactNode }) {
  return <div className="botoes">{children}</div>;
}
```

Em `web/src/estilos/componentes.css`, acrescentar depois de `.campo-medio`:

```css
.campo-largo { grid-column: span 4; }
.campo-checkbox { flex-direction: row; align-items: center; gap: var(--espaco-2); }
.campo-checkbox input { width: auto; }
```

- [ ] **Passo 4: reestruturar a etapa 1**

Em `web/src/ui/EtapaDados.tsx`, trocar a importação de componentes e todo o bloco `return`. A importação passa a ser:

```tsx
import { Botoes, Campo, CampoNumero, CampoTexto, Secao, SelecaoSimNao } from './componentes';
```

E o `return` passa a ser:

```tsx
  return (
    <section aria-labelledby="t-dados">
      <h2 id="t-dados">1. Dados do PDV</h2>

      <Secao titulo="Identificação">
        <Campo id="cnpj" rotulo="CNPJ" largura="medio" ajuda={consultando ? 'Consultando a Receita Federal...' : receitaErro ?? undefined}>
          <input id="cnpj" inputMode="numeric" autoComplete="off" value={formatarCnpj(f.cnpj)} onChange={(e) => void aoMudarCnpj(e.target.value)} />
        </Campo>

        {receita && (
          <dl className="cartao" aria-label="Dados da Receita">
            <dt>Razão social</dt><dd>{receita.razaoSocial}</dd>
            <dt>Situação cadastral</dt><dd>{receita.situacao}</dd>
            <dt>CNAE principal</dt><dd>{formatarCnae(receita.cnaePrincipal.codigo)} {receita.cnaePrincipal.descricao}</dd>
            <dt>Porte</dt><dd>{receita.porte}</dd>
            <dt>Natureza jurídica</dt><dd>{receita.naturezaJuridica}</dd>
            <dt>Quadro societário</dt><dd>{receita.qsa.length ? receita.qsa.map((s) => s.nome).join(', ') : 'Sem sócios registrados'}</dd>
          </dl>
        )}

        <CampoTexto id="responsavel" rotulo="Nome completo do responsável pelo CNPJ" valor={f.responsavel} aoMudar={(v) => mudar({ responsavel: v })} />
        <SelecaoSimNao id="possuiSocio" rotulo="Possui sócio no mesmo CNPJ?" valor={f.possuiSocio} aoMudar={(v) => mudar({ possuiSocio: v })} />
        <SelecaoSimNao id="contaCorrente" rotulo="Possui conta corrente vinculada ao CNPJ?" valor={f.contaCorrente} aoMudar={(v) => mudar({ contaCorrente: v })} largura="medio" />
      </Secao>

      <Secao titulo="Endereço do ponto de venda">
        <CampoTexto id="logradouro" rotulo="Logradouro" valor={f.endereco.logradouro} aoMudar={(v) => mudarEndereco({ logradouro: v })} />
        <CampoTexto id="numero" rotulo="Número" valor={f.endereco.numero} aoMudar={(v) => mudarEndereco({ numero: v })} largura="curto" />
        <CampoTexto id="complemento" rotulo="Complemento" valor={f.endereco.complemento} aoMudar={(v) => mudarEndereco({ complemento: v })} largura="curto" />
        <CampoTexto id="bairro" rotulo="Bairro" valor={f.endereco.bairro} aoMudar={(v) => mudarEndereco({ bairro: v })} largura="curto" />
        <CampoTexto id="municipio" rotulo="Município" valor={f.endereco.municipio} aoMudar={(v) => mudarEndereco({ municipio: v })} largura="curto" />
        <CampoTexto id="uf" rotulo="UF" valor={f.endereco.uf} aoMudar={(v) => mudarEndereco({ uf: v.toUpperCase().slice(0, 2) })} largura="curto" />
        <CampoTexto id="cep" rotulo="CEP" valor={f.endereco.cep} aoMudar={(v) => mudarEndereco({ cep: v.replace(/\D/g, '').slice(0, 8) })} largura="curto" />
      </Secao>

      <Secao titulo="Estrutura e equipamentos">
        <CampoNumero id="qtdRefrigeradores" rotulo="Quantidade de refrigeradores" valor={f.qtdRefrigeradores} aoMudar={(v) => mudar({ qtdRefrigeradores: v })} />
        <SelecaoSimNao id="camaraFria" rotulo="Câmara frigorífica" valor={f.camaraFria} aoMudar={(v) => mudar({ camaraFria: v })} />
        <CampoNumero id="qtdMaquininhas" rotulo="Quantidade de máquinas de cartão" valor={f.qtdMaquininhas} aoMudar={(v) => mudar({ qtdMaquininhas: v })} />
        <SelecaoSimNao id="computadorInternet" rotulo="Computador e internet" valor={f.computadorInternet} aoMudar={(v) => mudar({ computadorInternet: v })} largura="medio" />
        <SelecaoSimNao id="impressoraTermica" rotulo="Impressora térmica" valor={f.impressoraTermica} aoMudar={(v) => mudar({ impressoraTermica: v })} largura="medio" />
      </Secao>

      <Secao titulo="Operação e entrega">
        <CampoNumero id="qtdEntregadores" rotulo="Quantidade de entregadores" valor={f.qtdEntregadores} aoMudar={(v) => mudar({ qtdEntregadores: v })} />
        <CampoTexto id="horarioDelivery" rotulo="Dias e horário de funcionamento do delivery" valor={f.horarioDelivery} aoMudar={(v) => mudar({ horarioDelivery: v })} largura="largo" />
        <SelecaoSimNao id="lojaAtivaZe" rotulo="Já possui loja ativa no Zé?" valor={f.lojaAtivaZe} aoMudar={(v) => mudar({ lojaAtivaZe: v })} />
        <SelecaoSimNao id="trabalha300ml" rotulo="Trabalha com garrafa de 300 ml?" valor={f.trabalha300ml} aoMudar={(v) => mudar({ trabalha300ml: v })} />
      </Secao>

      <Secao titulo="Fiscal e comercial">
        <SelecaoSimNao id="cupomFiscal" rotulo="Emite cupom fiscal?" valor={f.cupomFiscal} aoMudar={(v) => mudar({ cupomFiscal: v })} />
        <CampoTexto id="cupomFiscalObs" rotulo="Observação sobre o cupom fiscal" valor={f.cupomFiscalObs} aoMudar={(v) => mudar({ cupomFiscalObs: v })} multilinha largura="largo" ajuda="Se houver alguma condição (certificado pendente, homologação em andamento), descreva aqui." />
        <SelecaoSimNao id="cnaeBebidas" rotulo="Possui CNAE de venda de bebidas e comida?" valor={f.cnaeBebidas} aoMudar={(v) => mudar({ cnaeBebidas: v })} />
        <SelecaoSimNao id="parceiroAmbev" rotulo="É parceiro Ambev?" valor={f.parceiroAmbev} aoMudar={(v) => mudar({ parceiroAmbev: v })} />
        {f.parceiroAmbev === 'sim' && <CampoTexto id="codigoParceiro" rotulo="Código de parceiro Ambev" valor={f.codigoParceiro} aoMudar={(v) => mudar({ codigoParceiro: v })} largura="curto" />}
      </Secao>

      <details className="parametros">
        <summary>Parâmetros de avaliação</summary>
        <p>Requisitos da região usados no relatório. Ajuste conforme a praça do PDV.</p>
        <CampoNumero id="minRefrigeradores" rotulo="Mínimo de refrigeradores na região" valor={parametros.minRefrigeradores} aoMudar={(v) => despachar({ tipo: 'parametros', valor: { minRefrigeradores: v } })} />
        <div className="campo campo-checkbox">
          <input id="camaraFriaObrigatoria" type="checkbox" checked={parametros.camaraFriaObrigatoria} onChange={(e) => despachar({ tipo: 'parametros', valor: { camaraFriaObrigatoria: e.target.checked } })} />
          <label htmlFor="camaraFriaObrigatoria">Câmara fria obrigatória na região</label>
        </div>
        <CampoNumero id="minEntregadores" rotulo="Mínimo de entregadores na região" valor={parametros.minEntregadores} aoMudar={(v) => despachar({ tipo: 'parametros', valor: { minEntregadores: v } })} />
      </details>

      {erros.length > 0 && (
        <ul className="erros" role="alert">{erros.map((e) => <li key={e}>{e}</li>)}</ul>
      )}
      <Botoes><button type="button" onClick={continuar}>Continuar</button></Botoes>
    </section>
  );
```

Nenhum `id`, rótulo, mensagem ou ordem de validação mudou. A ordem visual dos campos dentro de cada bloco segue a spec, com uma exceção deliberada: no bloco de operação, o horário vem logo após a quantidade de entregadores para ocupar a mesma linha da grade.

- [ ] **Passo 5: rodar e ver passar**

Run: `pnpm -C web test -- EtapaDados`
Expected: PASS, os quatro testes antigos e o novo.

- [ ] **Passo 6: rodar tudo**

Run: `pnpm lint && pnpm test && pnpm build`
Expected: PASS, sem avisos.

- [ ] **Passo 7: commit**

```bash
git add web/src/ui/componentes.tsx web/src/ui/EtapaDados.tsx web/src/ui/EtapaDados.test.tsx web/src/estilos/componentes.css
git commit -m "Etapa 1 agrupada em cinco blocos com grade responsiva" -m "Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Tarefa 3: resumo executivo do relatório e regras de impressão

**Files:**
- Create: `web/src/ui/contagens.ts`, `web/src/ui/contagens.test.ts`
- Modify: `web/src/ui/EtapaRelatorio.tsx` (bloco de resumo e realocação dos pontos de atenção), `web/src/estilos/componentes.css` (classe `contagens`), `web/src/estilos/impressao.css` (regras de página)
- Test: `web/src/ui/contagens.test.ts`, `web/src/ui/EtapaRelatorio.test.tsx`

**Interfaces:**
- Consumes: `Verificacao` e `StatusVerificacao` de `web/src/tipos`; `ROTULO_STATUS` de `web/src/ui/rotulos.ts`.
- Produces: `contarPorStatus(verificacoes: Verificacao[]): Contagens`, com `type Contagens = Record<StatusVerificacao, number>`; a lista de contagens no relatório com o nome acessível "Contagem por situação".

- [ ] **Passo 1: escrever o teste da função de contagem**

Criar `web/src/ui/contagens.test.ts`:

```ts
import { describe, expect, test } from 'vitest';
import type { Verificacao } from '../tipos';
import { contarPorStatus } from './contagens';

const v = (id: number, status: Verificacao['status']): Verificacao =>
  ({ id, item: `Item ${id}`, declarado: '', observado: '', status, evidencia: '', critico: false, obrigatorio: false });

describe('contarPorStatus', () => {
  test('lista vazia devolve zero em todas as situações', () => {
    expect(contarPorStatus([])).toEqual({ conforme: 0, divergente: 0, atencao: 0, nao_verificavel: 0 });
  });

  test('conta cada situação e a soma bate com o total', () => {
    const lista = [v(1, 'conforme'), v(2, 'conforme'), v(3, 'divergente'), v(4, 'atencao'), v(5, 'nao_verificavel'), v(6, 'atencao')];
    const c = contarPorStatus(lista);
    expect(c).toEqual({ conforme: 2, divergente: 1, atencao: 2, nao_verificavel: 1 });
    expect(Object.values(c).reduce((a, b) => a + b, 0)).toBe(lista.length);
  });
});
```

- [ ] **Passo 2: rodar e ver falhar**

Run: `pnpm -C web test -- contagens`
Expected: FAIL com "Cannot find module './contagens'".

- [ ] **Passo 3: implementar a função**

Criar `web/src/ui/contagens.ts`:

```ts
import type { StatusVerificacao, Verificacao } from '../tipos';

export type Contagens = Record<StatusVerificacao, number>;

const ZERO: Contagens = { conforme: 0, divergente: 0, atencao: 0, nao_verificavel: 0 };

/** Quantas verificações caíram em cada situação. */
export function contarPorStatus(verificacoes: Verificacao[]): Contagens {
  return verificacoes.reduce<Contagens>((acc, v) => ({ ...acc, [v.status]: acc[v.status] + 1 }), { ...ZERO });
}
```

- [ ] **Passo 4: rodar e ver passar**

Run: `pnpm -C web test -- contagens`
Expected: PASS (dois casos).

- [ ] **Passo 5: escrever o teste do resumo no relatório**

Em `web/src/ui/EtapaRelatorio.test.tsx`, acrescentar ao `describe('EtapaRelatorio')`:

```tsx
  test('o resumo mostra a contagem por situação nos dois casos', async () => {
    const { unmount } = render(<Harness cliente={clienteCom(vi.fn(async () => parecer))} entrada={ok()} />);
    const itens = () => within(screen.getByRole('list', { name: 'Contagem por situação' })).getAllByRole('listitem');
    expect(itens().map((li) => li.textContent)).toEqual(['16 Conforme', '0 Divergente', '0 Atenção', '0 Não verificável']);
    unmount();

    render(<Harness cliente={clienteCom(vi.fn(async () => parecer))} entrada={naoOk()} />);
    expect(itens().map((li) => li.textContent)).toEqual(['9 Conforme', '2 Divergente', '4 Atenção', '1 Não verificável']);
  });

  test('os pontos de atenção do parecer aparecem no topo, uma única vez', async () => {
    render(<Harness cliente={clienteCom(vi.fn(async () => parecer))} entrada={ok()} />);
    expect(await screen.findByText('Conferir horário na fachada')).toBeInTheDocument();
    expect(screen.getAllByText('Conferir horário na fachada')).toHaveLength(1);
  });
```

- [ ] **Passo 6: rodar e ver falhar**

Run: `pnpm -C web test -- EtapaRelatorio`
Expected: FAIL, porque não existe lista com o nome "Contagem por situação".

- [ ] **Passo 7: acrescentar o resumo ao relatório**

Em `web/src/ui/EtapaRelatorio.tsx`:

1. Importar a função e o tipo, junto das importações que já existem:

```tsx
import { contarPorStatus } from './contagens';
```

2. Dentro do componente, ao lado de `const custo = ...`:

```tsx
  const contagens = contarPorStatus(estado.verificacoes);
  const SITUACOES = ['conforme', 'divergente', 'atencao', 'nao_verificavel'] as const;
```

3. No `<header className="cabecalho">`, logo depois do parágrafo da recomendação, acrescentar:

```tsx
        <ul className="contagens" aria-label="Contagem por situação">
          {SITUACOES.map((s) => (
            <li key={s} className={s}><strong>{contagens[s]}</strong> <span>{ROTULO_STATUS[s]}</span></li>
          ))}
        </ul>
        {estado.parecer && estado.parecer.pontos_de_atencao.length > 0 && (
          <div className="pontos-atencao">
            <h3>Pontos de atenção</h3>
            <ul>{estado.parecer.pontos_de_atencao.map((p) => <li key={p}>{p}</li>)}</ul>
          </div>
        )}
```

4. Na seção do parecer, mais abaixo, remover a linha que repetia os pontos de atenção, para não duplicar:

```tsx
          {estado.parecer.pontos_de_atencao.length > 0 && <ul>{estado.parecer.pontos_de_atencao.map((p) => <li key={p}>{p}</li>)}</ul>}
```

- [ ] **Passo 8: estilos do resumo**

Em `web/src/estilos/componentes.css`, acrescentar antes do bloco `@media (max-width: 720px)`:

```css
.cabecalho { display: flex; flex-direction: column; gap: var(--espaco-3); align-items: flex-start; margin: 0 0 var(--espaco-5); }
.contagens { list-style: none; padding: 0; margin: 0; display: flex; flex-wrap: wrap; gap: var(--espaco-4); }
.contagens li { display: flex; align-items: baseline; gap: var(--espaco-2); }
.contagens strong { font-size: var(--fonte-5); line-height: 1; }
.contagens .conforme strong { color: var(--cor-conforme); }
.contagens .divergente strong { color: var(--cor-divergente); }
.contagens .atencao strong { color: var(--cor-atencao); }
.contagens .nao_verificavel strong { color: var(--cor-neutra); }
.pontos-atencao { border-left: 4px solid var(--cor-atencao); padding-left: var(--espaco-3); }
.pontos-atencao h3 { font-size: var(--fonte-3); margin: 0 0 var(--espaco-1); }
.pontos-atencao ul { margin: 0; padding-left: var(--espaco-4); }
```

- [ ] **Passo 9: regras de impressão**

`web/src/estilos/impressao.css` passa a ser:

```css
@page { size: A4; margin: 14mm; }

@media print {
  .botoes, .etapas, .zona, button, .introducao, .painel-docs { display: none !important; }
  .app { max-width: none; padding: 0; }
  .evidencias video { display: none; }

  body { background: #fff; font-size: 10pt; }
  .secao, .cartao, .anexos li, .fila li, .evidencias li { box-shadow: none; }

  thead { display: table-header-group; }
  tr, .evidencias li, .contagens li { break-inside: avoid; }
  h2, h3 { break-after: avoid; }
  .evidencias { break-before: page; }

  .badge { background: transparent !important; border-color: currentColor; }
  .badge.conforme { color: var(--cor-conforme); }
  .badge.divergente { color: var(--cor-divergente); }
  .badge.atencao { color: var(--cor-atencao); }
  .badge.nao_verificavel { color: var(--cor-neutra); }
  .recomendacao { background: transparent !important; border: 2px solid currentColor; }
  .recomendacao.apto { color: var(--cor-conforme); }
  .recomendacao.nao_apto { color: var(--cor-divergente); }
  .recomendacao.revisao_manual { color: var(--cor-atencao); }
}
```

- [ ] **Passo 10: rodar tudo**

Run: `pnpm lint && pnpm test && pnpm build`
Expected: PASS, sem avisos. O teste antigo que procurava o texto do ponto de atenção continua passando, porque o texto agora vive no topo.

- [ ] **Passo 11: commit**

```bash
git add web/src/ui/contagens.ts web/src/ui/contagens.test.ts web/src/ui/EtapaRelatorio.tsx web/src/ui/EtapaRelatorio.test.tsx web/src/estilos
git commit -m "Resumo executivo no relatório e regras de impressão em página" -m "Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Tarefa 4: região de aviso sempre presente na etapa 2

**Files:**
- Modify: `web/src/ui/EtapaAnexos.tsx` (região de aviso), `web/src/ui/EtapaAnexos.test.tsx` (uma asserção existente e um caso novo)
- Test: `web/src/ui/EtapaAnexos.test.tsx`

**Interfaces:**
- Consumes: `motivoBloqueio`, que já existe na tela.
- Produces: a região `role="status"` presente no documento em todos os estados da etapa 2, com o texto vazio quando não há bloqueio.

- [ ] **Passo 1: ajustar a asserção existente e escrever o caso novo**

Em `web/src/ui/EtapaAnexos.test.tsx`, no teste "Continuar só habilita com todos os obrigatórios presentes, mostra o que falta e avança para a etapa 3", trocar a linha que exige a ausência da região:

```tsx
    expect(screen.queryByRole('status')).toBeNull();
```

por:

```tsx
    expect(screen.getByRole('status')).toHaveTextContent('');
```

E acrescentar ao `describe`:

```tsx
  test('a região de aviso existe desde o início, mesmo antes de qualquer arquivo', () => {
    render(<Harness classificar={porNome({})} />);
    const regiao = screen.getByRole('status');
    expect(regiao).toBeInTheDocument();
    expect(regiao).toHaveTextContent('Adicione ao menos um arquivo');
  });
```

- [ ] **Passo 2: rodar e ver falhar**

Run: `pnpm -C web test -- EtapaAnexos`
Expected: FAIL no teste ajustado, porque hoje a região some do documento quando não há motivo de bloqueio.

- [ ] **Passo 3: manter a região sempre montada**

Em `web/src/ui/EtapaAnexos.tsx`, trocar a linha da região dentro de `Botoes`:

```tsx
          {motivoBloqueio && <small className="motivo-bloqueio" role="status">{motivoBloqueio}</small>}
```

por:

```tsx
          <small className="motivo-bloqueio" role="status">{motivoBloqueio}</small>
```

Uma região viva precisa existir no documento antes de mudar de conteúdo para que o leitor de tela anuncie a mudança de forma confiável.

- [ ] **Passo 4: rodar e ver passar**

Run: `pnpm -C web test -- EtapaAnexos`
Expected: PASS, incluindo o caso novo.

- [ ] **Passo 5: rodar tudo**

Run: `pnpm lint && pnpm test && pnpm build`
Expected: PASS, sem avisos.

- [ ] **Passo 6: commit**

```bash
git add web/src/ui/EtapaAnexos.tsx web/src/ui/EtapaAnexos.test.tsx
git commit -m "Região de aviso da etapa 2 passa a existir sempre no documento" -m "Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Tarefa 5: verificação 16 distingue ausência de falha de análise

**Files:**
- Modify: `web/src/rules/verificacoes/anexos.ts:7`
- Test: `web/src/rules/verificacoes/anexos.test.ts`

**Interfaces:**
- Consumes: `EntradaMotor.anexosEnviados`, que já traz `tipo` e `falhou` de cada anexo.
- Produces: a mesma assinatura de `verificarAnexos(e: EntradaMotor): Verificacao`, com a presença contada pelos anexos enviados em vez das observações.

- [ ] **Passo 1: escrever o teste**

Em `web/src/rules/verificacoes/anexos.test.ts`, acrescentar ao `describe('completude e qualidade (16)')`:

```ts
  test('documento enviado cuja análise falhou não é contado como ausente', () => {
    const e = ok();
    e.anexosEnviados = e.anexosEnviados.map((a) => (a.tipo === 'nf_ambev' ? { ...a, falhou: true } : a));
    e.observacoes = e.observacoes.filter((o) => o.tipo !== 'nf_ambev');
    const v = verificarAnexos(e);
    expect(v.status).toBe('atencao');
    expect(v.observado).toMatch(/1 arquivo\(s\) não analisado/);
    expect(v.observado).not.toMatch(/faltam/);
  });
```

- [ ] **Passo 2: rodar e ver falhar**

Run: `pnpm -C web test -- anexos`
Expected: FAIL na última asserção, porque hoje o observado traz "faltam: NF Ambev" junto com a contagem de arquivos não analisados.

- [ ] **Passo 3: contar a presença pelos anexos enviados**

Em `web/src/rules/verificacoes/anexos.ts`, trocar a linha:

```ts
  const presentes = new Set(e.observacoes.map((o) => o.tipo));
```

por:

```ts
  const presentes = new Set(e.anexosEnviados.map((a) => a.tipo));
```

O restante da função não muda: a contagem de arquivos não analisados por falha continua sendo um problema separado, e as checagens de qualidade continuam percorrendo as observações que existem.

- [ ] **Passo 4: rodar e ver passar**

Run: `pnpm -C web test -- anexos`
Expected: PASS. O teste antigo "tipo obrigatório faltando" continua verde, porque ele remove o tipo das duas listas.

- [ ] **Passo 5: rodar tudo**

Run: `pnpm lint && pnpm test && pnpm build`
Expected: PASS. O teste dourado do motor continua verde: nas duas fixtures, todo anexo enviado tem observação correspondente.

- [ ] **Passo 6: commit**

```bash
git add web/src/rules/verificacoes/anexos.ts web/src/rules/verificacoes/anexos.test.ts
git commit -m "Verificação 16 separa documento ausente de análise que falhou" -m "Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Tarefa 6: ADR-008 e alinhamento da documentação

**Files:**
- Create: `docs/adrs/ADR-008-sistema-visual-em-css-puro.md`
- Modify: `README.md` (tabela de estrutura), `docs/superpowers/specs/2026-09-03-passe-de-design-design.md` (linha de status)
- Test: não há teste automatizado; a verificação é leitura, busca por travessão e a suíte continuar verde.

**Interfaces:**
- Consumes: as decisões da seção 2 da spec.
- Produces: o registro da decisão do sistema visual.

- [ ] **Passo 1: conferir a numeração**

Run: `ls docs/adrs/`
Expected: a última é `ADR-007-classificacao-automatica-em-workflow-dedicado.md`. Se já existir uma ADR-008, pare e reporte.

- [ ] **Passo 2: escrever a ADR**

Criar `docs/adrs/ADR-008-sistema-visual-em-css-puro.md`:

```md
# ADR-008: sistema visual em CSS puro, com tokens e camadas

Data: 2026-09-03. Status: aceita. Decisores: José Romualdo.

## Contexto

A interface foi construída priorizando fluxo e regras. A folha de estilo tinha 71 linhas, a etapa 1 apresentava 29 campos em coluna única, não havia indicação de foco e o relatório impresso era a tela sem tratamento de página. Ao ver o fluxo pronto, a área de produto pediu um passe de design.

## Decisão

O visual passa a ser um sistema em CSS puro, dividido em quatro camadas importadas por `web/src/styles.css`: tokens, base, componentes e impressão. Nenhuma dependência nova, nenhuma fonte externa e nenhum passo de build. As cores de situação são tokens com contraste mínimo de 4,5 para 1 sobre branco, garantido por teste automatizado que calcula a razão de contraste a partir do próprio arquivo de tokens.

## Motivações

- O projeto tem cinco telas, e uma biblioteca de utilitários acrescentaria dependência, ruído de classe no JSX e mais superfície de revisão do que o problema pede.
- As regras de impressão ficam mais simples de controlar em uma camada própria, e o relatório impresso é um entregável do produto.
- Um sistema neutro, com tokens nomeados, permite aplicar a identidade real do Zé depois trocando valores, sem reescrever telas.

## Alternativas descartadas

- Tailwind ou outra biblioteca de utilitários: dependência e passo de build novos, e listas longas de classes no JSX.
- CSS Modules: escopo por componente é pouco útil com cinco telas e fragmenta as regras de impressão, que precisam enxergar o documento inteiro.
- Passe cosmético na folha existente: não resolveria a ausência de hierarquia, que era a reclamação.

## Riscos conhecidos e mitigações

- Sem escopo por componente, uma classe genérica pode vazar entre telas: as classes são nomeadas por componente e a revisão de cada tarefa confere colisões.
- O contraste pode regredir em uma alteração futura de cor: o teste de contraste lê o arquivo de tokens e falha se qualquer cor de situação cair abaixo do mínimo.
- O comportamento de impressão não é verificável em teste automatizado: fica registrado como checagem manual no roteiro.

## Consequências

- Positivas: hierarquia visual, foco visível, contraste garantido por teste, relatório impresso legível e base pronta para receber identidade de marca.
- Negativas: as classes continuam globais, e quem alterar CSS precisa saber em qual camada mexer.

## ADRs relacionadas

ADR-006 (oxlint no lugar do ESLint), pela mesma preferência por menos dependência no frontend.
```

- [ ] **Passo 3: atualizar o README**

Em `README.md`, na tabela de estrutura, trocar a descrição da pasta `web/` para mencionar o sistema visual:

```md
| `web/` | Frontend estático (Vite + React + TypeScript) com sistema visual em CSS puro por camadas em `web/src/estilos/`, publicado no GitHub Pages |
```

- [ ] **Passo 4: atualizar a linha de status da spec**

Em `docs/superpowers/specs/2026-09-03-passe-de-design-design.md`, trocar a linha de status por:

```md
Data: 2026-09-03. Status: aceita; implementada conforme `docs/superpowers/plans/2026-09-03-passe-de-design.md`; decisão registrada na ADR-008. Decisores: José Romualdo (produto), com apoio do Claude Code.
```

- [ ] **Passo 5: verificar**

Run: `grep -rnP '\x{2014}' docs/adrs/ADR-008-sistema-visual-em-css-puro.md README.md docs/superpowers/specs/2026-09-03-passe-de-design-design.md; pnpm lint && pnpm test`
Expected: o `grep` não encontra nada (sai com código 1) e a suíte segue verde. Se o seu `grep` não aceitar `-P`, use `rg` e diga no relatório qual usou.

- [ ] **Passo 6: commit**

```bash
git add docs/adrs/ADR-008-sistema-visual-em-css-puro.md README.md docs/superpowers/specs/2026-09-03-passe-de-design-design.md
git commit -m "ADR-008 e documentação do sistema visual" -m "Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Autorrevisão do plano

- Cobertura da spec: seção 3 (sistema visual) na Tarefa 1; seção 4 (etapa 1 em blocos) na Tarefa 2; seção 5 (relatório e impressão) na Tarefa 3; seção 6 (etapas 2 e 3) na Tarefa 1, que reescreve as classes de lista e painel usadas por essas telas, mais a Tarefa 4; seção 7 (dívidas): contraste na Tarefa 1, região de aviso na Tarefa 4, verificação 16 na Tarefa 5; seção 8 (testes) distribuída; seção 9 (ADR) na Tarefa 6.
- Consistência de nomes: `Secao`, `Largura`, `contarPorStatus`, `Contagens`, as variáveis de token e as classes `.secao`, `.grade`, `.campo-curto`, `.campo-medio`, `.campo-largo`, `.campo-longo`, `.contagens`, `.pontos-atencao` aparecem com a mesma grafia em todas as tarefas.
- Dependências entre tarefas: 1 é pré-requisito de 2, 3 e 4; 5 e 6 são independentes das demais. Executar em ordem numérica.
- Verificação manual que fica com o controlador, porque não é afirmável em teste: aparência das quatro telas no desktop e no celular, e a pré-visualização de impressão do relatório.

