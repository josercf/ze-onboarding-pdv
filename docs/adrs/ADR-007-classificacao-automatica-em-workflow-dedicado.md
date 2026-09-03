# ADR-007: classificação automática dos anexos em workflow dedicado do n8n, antes da análise

Data: 2026-09-03. Status: aceita. Decisores: José Romualdo.

## Contexto

Na versão inicial o usuário escolhia o tipo de cada arquivo na etapa 2, com sugestão apenas pelo nome do arquivo, que falha nas fotos de WhatsApp. No teste com casos reais, a área de onboarding pediu que a classificação saísse da mão do usuário, mantendo a reclassificação, e que a tela cobrasse ao menos um documento de cada tipo exigido.

## Decisão

Cada imagem ou PDF é classificado por um workflow próprio do n8n (`classificar-arquivo`) no momento do upload, com `google/gemini-2.5-flash`, prompt curto e schema estrito (`tipo_detectado`, `confianca`, `motivo`). O tipo é preenchido quando a confiança é igual ou superior a 0,6 e o formato é aceito pelo tipo; abaixo disso o usuário escolhe. Vídeo recebe `video_geral` sem chamada ao modelo. A lista de tipos obrigatórios é condicionada ao formulário (`tiposObrigatorios`), e a etapa 2 só avança com todos os obrigatórios presentes.

## Motivações

- Classificar antes de analisar deixa o usuário corrigir antes de gastar a análise completa, que é a chamada cara e lenta.
- Um workflow dedicado reaproveita os módulos testados de `n8n/lib` e mantém prompts, timeouts e retries separados dos da análise.
- Custo desprezível: cerca de 1.200 tokens de entrada por imagem no modelo flash, 1 a 3 s de latência.

## Alternativas descartadas

- Classificar dentro do `analisar-arquivo` na mesma execução: um erro de classificação custaria uma segunda análise e o canvas ficaria com dois caminhos.
- Só heurística local pelo nome e pelo mime: falha nas fotos com nomes genéricos.
- Modelo local no navegador (CLIP via transformers.js): cerca de 90 MB no celular do PDV e fraco em documentos.

## Riscos conhecidos e mitigações

- Classificação errada com confiança alta: o seletor continua editável, o relatório mostra o tipo detectado e a reclassificação, e a verificação 16 marca `aderente_ao_tipo` falso como Atenção.
- Terceiro workflow para importar e manter: gerado pelo mesmo build, com teste de sincronia e credenciais reassociadas na importação, conforme `docs/operacao.md`.
- Portão rígido pode travar o usuário sem documento: o botão mostra o que falta e o checklist aponta o item.

## Consequências

- Positivas: menos cliques, menos erro de tipo, medida de acerto da classificação no relatório.
- Negativas: uma chamada a mais por imagem ou PDF; dependência do webhook também na etapa 2 (falha degrada para escolha manual, sem bloquear).

## ADRs relacionadas

ADR-002 (arquivo por chamada via OpenRouter), ADR-003 (modelo extrai, regras julgam), ADR-005 (módulos n8n testados e injetados pelo build).
