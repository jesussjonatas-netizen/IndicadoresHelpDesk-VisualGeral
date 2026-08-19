# AUDITORIA | Indicadores Help Desk | Visual Geral

Crie um dashboard executivo denominado **"Análise Comparativa dos Chamados de Help Desk da ANCORA"**, utilizando como referência visual o BI enviado. Mantenha a mesma estrutura de layout, identidade visual e organização dos componentes, adaptando os indicadores para a operação do Help Desk.

Utilize como única fonte de dados a aba **"Rel. Cham. Atual 010726"** da planilha **"Análise Comparativa dos Chamados HD - 010726.xlsx"**.

## Identidade Visual

Utilize a identidade da Rede Ancora:

- Azul institucional predominante

- Vermelho institucional para destaques

- Branco e cinza claro nos cartões

- Cartões com cantos arredondados

- Sombras discretas

- Visual moderno semelhante ao Power BI

- Interface limpa, executiva e responsiva

## Remover completamente

- Indicador "Compra Junto" (os dados deverão ser incorporados ao indicador Crossdocking)

- Indicador "Pendente de Pagamento"

- Painel "Tempo em Aberto"

- Ranking lateral de Tempo em Aberto

## Indicadores Superiores

### Primeira linha

- Chamados Normais

- Chamados Crossdocking (somando os registros de Crossdocking + Compra Junto)

- Participação do Crossdocking (%)

### Segunda linha

- Ação ANCORA (Atendidos pelo HD)

- Ação Loja

- Ação Terceiros

### Terceira linha

- Procedentes

- Improcedentes

### Quarta linha

- Em Tratativa

- Finalizados

- Total de Chamados

Não exibir:

- SLA

- Tempo Médio de Atendimento

## Tabelas

### Tabela 1

Cliente

Colunas:

- Cliente

- Quantidade de Chamados

### Tabela 2

Conferente da Expedição

Colunas:

- Conferente da Expedição

- Quantidade de Chamados

## Filtros Laterais

Substituir os filtros atuais por:

- Ano

- Mês

- Dia

- Cliente

- Região

- Conferente da Expedição

- Tipo de Chamado

- Status

- Procedência

Todos os indicadores, gráficos e tabelas deverão responder automaticamente aos filtros selecionados.

## Pesquisa

Adicionar uma pesquisa rápida por:

- Número do Chamado

- Cliente

## Exportação

Adicionar botões para:

- Exportar Excel

- Exportar PDF

## Funcionalidades

- Atualização automática dos indicadores

- Layout totalmente responsivo

- Navegação rápida

- Animações discretas

- Carregamento otimizado

- Paleta de cores seguindo o padrão institucional da Rede Ancora

## Organização

Manter praticamente a mesma distribuição visual do BI de referência, substituindo apenas os indicadores e informações que não fazem parte da operação do Help Desk.

O objetivo é entregar um dashboard executivo, limpo, intuitivo e voltado para análise comparativa dos chamados do Help Desk, permitindo que coordenadores, supervisores e gerentes identifiquem rapidamente volumes, distribuição dos chamados, responsáveis, procedência e desempenho operacional.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://ancora-hd-dash.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/f556ccea-d1da-4e90-bfe7-09479dba1ddf).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
