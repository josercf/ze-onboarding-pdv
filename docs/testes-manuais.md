# Roteiro de testes manuais

Pré-requisitos: site publicado, workflows ativos, `pnpm smoke` verde, materiais reais em `exemplos/exemplo-ok/` e `exemplos/exemplo-nao-ok/` (fora do git).

## Caso aprovado (exemplos/exemplo-ok)
1. Abrir `https://josercf.github.io/ze-onboarding-pdv/` no desktop.
2. Preencher o formulário com os dados do texto padrão do caso; conferir que a Receita preencheu razão social e CNAE.
3. Anexar os 3 vídeos, as 16 fotos e a NF em lote; aguardar a classificação automática, anotar quantos arquivos vieram com o tipo certo, corrigir os demais pelo seletor e conferir que o painel "Documentos do PDV" marca todos os obrigatórios como ok antes de o botão Continuar habilitar.
4. Enviar; anotar o tempo por arquivo (todos abaixo de 100 s) e falhas.
5. Resultado esperado: recomendação **Apto**; itens 7, 8, 9, 10, 11 e 12 Conforme; 16 Conforme ou Atenção apenas por qualidade de foto.

## Caso reprovado (exemplos/exemplo-nao-ok)
1. Repetir o fluxo com o formulário do caso (declara 4 refrigeradores e câmara fria "não").
2. Resultado esperado: recomendação **Não apto**; 6 Divergente (NF em nome de terceiro e código de cliente diferente); 7 Divergente (declarados 4, observados 1 ou 2); 8 Atenção (anexo de câmara fria é freezer de gelo); 9 Atenção (porta de aço fechada, depósito); 13 Atenção (resposta condicional).

## Celular
Repetir o caso aprovado em Chrome Android ou Safari iOS: seleção de arquivos pela galeria, vídeo reproduzindo no relatório, botões de timestamp posicionando o vídeo, impressão em PDF pelo navegador.

## Registro
| Data | Caso | Recomendação obtida | Itens divergentes do esperado | Tempo máximo por arquivo | Classificações corretas / total | Observações |
|---|---|---|---|---|---|---|
