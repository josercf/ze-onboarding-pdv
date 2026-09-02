# ADR-002: análise de vídeo nativa, uma chamada por arquivo, via OpenRouter

Data: 2026-09-02. Status: aceita. Decisores: José Romualdo.

## Contexto

Os PDVs enviam vídeos de 15 a 60 s pelo WhatsApp (4 a 7 MB) e fotos. Três alternativas foram avaliadas: (A) enviar o vídeo inteiro em base64 a um modelo com entrada de vídeo, uma chamada por arquivo; (B) extrair frames no navegador e enviar imagens; (C) envio único com processamento assíncrono e polling.

## Decisão

Alternativa A: cada arquivo é enviado ao webhook `analisar-arquivo`, convertido para base64 no n8n e analisado pelo modelo `google/gemini-2.5-flash` via OpenRouter com parte `video_url`, `image_url` ou `file` e `response_format` json_schema.

## Motivações

- O OpenRouter aceita vídeo em data URL base64 (mp4, mov, webm) e 77 modelos declaram entrada de vídeo, incluindo a família Gemini Flash.
- Vídeo nativo preserva movimento, continuidade da cena e áudio, o que melhora a contagem de refrigeradores e permite transcrever a narração do PDV.
- Uma chamada por arquivo mantém cada resposta entre 10 e 40 s, abaixo do corte de 100 s do n8n Cloud, e permite progresso e repetição por arquivo.
- C exigiria guardar estado de job, o que contraria a ADR-001.

## Riscos conhecidos e mitigações

- Aceitação de `video_url` em base64 pelo Gemini via OpenRouter ainda não foi testada com chave: tarefa zero do plano de implementação. Se falhar, B entra como fallback.
- Base64 aumenta o payload em 33%: limite de 11 MB por vídeo e 8 MB por imagem ou PDF no frontend.
- Custo por vídeo: da ordem de 8 mil tokens por 30 s no Gemini Flash, aceitável.

## Consequências

Positivas: frontend simples, melhor qualidade de análise, sem estado. Negativas: vídeos acima de 11 MB são recusados até que o fallback de frames seja implementado; dependência de modelos com entrada de vídeo.

## ADRs relacionadas

ADR-001, ADR-003.
