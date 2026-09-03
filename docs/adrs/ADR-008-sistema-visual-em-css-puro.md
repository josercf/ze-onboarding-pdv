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
