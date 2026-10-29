# Primeira versão estável — Windows

Estado consolidado em 2026-10-29.

Este documento resume o corte da primeira versão utilizável do openScreenCopilot.
Ele não substitui [STATUS.md](STATUS.md) nem [ROADMAP.md](ROADMAP.md), que continuam
sendo as fontes detalhadas de evidências, dependências e histórico técnico.

## Objetivo da entrega

Entregar primeiro uma versão estável **somente para Windows**, concentrada no fluxo
principal de gravação:

1. abrir o aplicativo;
2. selecionar tela, janela ou região;
3. escolher e gravar áudio do sistema e microfone;
4. pausar, retomar e parar a gravação;
5. conferir o arquivo salvo e sua reprodução;
6. abrir a gravação no editor;
7. exportar o resultado;
8. repetir o fluxo em um pacote Windows reproduzível do fork.

Até a conclusão dos aceites abaixo, o pacote deve ser tratado como **preview/teste**,
e não como release homologado.

## O que já existe

- Branch de desenvolvimento própria do fork, com identidade e perfil isolados do
  upstream.
- Implementação Windows de captura de tela, janela e região.
- Crop de região no caminho de GPU.
- Suporte de gravação de áudio do sistema e microfone.
- Controles de pausa, retomada e parada.
- Resultado pós-gravação com acesso ao arquivo salvo.
- Abertura no editor e caminho de exportação existentes.
- Proteções para ownership, encerramento inesperado do helper e limpeza de processos.
- Testes automatizados extensos para TypeScript, Rust e contratos isolados.
- Fundação de speech-core/sidecar preservada e testada isoladamente, porém sem
  transcrição real integrada ao fluxo normal do aplicativo.

Esses itens indicam implementação disponível; não significam que todos os cenários
tenham sido homologados em hardware e uso reais.

## O que falta para fechar o preview Windows

### 1. Homologação funcional real

- [ ] Validar seleção e gravação de tela inteira.
- [ ] Validar seleção e gravação de uma janela.
- [ ] Validar seleção e gravação de uma região.
- [ ] Confirmar pixels e coordenadas em DPI misto.
- [ ] Confirmar áudio audível do sistema no endpoint escolhido.
- [ ] Confirmar microfone audível e independente do áudio do sistema.
- [ ] Validar pausa, retomada e parada sem perda ou dessincronização.
- [ ] Conferir arquivo salvo, duração, streams, reprodução e ausência de corrupção.
- [ ] Abrir o resultado no editor e concluir uma exportação reproduzível.
- [ ] Validar o fluxo completo no pacote Windows, não somente em desenvolvimento.

### 2. Robustez

- [ ] Testar desconexão ou mudança de dispositivo de áudio.
- [ ] Testar fechamento da janela ou fonte capturada durante a gravação.
- [ ] Testar encerramento inesperado do helper nativo.
- [ ] Verificar recuperação e limpeza após cancelamento, erro e fechamento do app.
- [ ] Executar gravação prolongada e conferir memória, CPU, sincronização e tamanho.
- [ ] Confirmar que não ficam processos ou arquivos temporários órfãos.

### 3. Regressão e pacote

- [ ] Executar testes TypeScript e Rust aplicáveis ao corte.
- [ ] Executar regressão do editor, reprodução e exportação.
- [ ] Recompilar e verificar os binários nativos Windows usados pelo pacote.
- [ ] Validar identidade, perfil, protocolos e ausência de atualização do upstream.
- [ ] Revisar privacidade, avisos, licenças e origem dos binários distribuídos.
- [ ] Gerar pacote Windows reproduzível do fork.
- [ ] Registrar limitações conhecidas e evidências da homologação.

## Regra para correções antes do preview

Durante a homologação, corrigir somente defeitos que bloqueiem ou comprometam o fluxo
principal de gravação, integridade do arquivo, áudio, estabilidade, privacidade ou
empacotamento Windows. Melhorias não essenciais retornam ao backlog para evitar ampliar
novamente o prazo da primeira entrega.

## Fora desta primeira versão

Os itens abaixo ficam preservados para incrementos posteriores e não bloqueiam o
preview Windows:

- transcrição durante a gravação;
- provider/engine Whisper concreto no sidecar;
- recuperação de transcrição após crash;
- Copilot, resumo, pesquisa e extração de tarefas;
- Linux/RegataOS;
- AV1 e otimizações avançadas de compressão;
- GIF e compartilhamento;
- redução ou cancelamento de ruído do microfone;
- downloads automáticos de modelos.

## Definição de pronto

O preview Windows pode ser considerado pronto quando:

- o fluxo tela/janela/região até arquivo salvo e exportação passar no Windows real;
- áudio do sistema e microfone forem comprovados de forma audível e sincronizada;
- os cenários essenciais de pausa, erro e encerramento não corromperem a gravação;
- uma execução prolongada não apresentar crescimento ilimitado de memória;
- a regressão automatizada relevante estiver aprovada;
- o pacote reproduzível do fork passar pelo mesmo fluxo;
- limitações restantes estiverem documentadas de forma explícita.

## Próximo passo

Executar a homologação funcional real na ordem da checklist acima, registrar cada
resultado em [STATUS.md](STATUS.md) e corrigir apenas os bloqueadores confirmados.

## Instruções de retomada para outra IA

Antes de alterar qualquer arquivo:

1. confirmar que o checkout está na branch `feat/windows-region-foundation`;
2. executar `git status --short --branch` e não sobrescrever mudanças existentes;
3. ler integralmente `AGENTS.md`, [STATUS.md](STATUS.md), [ROADMAP.md](ROADMAP.md),
   [SIMPLE-RECORDING-UX.md](SIMPLE-RECORDING-UX.md),
   [WINDOWS11-BASELINE.md](WINDOWS11-BASELINE.md) e
   [WINDOWS11-REGION-DEVICES.md](WINDOWS11-REGION-DEVICES.md);
4. tratar Git, `STATUS.md` e evidências registradas como estado real; planejamento
   ou código isolado não equivalem a aceite concluído;
5. manter o corte somente Windows e não iniciar ASR ao vivo, Copilot, Linux, AV1,
   GIF, Compartilhar ou redução de ruído antes de fechar este preview;
6. começar pela homologação real das etapas 01/02, na ordem da checklist deste
   documento;
7. quando um teste falhar, diagnosticar e corrigir somente um defeito confirmado que
   bloqueie o preview; não ampliar arquitetura por hipótese;
8. validar cada alteração com testes focados, os dois typechecks e lint aplicáveis;
   executar a suíte completa uma vez no fechamento do incremento quando necessário;
9. registrar em `STATUS.md` o que passou, falhou ou foi ignorado, sem transformar
   cenário não executado em aprovação;
10. fazer commit e push apenas na branch de trabalho depois da validação, nunca em
    `main`, e não publicar release ou instalador sem autorização específica.

### Primeiro incremento recomendado

Consolidar a execução do fluxo real no pacote Windows vigente: tela, janela e região;
áudio do sistema e microfone; pausa/retomada/parada; resultado salvo; editor e
exportação. Registrar as evidências e abrir correções somente para bloqueadores
reproduzidos nessa execução.

### Documentos de apoio

- `technical-documentation/testing/manual-e2e-checklist.md`: checklist de QA real.
- `project/TESTING.md`: estratégia e evidências de testes do fork.
- `project/ARCHITECTURE.md`: limites arquiteturais do projeto.
- `project/CONTRACTS.md`: contratos que não devem ser quebrados silenciosamente.
- `project/UPSTREAMS.md`: preservação de origens, licenças e histórico do vendor.

