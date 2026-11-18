# 0004. Código em inglês, interface em português

- Status: Aceita
- Data: 17/11/2026

## Contexto

O time é brasileiro e o produto é para restaurantes brasileiros, mas o código usa bibliotecas, APIs e convenções em inglês, e o projeto pode receber outros desenvolvedores.

## Decisão

Identificadores, arquivos, rotas, tabelas, variáveis de ambiente, comentários e commits em inglês. Todo texto lido pelo gestor fica em português em `src/copy` ou no JSX. A documentação em `docs/` é escrita em português com nomes de arquivo em inglês.

## Consequências

- Os nomes do design (Mata, Brasa) ficam em `design/tokens.json` como `designName`.
- Termos da CW em português nas respostas da API (por exemplo, nomes de arquivos de especificação) são mapeados para inglês nas bordas.
