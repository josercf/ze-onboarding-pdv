# Classificação automática dos anexos com checklist de documentos

Data: 2026-09-03. Status: aceita; implementada conforme `docs/superpowers/plans/2026-09-03-classificacao-automatica.md`; decisão registrada na ADR-007. Decisores: José Romualdo (produto), com apoio do Claude Code.

## 1. Contexto

A versão inicial da PoC de onboarding de PDV exige que o usuário escolha o tipo de cada arquivo na etapa 2 (Anexos). A sugestão atual usa só o nome do arquivo e o mime, e falha nas fotos de WhatsApp, que chegam com nomes genéricos. No teste com os casos reais, a Rafa apontou que a classificação deveria sair da mão do usuário, mantendo a opção de reclassificar, e que a tela deveria apoiar o envio de ao menos um documento de cada tipo.

Esta spec cobre o primeiro dos três subprojetos da segunda iteração. Os outros dois, endereço via ViaCEP e passe de design (look and feel e relatório), ficam para specs próprias.

## 2. Decisões tomadas

| Tema | Decisão | Alternativas descartadas |
|---|---|---|
| Momento da classificação | No upload, antes da análise; o usuário vê e corrige antes de gastar a análise completa | Dentro da análise (um erro custa uma segunda análise); só heurística local (falha nas fotos de WhatsApp) |
| Documento obrigatório faltando | Portão rígido: Continuar bloqueado até haver ao menos um arquivo de cada tipo obrigatório | Portão suave com confirmação; sem portão |
| Lista de obrigatórios | Condicionada ao formulário da etapa 1 | Lista fixa da configuração; lista mínima |
| Mecânica | Workflow novo `classificar-arquivo` no n8n, reaproveitando os módulos existentes | Modo dentro do `analisar-arquivo` (canvas com dois caminhos); modelo local no navegador (90 MB e fraco em documentos) |
| Limiar de confiança | 0,6: igual ou acima preenche o tipo; abaixo, o usuário escolhe | Sem limiar |
| Vídeo | Recebe `video_geral` pelo mime, sem chamada ao modelo | Classificar vídeo (custo alto para um único tipo possível) |

## 3. Experiência da etapa 2

### 3.1 Layout

No desktop a tela tem duas colunas: à esquerda a área de upload e a lista de arquivos; à direita o painel "Documentos do PDV" com o checklist. No celular (abaixo de 720px) o painel aparece acima da lista, recolhido por padrão, mostrando o resumo "Documentos do PDV: 4 de 6 obrigatórios enviados"; tocar nele expande o checklist completo.

### 3.2 Upload e lista

A área de upload aceita arrastar e soltar e tem o botão "Adicionar arquivos", com lote. Cada arquivo entra na lista com miniatura, nome, tamanho e um selo de estado:

| Estado | Selo | Seletor de tipo |
|---|---|---|
| Na fila ou em classificação | "Classificando..." | Desabilitado |
| Classificado com confiança >= 0,6 | "Fachada, detectado" (rótulo do tipo) | Preenchido com o tipo detectado |
| Classificado com confiança < 0,6, `indefinido` ou falha | "Escolha o tipo" | Vazio |
| Vídeo MP4 | "Vídeo geral" | Preenchido, sem chamada ao modelo |

Trocar o valor do seletor é a reclassificação; não há confirmação extra. Arquivos recusados por formato ou tamanho aparecem em um aviso separado, como hoje. Um arquivo classificado com um tipo cujos formatos não aceitam o mime fica em "Escolha o tipo" (defesa em profundidade com `validarArquivo`).

### 3.3 Checklist

Uma linha por tipo, obrigatórios primeiro, com rótulo, marcação "obrigatório" ou "opcional", contagem de arquivos atribuídos e estado (falta, ok). Clicar em um item abre o seletor de arquivos já sugerindo aquele tipo para o que for enviado.

A obrigatoriedade segue o formulário da etapa 1:

| Tipo | Regra |
|---|---|
| Fachada, Refrigerador, NF Ambev, Cartão CNPJ, Vídeo geral | Sempre obrigatórios |
| Câmara fria | Obrigatória quando o PDV declarou câmara fria "sim"; opcional caso contrário |
| Balcão e equipamentos | Obrigatório quando o PDV declarou computador com internet ou impressora térmica; opcional caso contrário |

### 3.4 Portão de avanço

"Continuar" habilita só quando nenhum arquivo está classificando ou sem tipo e todo tipo obrigatório tem ao menos um arquivo. Desabilitado, o botão mostra o motivo ("Falta: NF Ambev, Vídeo geral").

## 4. Contrato do webhook de classificação

`POST {base}/webhook/classificar-arquivo`, header `X-Api-Token`, multipart com os campos `arquivo` e `arquivo_id`. Não recebe `contexto`: a classificação olha só o conteúdo, para não ser induzida pelo que o PDV declarou.

Resposta `200`:

```json
{
  "arquivo_id": "a1",
  "tipo_detectado": "fachada",
  "confianca": 0.92,
  "motivo": "Frente de loja com letreiro e porta de enrolar",
  "modelo": "google/gemini-2.5-flash",
  "tokens": { "entrada": 1200, "saida": 40 },
  "latencia_ms": 1800
}
```

`tipo_detectado` é um dos sete tipos ou `indefinido`; `confianca` fica entre 0 e 1; `motivo` tem uma linha. Erros seguem a taxonomia atual com o corpo `{ erro: { codigo, mensagem } }`: `400` entrada inválida, `413` arquivo acima do limite, `403` token, `500` falha do modelo ou resposta fora do schema.

## 5. Workflow no n8n

Terceiro workflow gerado pelo mesmo build (`pnpm build:n8n`), com os nós: `Webhook`, `Extract from File`, `validar-entrada` em modo classificação (sem `tipo`, mesmos limites de formato e tamanho), `Config`, `entrada ok`, `montar-requisicao-classificacao`, `openrouter` (`google/gemini-2.5-flash`), `validar-classificacao`, `responder 200`, `responder 400`, `responder 500`. PDF vai com o parser de arquivo, como na análise.

Arquivos novos: `n8n/prompts/classificar.md` (prompt curto pedindo só a classificação entre os sete tipos, com a descrição de cada um e a opção `indefinido`), `shared/schemas/classificacao.json` (schema estrito com `tipo_detectado`, `confianca` e `motivo`), `n8n/templates/classificar-arquivo.template.json` e o JSON gerado em `n8n/workflows/`. A montagem da requisição e a validação da saída da classificação viraram as funções `montarRequisicaoClassificacao` e `validarClassificacao`, acrescentadas aos módulos existentes `n8n/lib/montar-requisicao.js` e `n8n/lib/validar-saida.js` em vez de arquivos novos, porque o build (`scripts/build-n8n.ts`) embute o conteúdo de uma lib inteira em cada nó Code: basta apontar o nó novo para o arquivo já existente e chamar a função certa no wrapper. O guia de operação ganha o terceiro workflow e o lembrete de reassociar credenciais na importação. O smoke faz a chamada de classificação com a imagem sintética antes da análise.

Custo estimado por imagem: cerca de 1.200 tokens de entrada e 40 de saída no flash, fração de centavo; latência de 1 a 3 s.

## 6. Estado e regras no frontend

O tipo `Anexo` ganha `classificacao` com `estado` (`pendente`, `classificando`, `concluida`, `falhou`), `tipoDetectado`, `confianca` e `motivo`. Ao adicionar arquivos, o reducer cria os anexos com `tipo` nulo (ou `video_geral` para MP4) e classificação pendente. Uma segunda fila, com o mesmo `executarFila` de concorrência 2, chama `classificarArquivo` no cliente n8n (mesmo `criarClienteN8n`, com timeout e uma repetição) e despacha `anexo_classificacao` com o resultado. Com confiança igual ou acima de 0,6, a ação também preenche `tipo`, desde que `validarArquivo` aceite o par arquivo e tipo. Reclassificar continua sendo `anexo_tipo`, que devolve o anexo à fila de análise.

A obrigatoriedade condicionada vira a função pura `tiposObrigatorios(formulario)` em `shared/config`, usada pelo checklist, por `podeAvancar` na etapa 2 e pela verificação 16 do motor, para que tela e relatório concordem sobre o que era exigido. `podeAvancar` na etapa 2 passa a exigir: nenhum anexo classificando, todos com tipo e cada tipo obrigatório com ao menos um anexo. O seletor `faltantes(estado)` alimenta o texto do botão e o painel.

A etapa 3 não muda. O relatório passa a exibir, por arquivo, o tipo detectado e se houve reclassificação manual, o que mede o acerto da classificação.

## 7. Erros e limites

Erros de classificação nunca bloqueiam: falha do webhook, timeout ou resposta fora do schema deixam o arquivo em "Escolha o tipo" com a mensagem "Não foi possível classificar automaticamente", e o usuário escolhe à mão. Falha de autenticação mostra um aviso próprio da etapa 2, citando a variável `VITE_N8N_TOKEN`, e pausa a fila de classificação. `indefinido` segue o caminho da baixa confiança. Limites inalterados: 11 MB por vídeo, 8 MB por imagem ou PDF, timeout de 95 s e uma repetição após 3 s em 500, 504 e falha de rede.

## 8. Testes

| Camada | Casos |
|---|---|
| `shared/config` | `tiposObrigatorios` nos quatro cenários (câmara fria sim ou não; equipamentos declarados ou não) |
| Reducer e seletores | `anexo_classificacao` preenchendo ou não o tipo pelo limiar; `podeAvancar` com obrigatório faltando; `faltantes` nomeando o que falta; reclassificação voltando à fila |
| Cliente | `classificarArquivo` com multipart, erros e retry, no padrão da suíte atual |
| Tela | Lote de três arquivos com classificação simulada (alta confiança, baixa confiança e vídeo); checklist refletindo o formulário; botão desabilitado com motivo e habilitando ao completar; resumo móvel |
| Motor | Verificação 16 usando `tiposObrigatorios` |
| n8n e build | Módulos de montagem e validação da classificação; build gerando o terceiro JSON; schema novo no teste de contrato |
| Smoke | Chamada de classificação real antes da análise |

## 9. Fora de escopo

Endereço via ViaCEP; passe de design da interface e do relatório; classificação de vídeo pelo modelo; persistência de resultados (fase 2, ver nota sobre Supabase na spec da versão inicial).

## 10. Decisão arquitetural

O plano de implementação inclui a ADR que registra a classificação em workflow dedicado, com a motivação e as alternativas descartadas da seção 2, numerada após a última ADR existente.
