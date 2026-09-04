# Passe de design da interface e do relatório

Data: 2026-09-03. Status: aceita; implementada conforme `docs/superpowers/plans/2026-09-03-passe-de-design.md`; decisão registrada na ADR-008. Decisores: José Romualdo (produto), com apoio do Claude Code.

## 1. Contexto

O frontend foi construído priorizando o fluxo e as regras. O resultado funciona e está coberto por testes, mas não tem sistema visual: a folha de estilo inteira tem 71 linhas, a etapa 1 apresenta 29 campos em coluna única com um único agrupamento, não existe indicação de foco, e o relatório impresso é a mesma tela sem tratamento de página. Ao ver o fluxo pronto, o usuário registrou que o formulário continua desconfortável de usar.

Este é o terceiro e último subprojeto da segunda iteração. Os dois anteriores, classificação automática dos anexos e o que a antecede, já estão em `main`. O endereço via ViaCEP fica para spec própria.

## 2. Decisões tomadas

| Tema | Decisão | Alternativas descartadas |
|---|---|---|
| Direção visual | Sóbria e neutra: hierarquia, agrupamento e espaçamento, sem ativo de marca | Identidade Zé Delivery aproximada de memória, arriscada diante de quem é dona da marca; identidade corporativa AMBEV |
| Estrutura da etapa 1 | Página única com cinco blocos temáticos e grade responsiva | Sub-etapas com navegação própria (mais estado e mais cliques); lista única só com respiro (ganho insuficiente) |
| Relatório | Resumo executivo no topo, antes da tabela | Só arrumar o existente; relatório ilustrado com miniaturas por verificação |
| Meio técnico | CSS puro em tokens e camadas, sem dependência nova | Tailwind (dependência, ruído de classe no JSX); CSS Modules (fragmenta as regras de impressão) |
| Execução | Tokens e camadas mais um componente de seção; telas 2 e 3 herdam sem reescrita | Componentizar todo o layout antes (churn nos testes); passe cosmético |

Fora de escopo: tema escuro, animação, biblioteca de componentes, fonte externa, identidade de marca.

## 3. Sistema visual

`web/src/styles.css` passa a importar quatro arquivos, e nenhum outro arquivo de código precisa saber dessa divisão:

| Arquivo | Conteúdo |
|---|---|
| `web/src/estilos/tokens.css` | Cor, espaço, tipografia, raio, sombra e foco |
| `web/src/estilos/base.css` | Elementos nus: corpo, títulos, tabela, formulário, links |
| `web/src/estilos/componentes.css` | Campo, cartão, seção, tabela de verificações, selo, painel, botões, avisos |
| `web/src/estilos/impressao.css` | Bloco `@media print` |

Escalas: espaço em grade de oito pixels com seis degraus; tipografia em seis tamanhos, cada um com altura de linha própria; raio em três degraus; uma sombra apenas. A fonte continua a do sistema, sem carregar arquivo externo, porque o site é estático e não deve depender de rede para renderizar.

Duas correções nascem nos tokens:

1. As quatro cores de situação (conforme, divergente, atenção, não verificável) atingem contraste mínimo de 4,5 para 1 sobre branco. O laranja atual de atenção fica em torno de 3,1 para 1 e reprova.
2. Passa a existir um token de foco, com anel visível, aplicado a todo elemento interativo. Hoje não há indicação de foco, e a etapa 1 tem 29 campos que se percorre por teclado.

## 4. Etapa 1 em blocos

Entra o componente `Secao` em `web/src/ui/componentes.tsx`: título, descrição opcional e grade para os campos.

Os campos se distribuem em cinco blocos, nesta ordem:

| Bloco | Campos |
|---|---|
| Identificação | CNPJ, cartão da Receita logo abaixo, responsável, sócio, conta corrente |
| Endereço do ponto de venda | Logradouro, número, complemento, bairro, município, UF, CEP |
| Estrutura e equipamentos | Refrigeradores, câmara fria, maquininhas, computador com internet, impressora térmica |
| Operação e entrega | Entregadores, horário de funcionamento do delivery, loja ativa no Zé, garrafa de 300 ml |
| Fiscal e comercial | Cupom fiscal, observação do cupom, CNAE de bebidas, parceiro Ambev, código de parceiro |

O painel recolhido de parâmetros de avaliação continua ao final, como está.

Na grade, campo de número ou de sim e não ocupa um terço da linha no desktop; campo de texto curto, metade; campo largo (horário, observação), dois terços; campo longo (logradouro), a linha inteira. No celular, coluna única.

Nada muda em rótulo, identificador de campo, ordem de validação ou mensagem de erro: os testes existentes consultam por rótulo e não devem sofrer churn. A lista de erros passa a ficar junto do botão Continuar, com o estilo de aviso do sistema.

## 5. Relatório e impressão

O topo da etapa 4 ganha um resumo executivo: cabeçalho com razão social, CNPJ e data de geração; a recomendação em destaque, como hoje; uma linha com a contagem por situação, os quatro números lado a lado; e em seguida os pontos de atenção do parecer, que hoje aparecem apenas ao final. A tabela das 16 verificações e as evidências por arquivo permanecem, agora como detalhamento.

As contagens vêm de uma função pura sobre as verificações, com teste próprio, sem estado novo.

Na impressão: margem de página definida; cabeçalho da tabela repetido a cada página (`display: table-header-group`); linha que não se parte no meio (`break-inside: avoid`); quebra antes da seção de evidências; vídeo escondido, além dos botões, painéis e indicador de etapas que já sumiam. Os selos de situação ganham contorno, para permanecerem legíveis em impressão preto e branco.

## 6. Etapas 2 e 3

Herdam o sistema sem reescrita de lógica. Na etapa 2, cada arquivo da lista vira um cartão com miniatura, nome, tamanho, selo e seletor alinhados em grade, e o painel de documentos passa a usar o cartão do sistema. Na etapa 3, a barra de progresso e as linhas de arquivo recebem o mesmo tratamento de selo e espaçamento.

## 7. Dívidas pagas neste passe

1. A região de aviso do portão da etapa 2 passa a existir sempre no documento, alternando apenas o texto. Hoje ela é montada junto com a mensagem, o que torna o anúncio pouco confiável em leitor de tela.
2. As cores de situação sobem para o contraste mínimo, o que vem dos tokens.
3. A verificação 16 deixa de dizer "faltam" quando o arquivo foi enviado e a análise falhou: a presença passa a ser contada pelos anexos enviados, e a menção à falha de análise continua separada, como já é hoje.

## 8. Testes

| Camada | Casos |
|---|---|
| Etapa 1 | Os cinco títulos de bloco existem e um campo de cada bloco está dentro do bloco certo |
| Relatório | A linha de contagens mostra os números certos para as fixtures aprovada e reprovada |
| Etapa 2 | A região de aviso existe no documento mesmo sem mensagem de bloqueio |
| Motor | Verificação 16 distingue documento ausente de documento enviado cuja análise falhou |
| Existentes | A maioria passa sem ajuste, por consultar por papel e por texto; dois foram ajustados, ambos legitimamente: duas asserções do relatório foram escopadas à tabela, porque o resumo passou a repetir as palavras no documento, e a asserção que checava a ausência da região de aviso da etapa 2 virou asserção de região vazia, porque a região passa a existir sempre |

Contraste verificado por medição e registrado. Comportamento de impressão verificado no navegador e registrado, porque não é afirmável em teste automatizado.

## 9. Decisão arquitetural

O plano inclui a ADR que registra o sistema visual em CSS puro com tokens e camadas, com a motivação e as alternativas descartadas da seção 2, numerada após a última ADR existente.
