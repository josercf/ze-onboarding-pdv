# Operação: n8n Cloud, credenciais e publicação dos workflows

## Credenciais no n8n
| Nome | Tipo | Uso |
|---|---|---|
| Token onboarding PDV | Header Auth (`X-Api-Token`) | Autentica os três webhooks. O mesmo valor vai no secret `N8N_TOKEN` do GitHub (Tarefa 18). Gerar com `openssl rand -hex 24`. |
| OpenRouter | Header Auth (`Authorization: Bearer ...`) | Chamadas ao OpenRouter. A chave nunca sai do n8n. |

## Publicar ou atualizar os workflows
1. Alterar `n8n/lib`, `n8n/prompts` ou `shared/` e rodar `pnpm test:node`.
2. Rodar `pnpm build:n8n` e commitar `n8n/workflows/*.json`.
3. No n8n Cloud: abrir cada um dos três workflows (`analisar-arquivo`, `classificar-arquivo`, `consolidar`), menu ⋯ → Import from File, escolher o JSON gerado (substitui os nós), reassociar as credenciais nos nós Webhook e HTTP Request (o JSON gerado traz o id placeholder REVISAR-CREDENCIAL, então a importação sempre as desfaz), salvar e publicar.
4. Rodar `pnpm smoke` (Tarefa 18) contra a instância.

Nunca editar código de nó na interface: o teste de sincronia falha e a mudança se perde na próxima importação. Para trocar de modelo sem reimportar, editar o valor no nó `Config`.

## Workflows
| Workflow | Caminho | O que faz | Modelo | Timeout do OpenRouter |
|---|---|---|---|---|
| `classificar-arquivo` | `POST /webhook/classificar-arquivo` (multipart `arquivo`, `arquivo_id`) | Identifica o tipo de documento de uma imagem ou PDF e devolve `tipo_detectado`, `confianca` e `motivo`. Vídeo não passa aqui. | `google/gemini-2.5-flash` (no `Config`, campo `modelo_classificacao`) | 40 s |
| `analisar-arquivo` | `POST /webhook/analisar-arquivo` (multipart `arquivo`, `tipo`, `arquivo_id`, `contexto`) | Extrai a observação estruturada do arquivo conforme o tipo. | `google/gemini-2.5-flash` (`modelo_analise`) | 80 s |
| `consolidar` | `POST /webhook/consolidar` (JSON) | Gera o parecer a partir do formulário, da Receita, das observações e das 16 verificações. | `google/gemini-2.5-pro` (`modelo_parecer`) | 80 s |

## Limites do n8n Cloud que o desenho respeita
Resposta de webhook em até 100 s (Cloudflare 524); payload de até 16 MB; por isso uma chamada por arquivo, vídeo até 11 MB e imagem ou PDF até 8 MB.

## CORS, token e rotação
O Webhook aceita só a origem `https://josercf.github.io`. Para rotacionar o token: gerar um novo, atualizar a credencial "Token onboarding PDV", atualizar o secret `N8N_TOKEN` no GitHub e disparar o deploy (`gh workflow run deploy.yml`).

## Dados
Execuções bem-sucedidas não são salvas; falhas são salvas para diagnóstico e devem ser apagadas após análise (Executions → Delete). A requisição ao OpenRouter leva `provider.data_collection: "deny"`.
