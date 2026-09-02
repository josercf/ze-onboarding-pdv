# ADR-004: token público no webhook com CORS restrito, e caminho para produção

Data: 2026-09-02. Status: aceita. Decisores: José Romualdo.

## Contexto

O frontend é um site estático público e chama webhooks do n8n que consomem créditos do OpenRouter. Qualquer segredo embutido no frontend é visível a quem inspecionar a página.

## Decisão

Os webhooks usam Header Auth com um token embutido no frontend por variável de build (`VITE_N8N_TOKEN`), CORS restrito à origem `https://josercf.github.io`, limites de tamanho por arquivo e rotação do token quando necessário. A chave do OpenRouter fica exclusivamente em credencial do n8n.

## Motivações

- Sem servidor próprio, não há onde guardar um segredo do lado do cliente.
- O token contém abuso casual (scripts que descobrem a URL do webhook) e o CORS impede uso a partir de outros sites no navegador.
- O custo por chamada é baixo (centavos), o que limita o dano de um abuso pontual.

## Riscos conhecidos e mitigações

- O token pode ser extraído e usado fora do navegador: monitorar consumo no OpenRouter e rotacionar o token; limites de tamanho reduzem o custo por chamada.
- Para produção, adicionar Cloudflare Turnstile validado no n8n ou um proxy autenticado, e revisar esta ADR.

## Consequências

Positivas: publicação imediata, sem infraestrutura adicional. Negativas: proteção fraca contra abuso deliberado, aceitável apenas nesta versão inicial.

## ADRs relacionadas

ADR-001.
