# ze-onboarding-pdv

Validação de onboarding de novos pontos de venda (PDV) com análise de fotos, vídeos e documentos por IA e geração de relatório de conformidade, com classificação automática dos anexos pelo modelo antes da análise.

Estado atual: versão inicial implementada (frontend, motor de regras e workflows n8n prontos; workflow de deploy no GitHub Pages configurado em `.github/workflows/deploy.yml`). O documento de design está em `docs/superpowers/specs/2026-09-02-onboarding-pdv-design.md` e as decisões arquiteturais em `docs/adrs/`.

A publicação em `https://josercf.github.io/ze-onboarding-pdv/` depende do merge para `main` e destas pendências:

- Configurar no GitHub Actions a variável de repositório `N8N_BASE_URL` (Settings, Variables) e o segredo `N8N_TOKEN` (Settings, Secrets); o `deploy.yml` lê a URL de `vars` e o token de `secrets`.
- Habilitar o GitHub Pages no repositório.
- Criar a credencial do OpenRouter e importar os workflows no n8n Cloud, conforme `docs/operacao.md`.
- Rodar `pnpm smoke` contra o ambiente publicado.
- Executar o roteiro manual em `docs/testes-manuais.md`.

## Comandos

| Comando | O que faz |
|---|---|
| `pnpm install` | Instala as dependências do workspace |
| `pnpm test` | Roda os testes da raiz (Vitest) e de `web/` |
| `pnpm -C web dev` | Sobe o frontend localmente |
| `pnpm build:n8n` | Gera `n8n/workflows/*.json` a partir de `n8n/lib`, `n8n/prompts` e `shared/schemas` |
| `pnpm smoke` | Chama os três webhooks publicados (classificar, analisar e consolidar) e valida as respostas contra os schemas (requer `.env` com `N8N_BASE_URL` e `N8N_TOKEN`) |

## Estrutura

| Pasta | Conteúdo |
|---|---|
| `web/` | Frontend estático (Vite + React + TypeScript), publicado no GitHub Pages |
| `n8n/` | Workflows exportados, prompts e módulos JS dos nós Code |
| `shared/` | Schemas JSON das observações e do parecer, configuração (CNAEs, itens críticos, padrões regionais) |
| `docs/` | Design, ADRs, guia de operação (`operacao.md`) e roteiro de testes manuais (`testes-manuais.md`) |
| `exemplos/` | Materiais reais para teste local. Ignorado pelo git por conter dados pessoais |

Guia de operação do n8n (credenciais, publicação dos workflows, limites, CORS e rotação de token): `docs/operacao.md`. Roteiro de testes manuais com os dois casos reais: `docs/testes-manuais.md`.

## Materiais de exemplo

Os arquivos reais enviados por PDVs contêm CNPJ, nomes e notas fiscais. Eles ficam apenas na máquina local, em `exemplos/`, e nunca entram neste repositório. As fixtures de teste em `shared/` e `web/` usam identificadores fictícios com a mesma estrutura.
