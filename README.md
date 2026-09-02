# ze-onboarding-pdv

Validação de onboarding de novos pontos de venda (PDV) com análise de fotos, vídeos e documentos por IA e geração de relatório de conformidade.

Estado atual: design aprovado, implementação ainda não iniciada. O documento de design está em `docs/superpowers/specs/2026-09-02-onboarding-pdv-design.md` e as decisões arquiteturais em `docs/adrs/`.

## Estrutura prevista

| Pasta | Conteúdo |
|---|---|
| `web/` | Frontend estático (Vite + React + TypeScript), publicado no GitHub Pages |
| `n8n/` | Workflows exportados, prompts e módulos JS dos nós Code |
| `shared/` | Schemas JSON das observações e do parecer, configuração (CNAEs, itens críticos, padrões regionais) |
| `docs/` | Design, ADRs, roteiro de testes manuais e guia de operação |
| `exemplos/` | Materiais reais para teste local. Ignorado pelo git por conter dados pessoais |

## Materiais de exemplo

Os arquivos reais enviados por PDVs contêm CNPJ, nomes e notas fiscais. Eles ficam apenas na máquina local, em `exemplos/`, e nunca entram neste repositório. As fixtures de teste em `shared/` e `web/` usam identificadores fictícios com a mesma estrutura.
