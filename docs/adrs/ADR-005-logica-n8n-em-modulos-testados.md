# ADR-005: lógica dos nós n8n mantida como módulos JS testados e injetados no workflow por script de build

Data: 2026-09-02. Status: aceita. Decisores: José Romualdo.

## Contexto

Parte da lógica do backend (validação da entrada, montagem da requisição ao OpenRouter com prompt e schema por tipo, validação da saída) vive em nós Code do n8n, que não têm framework de testes. As diretrizes do projeto exigem testes para tudo que for produzido.

## Decisão

Cada nó Code é escrito como módulo JS em `n8n/lib/`, coberto por Vitest, e um script `scripts/build-n8n.ts` injeta o código, os prompts (`n8n/prompts/`) e os schemas (`shared/schemas/`) nos workflows JSON em `n8n/workflows/`. O JSON gerado é o que se importa no n8n Cloud. Um teste de sincronia falha se o JSON versionado divergir do que o script produziria.

## Motivações

- Testes unitários da lógica do backend sem instância n8n.
- Uma única fonte para prompts e schemas, compartilhada com o frontend.
- Revisão de mudanças de prompt em pull request, com diff legível.

## Riscos conhecidos e mitigações

- Importação manual no n8n Cloud pode ficar defasada: `docs/operacao.md` descreve o procedimento e o smoke test verifica o webhook publicado.
- Divergência entre o ambiente Node dos testes e o runtime dos nós Code: os módulos usam apenas JavaScript padrão, sem dependências.

## Consequências

Positivas: backend testado, prompts versionados, importação reproduzível. Negativas: um passo de build a mais e disciplina para nunca editar o workflow direto na interface do n8n.

## ADRs relacionadas

ADR-003.
