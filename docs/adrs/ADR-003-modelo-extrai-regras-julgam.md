# ADR-003: o modelo extrai observações estruturadas e um motor de regras determinístico produz o veredito

Data: 2026-09-02. Status: aceita. Decisores: José Romualdo.

## Contexto

O relatório de conformidade compara o que o PDV declarou com o que o material comprova, com dados da Receita e com requisitos regionais. Deixar o modelo emitir o veredito diretamente tornaria o resultado difícil de auditar, de reproduzir e de testar.

## Decisão

O modelo multimodal devolve apenas observações por arquivo, validadas por JSON Schema (`shared/schemas/`). Um motor de regras em TypeScript no frontend (`web/src/rules/`) atribui o status de cada uma das 16 verificações e a recomendação sugerida. O modelo de texto escreve o parecer narrativo sem alterar status; discordâncias vão para `pontos_de_atencao`.

## Motivações

- Auditabilidade: cada status tem regra explícita e evidência citada.
- Testabilidade: as regras são funções puras cobertas por Vitest, com fixtures derivadas dos dois casos reais.
- Configuração sem código: lista de CNAEs, itens críticos e padrões regionais em `shared/config`.

## Riscos conhecidos e mitigações

- O motor roda no navegador, onde o PDV poderia adulterar o resultado: irrelevante nesta versão, porque não há persistência nem envio ao time. Quando houver, o mesmo módulo (função pura) passa a rodar no `consolidar`.
- Observações imprecisas do modelo contaminam o veredito: tolerâncias nas regras (diferença ≤ 1 em contagens) e evidências com timestamps para conferência humana.

## Consequências

Positivas: veredito explicável, regressões detectáveis por teste, ajustes de regra sem tocar em prompt. Negativas: duas camadas para manter (schemas e regras) e necessidade de sincronia entre schemas usados no frontend e no n8n, garantida por teste.

## ADRs relacionadas

ADR-002, ADR-005.
