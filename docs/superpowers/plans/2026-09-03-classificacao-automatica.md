# Classificação automática dos anexos: plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** cada imagem ou PDF anexado é classificado pelo modelo antes da análise, o usuário só corrige o que veio errado, e um painel de documentos com obrigatoriedade condicionada ao formulário bloqueia o avanço até haver ao menos um arquivo de cada tipo exigido.

**Architecture:** um terceiro workflow do n8n (`classificar-arquivo`) reaproveita os módulos de `n8n/lib` com um prompt curto e um schema estrito novo; no frontend, uma fila de classificação com concorrência 2 chama o webhook ao anexar e alimenta o reducer, que preenche o tipo quando a confiança atinge o limiar e o formato é compatível; a lista de tipos obrigatórios vira uma função pura em `shared/config`, usada pelo checklist, pelo portão da etapa 2 e pela verificação 16 do motor.

**Tech Stack:** TypeScript, React 19, Vite, Vitest com Testing Library e jsdom (frontend); JavaScript puro nos nós Code do n8n Cloud, gerados por `scripts/build-n8n.ts`; OpenRouter com `google/gemini-2.5-flash` e `response_format` em JSON Schema estrito; pnpm workspace.

**Spec:** `docs/superpowers/specs/2026-09-03-classificacao-automatica-design.md` (leia antes de cada tarefa; a spec da versão inicial está em `docs/superpowers/specs/2026-09-02-onboarding-pdv-design.md`).

## Global Constraints

- Textos de interface, mensagens, testes, commits e documentação em pt-BR com acentos. Nunca usar o travessão longo (em dash) em nenhum texto; reticências são três pontos.
- Contratos HTTP em `snake_case`; código TypeScript interno em `camelCase`.
- Frontend sem `localStorage` ou qualquer armazenamento. Chave do OpenRouter só em credencial do n8n; token do webhook só em credencial do n8n e no segredo do repositório.
- Modelos: classificação e análise `google/gemini-2.5-flash`; parecer `google/gemini-2.5-pro`. Limiar de confiança da classificação: `0.6`.
- Limites: 11 MB por vídeo (`11534336` bytes), 8 MB por imagem ou PDF (`8388608` bytes); formatos `video/mp4`, `image/jpeg`, `image/png`, `application/pdf`. Vídeo não passa pelo modelo de classificação.
- Filas com concorrência 2 (`limites.concorrencia`); uma repetição após 3 s em `servidor`, `tempo` e `rede`; timeout de 95 s. Erros de classificação nunca bloqueiam: o arquivo fica em "Escolha o tipo".
- Toda tarefa entrega testes (Vitest) e roda `pnpm lint && pnpm test && pnpm build` (e `npx tsc --noEmit -p tsconfig.json` quando tocar a raiz) antes do commit. Commits pequenos, em pt-BR, terminados com a linha `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`.
- Módulos de `n8n/lib` não usam `import` nem `require`; recebem `RECURSOS` por parâmetro. Nunca editar código de nó na interface do n8n.
- Trabalhar em um worktree da branch `feat/classificacao-automatica`, criada a partir de `main` (que está em `a82ef2a` ou posterior).

## Estrutura de arquivos

| Arquivo | Responsabilidade |
|---|---|
| `shared/config/obrigatorios.ts` (novo) | `tiposObrigatorios(formulario)`: lista de tipos exigidos, condicionada às declarações |
| `shared/config/tipos.json`, `limites.json`, `modelos.json` | `equipamentos` deixa de ser sempre obrigatório; limiar `confiancaMinimaClassificacao`; modelo `classificacao` |
| `shared/schemas/classificacao.json` (novo), `shared/schemas/index.ts` | Schema estrito da classificação e variantes modelo e completa |
| `n8n/prompts/classificar.md` (novo), `n8n/recursos.ts` | Prompt da classificação carregado nos recursos |
| `n8n/lib/validar-entrada.js`, `montar-requisicao.js`, `validar-saida.js` | Funções `validarEntradaClassificacao`, `montarRequisicaoClassificacao`, `validarClassificacao` |
| `n8n/templates/classificar-arquivo.template.json` (novo), `scripts/build-n8n.ts`, `n8n/workflows/classificar-arquivo.json` (gerado) | Terceiro workflow e seus wrappers |
| `scripts/smoke.ts` | Chamada de classificação antes da análise |
| `web/src/tipos/index.ts`, `web/src/api/clienteN8n.ts` | `RespostaClassificacao` e `classificarArquivo` |
| `web/src/fluxo/filaClassificacao.ts` (novo), `web/src/fluxo/estadoApp.ts` | Fila de classificação; `Classificacao` no anexo, ação `anexo_classificacao`, `faltantes`, portão da etapa 2 |
| `web/src/ui/EtapaAnexos.tsx`, `web/src/ui/PainelDocumentos.tsx` (novo), `web/src/styles.css`, `web/src/App.tsx` | Tela de anexos com selos, seletor, painel de documentos e layout responsivo |
| `web/src/ui/EtapaRelatorio.tsx` | Tipo detectado e reclassificação por arquivo |
| `web/src/rules/verificacoes/anexos.ts` | Verificação 16 usa `tiposObrigatorios` |
| `docs/adrs/ADR-007-classificacao-automatica-em-workflow-dedicado.md` (novo), `docs/operacao.md`, `docs/testes-manuais.md`, `README.md` | Decisão, operação do terceiro workflow, roteiro e visão geral |

---

### Tarefa 1: obrigatoriedade condicionada ao formulário e parâmetros da classificação na configuração

**Files:**
- Create: `shared/config/obrigatorios.ts`
- Modify: `shared/config/tipos.json` (campo `obrigatorio` de `equipamentos`), `shared/config/limites.json`, `shared/config/modelos.json`, `shared/config/index.ts`, `web/src/rules/verificacoes/anexos.ts:6`
- Test: `shared/config/obrigatorios.test.ts` (novo), `shared/config/config.test.ts`, `web/src/rules/verificacoes/anexos.test.ts`

**Interfaces:**
- Consumes: `tipos.json` (chaves na ordem `fachada, refrigerador, camara_fria, equipamentos, nf_ambev, cartao_cnpj, video_geral`).
- Produces: `tiposObrigatorios(f: DeclaracoesDoFormulario): TipoAnexo[]` com `DeclaracoesDoFormulario = { camaraFria: SimNao; computadorInternet: SimNao; impressoraTermica: SimNao }` (o tipo `Formulario` do frontend é estruturalmente compatível); `limites.confiancaMinimaClassificacao = 0.6`; `modelos.classificacao = 'google/gemini-2.5-flash'`. Semântica nova de `TIPOS_CONFIG[t].obrigatorio`: "sempre obrigatório" (os condicionais `camara_fria` e `equipamentos` ficam `false`).

- [ ] **Passo 1: escrever os testes da função**

Criar `shared/config/obrigatorios.test.ts`:

```ts
import { describe, expect, test } from 'vitest';
import { tiposObrigatorios } from './obrigatorios';

const base = { camaraFria: 'nao', computadorInternet: 'nao', impressoraTermica: 'nao' } as const;

describe('tiposObrigatorios', () => {
  test('sem câmara fria nem equipamentos declarados, exige os cinco sempre obrigatórios na ordem da configuração', () => {
    expect(tiposObrigatorios(base)).toEqual(['fachada', 'refrigerador', 'nf_ambev', 'cartao_cnpj', 'video_geral']);
  });
  test('câmara fria declarada "sim" passa a ser obrigatória', () => {
    expect(tiposObrigatorios({ ...base, camaraFria: 'sim' })).toContain('camara_fria');
  });
  test('computador declarado torna balcão e equipamentos obrigatório', () => {
    expect(tiposObrigatorios({ ...base, computadorInternet: 'sim' })).toContain('equipamentos');
  });
  test('impressora declarada também exige equipamentos, e tudo declarado exige os sete na ordem da configuração', () => {
    expect(tiposObrigatorios({ ...base, impressoraTermica: 'sim' })).toContain('equipamentos');
    expect(tiposObrigatorios({ camaraFria: 'sim', computadorInternet: 'sim', impressoraTermica: 'sim' })).toEqual(['fachada', 'refrigerador', 'camara_fria', 'equipamentos', 'nf_ambev', 'cartao_cnpj', 'video_geral']);
  });
});
```

Em `shared/config/config.test.ts`, trocar o teste `limites conforme a spec` e o final do teste `CNAEs e padrões regionais` por:

```ts
  test('limites conforme a spec, incluindo o limiar da classificação', () => {
    expect(limites).toMatchObject({ maxBytesVideo: 11534336, maxBytesImagemPdf: 8388608, concorrencia: 2, timeoutFetchMs: 95000, esperaRetryMs: 3000, duracaoMinimaVideoS: 10, diasValidadeDocumento: 90, confiancaMinimaClassificacao: 0.6 });
  });
  test('tipos condicionais não são sempre obrigatórios', () => {
    expect(TIPOS_CONFIG.camara_fria.obrigatorio).toBe(false);
    expect(TIPOS_CONFIG.equipamentos.obrigatorio).toBe(false);
    expect(TIPOS_CONFIG.fachada.obrigatorio).toBe(true);
  });
```

e, dentro de `CNAEs e padrões regionais`, acrescentar após a linha do `modelos.parecer`:

```ts
    expect(modelos.classificacao).toBe('google/gemini-2.5-flash');
```

- [ ] **Passo 2: rodar e ver falhar**

Run: `pnpm test:node`
Expected: FAIL em `obrigatorios.test.ts` ("Cannot find module './obrigatorios'"), em `limites conforme a spec` (falta `confiancaMinimaClassificacao`), em `tipos condicionais` (`equipamentos.obrigatorio` é `true`) e em `modelos.classificacao`.

- [ ] **Passo 3: implementar a configuração**

`shared/config/obrigatorios.ts`:

```ts
import type { TipoAnexo } from '../schemas/index';
import tipos from './tipos.json';

export type SimNao = 'sim' | 'nao';
export interface DeclaracoesDoFormulario { camaraFria: SimNao; computadorInternet: SimNao; impressoraTermica: SimNao }

const CONFIG = tipos as Record<TipoAnexo, { obrigatorio: boolean }>;
const ORDEM = Object.keys(CONFIG) as TipoAnexo[];

/** Tipos de anexo exigidos para este PDV: os sempre obrigatórios mais os condicionados às declarações da etapa 1. */
export function tiposObrigatorios(f: DeclaracoesDoFormulario): TipoAnexo[] {
  const exigidos = new Set<TipoAnexo>(ORDEM.filter((t) => CONFIG[t].obrigatorio));
  if (f.camaraFria === 'sim') exigidos.add('camara_fria');
  if (f.computadorInternet === 'sim' || f.impressoraTermica === 'sim') exigidos.add('equipamentos');
  return ORDEM.filter((t) => exigidos.has(t));
}
```

Em `shared/config/tipos.json`, na linha de `equipamentos`, trocar `"obrigatorio": true` por `"obrigatorio": false` (nada mais muda no arquivo).

`shared/config/limites.json` passa a ser:

```json
{ "maxBytesVideo": 11534336, "maxBytesImagemPdf": 8388608, "concorrencia": 2, "timeoutFetchMs": 95000, "esperaRetryMs": 3000, "duracaoMinimaVideoS": 10, "diasValidadeDocumento": 90, "confiancaMinimaClassificacao": 0.6 }
```

`shared/config/modelos.json` passa a ser:

```json
{ "analise": "google/gemini-2.5-flash", "parecer": "google/gemini-2.5-pro", "classificacao": "google/gemini-2.5-flash" }
```

Em `shared/config/index.ts`, acrescentar ao final:

```ts
export { tiposObrigatorios, type DeclaracoesDoFormulario } from './obrigatorios';
```

- [ ] **Passo 4: rodar e ver passar**

Run: `pnpm test:node`
Expected: PASS (os quatro testes novos e os ajustados). O teste `tipos.json cobre exatamente os sete tipos` continua passando.

- [ ] **Passo 5: escrever os testes da verificação 16 com a lista condicionada**

Em `web/src/rules/verificacoes/anexos.test.ts`, substituir o teste `câmara fria não é obrigatória` por estes três (a fixture aprovada declara câmara fria "sim" e computador e impressora "sim"):

```ts
  test('câmara fria declarada "não" não é obrigatória', () => {
    const e = ok(); e.formulario = { ...e.formulario, camaraFria: 'nao' };
    e.observacoes = e.observacoes.filter((o) => o.tipo !== 'camara_fria'); e.anexosEnviados = e.anexosEnviados.filter((a) => a.tipo !== 'camara_fria');
    expect(verificarAnexos(e).status).toBe('conforme');
  });
  test('câmara fria declarada "sim" sem anexo vira atenção', () => {
    const e = ok();
    e.observacoes = e.observacoes.filter((o) => o.tipo !== 'camara_fria'); e.anexosEnviados = e.anexosEnviados.filter((a) => a.tipo !== 'camara_fria');
    const v = verificarAnexos(e);
    expect(v.status).toBe('atencao');
    expect(v.observado).toMatch(/faltam: Câmara fria/);
  });
  test('balcão e equipamentos só é obrigatório com computador ou impressora declarados', () => {
    const e = ok(); e.formulario = { ...e.formulario, computadorInternet: 'nao', impressoraTermica: 'nao' };
    e.observacoes = e.observacoes.filter((o) => o.tipo !== 'equipamentos'); e.anexosEnviados = e.anexosEnviados.filter((a) => a.tipo !== 'equipamentos');
    expect(verificarAnexos(e).status).toBe('conforme');
  });
```

- [ ] **Passo 6: rodar e ver falhar**

Run: `pnpm -C web test -- anexos`
Expected: FAIL em `câmara fria declarada "sim" sem anexo vira atenção` (hoje câmara fria nunca entra em "faltam") e em `balcão e equipamentos só é obrigatório...` (hoje `equipamentos` é lido de `TIPOS_CONFIG`, que passou a `false`; a lista fixa perde o item e o teste `tipo obrigatório faltando` segue passando).

- [ ] **Passo 7: usar a função na verificação 16**

Em `web/src/rules/verificacoes/anexos.ts`, trocar a importação e a primeira linha da função:

```ts
import { TIPOS_CONFIG, limites, tiposObrigatorios } from '@shared/config/index';
```

```ts
  const obrigatorios = tiposObrigatorios(e.formulario);
```

(remover a linha que filtrava `TIPOS_CONFIG[t].obrigatorio`).

- [ ] **Passo 8: rodar tudo e ver passar**

Run: `pnpm lint && pnpm test && pnpm build`
Expected: PASS. O teste dourado (`web/src/rules/motor.test.ts`) continua verde: a fixture aprovada tem câmara fria declarada e anexada; a reprovada declara "não".

- [ ] **Passo 9: commit**

```bash
git add shared/config web/src/rules/verificacoes/anexos.ts web/src/rules/verificacoes/anexos.test.ts
git commit -m "Obrigatoriedade dos anexos condicionada ao formulário, com limiar e modelo da classificação na configuração" -m "Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Tarefa 2: schema, prompt e recursos da classificação

**Files:**
- Create: `shared/schemas/classificacao.json`, `n8n/prompts/classificar.md`, `n8n/recursos.test.ts`
- Modify: `shared/schemas/index.ts`, `n8n/recursos.ts`, `vitest.config.ts:6` (include de `n8n/**/*.test.ts`)
- Test: `shared/schemas/schemas.test.ts`, `n8n/recursos.test.ts`

**Interfaces:**
- Consumes: `TIPOS`, `SchemaObjeto`, `METADADOS` de `shared/schemas/index.ts`.
- Produces: `TIPOS_DETECTADOS` (os sete tipos mais `'indefinido'`), `type TipoDetectado`, `schemaClassificacaoModelo: SchemaObjeto` (campos `tipo_detectado`, `confianca`, `motivo`), `schemaClassificacaoCompleta(): SchemaObjeto` (acrescenta `arquivo_id`, `nome`, `mime`, `modelo`, `tokens`, `latencia_ms`); `Recursos.prompts.classificar` e `Recursos.schemas.classificacao`.

- [ ] **Passo 1: escrever os testes do schema**

Em `shared/schemas/schemas.test.ts`, ampliar a importação:

```ts
import {
  TIPOS, TIPOS_DETECTADOS, schemaClassificacaoCompleta, schemaClassificacaoModelo, schemaModeloObservacao, schemaObservacaoCompleta, schemaParecerModelo, schemaParecerCompleto,
  type TipoAnexo,
} from './index';
```

e acrescentar ao final do arquivo:

```ts
describe('schema da classificação', () => {
  const classificacao = { tipo_detectado: 'fachada', confianca: 0.92, motivo: 'Frente de loja com letreiro.' };
  const metadadosClassificacao = { arquivo_id: 'a1', nome: 'foto.jpeg', mime: 'image/jpeg', modelo: 'google/gemini-2.5-flash', tokens: { entrada: 1200, saida: 40 }, latencia_ms: 1800 };

  test('amostra válida passa no schema do modelo e no completo', () => {
    expect(ajv.validate(schemaClassificacaoModelo, classificacao)).toBe(true);
    expect(ajv.validate(schemaClassificacaoCompleta(), { ...classificacao, ...metadadosClassificacao })).toBe(true);
  });
  test('enum de tipo_detectado cobre os sete tipos e indefinido, e rejeita outros valores', () => {
    expect((schemaClassificacaoModelo.properties.tipo_detectado as { enum: string[] }).enum).toEqual([...TIPOS_DETECTADOS]);
    expect(ajv.validate(schemaClassificacaoModelo, { ...classificacao, tipo_detectado: 'geladeira' })).toBe(false);
  });
  test('schema completo exige metadados e todo objeto é estrito', () => {
    expect(ajv.validate(schemaClassificacaoCompleta(), classificacao)).toBe(false);
    for (const [caminho, obj] of objetosDe(schemaClassificacaoCompleta())) {
      expect(obj.additionalProperties, caminho).toBe(false);
      expect([...(obj.required as string[])].sort(), caminho).toEqual(Object.keys(obj.properties as object).sort());
    }
  });
});
```

Criar `n8n/recursos.test.ts`:

```ts
import { describe, expect, test } from 'vitest';
import { carregarRecursos } from './recursos';

describe('carregarRecursos', () => {
  const r = carregarRecursos();
  test('carrega o prompt, o schema e o modelo da classificação', () => {
    expect(r.prompts.classificar).toContain('Tipos possíveis');
    expect(r.schemas.classificacao.required).toEqual(['tipo_detectado', 'confianca', 'motivo']);
    expect(r.modelos.classificacao).toBe('google/gemini-2.5-flash');
  });
  test('continua carregando os prompts dos sete tipos, do sistema e do parecer', () => {
    expect(Object.keys(r.prompts).sort()).toEqual(['camara_fria', 'cartao_cnpj', 'classificar', 'equipamentos', 'fachada', 'nf_ambev', 'parecer', 'refrigerador', 'system', 'video_geral']);
  });
});
```

Em `vitest.config.ts`, trocar a linha do `include` por:

```ts
    include: ['shared/**/*.test.ts', 'n8n/**/*.test.js', 'n8n/**/*.test.ts', 'scripts/**/*.test.ts'],
```

- [ ] **Passo 2: rodar e ver falhar**

Run: `pnpm test:node`
Expected: FAIL: `schemas.test.ts` não compila as importações novas (`TIPOS_DETECTADOS` e os dois schemas não existem); `recursos.test.ts` falha porque `prompts.classificar` é indefinido.

- [ ] **Passo 3: criar o schema**

`shared/schemas/classificacao.json`:

```json
{
  "type": "object",
  "additionalProperties": false,
  "required": ["tipo_detectado", "confianca", "motivo"],
  "properties": {
    "tipo_detectado": {
      "type": "string",
      "enum": ["fachada", "refrigerador", "camara_fria", "equipamentos", "nf_ambev", "cartao_cnpj", "video_geral", "indefinido"],
      "description": "Tipo de documento do onboarding que o arquivo representa, ou indefinido"
    },
    "confianca": { "type": "number", "description": "Confiança da classificação entre 0 e 1" },
    "motivo": { "type": "string", "description": "Uma frase curta em pt-BR justificando a classificação" }
  }
}
```

Em `shared/schemas/index.ts`, acrescentar a importação junto das outras:

```ts
import classificacaoModelo from './classificacao.json';
```

logo após a declaração de `TIPOS` e `TipoAnexo`:

```ts
export const TIPOS_DETECTADOS = [...TIPOS, 'indefinido'] as const;
export type TipoDetectado = (typeof TIPOS_DETECTADOS)[number];
```

e ao final do arquivo:

```ts
export const schemaClassificacaoModelo = classificacaoModelo as SchemaObjeto;

const METADADOS_CLASSIFICACAO: Record<string, unknown> = {
  arquivo_id: METADADOS.arquivo_id, nome: METADADOS.nome, mime: METADADOS.mime,
  modelo: METADADOS.modelo, tokens: METADADOS.tokens, latencia_ms: METADADOS.latencia_ms,
};

export function schemaClassificacaoCompleta(): SchemaObjeto {
  return {
    ...schemaClassificacaoModelo,
    properties: { ...schemaClassificacaoModelo.properties, ...METADADOS_CLASSIFICACAO },
    required: [...schemaClassificacaoModelo.required, ...Object.keys(METADADOS_CLASSIFICACAO)],
  };
}
```

- [ ] **Passo 4: criar o prompt**

`n8n/prompts/classificar.md`:

```md
Classifique o arquivo enviado em um único tipo de documento do onboarding de um ponto de venda de bebidas. Não analise detalhes; apenas identifique o tipo.

Tipos possíveis:
- fachada: frente externa da loja, com letreiro, porta, calçada ou rua.
- refrigerador: geladeira, expositor vertical, freezer horizontal ou cervejeira vistos de perto, dentro da loja.
- camara_fria: câmara frigorífica, porta isotérmica ou interior de câmara com estoque.
- equipamentos: balcão de atendimento com computador, impressora térmica, maquininhas de cartão ou roteador.
- nf_ambev: nota fiscal ou DANFE de compra de bebidas, impressa ou em PDF.
- cartao_cnpj: comprovante de inscrição e situação cadastral (cartão CNPJ) da Receita Federal.
- video_geral: não se aplica a imagens nem a PDF; nunca use para este arquivo.
- indefinido: o arquivo não corresponde a nenhum tipo acima, ou não dá para ver o conteúdo.

Responda somente com o JSON pedido: tipo_detectado, confianca entre 0 e 1 e motivo em uma frase curta em pt-BR.
```

- [ ] **Passo 5: carregar nos recursos**

`n8n/recursos.ts` passa a ser:

```ts
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { TIPOS_CONFIG, limites, modelos } from '../shared/config/index';
import { TIPOS, schemaClassificacaoModelo, schemaModeloObservacao, schemaParecerModelo, type SchemaObjeto, type TipoAnexo } from '../shared/schemas/index';

export interface Recursos {
  prompts: Record<TipoAnexo | 'system' | 'parecer' | 'classificar', string>;
  schemas: Record<TipoAnexo | 'parecer' | 'classificacao', SchemaObjeto>;
  tipos: typeof TIPOS_CONFIG;
  limites: typeof limites;
  modelos: typeof modelos;
}

const raiz = dirname(fileURLToPath(import.meta.url));

export function carregarRecursos(): Recursos {
  const ler = (nome: string) => readFileSync(join(raiz, 'prompts', `${nome}.md`), 'utf8').trim();
  const prompts = Object.fromEntries([...TIPOS, 'system', 'parecer', 'classificar'].map((n) => [n, ler(n)])) as Recursos['prompts'];
  const schemas = Object.fromEntries([
    ...TIPOS.map((t) => [t, schemaModeloObservacao(t)]),
    ['parecer', schemaParecerModelo],
    ['classificacao', schemaClassificacaoModelo],
  ]) as Recursos['schemas'];
  return { prompts, schemas, tipos: TIPOS_CONFIG, limites, modelos };
}
```

- [ ] **Passo 6: rodar e ver passar**

Run: `pnpm test:node && npx tsc --noEmit -p tsconfig.json`
Expected: PASS. Atenção: o teste de sincronia em `scripts/build-n8n.test.ts` passa a FALHAR, porque `RECURSOS` embutido nos JSON versionados mudou (prompt, schema e modelo novos). Rode `pnpm build:n8n` para regenerar `n8n/workflows/*.json` e confirme com `pnpm test:node` que tudo voltou a passar; esses JSON regenerados entram no commit desta tarefa.

- [ ] **Passo 7: commit**

```bash
git add shared/schemas n8n/prompts/classificar.md n8n/recursos.ts n8n/recursos.test.ts n8n/workflows vitest.config.ts
git commit -m "Schema e prompt da classificação de anexos, carregados nos recursos do n8n" -m "Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Tarefa 3: funções dos nós Code para a classificação

**Files:**
- Modify: `n8n/lib/validar-entrada.js`, `n8n/lib/montar-requisicao.js`, `n8n/lib/validar-saida.js`
- Test: `n8n/lib/validar-entrada.test.js`, `n8n/lib/montar-requisicao.test.js`, `n8n/lib/validar-saida.test.js`

**Interfaces:**
- Consumes: `inferirMime`, `tamanhoBase64` (validar-entrada.js); `extrairConteudo`, `tokensDe` (validar-saida.js); `RECURSOS.prompts.classificar`, `RECURSOS.schemas.classificacao`, `RECURSOS.modelos.classificacao`, `RECURSOS.limites.maxBytesImagemPdf`, `RECURSOS.tipos` (Tarefa 2).
- Produces: `validarEntradaClassificacao(item, RECURSOS)` devolvendo `{ ok: true, entrada: { arquivo_id, nome, mime, base64, tamanho_bytes, inicio_ms } }` ou `{ ok: false, status, erro: { codigo, mensagem } }`; `montarRequisicaoClassificacao(entrada, RECURSOS)` devolvendo `{ url, body }`; `validarClassificacao(resposta, entrada, RECURSOS)` devolvendo `{ arquivo_id, nome, mime, tipo_detectado, confianca, motivo, modelo, tokens, latencia_ms }`.

- [ ] **Passo 1: escrever os testes**

Em `n8n/lib/validar-entrada.test.js`, ampliar a importação e acrescentar ao final:

```js
import { inferirMime, tamanhoBase64, validarEntrada, validarEntradaClassificacao } from './validar-entrada.js';
```

```js
describe('validarEntradaClassificacao', () => {
  const itemClassificacao = (extra = {}) => ({ body: { arquivo_id: 'c1' }, base64: 'aGVsbG8=', binario: { fileName: 'foto.jpeg', mimeType: 'image/jpeg' }, ...extra });
  test('imagem válida devolve a entrada sem tipo, com nome, mime e tamanho', () => {
    const r = validarEntradaClassificacao(itemClassificacao(), RECURSOS);
    expect(r.ok).toBe(true);
    expect(r.entrada).toMatchObject({ arquivo_id: 'c1', nome: 'foto.jpeg', mime: 'image/jpeg', tamanho_bytes: 5 });
    expect(r.entrada.tipo).toBeUndefined();
  });
  test('PDF é aceito', () => {
    expect(validarEntradaClassificacao(itemClassificacao({ binario: { fileName: 'cartao.pdf', mimeType: 'application/pdf' } }), RECURSOS).ok).toBe(true);
  });
  test('vídeo é recusado com formato_invalido', () => {
    const r = validarEntradaClassificacao(itemClassificacao({ binario: { fileName: 'tour.mp4', mimeType: 'video/mp4' } }), RECURSOS);
    expect(r).toMatchObject({ ok: false, status: 400, erro: { codigo: 'formato_invalido' } });
  });
  test('sem arquivo_id ou sem arquivo devolve 400', () => {
    expect(validarEntradaClassificacao(itemClassificacao({ body: {} }), RECURSOS).erro.codigo).toBe('arquivo_id_ausente');
    expect(validarEntradaClassificacao(itemClassificacao({ base64: '' }), RECURSOS).erro.codigo).toBe('arquivo_ausente');
  });
  test('imagem acima de 8 MB devolve 413', () => {
    const grande = 'A'.repeat(Math.ceil(((RECURSOS.limites.maxBytesImagemPdf + 3) * 4) / 3));
    expect(validarEntradaClassificacao(itemClassificacao({ base64: grande }), RECURSOS)).toMatchObject({ ok: false, status: 413, erro: { codigo: 'arquivo_grande' } });
  });
});
```

Em `n8n/lib/montar-requisicao.test.js`:

```js
import { montarRequisicao, montarRequisicaoClassificacao, preencher } from './montar-requisicao.js';
```

```js
describe('montarRequisicaoClassificacao', () => {
  const entradaClassificacao = (mime, nome) => ({ arquivo_id: 'c1', nome, mime, base64: 'QUJD', tamanho_bytes: 3, inicio_ms: 1 });
  test('imagem vira image_url com o prompt de classificação, o modelo de classificação e o schema estrito', () => {
    const { url, body } = montarRequisicaoClassificacao(entradaClassificacao('image/jpeg', 'foto.jpeg'), RECURSOS);
    expect(url).toBe('https://openrouter.ai/api/v1/chat/completions');
    expect(body.model).toBe(RECURSOS.modelos.classificacao);
    expect(body.messages[0]).toEqual({ role: 'system', content: RECURSOS.prompts.system });
    expect(body.messages[1].content[0]).toEqual({ type: 'text', text: RECURSOS.prompts.classificar });
    expect(body.messages[1].content[1]).toEqual({ type: 'image_url', image_url: { url: 'data:image/jpeg;base64,QUJD' } });
    expect(body.response_format).toEqual({ type: 'json_schema', json_schema: { name: 'classificacao_anexo', strict: true, schema: RECURSOS.schemas.classificacao } });
    expect(body.provider).toEqual({ require_parameters: true, data_collection: 'deny' });
    expect(body.plugins).toBeUndefined();
  });
  test('PDF vira parte file com o plugin file-parser', () => {
    const { body } = montarRequisicaoClassificacao(entradaClassificacao('application/pdf', 'cartao.pdf'), RECURSOS);
    expect(body.messages[1].content[1]).toEqual({ type: 'file', file: { filename: 'cartao.pdf', file_data: 'data:application/pdf;base64,QUJD' } });
    expect(body.plugins).toEqual([{ id: 'file-parser', pdf: { engine: 'native' } }]);
  });
});
```

Em `n8n/lib/validar-saida.test.js`:

```js
import { extrairConteudo, validarClassificacao, validarObservacao, validarParecer } from './validar-saida.js';
```

```js
describe('validarClassificacao', () => {
  const entradaClassificacao = { arquivo_id: 'c1', nome: 'foto.jpeg', mime: 'image/jpeg', inicio_ms: Date.now() - 50 };
  const classificacao = { tipo_detectado: 'fachada', confianca: 1.3, motivo: 'Frente de loja.' };
  test('devolve tipo, confiança limitada a 1, motivo e metadados', () => {
    const r = validarClassificacao(resposta(classificacao), entradaClassificacao, RECURSOS);
    expect(r).toMatchObject({ arquivo_id: 'c1', nome: 'foto.jpeg', mime: 'image/jpeg', tipo_detectado: 'fachada', confianca: 1, motivo: 'Frente de loja.', modelo: 'google/gemini-2.5-flash', tokens: { entrada: 1200, saida: 90 } });
    expect(r.latencia_ms).toBeGreaterThanOrEqual(50);
  });
  test('indefinido é aceito', () => {
    expect(validarClassificacao(resposta({ ...classificacao, tipo_detectado: 'indefinido', confianca: 0.2 }), entradaClassificacao, RECURSOS).tipo_detectado).toBe('indefinido');
  });
  test('tipo fora do enum ou confiança não numérica lançam', () => {
    expect(() => validarClassificacao(resposta({ ...classificacao, tipo_detectado: 'geladeira' }), entradaClassificacao, RECURSOS)).toThrow(/Classificação inválida/);
    expect(() => validarClassificacao(resposta({ ...classificacao, confianca: 'alta' }), entradaClassificacao, RECURSOS)).toThrow(/Classificação inválida/);
  });
});
```

- [ ] **Passo 2: rodar e ver falhar**

Run: `pnpm test:node`
Expected: FAIL nos três arquivos ("is not a function" ou export ausente).

- [ ] **Passo 3: implementar**

Acrescentar ao final de `n8n/lib/validar-entrada.js`:

```js
const FORMATOS_CLASSIFICAVEIS = ['image/jpeg', 'image/png', 'application/pdf'];

export function validarEntradaClassificacao(item, RECURSOS) {
  const body = (item && item.body) || {};
  const erro = (status, codigo, mensagem) => ({ ok: false, status, erro: { codigo, mensagem } });
  if (!body.arquivo_id) return erro(400, 'arquivo_id_ausente', 'Informe o campo arquivo_id');
  if (!item.base64) return erro(400, 'arquivo_ausente', 'Envie o arquivo no campo "arquivo"');
  const nome = (item.binario && item.binario.fileName) || 'arquivo';
  const mime = inferirMime(item.binario && item.binario.mimeType, nome);
  if (!FORMATOS_CLASSIFICAVEIS.includes(mime)) return erro(400, 'formato_invalido', `Formato ${mime || 'desconhecido'} não passa por classificação; envie JPEG, PNG ou PDF`);
  const tamanho = tamanhoBase64(item.base64);
  const limite = RECURSOS.limites.maxBytesImagemPdf;
  if (tamanho > limite) return erro(413, 'arquivo_grande', `Arquivo com ${tamanho} bytes; o limite é ${limite}`);
  return { ok: true, entrada: { arquivo_id: body.arquivo_id, nome, mime, base64: item.base64, tamanho_bytes: tamanho, inicio_ms: Date.now() } };
}
```

Acrescentar ao final de `n8n/lib/montar-requisicao.js`:

```js
export function montarRequisicaoClassificacao(entrada, RECURSOS) {
  const { nome, mime, base64 } = entrada;
  const dataUrl = `data:${mime};base64,${base64}`;
  const parte = mime === 'application/pdf'
    ? { type: 'file', file: { filename: nome, file_data: dataUrl } }
    : { type: 'image_url', image_url: { url: dataUrl } };
  const body = {
    model: RECURSOS.modelos.classificacao,
    messages: [
      { role: 'system', content: RECURSOS.prompts.system },
      { role: 'user', content: [{ type: 'text', text: RECURSOS.prompts.classificar }, parte] },
    ],
    response_format: { type: 'json_schema', json_schema: { name: 'classificacao_anexo', strict: true, schema: RECURSOS.schemas.classificacao } },
    provider: { require_parameters: true, data_collection: 'deny' },
  };
  if (mime === 'application/pdf') body.plugins = [{ id: 'file-parser', pdf: { engine: 'native' } }];
  return { url: 'https://openrouter.ai/api/v1/chat/completions', body };
}
```

Acrescentar ao final de `n8n/lib/validar-saida.js`:

```js
export function validarClassificacao(resposta, entrada, RECURSOS) {
  const c = extrairConteudo(resposta);
  const tiposValidos = [...Object.keys(RECURSOS.tipos), 'indefinido'];
  if (!tiposValidos.includes(c.tipo_detectado) || typeof c.confianca !== 'number' || typeof c.motivo !== 'string') {
    throw new Error('Classificação inválida: campos obrigatórios ausentes ou fora do enum');
  }
  return {
    arquivo_id: entrada.arquivo_id, nome: entrada.nome, mime: entrada.mime,
    tipo_detectado: c.tipo_detectado, confianca: Math.min(1, Math.max(0, c.confianca)), motivo: c.motivo,
    modelo: resposta.model || RECURSOS.modelos.classificacao, tokens: tokensDe(resposta),
    latencia_ms: Math.max(0, Date.now() - (entrada.inicio_ms || Date.now())),
  };
}
```

- [ ] **Passo 4: rodar e ver passar**

Run: `pnpm test:node`
Expected: PASS. O teste de sincronia do build falha de novo (o código embutido de `validar-entrada`, `montar-requisicao` e `validar-saida` mudou): rode `pnpm build:n8n`, confirme `pnpm test:node` verde e inclua `n8n/workflows/*.json` no commit.

- [ ] **Passo 5: commit**

```bash
git add n8n/lib n8n/workflows
git commit -m "Módulos dos nós Code para a classificação de anexos" -m "Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Tarefa 4: workflow classificar-arquivo, wrappers do build e guia de operação

**Files:**
- Create: `n8n/templates/classificar-arquivo.template.json`; gerado: `n8n/workflows/classificar-arquivo.json`
- Modify: `scripts/build-n8n.ts` (mapa `NOS`), `docs/operacao.md`
- Test: `scripts/build-n8n.test.ts`

**Interfaces:**
- Consumes: as três funções da Tarefa 3; `gerarCodigoNo`, `gerarWorkflow`, `construirTodos` existentes.
- Produces: nós `validar-entrada-classificacao`, `montar-requisicao-classificacao` e `validar-classificacao` no mapa `NOS`; webhook `POST {base}/webhook/classificar-arquivo` (multipart `arquivo`, `arquivo_id`; header `X-Api-Token`); respostas `200` com o objeto de `validarClassificacao`, `400`/`413` com `{ erro }`, `500` com `{ erro: { codigo: 'classificacao_falhou', mensagem } }`.

- [ ] **Passo 1: escrever os testes**

Em `scripts/build-n8n.test.ts`: na lista do `test.each` de `gerarCodigoNo`, trocar por

```ts
  test.each(['validar-entrada', 'montar-requisicao', 'validar-saida', 'montar-prompt-parecer', 'validar-parecer', 'validar-entrada-classificacao', 'montar-requisicao-classificacao', 'validar-classificacao'])('%s embute recursos, remove export e é JavaScript válido', (nome) => {
```

no teste `construirTodos devolve os nomes gerados...`, trocar a expectativa dos nomes por

```ts
    expect(nomes.sort()).toEqual(['analisar-arquivo', 'classificar-arquivo', 'consolidar']);
```

e acrescentar ao `describe('workflows versionados')`:

```ts
  test('classificar-arquivo gerado chama as três funções de classificação e responde 500 no ramo de erro', () => {
    const wf = JSON.parse(readFileSync('n8n/workflows/classificar-arquivo.json', 'utf8')) as { nodes: Array<{ name: string; parameters: Record<string, unknown> }> };
    const codigo = (nome: string) => String(wf.nodes.find((n) => n.name === nome)!.parameters.jsCode);
    expect(codigo('validar-entrada-classificacao')).toContain('validarEntradaClassificacao(');
    expect(codigo('montar-requisicao-classificacao')).toContain('montarRequisicaoClassificacao(');
    expect(codigo('validar-classificacao')).toContain('validarClassificacao(');
    expect(wf.nodes.find((n) => n.name === 'responder 500')!.parameters.options).toEqual({ responseCode: 500 });
    expect(wf.nodes.find((n) => n.name === 'Webhook')!.parameters.path).toBe('classificar-arquivo');
  });
```

- [ ] **Passo 2: rodar e ver falhar**

Run: `pnpm test:node`
Expected: FAIL: `gerarCodigoNo` lança "Sem wrapper" para os três nomes novos; `construirTodos` devolve dois nomes; o arquivo `n8n/workflows/classificar-arquivo.json` não existe.

- [ ] **Passo 3: wrappers no build**

Em `scripts/build-n8n.ts`, acrescentar ao objeto `NOS`, depois de `'validar-parecer'`:

```ts
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
```

- [ ] **Passo 4: criar o template**

`n8n/templates/classificar-arquivo.template.json` (mesma estrutura de `analisar-arquivo.template.json`; credenciais com o id placeholder, timeout do OpenRouter em 40 s porque a classificação é curta):

```json
{
  "name": "classificar-arquivo",
  "nodes": [
    {
      "parameters": { "httpMethod": "POST", "path": "classificar-arquivo", "authentication": "headerAuth", "responseMode": "responseNode", "options": { "allowedOrigins": "https://josercf.github.io" } },
      "id": "webhook-classificar-arquivo", "name": "Webhook", "type": "n8n-nodes-base.webhook", "typeVersion": 2, "position": [-500, 0],
      "credentials": { "httpHeaderAuth": { "id": "REVISAR-CREDENCIAL", "name": "Token onboarding PDV" } }
    },
    {
      "parameters": { "operation": "binaryToPropery", "binaryPropertyName": "arquivo", "destinationKey": "arquivo_base64", "options": { "keepSource": "both" } },
      "id": "extract-from-file-classificacao", "name": "Extract from File", "type": "n8n-nodes-base.extractFromFile", "typeVersion": 1, "position": [-260, 0]
    },
    {
      "parameters": { "mode": "runOnceForAllItems", "jsCode": "__NO__validar-entrada-classificacao__" },
      "id": "validar-entrada-classificacao", "name": "validar-entrada-classificacao", "type": "n8n-nodes-base.code", "typeVersion": 2, "position": [-20, 0]
    },
    {
      "parameters": { "mode": "manual", "assignments": { "assignments": [ { "id": "config-classificacao-assignment", "name": "modelo_classificacao", "type": "string", "value": "google/gemini-2.5-flash" } ] }, "includeOtherFields": true, "options": {} },
      "id": "config-classificacao", "name": "Config", "type": "n8n-nodes-base.set", "typeVersion": 3.4, "position": [220, 0]
    },
    {
      "parameters": { "conditions": { "options": { "caseSensitive": true, "leftValue": "", "typeValidation": "strict" }, "conditions": [ { "id": "entrada-ok-classificacao-condition", "leftValue": "={{ $json.ok }}", "rightValue": "", "operator": { "type": "boolean", "operation": "true", "singleValue": true } } ], "combinator": "and" }, "options": {} },
      "id": "entrada-ok-classificacao", "name": "entrada ok", "type": "n8n-nodes-base.if", "typeVersion": 2.2, "position": [460, 0]
    },
    {
      "parameters": { "respondWith": "json", "responseBody": "={{ JSON.stringify({ erro: $json.erro }) }}", "options": { "responseCode": "={{ $json.status }}" } },
      "id": "responder-400-classificacao", "name": "responder 400", "type": "n8n-nodes-base.respondToWebhook", "typeVersion": 1.1, "position": [700, 200]
    },
    {
      "parameters": { "mode": "runOnceForAllItems", "jsCode": "__NO__montar-requisicao-classificacao__" },
      "id": "montar-requisicao-classificacao", "name": "montar-requisicao-classificacao", "type": "n8n-nodes-base.code", "typeVersion": 2, "position": [700, -200]
    },
    {
      "parameters": { "method": "POST", "url": "={{ $json.url }}", "authentication": "genericCredentialType", "genericAuthType": "httpHeaderAuth", "sendBody": true, "contentType": "json", "specifyBody": "json", "jsonBody": "={{ JSON.stringify($json.body) }}", "options": { "timeout": 40000 } },
      "id": "openrouter-classificacao", "name": "openrouter", "type": "n8n-nodes-base.httpRequest", "typeVersion": 4.2, "position": [940, -200],
      "credentials": { "httpHeaderAuth": { "id": "REVISAR-CREDENCIAL", "name": "OpenRouter" } },
      "onError": "continueErrorOutput", "retryOnFail": true, "maxTries": 2, "waitBetweenTries": 2000
    },
    {
      "parameters": { "mode": "runOnceForAllItems", "jsCode": "__NO__validar-classificacao__" },
      "id": "validar-classificacao", "name": "validar-classificacao", "type": "n8n-nodes-base.code", "typeVersion": 2, "position": [1180, -260], "onError": "continueErrorOutput"
    },
    {
      "parameters": { "respondWith": "json", "responseBody": "={{ JSON.stringify($json) }}", "options": {} },
      "id": "responder-200-classificacao", "name": "responder 200", "type": "n8n-nodes-base.respondToWebhook", "typeVersion": 1.1, "position": [1420, -320]
    },
    {
      "parameters": { "respondWith": "json", "responseBody": "={{ JSON.stringify({ erro: { codigo: 'classificacao_falhou', mensagem: ($json.error && $json.error.message) || $json.message || 'Falha na classificação' } }) }}", "options": { "responseCode": 500 } },
      "id": "responder-500-classificacao", "name": "responder 500", "type": "n8n-nodes-base.respondToWebhook", "typeVersion": 1.1, "position": [1420, -80]
    }
  ],
  "connections": {
    "Webhook": { "main": [[{ "node": "Extract from File", "type": "main", "index": 0 }]] },
    "Extract from File": { "main": [[{ "node": "validar-entrada-classificacao", "type": "main", "index": 0 }]] },
    "validar-entrada-classificacao": { "main": [[{ "node": "Config", "type": "main", "index": 0 }]] },
    "Config": { "main": [[{ "node": "entrada ok", "type": "main", "index": 0 }]] },
    "entrada ok": { "main": [[{ "node": "montar-requisicao-classificacao", "type": "main", "index": 0 }], [{ "node": "responder 400", "type": "main", "index": 0 }]] },
    "montar-requisicao-classificacao": { "main": [[{ "node": "openrouter", "type": "main", "index": 0 }]] },
    "openrouter": { "main": [[{ "node": "validar-classificacao", "type": "main", "index": 0 }], [{ "node": "responder 500", "type": "main", "index": 0 }]] },
    "validar-classificacao": { "main": [[{ "node": "responder 200", "type": "main", "index": 0 }], [{ "node": "responder 500", "type": "main", "index": 0 }]] }
  },
  "active": false,
  "settings": { "executionOrder": "v1", "saveDataSuccessExecution": "none", "saveDataErrorExecution": "all", "saveManualExecutions": true, "timezone": "America/Sao_Paulo" },
  "pinData": {}
}
```

- [ ] **Passo 5: gerar e ver passar**

Run: `pnpm build:n8n && pnpm test:node && npx tsc --noEmit -p tsconfig.json`
Expected: "Workflows gerados: analisar-arquivo, classificar-arquivo, consolidar" e PASS em todos os testes da raiz.

- [ ] **Passo 6: guia de operação**

Em `docs/operacao.md`: na tabela de credenciais, trocar "Autentica os dois webhooks" por "Autentica os três webhooks"; no passo 3 de "Publicar ou atualizar os workflows", trocar "abrir o workflow" por "abrir cada um dos três workflows (`analisar-arquivo`, `classificar-arquivo`, `consolidar`)"; e inserir, antes de "## Limites do n8n Cloud que o desenho respeita", a seção:

```md
## Workflows
| Workflow | Caminho | O que faz | Modelo | Timeout do OpenRouter |
|---|---|---|---|---|
| `classificar-arquivo` | `POST /webhook/classificar-arquivo` (multipart `arquivo`, `arquivo_id`) | Identifica o tipo de documento de uma imagem ou PDF e devolve `tipo_detectado`, `confianca` e `motivo`. Vídeo não passa aqui. | `google/gemini-2.5-flash` (nó `Config`, campo `modelo_classificacao`) | 40 s |
| `analisar-arquivo` | `POST /webhook/analisar-arquivo` (multipart `arquivo`, `tipo`, `arquivo_id`, `contexto`) | Extrai a observação estruturada do arquivo conforme o tipo. | `google/gemini-2.5-flash` (`modelo_analise`) | 80 s |
| `consolidar` | `POST /webhook/consolidar` (JSON) | Gera o parecer a partir do formulário, da Receita, das observações e das 16 verificações. | `google/gemini-2.5-pro` (`modelo_parecer`) | 80 s |
```

- [ ] **Passo 7: commit**

```bash
git add scripts/build-n8n.ts scripts/build-n8n.test.ts n8n/templates/classificar-arquivo.template.json n8n/workflows/classificar-arquivo.json docs/operacao.md
git commit -m "Workflow classificar-arquivo: template, wrappers do build, JSON gerado e guia de operação" -m "Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Tarefa 5: smoke test chama o webhook de classificação antes da análise

**Files:**
- Modify: `scripts/smoke.ts`
- Test: `scripts/smoke.test.ts`

**Interfaces:**
- Consumes: `schemaClassificacaoCompleta` (Tarefa 2); `chamar(fetchFn, cfg, caminho, init, codigoCorpoInvalido, log)` existente.
- Produces: `CODIGO_CLASSIFICACAO_INVALIDA = 7`, `montarFormDataClassificacao(png?)`, `validarClassificacao(ajv, classificacao)`; `rodarSmoke` passa a fazer três chamadas, nesta ordem: `classificar-arquivo`, `analisar-arquivo`, `consolidar`, com seis linhas de log em caso de sucesso.

- [ ] **Passo 1: escrever os testes**

Em `scripts/smoke.test.ts`, ampliar a importação:

```ts
import {
  CODIGO_CLASSIFICACAO_INVALIDA, CODIGO_FALHA_REDE, CODIGO_HTTP_NAO_OK, CODIGO_OBSERVACAO_INVALIDA, CODIGO_PARECER_INVALIDO,
  ErroSmoke, PNG, chamar, lerConfig, montarFormDataAnalise, montarFormDataClassificacao, montarPayloadConsolidar, rodarSmoke, validarClassificacao, validarObservacao, validarParecer,
} from './smoke';
```

Acrescentar após `PARECER_VALIDO`:

```ts
const CLASSIFICACAO_VALIDA = {
  arquivo_id: 'smoke-0', nome: 'smoke.png', mime: 'image/png', tipo_detectado: 'fachada', confianca: 0.92, motivo: 'Frente de loja.',
  modelo: 'google/gemini-2.5-flash', tokens: { entrada: 1200, saida: 40 }, latencia_ms: 1500,
};
```

Acrescentar após o `describe('montarFormDataAnalise')`:

```ts
describe('montarFormDataClassificacao', () => {
  test('monta o multipart só com arquivo e arquivo_id, sem tipo nem contexto', () => {
    const fd = montarFormDataClassificacao();
    expect((fd.get('arquivo') as File).name).toBe('smoke.png');
    expect(fd.get('arquivo_id')).toBe('smoke-0');
    expect(fd.get('tipo')).toBeNull();
    expect(fd.get('contexto')).toBeNull();
  });
});

describe('validarClassificacao', () => {
  const ajv = new Ajv({ allErrors: true, strict: false });
  test('classificação válida não lança', () => expect(() => validarClassificacao(ajv, CLASSIFICACAO_VALIDA)).not.toThrow());
  test('tipo fora do enum lança ErroSmoke código 7', () => {
    try {
      validarClassificacao(ajv, { ...CLASSIFICACAO_VALIDA, tipo_detectado: 'geladeira' });
      throw new Error('deveria ter lançado');
    } catch (e) {
      expect(e).toBeInstanceOf(ErroSmoke);
      expect((e as ErroSmoke).codigo).toBe(CODIGO_CLASSIFICACAO_INVALIDA);
    }
  });
});
```

Substituir o bloco `describe('rodarSmoke', ...)` inteiro por:

```ts
describe('rodarSmoke', () => {
  const env = { N8N_BASE_URL: 'https://n8n.exemplo.com', N8N_TOKEN: 'tok' };
  const tresOk = () => vi.fn()
    .mockResolvedValueOnce(jsonResponse(200, CLASSIFICACAO_VALIDA))
    .mockResolvedValueOnce(jsonResponse(200, OBSERVACAO_VALIDA))
    .mockResolvedValueOnce(jsonResponse(200, PARECER_VALIDO));

  test('três HTTP 200 válidos: código 0 e as seis linhas esperadas, nesta ordem', async () => {
    const log = vi.fn();
    const fetchFn = tresOk();
    const codigo = await rodarSmoke(fetchFn as unknown as typeof fetch, env, log);
    expect(codigo).toBe(0);
    expect(fetchFn).toHaveBeenCalledTimes(3);
    expect(log.mock.calls.map((c) => c[0])).toEqual([
      expect.stringMatching(/^classificar-arquivo: HTTP 200 em \d+ ms$/),
      'classificação ok: fachada (confiança 0.92)',
      expect.stringMatching(/^analisar-arquivo: HTTP 200 em \d+ ms$/),
      'observação ok: Fachada de loja aberta.',
      expect.stringMatching(/^consolidar: HTTP 200 em \d+ ms$/),
      'parecer ok: apto',
    ]);
  });

  test('sem variáveis de ambiente: código 1, sem chamar fetch', async () => {
    const logErro = vi.fn();
    const fetchFn = vi.fn();
    const codigo = await rodarSmoke(fetchFn as unknown as typeof fetch, {}, vi.fn(), logErro);
    expect(codigo).toBe(1);
    expect(fetchFn).not.toHaveBeenCalled();
    expect(logErro).toHaveBeenCalledWith(expect.stringMatching(/N8N_BASE_URL e N8N_TOKEN/));
  });

  test('primeira chamada (classificação) com HTTP não ok: código 2 e as demais não são chamadas', async () => {
    const fetchFn = vi.fn().mockResolvedValueOnce(jsonResponse(401, { erro: 'sem token' }));
    const codigo = await rodarSmoke(fetchFn as unknown as typeof fetch, env, vi.fn(), vi.fn());
    expect(codigo).toBe(2);
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  test('classificação fora do schema: código 7 e as demais não são chamadas', async () => {
    const fetchFn = vi.fn().mockResolvedValueOnce(jsonResponse(200, { ...CLASSIFICACAO_VALIDA, confianca: 'alta' }));
    const codigo = await rodarSmoke(fetchFn as unknown as typeof fetch, env, vi.fn(), vi.fn());
    expect(codigo).toBe(CODIGO_CLASSIFICACAO_INVALIDA);
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  test('observação fora do schema: código 3 e consolidar não é chamado', async () => {
    const { resumo: _resumo, ...semResumo } = OBSERVACAO_VALIDA;
    const fetchFn = vi.fn().mockResolvedValueOnce(jsonResponse(200, CLASSIFICACAO_VALIDA)).mockResolvedValueOnce(jsonResponse(200, semResumo));
    const codigo = await rodarSmoke(fetchFn as unknown as typeof fetch, env, vi.fn(), vi.fn());
    expect(codigo).toBe(3);
    expect(fetchFn).toHaveBeenCalledTimes(2);
  });

  test('parecer fora do schema: código 4', async () => {
    const fetchFn = vi.fn()
      .mockResolvedValueOnce(jsonResponse(200, CLASSIFICACAO_VALIDA))
      .mockResolvedValueOnce(jsonResponse(200, OBSERVACAO_VALIDA))
      .mockResolvedValueOnce(jsonResponse(200, { ...PARECER_VALIDO, recomendacao_sugerida: 'talvez' }));
    const codigo = await rodarSmoke(fetchFn as unknown as typeof fetch, env, vi.fn(), vi.fn());
    expect(codigo).toBe(4);
    expect(fetchFn).toHaveBeenCalledTimes(3);
  });

  test('falha de rede na primeira chamada: código de falha de rede, mensagem com a causa, e as demais não são chamadas', async () => {
    const fetchFn = vi.fn().mockRejectedValueOnce(new Error('ECONNREFUSED'));
    const logErro = vi.fn();
    const codigo = await rodarSmoke(fetchFn as unknown as typeof fetch, env, vi.fn(), logErro);
    expect(codigo).toBe(CODIGO_FALHA_REDE);
    expect(fetchFn).toHaveBeenCalledTimes(1);
    expect(logErro).toHaveBeenCalledWith(expect.stringContaining('ECONNREFUSED'));
  });

  test('corpo 2xx inválido (não é JSON) na chamada de analisar-arquivo: código 3 e consolidar não é chamado', async () => {
    const fetchFn = vi.fn().mockResolvedValueOnce(jsonResponse(200, CLASSIFICACAO_VALIDA)).mockResolvedValueOnce(new Response('<html>erro</html>', { status: 200 }));
    const codigo = await rodarSmoke(fetchFn as unknown as typeof fetch, env, vi.fn(), vi.fn());
    expect(codigo).toBe(CODIGO_OBSERVACAO_INVALIDA);
    expect(fetchFn).toHaveBeenCalledTimes(2);
  });

  test('corpo 2xx inválido (não é JSON) na chamada de consolidar: código 4', async () => {
    const fetchFn = vi.fn()
      .mockResolvedValueOnce(jsonResponse(200, CLASSIFICACAO_VALIDA))
      .mockResolvedValueOnce(jsonResponse(200, OBSERVACAO_VALIDA))
      .mockResolvedValueOnce(new Response('<html>erro</html>', { status: 200 }));
    const codigo = await rodarSmoke(fetchFn as unknown as typeof fetch, env, vi.fn(), vi.fn());
    expect(codigo).toBe(CODIGO_PARECER_INVALIDO);
    expect(fetchFn).toHaveBeenCalledTimes(3);
  });
});
```

- [ ] **Passo 2: rodar e ver falhar**

Run: `pnpm test:node`
Expected: FAIL: as exportações novas não existem e `rodarSmoke` ainda faz duas chamadas.

- [ ] **Passo 3: implementar**

Em `scripts/smoke.ts`:

1. Ampliar a importação dos schemas:

```ts
import { schemaClassificacaoCompleta, schemaObservacaoCompleta, schemaParecerCompleto } from '../shared/schemas/index';
```

2. No comentário da tabela de códigos, trocar a linha do código 6 e acrescentar a do 7:

```ts
 *   6 erro inesperado, não classificado nos códigos acima (só no ponto de entrada de CLI).
 *   7 resposta de classificar-arquivo com HTTP 2xx mas corpo não é JSON válido, ou a classificação
 *     não passa no schema de shared/schemas (chamar / validarClassificacao).
```

e, após `export const CODIGO_ERRO_INESPERADO = 6;`:

```ts
export const CODIGO_CLASSIFICACAO_INVALIDA = 7;
```

3. Após `montarFormDataAnalise`:

```ts
export function montarFormDataClassificacao(png: Buffer = PNG): FormData {
  const fd = new FormData();
  fd.append('arquivo', new Blob([new Uint8Array(png)], { type: 'image/png' }), 'smoke.png');
  fd.append('arquivo_id', 'smoke-0');
  return fd;
}
```

4. Após `validarObservacao`:

```ts
export function validarClassificacao(ajv: Ajv, classificacao: unknown): void {
  if (!ajv.validate(schemaClassificacaoCompleta(), classificacao)) {
    throw new ErroSmoke(CODIGO_CLASSIFICACAO_INVALIDA, `Classificação fora do schema: ${ajv.errorsText()}`);
  }
}
```

5. Em `rodarSmoke`, trocar o comentário de documentação por

```ts
/**
 * Chama classificar-arquivo e analisar-arquivo com um PNG sintético e depois consolidar com o
 * exemplo-ok, validando as três respostas contra os schemas de shared/schemas. Devolve o código de
 * saída do processo (0 a 5, ou 7; ver a tabela no topo do arquivo). Qualquer erro que não seja
 * ErroSmoke é relançado (a promise rejeita); só o ponto de entrada de CLI abaixo trata isso, com o código 6.
 */
```

e inserir, logo após `const ajv = new Ajv(...)`, antes da chamada a `analisar-arquivo`:

```ts
    const classificacao = (await chamar(fetchFn, cfg, 'classificar-arquivo', { method: 'POST', body: montarFormDataClassificacao() }, CODIGO_CLASSIFICACAO_INVALIDA, log)) as Record<string, unknown>;
    validarClassificacao(ajv, classificacao);
    log(`classificação ok: ${classificacao.tipo_detectado} (confiança ${classificacao.confianca})`);
```

- [ ] **Passo 4: rodar e ver passar**

Run: `pnpm test:node && npx tsc --noEmit -p tsconfig.json`
Expected: PASS.

- [ ] **Passo 5: commit**

```bash
git add scripts/smoke.ts scripts/smoke.test.ts
git commit -m "Smoke test chama o webhook de classificação antes da análise" -m "Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Tarefa 6: tipos e cliente do frontend para a classificação

**Files:**
- Modify: `web/src/tipos/index.ts`, `web/src/api/clienteN8n.ts`
- Test: `web/src/api/clienteN8n.test.ts`

**Interfaces:**
- Consumes: `TipoDetectado` de `@shared/schemas/index` (Tarefa 2); `chamar` e `comRetry` internos do cliente.
- Produces: `RespostaClassificacao` (contrato `snake_case` do webhook); `ParamsClassificar { arquivo: Blob; nome: string; arquivoId: string }`; `ClienteN8n.classificarArquivo(p, sinal?): Promise<RespostaClassificacao>` chamando `POST {base}/webhook/classificar-arquivo` com multipart `arquivo` e `arquivo_id`, mesmo timeout, retry e mapeamento de erros das outras chamadas.

- [ ] **Passo 1: escrever os testes**

Em `web/src/api/clienteN8n.test.ts`, acrescentar após `const observacao = ...`:

```ts
const classificacao = { arquivo_id: 'c1', nome: 'foto.jpeg', mime: 'image/jpeg', tipo_detectado: 'fachada', confianca: 0.9, motivo: 'Frente de loja', modelo: 'm', tokens: { entrada: 1, saida: 1 }, latencia_ms: 1 };
const paramsClassificar = () => ({ arquivo: new Blob(['x'], { type: 'image/jpeg' }), nome: 'foto.jpeg', arquivoId: 'c1' });
```

e, antes de `describe('consolidar')`:

```ts
describe('classificarArquivo', () => {
  test('envia multipart só com arquivo e arquivo_id, com token, e devolve a classificação', async () => {
    const fetchFn = vi.fn(async () => json(200, classificacao));
    const r = await cliente(fetchFn).classificarArquivo(paramsClassificar());
    expect(r).toEqual(classificacao);
    const [url, init] = fetchFn.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://n8n.exemplo.com/webhook/classificar-arquivo');
    expect((init.headers as Record<string, string>)['X-Api-Token']).toBe('tok');
    const fd = init.body as FormData;
    expect(fd.get('arquivo_id')).toBe('c1');
    expect(fd.get('tipo')).toBeNull();
    expect(fd.get('contexto')).toBeNull();
    expect((fd.get('arquivo') as File).name).toBe('foto.jpeg');
  });
  test('500 é repetido uma vez e 401 vira auth sem repetição', async () => {
    dormir.mockClear();
    const fetchFn = vi.fn().mockResolvedValueOnce(json(500, { erro: { codigo: 'classificacao_falhou', mensagem: 'falhou' } })).mockResolvedValueOnce(json(200, classificacao));
    await expect(cliente(fetchFn).classificarArquivo(paramsClassificar())).resolves.toEqual(classificacao);
    expect(fetchFn).toHaveBeenCalledTimes(2);
    expect(dormir).toHaveBeenCalledWith(3000);
    const negado = vi.fn(async () => json(401, { erro: { codigo: 'auth', mensagem: 'token inválido' } }));
    await expect(cliente(negado).classificarArquivo(paramsClassificar())).rejects.toMatchObject({ codigo: 'auth', mensagem: 'token inválido' });
    expect(negado).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Passo 2: rodar e ver falhar**

Run: `pnpm -C web test -- clienteN8n`
Expected: FAIL ("classificarArquivo is not a function").

- [ ] **Passo 3: implementar**

Em `web/src/tipos/index.ts`, trocar as duas primeiras linhas por:

```ts
import type { TipoAnexo, TipoDetectado } from '@shared/schemas/index';

export type { TipoAnexo, TipoDetectado };
```

e acrescentar ao final do arquivo:

```ts
export interface RespostaClassificacao {
  arquivo_id: string; nome: string; mime: string; tipo_detectado: TipoDetectado; confianca: number; motivo: string;
  modelo: string; tokens: { entrada: number; saida: number }; latencia_ms: number;
}
```

Em `web/src/api/clienteN8n.ts`: ampliar a importação de tipos com `RespostaClassificacao`; acrescentar após `ParamsAnalisar`:

```ts
export interface ParamsClassificar { arquivo: Blob; nome: string; arquivoId: string }
```

na interface `ClienteN8n`, acrescentar:

```ts
  classificarArquivo(p: ParamsClassificar, sinal?: AbortSignal): Promise<RespostaClassificacao>;
```

e no objeto devolvido por `criarClienteN8n`, antes de `consolidar`:

```ts
    classificarArquivo(p, sinal) {
      const corpo = () => {
        const fd = new FormData();
        fd.append('arquivo', p.arquivo, p.nome);
        fd.append('arquivo_id', p.arquivoId);
        return fd;
      };
      return comRetry(() => chamar<RespostaClassificacao>('classificar-arquivo', { method: 'POST', body: corpo() }, sinal), sinal);
    },
```

- [ ] **Passo 4: rodar e ver passar**

Run: `pnpm lint && pnpm test && pnpm build`
Expected: PASS. Os testes de tela que constroem `ClienteN8n` com cast (`as unknown as ClienteN8n`) continuam compilando.

- [ ] **Passo 5: commit**

```bash
git add web/src/tipos/index.ts web/src/api/clienteN8n.ts web/src/api/clienteN8n.test.ts
git commit -m "Cliente n8n ganha classificarArquivo e o tipo RespostaClassificacao" -m "Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Tarefa 7: fila de classificação, estado no reducer e portão da etapa 2

**Files:**
- Create: `web/src/fluxo/filaClassificacao.ts`, `web/src/fluxo/filaClassificacao.test.ts`
- Modify: `web/src/fluxo/estadoApp.ts`, `web/src/ui/EtapaAnalise.test.tsx:11`, `web/src/ui/EtapaRelatorio.test.tsx:18` (construções literais de `Anexo`)
- Test: `web/src/fluxo/estadoApp.test.ts`, `web/src/fluxo/filaClassificacao.test.ts`

**Interfaces:**
- Consumes: `RespostaClassificacao`, `TipoDetectado` (Tarefa 6); `tiposObrigatorios`, `limites.confiancaMinimaClassificacao` (Tarefa 1); `validarArquivo` de `web/src/anexos/validarArquivo.ts`; `ErroApi`.
- Produces: `EstadoClassificacao = 'pendente' | 'classificando' | 'concluida' | 'falhou'`; `ItemClassificacao`; `executarFilaClassificacao(itens, classificar, opcoes)`; no reducer: `Classificacao { estado; tipoDetectado: TipoDetectado | null; confianca: number | null; motivo: string | null; erro?; erroCodigo? }`, campo obrigatório `Anexo.classificacao`, constantes `CLASSIFICACAO_PENDENTE` e `CLASSIFICACAO_VIDEO`, ação `{ tipo: 'anexo_classificacao'; arquivoId; valor: Partial<Classificacao> & { estado: EstadoClassificacao } }`, seletor `faltantes(e): TipoAnexo[]`, e `podeAvancar` na etapa 2 exigindo tipo em todos, nenhuma classificação pendente ou em andamento e `faltantes` vazio.

- [ ] **Passo 1: escrever os testes da fila**

`web/src/fluxo/filaClassificacao.test.ts`:

```ts
import { describe, expect, test, vi } from 'vitest';
import { ErroApi } from '../api/clienteN8n';
import type { RespostaClassificacao } from '../tipos';
import { executarFilaClassificacao, type ItemClassificacao } from './filaClassificacao';

const arquivo = new File(['x'], 'a.jpeg', { type: 'image/jpeg' });
const item = (id: string, estado: ItemClassificacao['estado'] = 'pendente'): ItemClassificacao => ({ arquivoId: id, arquivo, nome: `${id}.jpeg`, estado });
const resultado = (id: string): RespostaClassificacao => ({ arquivo_id: id, nome: `${id}.jpeg`, mime: 'image/jpeg', tipo_detectado: 'fachada', confianca: 0.9, motivo: 'teste', modelo: 'm', tokens: { entrada: 1, saida: 1 }, latencia_ms: 1 });

function controlavel() {
  const pendentes = new Map<string, { resolve: (v: RespostaClassificacao) => void; reject: (e: Error) => void }>();
  const classificar = vi.fn((i: ItemClassificacao) => new Promise<RespostaClassificacao>((resolve, reject) => pendentes.set(i.arquivoId, { resolve, reject })));
  return { classificar, pendentes };
}

describe('executarFilaClassificacao', () => {
  test('mantém no máximo 2 classificações simultâneas, na ordem de entrada, e notifica cada transição', async () => {
    const { classificar, pendentes } = controlavel();
    const itens = ['a', 'b', 'c'].map((id) => item(id));
    const aoMudar = vi.fn();
    const execucao = executarFilaClassificacao(itens, classificar, { aoMudar });
    expect(classificar).toHaveBeenCalledTimes(2);
    expect(itens.map((i) => i.estado)).toEqual(['classificando', 'classificando', 'pendente']);
    pendentes.get('a')!.resolve(resultado('a'));
    await vi.waitFor(() => expect(classificar).toHaveBeenCalledTimes(3));
    pendentes.get('b')!.resolve(resultado('b'));
    pendentes.get('c')!.resolve(resultado('c'));
    const final = await execucao;
    expect(final.map((i) => i.estado)).toEqual(['concluida', 'concluida', 'concluida']);
    expect(final[0].resultado).toEqual(resultado('a'));
    expect(aoMudar).toHaveBeenCalledTimes(6);
    expect(aoMudar.mock.calls[0][0]).toMatchObject({ arquivoId: 'a', estado: 'classificando' });
  });
  test('falha registra mensagem e código do ErroApi sem interromper os demais', async () => {
    const classificar = vi.fn(async (i: ItemClassificacao) => { if (i.arquivoId === 'a') throw new ErroApi('auth', 'token inválido', 401); return resultado(i.arquivoId); });
    const final = await executarFilaClassificacao([item('a'), item('b')], classificar);
    expect(final[0]).toMatchObject({ estado: 'falhou', erro: 'token inválido', erroCodigo: 'auth' });
    expect(final[1].estado).toBe('concluida');
  });
  test('reexecução processa só pendentes e falhos', async () => {
    const classificar = vi.fn(async (i: ItemClassificacao) => resultado(i.arquivoId));
    await executarFilaClassificacao([item('a', 'concluida'), item('b', 'falhou'), item('c')], classificar);
    expect(classificar.mock.calls.map(([i]) => i.arquivoId)).toEqual(['b', 'c']);
  });
});
```

- [ ] **Passo 2: rodar e ver falhar**

Run: `pnpm -C web test -- filaClassificacao`
Expected: FAIL ("Cannot find module './filaClassificacao'").

- [ ] **Passo 3: implementar a fila**

`web/src/fluxo/filaClassificacao.ts` (mesmo desenho de `filaAnalise.ts`, com estados e resultado próprios; a unificação das duas filas fica para o passe de design):

```ts
import { limites } from '@shared/config/index';
import { ErroApi, type CodigoErroApi } from '../api/clienteN8n';
import type { RespostaClassificacao } from '../tipos';

export type EstadoClassificacao = 'pendente' | 'classificando' | 'concluida' | 'falhou';
export interface ItemClassificacao { arquivoId: string; arquivo: File; nome: string; estado: EstadoClassificacao; resultado?: RespostaClassificacao; erro?: string; erroCodigo?: CodigoErroApi }
export interface OpcoesFilaClassificacao { concorrencia?: number; aoMudar?: (item: ItemClassificacao) => void }

export async function executarFilaClassificacao(
  itens: ItemClassificacao[],
  classificar: (item: ItemClassificacao) => Promise<RespostaClassificacao>,
  opcoes: OpcoesFilaClassificacao = {},
): Promise<ItemClassificacao[]> {
  const concorrencia = opcoes.concorrencia ?? limites.concorrencia;
  const pendentes = itens.filter((i) => i.estado === 'pendente' || i.estado === 'falhou');
  let proximo = 0;

  async function trabalhador(): Promise<void> {
    while (proximo < pendentes.length) {
      const item = pendentes[proximo++];
      item.estado = 'classificando';
      item.erro = undefined;
      item.erroCodigo = undefined;
      opcoes.aoMudar?.({ ...item });
      try {
        item.resultado = await classificar(item);
        item.estado = 'concluida';
      } catch (e) {
        item.estado = 'falhou';
        item.erro = e instanceof Error ? e.message : String(e);
        item.erroCodigo = e instanceof ErroApi ? e.codigo : undefined;
      }
      opcoes.aoMudar?.({ ...item });
    }
  }

  await Promise.all(Array.from({ length: Math.min(concorrencia, pendentes.length) }, () => trabalhador()));
  return itens;
}
```

- [ ] **Passo 4: rodar e ver passar**

Run: `pnpm -C web test -- filaClassificacao`
Expected: PASS (3 testes).

- [ ] **Passo 5: escrever os testes do reducer**

Em `web/src/fluxo/estadoApp.test.ts`, trocar a importação e o helper `anexo` por:

```ts
import { describe, expect, test } from 'vitest';
import type { Receita, TipoAnexo, TipoDetectado } from '../tipos';
import { CLASSIFICACAO_PENDENTE, anexosParaMotor, errosFormulario, estadoInicial, faltantes, podeAvancar, reduzir, type Anexo, type Classificacao, type EstadoApp } from './estadoApp';

const arquivo = new File(['x'], 'fachada.jpeg', { type: 'image/jpeg' });
const classificado = (tipo: TipoDetectado, confianca = 0.9): Classificacao => ({ estado: 'concluida', tipoDetectado: tipo, confianca, motivo: 'teste' });
const anexo = (id: string, tipo: Anexo['tipo'] = 'fachada', classificacao: Classificacao = CLASSIFICACAO_PENDENTE): Anexo =>
  ({ arquivoId: id, arquivo, nome: `${id}.jpeg`, mime: 'image/jpeg', tipo, duracaoS: null, estado: 'na_fila', classificacao });
const SEIS: TipoAnexo[] = ['fachada', 'refrigerador', 'equipamentos', 'nf_ambev', 'cartao_cnpj', 'video_geral'];
const completo = (): EstadoApp => SEIS.reduce<EstadoApp>((e, t, i) => reduzir(e, { tipo: 'anexo_adicionar', valor: anexo(`a${i}`, t, classificado(t)) }), { ...estadoInicial(), etapa: 2 });
```

Substituir o teste `etapa 2 exige ao menos um anexo e todos com tipo; etapa 3 exige fila terminada` por:

```ts
  test('etapa 2 exige todos os obrigatórios do formulário, tipo em todos e nenhuma classificação em andamento', () => {
    let e = { ...estadoInicial(), etapa: 2 as const } as EstadoApp;
    expect(podeAvancar(e)).toBe(false);
    expect(faltantes(e)).toEqual(SEIS);
    e = completo();
    expect(podeAvancar(e)).toBe(true);
    expect(faltantes(e)).toEqual([]);
    const semNf = reduzir(e, { tipo: 'anexo_remover', arquivoId: 'a3' });
    expect(faltantes(semNf)).toEqual(['nf_ambev']);
    expect(podeAvancar(semNf)).toBe(false);
    const classificando = reduzir(e, { tipo: 'anexo_adicionar', valor: anexo('a9', 'fachada', { ...CLASSIFICACAO_PENDENTE, estado: 'classificando' }) });
    expect(podeAvancar(classificando)).toBe(false);
    const semTipo = reduzir(e, { tipo: 'anexo_adicionar', valor: anexo('a8', null, classificado('indefinido', 0.3)) });
    expect(podeAvancar(semTipo)).toBe(false);
    const comCamara = reduzir(e, { tipo: 'formulario', valor: { camaraFria: 'sim' } });
    expect(faltantes(comCamara)).toEqual(['camara_fria']);
    expect(podeAvancar(comCamara)).toBe(false);
  });
  test('etapa 3 exige fila terminada e anexosParaMotor marca falhos', () => {
    let e = reduzir({ ...estadoInicial(), etapa: 3 as const } as EstadoApp, { tipo: 'anexo_adicionar', valor: anexo('a1', 'fachada') });
    expect(podeAvancar(e)).toBe(false);
    e = reduzir(e, { tipo: 'anexo_estado', valor: { arquivoId: 'a1', estado: 'falhou', erro: 'x' } });
    expect(podeAvancar(e)).toBe(true);
    expect(anexosParaMotor(e)).toEqual([{ arquivoId: 'a1', tipo: 'fachada', nome: 'a1.jpeg', duracaoS: null, falhou: true }]);
  });
```

e acrescentar, ainda dentro de `describe('anexos')`:

```ts
  test('anexo_classificacao preenche o tipo quando a confiança atinge o limiar e o formato é compatível', () => {
    let e = reduzir(estadoInicial(), { tipo: 'anexo_adicionar', valor: anexo('a1', null) });
    e = reduzir(e, { tipo: 'anexo_classificacao', arquivoId: 'a1', valor: { estado: 'classificando' } });
    expect(e.anexos[0]).toMatchObject({ tipo: null, classificacao: { estado: 'classificando' } });
    e = reduzir(e, { tipo: 'anexo_classificacao', arquivoId: 'a1', valor: { estado: 'concluida', tipoDetectado: 'fachada', confianca: 0.9, motivo: 'frente de loja' } });
    expect(e.anexos[0]).toMatchObject({ tipo: 'fachada', classificacao: { estado: 'concluida', tipoDetectado: 'fachada', confianca: 0.9 } });
    const baixa = reduzir(reduzir(estadoInicial(), { tipo: 'anexo_adicionar', valor: anexo('b1', null) }), { tipo: 'anexo_classificacao', arquivoId: 'b1', valor: { estado: 'concluida', tipoDetectado: 'fachada', confianca: 0.4, motivo: 'incerto' } });
    expect(baixa.anexos[0].tipo).toBeNull();
    const indefinido = reduzir(reduzir(estadoInicial(), { tipo: 'anexo_adicionar', valor: anexo('c1', null) }), { tipo: 'anexo_classificacao', arquivoId: 'c1', valor: { estado: 'concluida', tipoDetectado: 'indefinido', confianca: 0.9, motivo: 'nada' } });
    expect(indefinido.anexos[0].tipo).toBeNull();
    const incompativel = reduzir(reduzir(estadoInicial(), { tipo: 'anexo_adicionar', valor: anexo('d1', null) }), { tipo: 'anexo_classificacao', arquivoId: 'd1', valor: { estado: 'concluida', tipoDetectado: 'video_geral', confianca: 0.95, motivo: 'jpeg como vídeo' } });
    expect(incompativel.anexos[0].tipo).toBeNull();
  });
  test('anexo_classificacao não sobrescreve o tipo escolhido pelo usuário e guarda a falha', () => {
    let e = reduzir(estadoInicial(), { tipo: 'anexo_adicionar', valor: anexo('a1', 'refrigerador') });
    e = reduzir(e, { tipo: 'anexo_classificacao', arquivoId: 'a1', valor: { estado: 'concluida', tipoDetectado: 'fachada', confianca: 0.95, motivo: 'frente' } });
    expect(e.anexos[0]).toMatchObject({ tipo: 'refrigerador', classificacao: { tipoDetectado: 'fachada' } });
    e = reduzir(e, { tipo: 'anexo_adicionar', valor: anexo('a2', null) });
    e = reduzir(e, { tipo: 'anexo_classificacao', arquivoId: 'a2', valor: { estado: 'falhou', erro: 'O serviço respondeu HTTP 500', erroCodigo: 'servidor' } });
    expect(e.anexos[1]).toMatchObject({ tipo: null, classificacao: { estado: 'falhou', erro: 'O serviço respondeu HTTP 500', erroCodigo: 'servidor' } });
  });
```

O teste `anexo_tipo com null deixa o anexo sem tipo e na fila` continua igual, mas a asserção final `expect(podeAvancar({ ...e, etapa: 2 })).toBe(false)` segue válida pelo tipo nulo.

Em `web/src/ui/EtapaAnalise.test.tsx`, o helper `anexo` passa a incluir a classificação:

```ts
import { CLASSIFICACAO_PENDENTE, estadoInicial, reduzir, type Anexo, type EstadoApp } from '../fluxo/estadoApp';
```

```ts
const anexo = (id: string, tipo: Anexo['tipo']): Anexo => ({ arquivoId: id, arquivo: new File(['x'], `${id}.jpeg`, { type: 'image/jpeg' }), nome: `${id}.jpeg`, mime: 'image/jpeg', tipo, duracaoS: null, estado: 'na_fila', classificacao: CLASSIFICACAO_PENDENTE });
```

Em `web/src/ui/EtapaRelatorio.test.tsx`, a construção dos anexos em `estadoDe` ganha uma classificação concluída igual ao tipo (a Tarefa 10 usa isso):

```ts
  const anexos: Anexo[] = entrada.observacoes.map((o) => ({ arquivoId: o.arquivo_id, arquivo: new File(['x'], o.nome, { type: o.mime }), nome: o.nome, mime: o.mime, tipo: o.tipo, duracaoS: null, estado: 'concluido', observacao: o, classificacao: { estado: 'concluida', tipoDetectado: o.tipo, confianca: 0.9, motivo: 'teste' } }));
```

- [ ] **Passo 6: rodar e ver falhar**

Run: `pnpm -C web test -- estadoApp`
Expected: FAIL (importações `CLASSIFICACAO_PENDENTE`, `faltantes`, tipo `Classificacao` inexistentes; ação `anexo_classificacao` desconhecida).

- [ ] **Passo 7: implementar no reducer**

Em `web/src/fluxo/estadoApp.ts`, trocar as importações do topo por:

```ts
import { limites, regiaoDefault, tiposObrigatorios } from '@shared/config/index';
import { validarArquivo } from '../anexos/validarArquivo';
import type { CodigoErroApi } from '../api/clienteN8n';
import { validarCnpj } from '../cnpj/validarCnpj';
import type { AnexoEnviado, Formulario, Observacao, Parecer, ParametrosRegiao, Receita, Recomendacao, TipoAnexo, TipoDetectado, Verificacao } from '../tipos';
import type { EstadoItem } from './filaAnalise';
import type { EstadoClassificacao } from './filaClassificacao';
```

trocar a interface `Anexo` por:

```ts
export interface Classificacao { estado: EstadoClassificacao; tipoDetectado: TipoDetectado | null; confianca: number | null; motivo: string | null; erro?: string; erroCodigo?: CodigoErroApi }
export interface Anexo { arquivoId: string; arquivo: File; nome: string; mime: string; tipo: TipoAnexo | null; duracaoS: number | null; estado: EstadoItem; observacao?: Observacao; erro?: string; erroCodigo?: CodigoErroApi; classificacao: Classificacao }

export const CLASSIFICACAO_PENDENTE: Classificacao = { estado: 'pendente', tipoDetectado: null, confianca: null, motivo: null };
export const CLASSIFICACAO_VIDEO: Classificacao = { estado: 'concluida', tipoDetectado: 'video_geral', confianca: 1, motivo: 'Vídeo MP4 só pode ser vídeo geral' };
```

acrescentar à união `Acao`, após `anexo_tipo`:

```ts
  | { tipo: 'anexo_classificacao'; arquivoId: string; valor: Partial<Classificacao> & { estado: EstadoClassificacao } }
```

trocar o ramo `etapa === 2` de `podeAvancar` por:

```ts
  if (e.etapa === 2) {
    const prontos = e.anexos.every((a) => a.tipo !== null && a.classificacao.estado !== 'pendente' && a.classificacao.estado !== 'classificando');
    return e.anexos.length > 0 && prontos && faltantes(e).length === 0;
  }
```

acrescentar, antes de `reduzir`:

```ts
/** Tipos obrigatórios para este formulário que ainda não têm nenhum anexo atribuído. */
export function faltantes(e: EstadoApp): TipoAnexo[] {
  const presentes = new Set(e.anexos.map((a) => a.tipo));
  return tiposObrigatorios(e.formulario).filter((t) => !presentes.has(t));
}

/** Mantém o tipo escolhido pelo usuário; senão adota o detectado quando a confiança atinge o limiar e o formato do arquivo é aceito pelo tipo. */
function tipoAposClassificacao(a: Anexo, c: Classificacao): TipoAnexo | null {
  if (a.tipo !== null) return a.tipo;
  if (c.estado !== 'concluida' || c.tipoDetectado === null || c.tipoDetectado === 'indefinido') return null;
  if ((c.confianca ?? 0) < limites.confiancaMinimaClassificacao) return null;
  return validarArquivo(a.arquivo, c.tipoDetectado).ok ? c.tipoDetectado : null;
}
```

e, no `switch` de `reduzir`, após o caso `anexo_tipo`:

```ts
    case 'anexo_classificacao': return {
      ...e,
      anexos: e.anexos.map((a) => {
        if (a.arquivoId !== acao.arquivoId) return a;
        const classificacao: Classificacao = { ...a.classificacao, ...acao.valor };
        return { ...a, classificacao, tipo: tipoAposClassificacao(a, classificacao) };
      }),
    };
```

- [ ] **Passo 8: rodar e ver passar**

Run: `pnpm lint && pnpm -C web test && pnpm -C web build`
Expected: PASS. `EtapaAnexos.test.tsx` ainda passa nesta tarefa porque a tela antiga cria anexos sem `classificacao`: se o `tsc -b` do build reclamar do campo ausente em `EtapaAnexos.tsx`, acrescente `classificacao: CLASSIFICACAO_PENDENTE` na criação do anexo em `adicionar` (importando a constante); a tela é reescrita na Tarefa 8. Se algum teste da tela antiga falhar por `podeAvancar` exigir obrigatórios, é esperado: marque-o com `test.skip` nesta tarefa e diga no relatório; a Tarefa 8 substitui esse arquivo de teste inteiro.

- [ ] **Passo 9: commit**

```bash
git add web/src/fluxo web/src/ui/EtapaAnalise.test.tsx web/src/ui/EtapaRelatorio.test.tsx web/src/ui/EtapaAnexos.tsx web/src/ui/EtapaAnexos.test.tsx
git commit -m "Estado da classificação no reducer, fila de classificação e portão da etapa 2" -m "Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Tarefa 8: tela de anexos com classificação automática, selos e seletor

**Files:**
- Modify: `web/src/ui/EtapaAnexos.tsx` (reescrita), `web/src/App.tsx:29` (passa `cliente`), `web/src/styles.css`
- Test: `web/src/ui/EtapaAnexos.test.tsx` (reescrita), `web/src/App.test.tsx` (inalterado, deve continuar verde)

**Interfaces:**
- Consumes: `executarFilaClassificacao`, `CLASSIFICACAO_PENDENTE`, `CLASSIFICACAO_VIDEO`, `faltantes`, `podeAvancar`, ação `anexo_classificacao` (Tarefa 7); `ClienteN8n.classificarArquivo` (Tarefa 6); `validarArquivo`, `validarArquivoBasico`, `inferirMime`, `formatarMb`, `obterDuracaoVideo` existentes.
- Produces: `EtapaAnexos` com props `{ estado; despachar; cliente: Pick<ClienteN8n, 'classificarArquivo'>; obterDuracao? }`; função exportada `seloDe(a: Anexo): string`; texto de bloqueio em `role="status"`; `sugerirTipo` deixa de ser usado pela tela (o módulo fica, porque `declarativas.ts` usa `normalizarTexto`).

- [ ] **Passo 1: escrever os testes**

Substituir `web/src/ui/EtapaAnexos.test.tsx` por:

```tsx
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useReducer } from 'react';
import { describe, expect, test, vi } from 'vitest';
import { ErroApi, type ClienteN8n } from '../api/clienteN8n';
import { estadoInicial, reduzir } from '../fluxo/estadoApp';
import type { Formulario, RespostaClassificacao } from '../tipos';
import { EtapaAnexos } from './EtapaAnexos';

const MB = 1048576;
const arquivo = (nome: string, mime: string, tamanho = MB) => {
  const f = new File(['x'], nome, { type: mime });
  Object.defineProperty(f, 'size', { value: tamanho });
  return f;
};
type Classificar = ClienteN8n['classificarArquivo'];
const classificacaoDe = (tipo: RespostaClassificacao['tipo_detectado'], confianca = 0.9): RespostaClassificacao =>
  ({ arquivo_id: 'x', nome: 'x', mime: 'image/jpeg', tipo_detectado: tipo, confianca, motivo: `parece ${tipo}`, modelo: 'm', tokens: { entrada: 1, saida: 1 }, latencia_ms: 1 });
const porNome = (mapa: Record<string, RespostaClassificacao | Error>) => vi.fn(async (p: { nome: string }) => {
  const r = mapa[p.nome];
  if (r instanceof Error) throw r;
  return r;
}) as unknown as Classificar;

function Harness({ classificar, formulario }: { classificar: Classificar; formulario?: Partial<Formulario> }) {
  const [estado, despachar] = useReducer(reduzir, undefined, () => {
    const e = estadoInicial();
    return { ...e, etapa: 2 as const, formulario: { ...e.formulario, ...formulario } };
  });
  return (<><EtapaAnexos estado={estado} despachar={despachar} cliente={{ classificarArquivo: classificar }} obterDuracao={async () => 18} /><output data-testid="etapa">{estado.etapa}</output></>);
}

const entrada = () => screen.getByLabelText('Adicionar arquivos') as HTMLInputElement;
const linha = (nome: string) => screen.getByRole('listitem', { name: nome });
const continuar = () => screen.getByRole('button', { name: 'Continuar' });
const TODOS = { 'fachada.jpeg': classificacaoDe('fachada'), 'geladeira.jpeg': classificacaoDe('refrigerador'), 'balcao.jpeg': classificacaoDe('equipamentos'), 'nf.jpeg': classificacaoDe('nf_ambev'), 'cartao.pdf': classificacaoDe('cartao_cnpj') };
const subirTodos = async () => userEvent.upload(entrada(), [arquivo('fachada.jpeg', 'image/jpeg'), arquivo('geladeira.jpeg', 'image/jpeg'), arquivo('balcao.jpeg', 'image/jpeg'), arquivo('nf.jpeg', 'image/jpeg'), arquivo('cartao.pdf', 'application/pdf'), arquivo('tour.mp4', 'video/mp4', 4 * MB)]);

describe('EtapaAnexos', () => {
  test('classifica em lote, preenche o tipo com confiança alta, pede escolha com confiança baixa e não classifica vídeo', async () => {
    const classificar = porNome({ 'fachada.jpeg': classificacaoDe('fachada', 0.92), 'gelo.jpeg': classificacaoDe('refrigerador', 0.4) });
    render(<Harness classificar={classificar} />);
    await userEvent.upload(entrada(), [arquivo('fachada.jpeg', 'image/jpeg'), arquivo('gelo.jpeg', 'image/jpeg'), arquivo('tour.mp4', 'video/mp4', 4 * MB)]);
    expect(await within(linha('fachada.jpeg')).findByText('Fachada, detectado')).toBeInTheDocument();
    expect(within(linha('fachada.jpeg')).getByRole('combobox')).toHaveValue('fachada');
    expect(await within(linha('gelo.jpeg')).findByText('Escolha o tipo')).toBeInTheDocument();
    expect(within(linha('gelo.jpeg')).getByRole('combobox')).toHaveValue('');
    expect(within(linha('gelo.jpeg')).getByText('parece refrigerador')).toBeInTheDocument();
    expect(within(linha('tour.mp4')).getByRole('combobox')).toHaveValue('video_geral');
    expect(await within(linha('tour.mp4')).findByText('18 s')).toBeInTheDocument();
    expect(classificar).toHaveBeenCalledTimes(2);
  });

  test('enquanto classifica, o seletor fica desabilitado e Continuar explica o motivo', async () => {
    let resolver!: (r: RespostaClassificacao) => void;
    const classificar = vi.fn(() => new Promise<RespostaClassificacao>((res) => { resolver = res; })) as unknown as Classificar;
    render(<Harness classificar={classificar} />);
    await userEvent.upload(entrada(), arquivo('fachada.jpeg', 'image/jpeg'));
    const combo = within(linha('fachada.jpeg')).getByRole('combobox');
    expect(combo).toBeDisabled();
    expect(within(linha('fachada.jpeg')).getByText('Classificando...')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Aguarde a classificação terminar');
    resolver(classificacaoDe('fachada'));
    await waitFor(() => expect(combo).toBeEnabled());
    expect(combo).toHaveValue('fachada');
  });

  test('falha na classificação deixa o arquivo sem tipo, com aviso, e o usuário escolhe à mão', async () => {
    render(<Harness classificar={porNome({ 'foto.jpeg': new Error('O serviço respondeu HTTP 500') })} />);
    await userEvent.upload(entrada(), arquivo('foto.jpeg', 'image/jpeg'));
    expect(await within(linha('foto.jpeg')).findByText('Não foi possível classificar automaticamente.')).toBeInTheDocument();
    const combo = within(linha('foto.jpeg')).getByRole('combobox');
    expect(combo).toHaveValue('');
    await userEvent.selectOptions(combo, 'refrigerador');
    expect(combo).toHaveValue('refrigerador');
    expect(within(linha('foto.jpeg')).getByText('Refrigerador')).toBeInTheDocument();
  });

  test('falha de autenticação mostra o aviso de token e não chama o webhook para os próximos arquivos', async () => {
    const classificar = porNome({ 'a.jpeg': new ErroApi('auth', 'token inválido', 401) });
    render(<Harness classificar={classificar} />);
    await userEvent.upload(entrada(), arquivo('a.jpeg', 'image/jpeg'));
    expect(await screen.findByRole('alert')).toHaveTextContent('VITE_N8N_TOKEN');
    await userEvent.upload(entrada(), arquivo('b.jpeg', 'image/jpeg'));
    expect(await within(linha('b.jpeg')).findByText('Não foi possível classificar automaticamente.')).toBeInTheDocument();
    expect(classificar).toHaveBeenCalledTimes(1);
  });

  test('recusa arquivo grande com o motivo e não cria linha', async () => {
    render(<Harness classificar={porNome({})} />);
    await userEvent.upload(entrada(), arquivo('VIDEO grande.mp4', 'video/mp4', 12 * MB));
    expect(screen.getByRole('alert')).toHaveTextContent('WhatsApp');
    expect(screen.queryByRole('listitem', { name: 'VIDEO grande.mp4' })).toBeNull();
  });

  test('tipo incompatível com o formato mostra erro na linha e mantém sem tipo', async () => {
    render(<Harness classificar={porNome({})} />);
    await userEvent.upload(entrada(), arquivo('clipe.mp4', 'video/mp4'));
    const combo = within(linha('clipe.mp4')).getByRole('combobox');
    expect(combo).toHaveValue('video_geral');
    await userEvent.selectOptions(combo, 'refrigerador');
    expect(within(linha('clipe.mp4')).getByText(/Formato não aceito/)).toBeInTheDocument();
    expect(combo).toHaveValue('');
    await userEvent.selectOptions(combo, 'video_geral');
    expect(combo).toHaveValue('video_geral');
  });

  test('miniatura cria a object URL uma vez por arquivo e revoga ao desmontar', async () => {
    const criar = vi.spyOn(URL, 'createObjectURL').mockClear();
    const revogar = vi.spyOn(URL, 'revokeObjectURL').mockClear();
    const { unmount } = render(<Harness classificar={porNome({ 'gelo.jpeg': classificacaoDe('refrigerador') })} />);
    await userEvent.upload(entrada(), arquivo('gelo.jpeg', 'image/jpeg'));
    await within(linha('gelo.jpeg')).findByText('Refrigerador, detectado');
    expect(criar).toHaveBeenCalledTimes(1);
    await userEvent.selectOptions(within(linha('gelo.jpeg')).getByRole('combobox'), 'fachada');
    expect(criar).toHaveBeenCalledTimes(1);
    unmount();
    expect(revogar).toHaveBeenCalledTimes(1);
    criar.mockRestore();
    revogar.mockRestore();
  });

  test('Continuar só habilita com todos os obrigatórios presentes, mostra o que falta e avança para a etapa 3', async () => {
    render(<Harness classificar={porNome(TODOS)} />);
    await userEvent.upload(entrada(), arquivo('fachada.jpeg', 'image/jpeg'));
    await within(linha('fachada.jpeg')).findByText('Fachada, detectado');
    expect(continuar()).toBeDisabled();
    expect(screen.getByRole('status')).toHaveTextContent('Falta: Refrigerador, Balcão e equipamentos, NF Ambev, Cartão CNPJ, Vídeo geral');
    await subirTodos();
    await waitFor(() => expect(continuar()).toBeEnabled());
    expect(screen.queryByRole('status')).toBeNull();
    await userEvent.click(continuar());
    expect(screen.getByTestId('etapa')).toHaveTextContent('3');
  });

  test('câmara fria declarada "sim" entra na lista do que falta', async () => {
    render(<Harness classificar={porNome(TODOS)} formulario={{ camaraFria: 'sim' }} />);
    await subirTodos();
    await within(linha('cartao.pdf')).findByText('Cartão CNPJ, detectado');
    expect(continuar()).toBeDisabled();
    expect(screen.getByRole('status')).toHaveTextContent('Falta: Câmara fria');
  });

  test('voltar retorna à etapa 1', async () => {
    render(<Harness classificar={porNome({})} />);
    await userEvent.click(screen.getByRole('button', { name: 'Voltar' }));
    expect(screen.getByTestId('etapa')).toHaveTextContent('1');
  });
});
```

- [ ] **Passo 2: rodar e ver falhar**

Run: `pnpm -C web test -- EtapaAnexos`
Expected: FAIL (a tela atual não aceita `cliente`, não mostra selos nem `role="status"`, e sugere tipos pelo nome).

- [ ] **Passo 3: reescrever a tela**

Substituir `web/src/ui/EtapaAnexos.tsx` por:

```tsx
// web/src/ui/EtapaAnexos.tsx
import { useEffect, useRef, useState } from 'react';
import { TIPOS_CONFIG } from '@shared/config/index';
import { TIPOS } from '@shared/schemas/index';
import type { ClienteN8n } from '../api/clienteN8n';
import { obterDuracaoVideo } from '../anexos/duracaoVideo';
import { formatarMb, inferirMime, validarArquivo, validarArquivoBasico } from '../anexos/validarArquivo';
import { CLASSIFICACAO_PENDENTE, CLASSIFICACAO_VIDEO, faltantes, podeAvancar, type Acao, type Anexo, type EstadoApp } from '../fluxo/estadoApp';
import { executarFilaClassificacao, type ItemClassificacao } from '../fluxo/filaClassificacao';
import type { TipoAnexo } from '../tipos';
import { Botoes } from './componentes';

interface Props { estado: EstadoApp; despachar: (a: Acao) => void; cliente: Pick<ClienteN8n, 'classificarArquivo'>; obterDuracao?: (arquivo: File) => Promise<number | null> }

const AVISO_TOKEN = 'Token do n8n ausente ou inválido. Verifique a configuração (VITE_N8N_TOKEN); enquanto isso, escolha os tipos à mão.';

function Miniatura({ arquivo }: { arquivo: File }) {
  const [url] = useState(() => URL.createObjectURL(arquivo));
  useEffect(() => () => URL.revokeObjectURL(url), [url]);
  return <img src={url} alt="" width={64} height={64} />;
}

/** Texto do selo de estado de um anexo na lista. */
export function seloDe(a: Anexo): string {
  if (a.classificacao.estado === 'pendente' || a.classificacao.estado === 'classificando') return 'Classificando...';
  if (a.tipo && a.classificacao.tipoDetectado === a.tipo) return `${TIPOS_CONFIG[a.tipo].rotulo}, detectado`;
  if (a.tipo) return TIPOS_CONFIG[a.tipo].rotulo;
  return 'Escolha o tipo';
}

const classificando = (a: Anexo) => a.classificacao.estado === 'pendente' || a.classificacao.estado === 'classificando';

export function EtapaAnexos({ estado, despachar, cliente, obterDuracao = obterDuracaoVideo }: Props) {
  const [recusados, setRecusados] = useState<string[]>([]);
  const [errosLinha, setErrosLinha] = useState<Record<string, string>>({});
  const entradaRef = useRef<HTMLInputElement>(null);

  const semTokenValido = estado.anexos.some((a) => a.classificacao.estado === 'falhou' && a.classificacao.erroCodigo === 'auth');

  function classificar(anexos: Anexo[]) {
    if (anexos.length === 0) return;
    if (semTokenValido) {
      for (const a of anexos) despachar({ tipo: 'anexo_classificacao', arquivoId: a.arquivoId, valor: { estado: 'falhou', erro: 'Token do n8n ausente ou inválido', erroCodigo: 'auth' } });
      return;
    }
    const itens: ItemClassificacao[] = anexos.map((a) => ({ arquivoId: a.arquivoId, arquivo: a.arquivo, nome: a.nome, estado: 'pendente' }));
    void executarFilaClassificacao(itens, (item) => cliente.classificarArquivo({ arquivo: item.arquivo, nome: item.nome, arquivoId: item.arquivoId }), {
      aoMudar: (item) => despachar({
        tipo: 'anexo_classificacao', arquivoId: item.arquivoId,
        valor: item.estado === 'concluida' && item.resultado
          ? { estado: 'concluida', tipoDetectado: item.resultado.tipo_detectado, confianca: item.resultado.confianca, motivo: item.resultado.motivo, erro: undefined, erroCodigo: undefined }
          : { estado: item.estado, erro: item.erro, erroCodigo: item.erroCodigo },
      }),
    });
  }

  async function adicionar(arquivos: FileList | File[]) {
    const motivos: string[] = [];
    const novos: Anexo[] = [];
    for (const arquivo of Array.from(arquivos)) {
      const basico = validarArquivoBasico(arquivo);
      if (!basico.ok) { motivos.push(`${arquivo.name}: ${basico.motivo}`); continue; }
      const mime = inferirMime(arquivo);
      const video = mime.startsWith('video/');
      const duracaoS = video ? await obterDuracao(arquivo) : null;
      const anexo: Anexo = {
        arquivoId: crypto.randomUUID(), arquivo, nome: arquivo.name, mime, tipo: video ? 'video_geral' : null, duracaoS, estado: 'na_fila',
        classificacao: video ? CLASSIFICACAO_VIDEO : CLASSIFICACAO_PENDENTE,
      };
      despachar({ tipo: 'anexo_adicionar', valor: anexo });
      if (!video) novos.push(anexo);
    }
    setRecusados(motivos);
    classificar(novos);
  }

  function mudarTipo(anexo: Anexo, valor: string) {
    if (!valor) return;
    const tipo = valor as TipoAnexo;
    const r = validarArquivo(anexo.arquivo, tipo);
    if (!r.ok) {
      setErrosLinha((e) => ({ ...e, [anexo.arquivoId]: r.motivo }));
      despachar({ tipo: 'anexo_tipo', arquivoId: anexo.arquivoId, valor: null });
      return;
    }
    setErrosLinha((e) => { const { [anexo.arquivoId]: _r, ...resto } = e; return resto; });
    despachar({ tipo: 'anexo_tipo', arquivoId: anexo.arquivoId, valor: tipo });
  }

  const pendentes = faltantes(estado);
  const motivoBloqueio = estado.anexos.length === 0 ? 'Adicione ao menos um arquivo'
    : estado.anexos.some(classificando) ? 'Aguarde a classificação terminar'
      : estado.anexos.some((a) => a.tipo === null) ? 'Escolha o tipo dos arquivos sem tipo'
        : pendentes.length ? `Falta: ${pendentes.map((t) => TIPOS_CONFIG[t].rotulo).join(', ')}` : '';

  return (
    <section aria-labelledby="t-anexos" className="etapa-anexos">
      <div className="coluna-arquivos">
        <h2 id="t-anexos">2. Fotos, vídeos e documentos</h2>
        <p>Adicione os arquivos em lote. Cada um é classificado automaticamente; confira o tipo e corrija se precisar.</p>

        <div className="zona" onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); void adicionar(e.dataTransfer.files); }}>
          <label htmlFor="arquivos">Adicionar arquivos</label>
          <input ref={entradaRef} id="arquivos" type="file" multiple accept=".mp4,.jpg,.jpeg,.png,.pdf" onChange={(e) => { if (e.target.files) void adicionar(e.target.files); e.target.value = ''; }} />
          <small>Arraste aqui ou toque para escolher. MP4 até 11 MB; JPEG, PNG e PDF até 8 MB.</small>
        </div>

        {recusados.length > 0 && <ul className="erros" role="alert">{recusados.map((m) => <li key={m}>{m}</li>)}</ul>}
        {semTokenValido && <p role="alert" className="aviso">{AVISO_TOKEN}</p>}

        <ul className="anexos" aria-label="Arquivos adicionados">
          {estado.anexos.map((a) => (
            <li key={a.arquivoId} aria-label={a.nome} className={`classificacao-${a.classificacao.estado}`}>
              {a.mime.startsWith('image/') ? <Miniatura arquivo={a.arquivo} /> : <span className="icone">{a.mime.startsWith('video/') ? 'Vídeo' : 'PDF'}</span>}
              <div className="detalhes">
                <strong>{a.nome}</strong>
                <small>{formatarMb(a.arquivo.size)}{a.duracaoS != null && <> · <span>{a.duracaoS} s</span></>}</small>
                <span className="selo">{seloDe(a)}</span>
                <select aria-label={`Tipo de ${a.nome}`} value={a.tipo ?? ''} disabled={classificando(a)} onChange={(e) => mudarTipo(a, e.target.value)}>
                  <option value="">Escolha o tipo</option>
                  {TIPOS.map((t) => <option key={t} value={t}>{TIPOS_CONFIG[t].rotulo}</option>)}
                </select>
                {a.classificacao.estado === 'falhou' && <small className="erro">Não foi possível classificar automaticamente.</small>}
                {a.classificacao.estado === 'concluida' && a.tipo === null && a.classificacao.motivo && <small className="motivo">{a.classificacao.motivo}</small>}
                {errosLinha[a.arquivoId] && <small className="erro">{errosLinha[a.arquivoId]}</small>}
              </div>
              <button type="button" onClick={() => despachar({ tipo: 'anexo_remover', arquivoId: a.arquivoId })}>Remover</button>
            </li>
          ))}
        </ul>

        <Botoes>
          <button type="button" onClick={() => despachar({ tipo: 'etapa', valor: 1 })}>Voltar</button>
          <button type="button" disabled={!podeAvancar(estado)} onClick={() => despachar({ tipo: 'etapa', valor: 3 })}>Continuar</button>
          {motivoBloqueio && <small className="motivo-bloqueio" role="status">{motivoBloqueio}</small>}
        </Botoes>
      </div>
    </section>
  );
}
```

Em `web/src/App.tsx`, trocar a linha da etapa 2 por:

```tsx
      {estado.etapa === 2 && <EtapaAnexos estado={estado} despachar={despachar} cliente={cliente} />}
```

Em `web/src/styles.css`, acrescentar antes do bloco `@media print`:

```css
.selo { font-size: 0.85rem; color: var(--cor-neutra); }
.classificacao-classificando .selo, .classificacao-pendente .selo { color: var(--cor-primaria); }
.classificacao-falhou .selo { color: var(--cor-atencao); }
.motivo { color: var(--cor-neutra); }
.motivo-bloqueio { color: var(--cor-neutra); align-self: center; }
```

- [ ] **Passo 4: rodar e ver passar**

Run: `pnpm lint && pnpm test && pnpm build`
Expected: PASS, sem warnings de `act(...)`; `App.test.tsx` continua verde (o App monta com `cliente`).

- [ ] **Passo 5: commit**

```bash
git add web/src/ui/EtapaAnexos.tsx web/src/ui/EtapaAnexos.test.tsx web/src/App.tsx web/src/styles.css
git commit -m "Tela de anexos classifica os arquivos automaticamente e exige tipo e obrigatórios antes de avançar" -m "Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Tarefa 9: painel de documentos com checklist, sugestão ao clicar e layout responsivo

**Files:**
- Create: `web/src/ui/PainelDocumentos.tsx`, `web/src/ui/PainelDocumentos.test.tsx`
- Modify: `web/src/ui/EtapaAnexos.tsx` (coluna do painel, sugestão de tipo ao clicar no checklist, painel recolhido no celular), `web/src/styles.css`
- Test: `web/src/ui/PainelDocumentos.test.tsx`, `web/src/ui/EtapaAnexos.test.tsx` (dois testes novos)

**Interfaces:**
- Consumes: `tiposObrigatorios`, `TIPOS_CONFIG`, `TIPOS`; `EstadoApp`; a tela da Tarefa 8.
- Produces: `PainelDocumentos({ estado, aberto, aoEscolher })`: `<details>` com `<summary>` "Documentos do PDV: X de N obrigatórios enviados" e lista `aria-label="Checklist de documentos"`, um botão por tipo (`aria-label="Adicionar <rótulo>"`) com contagem e situação (`ok`, `falta`, `opcional`), obrigatórios primeiro na ordem da configuração; em `EtapaAnexos`, clicar em um item guarda o tipo sugerido e abre o seletor de arquivos; os arquivos enviados em seguida recebem esse tipo quando o formato for compatível (a classificação ainda roda, e o tipo escolhido prevalece); no celular (`max-width: 720px`) o painel começa recolhido e aparece antes da lista.

- [ ] **Passo 1: escrever os testes do painel**

`web/src/ui/PainelDocumentos.test.tsx`:

```tsx
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, test, vi } from 'vitest';
import { CLASSIFICACAO_PENDENTE, estadoInicial, type Anexo, type EstadoApp } from '../fluxo/estadoApp';
import { PainelDocumentos } from './PainelDocumentos';

const anexo = (id: string, tipo: Anexo['tipo']): Anexo => ({ arquivoId: id, arquivo: new File(['x'], `${id}.jpeg`, { type: 'image/jpeg' }), nome: `${id}.jpeg`, mime: 'image/jpeg', tipo, duracaoS: null, estado: 'na_fila', classificacao: CLASSIFICACAO_PENDENTE });
const estadoCom = (anexos: Anexo[], camaraFria: 'sim' | 'nao' = 'sim'): EstadoApp => {
  const e = estadoInicial();
  return { ...e, etapa: 2, formulario: { ...e.formulario, camaraFria }, anexos };
};

describe('PainelDocumentos', () => {
  test('lista obrigatórios primeiro na ordem da configuração, com contagem, situação e resumo', () => {
    render(<PainelDocumentos estado={estadoCom([anexo('a1', 'fachada'), anexo('a2', 'fachada')])} aberto aoEscolher={vi.fn()} />);
    expect(screen.getByText('Documentos do PDV: 1 de 7 obrigatórios enviados')).toBeInTheDocument();
    const itens = within(screen.getByRole('list', { name: 'Checklist de documentos' })).getAllByRole('listitem');
    expect(itens.map((li) => li.textContent)).toEqual([
      'Fachadaobrigatório · 2 arquivo(s)ok',
      'Refrigeradorobrigatório · 0 arquivo(s)falta',
      'Câmara friaobrigatório · 0 arquivo(s)falta',
      'Balcão e equipamentosobrigatório · 0 arquivo(s)falta',
      'NF Ambevobrigatório · 0 arquivo(s)falta',
      'Cartão CNPJobrigatório · 0 arquivo(s)falta',
      'Vídeo geralobrigatório · 0 arquivo(s)falta',
    ]);
    expect(itens[0]).toHaveClass('ok');
    expect(itens[1]).toHaveClass('falta');
  });

  test('câmara fria declarada "não" vira opcional e vai para o fim da lista', () => {
    render(<PainelDocumentos estado={estadoCom([], 'nao')} aberto aoEscolher={vi.fn()} />);
    const itens = within(screen.getByRole('list', { name: 'Checklist de documentos' })).getAllByRole('listitem');
    expect(itens[6]).toHaveTextContent('Câmara friaopcional · 0 arquivo(s)');
    expect(itens[6]).toHaveClass('opcional');
    expect(screen.getByText('Documentos do PDV: 0 de 6 obrigatórios enviados')).toBeInTheDocument();
  });

  test('clicar em um item chama aoEscolher com o tipo', async () => {
    const aoEscolher = vi.fn();
    render(<PainelDocumentos estado={estadoCom([])} aberto aoEscolher={aoEscolher} />);
    await userEvent.click(screen.getByRole('button', { name: 'Adicionar NF Ambev' }));
    expect(aoEscolher).toHaveBeenCalledWith('nf_ambev');
  });

  test('aberto=false deixa o painel recolhido', () => {
    render(<PainelDocumentos estado={estadoCom([])} aberto={false} aoEscolher={vi.fn()} />);
    expect(screen.getByText(/Documentos do PDV/).closest('details')).not.toHaveAttribute('open');
  });
});
```

Em `web/src/ui/EtapaAnexos.test.tsx`, acrescentar dentro do `describe`:

```tsx
  test('clicar em um documento do checklist abre o seletor e atribui o tipo ao arquivo enviado, mesmo com classificação diferente', async () => {
    const abrir = vi.spyOn(HTMLInputElement.prototype, 'click').mockImplementation(() => {});
    render(<Harness classificar={porNome({ 'nota.jpeg': classificacaoDe('fachada', 0.95) })} />);
    await userEvent.click(screen.getByRole('button', { name: 'Adicionar NF Ambev' }));
    expect(abrir).toHaveBeenCalledTimes(1);
    await userEvent.upload(entrada(), arquivo('nota.jpeg', 'image/jpeg'));
    await waitFor(() => expect(within(linha('nota.jpeg')).getByRole('combobox')).toBeEnabled());
    expect(within(linha('nota.jpeg')).getByRole('combobox')).toHaveValue('nf_ambev');
    expect(within(linha('nota.jpeg')).getByText('NF Ambev')).toBeInTheDocument();
    abrir.mockRestore();
  });

  test('no celular o painel começa recolhido', async () => {
    const original = window.matchMedia;
    window.matchMedia = ((consulta: string) => ({ matches: consulta.includes('720px'), media: consulta, onchange: null, addListener: () => {}, removeListener: () => {}, addEventListener: () => {}, removeEventListener: () => {}, dispatchEvent: () => false })) as typeof window.matchMedia;
    try {
      render(<Harness classificar={porNome({})} />);
      expect(screen.getByText(/Documentos do PDV/).closest('details')).not.toHaveAttribute('open');
    } finally {
      window.matchMedia = original;
    }
  });
```

- [ ] **Passo 2: rodar e ver falhar**

Run: `pnpm -C web test -- Painel EtapaAnexos`
Expected: FAIL ("Cannot find module './PainelDocumentos'"; a tela não tem o botão "Adicionar NF Ambev").

- [ ] **Passo 3: criar o painel**

`web/src/ui/PainelDocumentos.tsx`:

```tsx
// web/src/ui/PainelDocumentos.tsx
import { TIPOS_CONFIG, tiposObrigatorios } from '@shared/config/index';
import { TIPOS } from '@shared/schemas/index';
import type { EstadoApp } from '../fluxo/estadoApp';
import type { TipoAnexo } from '../tipos';

interface Props { estado: EstadoApp; aberto: boolean; aoEscolher: (tipo: TipoAnexo) => void }

export function PainelDocumentos({ estado, aberto, aoEscolher }: Props) {
  const obrigatorios = tiposObrigatorios(estado.formulario);
  const contagem = (t: TipoAnexo) => estado.anexos.filter((a) => a.tipo === t).length;
  const ordenados = [...TIPOS].sort((a, b) => Number(obrigatorios.includes(b)) - Number(obrigatorios.includes(a)));
  const enviados = obrigatorios.filter((t) => contagem(t) > 0).length;

  return (
    <details className="painel-docs" open={aberto}>
      <summary>Documentos do PDV: {enviados} de {obrigatorios.length} obrigatórios enviados</summary>
      <ul aria-label="Checklist de documentos">
        {ordenados.map((t) => {
          const obrigatorio = obrigatorios.includes(t);
          const n = contagem(t);
          const situacao = n > 0 ? 'ok' : obrigatorio ? 'falta' : 'opcional';
          return (
            <li key={t} className={situacao}>
              <button type="button" onClick={() => aoEscolher(t)} aria-label={`Adicionar ${TIPOS_CONFIG[t].rotulo}`}>
                <span className="rotulo">{TIPOS_CONFIG[t].rotulo}</span>
                <small>{obrigatorio ? 'obrigatório' : 'opcional'} · {n} arquivo(s)</small>
                <span className="situacao">{n > 0 ? 'ok' : obrigatorio ? 'falta' : ''}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </details>
  );
}
```

- [ ] **Passo 4: integrar na tela**

Em `web/src/ui/EtapaAnexos.tsx`:

1. Importar o painel:

```tsx
import { PainelDocumentos } from './PainelDocumentos';
```

2. Dentro do componente, após `const entradaRef = ...`, acrescentar:

```tsx
  const tipoSugerido = useRef<TipoAnexo | null>(null);
  const [estreito] = useState(() => typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(max-width: 720px)').matches);

  function escolherDocumento(tipo: TipoAnexo) {
    tipoSugerido.current = tipo;
    entradaRef.current?.click();
  }
```

3. Em `adicionar`, trocar a criação do anexo para usar a sugestão e limpar a sugestão ao final do laço:

```tsx
      const sugerido = tipoSugerido.current;
      const tipo: TipoAnexo | null = video ? 'video_geral' : sugerido && validarArquivo(arquivo, sugerido).ok ? sugerido : null;
      const anexo: Anexo = {
        arquivoId: crypto.randomUUID(), arquivo, nome: arquivo.name, mime, tipo, duracaoS, estado: 'na_fila',
        classificacao: video ? CLASSIFICACAO_VIDEO : CLASSIFICACAO_PENDENTE,
      };
```

e, logo após o `for`, antes de `setRecusados(motivos)`:

```tsx
    tipoSugerido.current = null;
```

4. No JSX, depois do `</div>` que fecha `coluna-arquivos` e antes de `</section>`, acrescentar:

```tsx
      <aside className="coluna-painel">
        <PainelDocumentos estado={estado} aberto={!estreito} aoEscolher={escolherDocumento} />
      </aside>
```

Em `web/src/styles.css`, acrescentar antes do bloco `@media print`:

```css
.etapa-anexos { display: grid; grid-template-columns: minmax(0, 1fr) 280px; gap: 1.5rem; align-items: start; }
.coluna-arquivos { min-width: 0; }
.painel-docs { border: 1px solid var(--cor-borda); border-radius: 8px; background: #fff; padding: 0.5rem 0.75rem; position: sticky; top: 1rem; }
.painel-docs summary { cursor: pointer; font-weight: 600; }
.painel-docs ul { list-style: none; padding: 0; margin: 0.5rem 0 0; }
.painel-docs li button { width: 100%; display: grid; grid-template-columns: 1fr auto; column-gap: 0.5rem; text-align: left; background: none; color: var(--cor-texto); border: 0; border-bottom: 1px solid var(--cor-borda); border-radius: 0; padding: 0.5rem 0; }
.painel-docs li button small { grid-column: 1; color: var(--cor-neutra); }
.painel-docs li button .situacao { grid-column: 2; grid-row: 1 / span 2; align-self: center; font-weight: 600; }
.painel-docs .ok .situacao { color: var(--cor-conforme); }
.painel-docs .falta .situacao { color: var(--cor-atencao); }
@media (max-width: 720px) {
  .etapa-anexos { grid-template-columns: 1fr; }
  .coluna-painel { order: -1; }
  .painel-docs { position: static; }
}
```

e, dentro de `@media print`, acrescentar `.painel-docs` à lista de seletores escondidos:

```css
  .botoes, .etapas, .zona, button, .introducao, .painel-docs { display: none !important; }
```

- [ ] **Passo 5: rodar e ver passar**

Run: `pnpm lint && pnpm test && pnpm build`
Expected: PASS. Checagem visual (obrigatória, registrar no relatório): `pnpm -C web dev`, abrir a etapa 2 no desktop (duas colunas, painel fixo à direita) e com a janela abaixo de 720 px (painel recolhido acima da lista, expansível ao toque).

- [ ] **Passo 6: commit**

```bash
git add web/src/ui/PainelDocumentos.tsx web/src/ui/PainelDocumentos.test.tsx web/src/ui/EtapaAnexos.tsx web/src/ui/EtapaAnexos.test.tsx web/src/styles.css
git commit -m "Painel de documentos com checklist condicionado ao formulário e layout responsivo da etapa 2" -m "Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Tarefa 10: relatório mostra o tipo detectado e a reclassificação por arquivo

**Files:**
- Modify: `web/src/ui/EtapaRelatorio.tsx` (bloco "Evidências por arquivo", rodapé e `baixarJson`)
- Test: `web/src/ui/EtapaRelatorio.test.tsx`

**Interfaces:**
- Consumes: `Anexo.classificacao` (Tarefa 7); `TIPOS_CONFIG`; `TipoDetectado`.
- Produces: em cada arquivo do relatório, o sufixo " (detectado automaticamente)" quando o tipo final é o detectado, ou " (detectado como <rótulo ou indefinido>, reclassificado)" quando o usuário mudou; linha do rodapé "Classificação automática: X de Y arquivos aceitos sem correção" (Y conta só arquivos com classificação concluída pelo modelo, excluindo vídeo); o JSON baixado ganha `anexos` com `arquivo_id`, `nome`, `tipo`, `tipo_detectado` e `confianca`.

- [ ] **Passo 1: escrever os testes**

Em `web/src/ui/EtapaRelatorio.test.tsx`, acrescentar ao `describe`:

```tsx
  test('mostra o tipo detectado por arquivo e destaca reclassificações', async () => {
    const entrada = ok();
    const estado = estadoDe(entrada);
    estado.anexos[0].classificacao = { estado: 'concluida', tipoDetectado: 'refrigerador', confianca: 0.8, motivo: 'teste' };
    const video = estado.anexos.find((a) => a.tipo === 'video_geral')!;
    video.classificacao = { estado: 'concluida', tipoDetectado: 'video_geral', confianca: 1, motivo: 'Vídeo MP4 só pode ser vídeo geral' };
    function HarnessFixo({ cliente }: { cliente: ClienteN8n }) {
      const [e, despachar] = useReducer(reduzir, undefined, () => estado);
      return <EtapaRelatorio estado={e} despachar={despachar} cliente={cliente} agora={() => new Date('2026-09-02T15:04:00')} />;
    }
    render(<HarnessFixo cliente={clienteCom(vi.fn(async () => parecer))} />);
    expect(await screen.findByText('Material consistente com o declarado.')).toBeInTheDocument();
    expect(screen.getByText(/\(detectado como Refrigerador, reclassificado\)/)).toBeInTheDocument();
    expect(screen.getAllByText(/\(detectado automaticamente\)/)).toHaveLength(estado.anexos.length - 2);
    expect(screen.getByText(/Classificação automática: 7 de 8 arquivos aceitos sem correção/)).toBeInTheDocument();
  });
```

(A fixture aprovada tem nove anexos: um vídeo, que não conta, e oito imagens ou PDF classificados; a primeira observação foi marcada como reclassificada.)

- [ ] **Passo 2: rodar e ver falhar**

Run: `pnpm -C web test -- EtapaRelatorio`
Expected: FAIL (os textos não existem).

- [ ] **Passo 3: implementar**

Em `web/src/ui/EtapaRelatorio.tsx`:

1. Ampliar a importação de tipos:

```tsx
import type { TipoDetectado } from '../tipos';
```

2. Após `const segundosDe = ...`, acrescentar:

```tsx
const rotuloDetectado = (t: TipoDetectado) => (t === 'indefinido' ? 'indefinido' : TIPOS_CONFIG[t].rotulo);

function notaClassificacao(a: { tipo: TipoDetectado | null; classificacao: { tipoDetectado: TipoDetectado | null } }): string {
  const d = a.classificacao.tipoDetectado;
  if (!d || !a.tipo) return '';
  return d === a.tipo ? ' (detectado automaticamente)' : ` (detectado como ${rotuloDetectado(d)}, reclassificado)`;
}
```

3. Dentro do componente, após `const discorda = ...`:

```tsx
  const classificados = estado.anexos.filter((a) => a.classificacao.estado === 'concluida' && a.mime !== 'video/mp4');
  const aceitos = classificados.filter((a) => a.classificacao.tipoDetectado === a.tipo).length;
```

4. No bloco "Evidências por arquivo", trocar o `<small>` do tipo por:

```tsx
                <strong>{a.nome}</strong> <small>{a.tipo ? TIPOS_CONFIG[a.tipo].rotulo : ''}{notaClassificacao(a)}{!o.aderente_ao_tipo && ' (não corresponde ao tipo)'}</small>
```

5. No rodapé, acrescentar uma linha depois do `<small>` existente:

```tsx
        <br /><small>Classificação automática: {aceitos} de {classificados.length} arquivos aceitos sem correção</small>
```

6. Em `baixarJson`, acrescentar ao objeto `conteudo`:

```tsx
      anexos: estado.anexos.map((a) => ({ arquivo_id: a.arquivoId, nome: a.nome, tipo: a.tipo, tipo_detectado: a.classificacao.tipoDetectado, confianca: a.classificacao.confianca })),
```

- [ ] **Passo 4: rodar e ver passar**

Run: `pnpm lint && pnpm test && pnpm build`
Expected: PASS. O teste `caso aprovado: cabeçalho, 16 linhas, parecer e rodapé` continua passando (a fixture recebe classificação igual ao tipo na Tarefa 7).

- [ ] **Passo 5: commit**

```bash
git add web/src/ui/EtapaRelatorio.tsx web/src/ui/EtapaRelatorio.test.tsx
git commit -m "Relatório mostra o tipo detectado e as reclassificações por arquivo" -m "Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Tarefa 11: ADR-007, README, roteiro manual e status da spec

**Files:**
- Create: `docs/adrs/ADR-007-classificacao-automatica-em-workflow-dedicado.md`
- Modify: `README.md`, `docs/testes-manuais.md`, `docs/superpowers/specs/2026-09-03-classificacao-automatica-design.md` (linha de status)
- Test: não há código; verificação por `grep` de travessão e leitura.

**Interfaces:**
- Consumes: decisões da seção 2 da spec.
- Produces: registro da decisão e documentação alinhada ao que foi construído.

- [ ] **Passo 1: escrever a ADR**

`docs/adrs/ADR-007-classificacao-automatica-em-workflow-dedicado.md`:

```md
# ADR-007: classificação automática dos anexos em workflow dedicado do n8n, antes da análise

Data: 2026-09-03. Status: aceita. Decisores: José Romualdo.

## Contexto

Na versão inicial o usuário escolhia o tipo de cada arquivo na etapa 2, com sugestão apenas pelo nome do arquivo, que falha nas fotos de WhatsApp. No teste com casos reais, a área de onboarding pediu que a classificação saísse da mão do usuário, mantendo a reclassificação, e que a tela cobrasse ao menos um documento de cada tipo exigido.

## Decisão

Cada imagem ou PDF é classificado por um workflow próprio do n8n (`classificar-arquivo`) no momento do upload, com `google/gemini-2.5-flash`, prompt curto e schema estrito (`tipo_detectado`, `confianca`, `motivo`). O tipo é preenchido quando a confiança é igual ou superior a 0,6 e o formato é aceito pelo tipo; abaixo disso o usuário escolhe. Vídeo recebe `video_geral` sem chamada ao modelo. A lista de tipos obrigatórios é condicionada ao formulário (`tiposObrigatorios`), e a etapa 2 só avança com todos os obrigatórios presentes.

## Motivações

- Classificar antes de analisar deixa o usuário corrigir antes de gastar a análise completa, que é a chamada cara e lenta.
- Um workflow dedicado reaproveita os módulos testados de `n8n/lib` e mantém prompts, timeouts e retries separados dos da análise.
- Custo desprezível: cerca de 1.200 tokens de entrada por imagem no modelo flash, 1 a 3 s de latência.

## Alternativas descartadas

- Classificar dentro do `analisar-arquivo` na mesma execução: um erro de classificação custaria uma segunda análise e o canvas ficaria com dois caminhos.
- Só heurística local pelo nome e pelo mime: falha nas fotos com nomes genéricos.
- Modelo local no navegador (CLIP via transformers.js): cerca de 90 MB no celular do PDV e fraco em documentos.

## Riscos conhecidos e mitigações

- Classificação errada com confiança alta: o seletor continua editável, o relatório mostra o tipo detectado e a reclassificação, e a verificação 16 marca `aderente_ao_tipo` falso como Atenção.
- Terceiro workflow para importar e manter: gerado pelo mesmo build, com teste de sincronia e credenciais reassociadas na importação, conforme `docs/operacao.md`.
- Portão rígido pode travar o usuário sem documento: o botão mostra o que falta e o checklist aponta o item.

## Consequências

- Positivas: menos cliques, menos erro de tipo, medida de acerto da classificação no relatório.
- Negativas: uma chamada a mais por imagem ou PDF; dependência do webhook também na etapa 2 (falha degrada para escolha manual, sem bloquear).

## ADRs relacionadas

ADR-002 (arquivo por chamada via OpenRouter), ADR-003 (modelo extrai, regras julgam), ADR-005 (módulos n8n testados e injetados pelo build).
```

- [ ] **Passo 2: README e roteiro**

Em `README.md`: no parágrafo de abertura, acrescentar após "geração de relatório de conformidade": ", com classificação automática dos anexos pelo modelo antes da análise"; na tabela de comandos, trocar a descrição de `pnpm smoke` por "Chama os três webhooks publicados (classificar, analisar e consolidar) e valida as respostas contra os schemas (requer `.env` com `N8N_BASE_URL` e `N8N_TOKEN`)".

Em `docs/testes-manuais.md`, no caso aprovado, trocar o passo 3 por:

```md
3. Anexar os 3 vídeos, as 16 fotos e a NF em lote; aguardar a classificação automática, anotar quantos arquivos vieram com o tipo certo, corrigir os demais pelo seletor e conferir que o painel "Documentos do PDV" marca todos os obrigatórios como ok antes de Continuar habilitar.
```

e acrescentar à tabela de registro a coluna "Classificações corretas / total" antes de "Observações".

- [ ] **Passo 3: status da spec**

Em `docs/superpowers/specs/2026-09-03-classificacao-automatica-design.md`, trocar a linha de status por:

```md
Data: 2026-09-03. Status: aceita; implementada conforme `docs/superpowers/plans/2026-09-03-classificacao-automatica.md`; decisão registrada na ADR-007. Decisores: José Romualdo (produto), com apoio do Claude Code.
```

- [ ] **Passo 4: verificar**

Run: `grep -rnP '\x{2014}' docs/adrs/ADR-007-classificacao-automatica-em-workflow-dedicado.md README.md docs/testes-manuais.md docs/superpowers/specs/2026-09-03-classificacao-automatica-design.md; pnpm lint && pnpm test`
Expected: o `grep` não encontra nada (sai com código 1) e a suíte segue verde.

- [ ] **Passo 5: commit**

```bash
git add docs/adrs/ADR-007-classificacao-automatica-em-workflow-dedicado.md README.md docs/testes-manuais.md docs/superpowers/specs/2026-09-03-classificacao-automatica-design.md
git commit -m "ADR-007 e documentação da classificação automática dos anexos" -m "Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

## Autorrevisão do plano

- Cobertura da spec: seção 3 (UX) nas Tarefas 8 e 9; seção 4 (contrato) nas Tarefas 3, 4 e 6; seção 5 (workflow) nas Tarefas 2, 3, 4 e 5; seção 6 (estado e regras) nas Tarefas 1 e 7; seção 7 (erros) nas Tarefas 7 e 8 (falha degrada para "Escolha o tipo", auth pausa a fila); seção 8 (testes) distribuída por tarefa; seção 10 (ADR) na Tarefa 11; relatório com tipo detectado na Tarefa 10.
- Consistência de nomes: `tiposObrigatorios`, `faltantes`, `CLASSIFICACAO_PENDENTE`, `CLASSIFICACAO_VIDEO`, `anexo_classificacao`, `executarFilaClassificacao`, `classificarArquivo`, `RespostaClassificacao`, `TipoDetectado`, `schemaClassificacaoModelo`, `schemaClassificacaoCompleta`, `validarEntradaClassificacao`, `montarRequisicaoClassificacao`, `validarClassificacao` são usados com a mesma grafia em todas as tarefas.
- Dependências entre tarefas: 1 e 2 independentes; 3 depende de 2; 4 de 3; 5 de 2 e 4; 6 de 2; 7 de 1 e 6; 8 de 7; 9 de 8; 10 de 7; 11 de todas. Executar em ordem numérica.
- Após a Tarefa 11, publicar: `pnpm build:n8n` já rodado; importar `n8n/workflows/classificar-arquivo.json` no n8n Cloud e reassociar credenciais; rodar `pnpm smoke`; fazer o merge em `main` e enviar, o que dispara o deploy.

