# ADR-001: frontend estático no GitHub Pages e backend n8n Cloud sem persistência

Data: 2026-09-02. Status: aceita. Decisores: José Romualdo.

## Contexto

O produto valida o onboarding de PDVs a partir de formulário, fotos, vídeos e documentos. A primeira versão precisa ser publicada rápido, sem servidor próprio, e demonstrada ao time de onboarding. O operador do frontend é o próprio PDV, e o relatório é exibido na tela ao final.

## Decisão

Frontend estático (Vite + React + TypeScript) no GitHub Pages e backend composto por dois webhooks no n8n Cloud existente, sem nenhuma persistência de envios ou resultados.

## Motivações

- Nenhum servidor para operar; deploy por GitHub Actions.
- O n8n já existe e concentra a credencial do OpenRouter.
- Sem persistência, não há dados pessoais armazenados, o que simplifica a LGPD na primeira versão.
- O time decidiu explicitamente não ter fila de revisão nem canal de entrega nesta versão.

## Riscos conhecidos e mitigações

- Limite de 100 s por resposta de webhook e 16 MB por payload no n8n Cloud: uma chamada por arquivo, com limites de tamanho no frontend (ADR-002).
- Sem histórico, o relatório se perde ao recarregar a página: botões de impressão em PDF e download em JSON.
- CORS e autenticação do webhook em site público: ADR-004.

## Consequências

Positivas: custo próximo de zero, publicação em minutos, superfície de segurança pequena. Negativas: nenhuma rastreabilidade de envios; quando o time quiser fila e histórico, será preciso um datastore (n8n Data Tables ou Supabase) e revisão desta ADR.

## ADRs relacionadas

ADR-002, ADR-004.
