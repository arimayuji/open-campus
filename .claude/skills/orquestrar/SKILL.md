---
name: orquestrar
description: Orquestra tarefas grandes: o modelo atual planeja, vários subagentes Haiku executam em paralelo e o orquestrador revisa. Use em /orquestrar ou para implementar uma spec com partes independentes.
---

# Orquestrar: planejar caro, executar barato

Você é o **orquestrador**. Seu trabalho é planejar, delegar e revisar. Não leia dezenas de arquivos nem escreva código em volume você mesmo: isso é dos workers. O que o worker lê fica no contexto dele, e só um resumo volta para você. É isso que economiza cota.

## Quando usar

Use quando a tarefa se divide em 3 ou mais partes independentes (várias features, módulos, arquivos, pesquisas, migrações). Se for pequena ou muito acoplada, faça direto ou com no máximo um worker. Não gaste orquestração onde não compensa.

## Processo

1. **Spec.** Se o usuário já trouxe uma spec, use. Se não, escreva uma curta em `spec.md` (objetivo, restrições, critérios de pronto). Pergunte só se houver ambiguidade que mude o resultado.
2. **Decomposição.** Quebre em tarefas independentes, cada uma mexendo em arquivos diferentes para os workers não se atropelarem. Dependências reais viram ondas: onda 2 só começa quando a 1 voltar revisada. Limite padrão de 6 workers por onda.
3. **Contrato por tarefa.** Cada worker recebe um prompt autocontido, porque ele não vê esta conversa:
   - Objetivo em uma frase
   - Arquivos que pode ler e arquivos que pode alterar (e os que não pode tocar)
   - Restrições do projeto (stack, estilo, versões)
   - Critério de pronto verificável (ex: "teste X passa", "função Y exportada")
   - Formato do retorno: no máximo 150 palavras com o que foi feito, arquivos alterados e problemas. Nada de colar código no retorno
4. **Disparo em paralelo.** Use a ferramenta Agent com `model: "haiku"` e `run_in_background: false`, todas as chamadas da onda no mesmo turno. Observação: o seletor aceita só o alias "haiku", então não dá para fixar a versão. Se o usuário quiser garantir a 5.5, avise que ele deve conferir o consumo.
5. **Revisão.** Para cada retorno, confira contra o critério de pronto. Prefira verificar de fato (rodar teste, ler o diff, checar o arquivo) em vez de confiar no resumo. Aprovado: marque como feito.
6. **Refazer.** Se algo falhou, devolva a mesma tarefa ao worker com feedback específico do que está errado (máximo 2 rodadas por tarefa). Se o Haiku falhar duas vezes, assuma a tarefa você mesmo ou use um worker `sonnet`.
7. **Fechamento.** Integre, rode a verificação final do conjunto (build, testes) e entregue um resumo curto: o que foi feito, o que foi refeito, o que ficou pendente.

## Regras de economia

- Tarefa mecânica (renomear, listar, mover, buscar, formatar) vai para Haiku. Decisão de arquitetura e revisão ficam com você.
- Worker nunca recebe o histórico inteiro, só o contrato.
- Use a lista de tarefas para mostrar progresso ao usuário.
- Não crie workers dentro de workers.
- Se a spec ficar ambígua no meio do caminho, pare e pergunte em vez de gastar uma onda no palpite.
