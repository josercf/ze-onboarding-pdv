# ADR-006: oxlint mantido no lugar do ESLint no frontend

Data: 2026-09-02. Status: aceita. Decisores: José Romualdo.

## Contexto

O plano da Tarefa 1 especificava o script `"lint": "eslint ."` em `web/package.json`, partindo do pressuposto de que `pnpm create vite web --template react-ts` geraria `eslint.config.js` e as dependências de ESLint, como o template fazia até então. Ao rodar o comando na implementação, o template atual (Vite 8, `create-vite` de 2026) não gerou nenhum arquivo nem dependência de ESLint: gerou `web/.oxlintrc.json` e instalou `oxlint` como devDependency, com `"lint": "oxlint"` já pronto em `web/package.json`. O próprio `web/README.md` gerado pelo template documenta oxlint ("Expanding the Oxlint configuration"), confirmando que é a ferramenta padrão atual do template, não uma falha de instalação.

Esse cenário não estava coberto pelas decisões pré-respondidas do brief da Tarefa 1, que só previam o que fazer se o template gerasse `eslint.config.js`.

## Decisão

Manter `oxlint` como linter de `web/`, com `"lint": "oxlint"` em `web/package.json` e o `web/.oxlintrc.json` gerado pelo template. Não instalar ESLint nem escrever `eslint.config.js`.

## Motivações

- `oxlint` já vem funcional e configurado pelo próprio `create-vite`, sem exigir nenhuma dependência fora da lista de pacotes autorizada para a Tarefa 1.
- Forçar `eslint .` exigiria instalar pacotes não previstos (`eslint`, `typescript-eslint`, `eslint-plugin-react-hooks`, `eslint-plugin-react-refresh` ou equivalentes) e escrever um `eslint.config.js` do zero sem nenhum conteúdo de referência no brief, ou seja, uma configuração inteira decidida sem especificação.
- `oxlint` é o padrão atual do template `react-ts` do Vite; seguir o padrão do ecossistema reduz manutenção comparado a reintroduzir uma ferramenta que o próprio template abandonou.

## Riscos conhecidos e mitigações

- `oxlint` não faz lint type-aware por padrão (ao contrário do `typescript-eslint` com informação de tipos): o `pnpm build` já roda `tsc -b` antes do `vite build`, cobrindo erros de tipo; se regras type-aware específicas forem necessárias, instalar `oxlint-tsgolint` (documentado no `web/README.md` gerado) ou reabrir esta ADR.
- `oxlint` tem motor, regras e ecossistema de plugins diferentes do ESLint, então plugins ou regras específicas do ESLint usados em outros projetos podem não ter equivalente: se uma tarefa futura depender de uma regra ESLint sem equivalente em `oxlint`, reavaliar esta decisão antes de prosseguir.
- Divergência entre o texto literal do brief da Tarefa 1 (`eslint .`) e o que foi implementado: registrada nesta ADR e no relatório da Tarefa 1 para não se perder no histórico.

## Consequências

Positivas: `pnpm lint` funcional desde a Tarefa 1, sem dependência adicional, sem configuração para manter. Negativas: sem lint type-aware por padrão; risco de precisar reavaliar a ferramenta se uma tarefa futura exigir uma regra específica do ecossistema ESLint.

## Decisões de toolchain relacionadas

Três ajustes adicionais, fora do texto literal do brief da Tarefa 1, foram necessários para o conteúdo especificado funcionar nas versões reais de pnpm/TypeScript/Vitest instaladas. Nenhum decide uma troca de tecnologia (por isso não abrem ADR própria), mas ficam registrados aqui por serem do mesmo tipo de achado:

- **`globals: true`** em `web/vite.config.ts` (bloco `test`) e **`"vitest/globals"`** acrescentado a `types` em `web/tsconfig.app.json`: o teste de fumaça do App usa `test(...)` e `expect(...)` como globais, sem importar de `'vitest'`; sem `globals: true` o Vitest não injeta esses globais em runtime (`ReferenceError: test is not defined`), e sem `"vitest/globals"` em `types` o `tsc -b` não reconhece os mesmos identificadores em tempo de compilação.
- **`ignoreDeprecations: "6.0"`** em `web/tsconfig.app.json`: o TypeScript instalado pelo template (`~6.0.2`, resolvido para `6.0.3`) trata a opção `baseUrl` (exigida pelo brief para o alias `@shared`) como erro fatal de compilação (`TS5101`), não apenas aviso; a mensagem do próprio compilador recomenda essa opção como correção.
- **`allowBuilds: { esbuild: true }`** em `pnpm-workspace.yaml`, gerado por `pnpm approve-builds --all`: o pnpm 11 bloqueia por padrão o script de postinstall do `esbuild` (dependência transitiva do Vite/Vitest); sem aprovar, `pnpm install --frozen-lockfile` (usado no CI) termina com `ERR_PNPM_IGNORED_BUILDS` e exit code 1, mesmo instalando os pacotes corretamente. Confirmado com reinstalação limpa local e com o CI real no GitHub.

## ADRs relacionadas

Nenhuma.
