Classifique o arquivo enviado em um único tipo de documento do onboarding de um ponto de venda de bebidas. Não analise detalhes; apenas identifique o tipo.

Tipos possíveis:
- fachada: frente externa da loja, com letreiro, porta, calçada ou rua.
- refrigerador: geladeira, expositor vertical, freezer horizontal ou cervejeira vistos de perto, dentro da loja.
- camara_fria: câmara frigorífica, porta isotérmica ou interior de câmara com estoque.
- equipamentos: balcão de atendimento com computador, impressora térmica, maquininhas de cartão ou roteador.
- nf_ambev: nota fiscal ou DANFE de compra de bebidas, impressa ou em PDF.
- cartao_cnpj: comprovante de inscrição e situação cadastral (cartão CNPJ) da Receita Federal.
- video_geral: não se aplica a imagens nem a PDF; nunca use para este arquivo.
- indefinido: o arquivo não corresponde a nenhum tipo acima, ou não dá para ver o conteúdo.

Responda somente com o JSON pedido: tipo_detectado, confianca entre 0 e 1 e motivo em uma frase curta em pt-BR.
