# Transcrição local pós-gravação

Estado em 2026-10-31: primeiro corte vertical implementado na branch
`feat/post-recording-transcription`; validação automatizada e provider real aprovados.
Ainda não é release, instalador homologado nem transcrição durante a gravação.

## Corte implementado

O resultado simples pós-gravação agora oferece uma etapa independente de transcrição:

1. o vídeo já salvo permanece como fonte e não é regravado ou substituído;
2. o Electron main confirma que o pedido veio do frame principal da janela de resultado;
3. o caminho precisa ser exatamente a gravação corrente já autorizada pelo host;
4. a extração existente usa `ffmpeg` local para mono 16 kHz;
5. o `SttManager`/`WhisperServerManager` herdado executa Whisper local com idioma `pt`;
6. a UI mostra preparação do modelo, progresso de transcrição, conclusão,
   cancelamento ou falha;
7. resultados concluídos são publicados ao lado do vídeo como
   `<nome>.transcript.txt` e `<nome>.transcript.json`.

Não foi criado outro engine, cache de modelo ou sidecar ASR. O `speech-sidecar` v0
continua somente como handshake/probe sem provider, conforme seu README. O fluxo novo
reutiliza o engine Whisper já integrado ao aplicativo e sua supervisão de processo.

## Contrato JSON v1

```json
{
  "schema": "openscreencopilot.post-recording-transcript",
  "version": 1,
  "language": "pt",
  "backend": "whispercpp-cpu",
  "segments": [
    { "text": "Olá.", "startSec": 0.2, "endSec": 0.8 }
  ]
}
```

Somente segmentos finais são publicados. Falha ou cancelamento não anuncia conclusão.
TXT e JSON são preparados juntos com nomes temporários exclusivos e substituídos por
rename com backup/rollback do par anterior; uma falha na segunda publicação restaura
ou remove os dois lados. A fase curta de publicação não aceita cancelamento, para não
prometer cancelamento depois de um derivado já ter sido publicado.

## Limites e segurança

- fonte de vídeo: no máximo 8 GiB neste fluxo;
- PCM extraído: teto global de quatro horas, 16 kHz mono (`230.400.000` amostras);
- extração: timeout herdado de 60 s e `SIGKILL` em timeout, cancelamento ou excesso;
- uma transcrição completa por vez no singleton existente;
- cópia/GIF e transcrição do resultado têm admissão mutuamente exclusiva;
- troca de tela e início de nova captura são recusados enquanto a transcrição está ativa;
- encerramento congela nova admissão, solicita cancelamento e aguarda inferência,
  publicação e limpeza terminarem antes de prosseguir;
- helper iniciado sem shell pelo caminho já validado pelo runtime herdado;
- eventos e erros enviados à UI não incluem texto transcrito, PCM, caminho privado ou
  mensagem crua do helper;
- cancelamento nunca remove o vídeo nem os derivados concluídos anteriormente.

O normalizador continua whole-buffer; o teto é uma fronteira explícita, não uma
alegação de baixo RSS. Em quatro horas, o PCM f32 sozinho pode chegar a cerca de
879 MiB e a consolidação final mantém buffers simultâneos. Reduzir esse pico exige
extração/ingestão incremental futura e não foi escondido como concluído.

## Evidência do provider real

Validação isolada em Windows, sem microfone, captura ou mídia privada:

- áudio: SAPI `Microsoft Daniel`, frase conhecida pt-BR, WAV PCM16 mono 16 kHz,
  7,37 s;
- helper: `whisper-stt-server.exe` x64 do release oficial OpenScreen v2.1.2,
  extraído sem executar o instalador;
- instalador de origem: SHA-256
  `55A7ADCD8517159198E2F7A2E31CD69B91C3CE4FB14CF3F56E9809681CCBDFCB`;
- modelos: cache local existente `ggml-small-q8_0` e Silero v6.2.0;
- backend forçado: CPU;
- resultado: 1 segmento, 15 palavras, idioma detectado `pt`, WER `0,0000`;
- guardrail DTW, intervalos de fala, limites e monotonicidade: aprovados;
- tempo: 2,95 s para 7,37 s de áudio, RTF `0,400`;
- alinhador CTC: ignorado porque não há alinhador pt no catálogo atual.

Um teste de integração opt-in adicional executou o corte exato
`serviço main-owned -> extração ffmpeg -> SttManager -> helper Vulkan -> TXT/JSON`:
texto esperado e schema v1 foram conferidos, ambos os arquivos foram relidos do disco
e o processo foi encerrado. Uma segunda execução cancelou depois da extração real e
antes da inferência, retornou `cancelled` e preservou byte a byte os derivados já
concluídos. O host também passou a redigir os caminhos conhecidos do helper/modelos
antes de encaminhar ou reter stderr; o mesmo teste real mostrou `[private-path]` nos
lugares antes ocupados pelos caminhos locais.

Essa evidência qualifica o provider concreto e a amostra conhecida. O helper veio de
um release upstream, não de um pacote desta branch; portanto não comprova staging,
empacotamento ou E2E da interface desta branch.

## Validação do pacote local da branch

Em 2026-11-06, a branch foi reconstruída no Windows com o toolchain fixado pelo
repositório (Node 22.22.1/npm 10.9.4). O build nativo WGC passou seus 177 testes de
áudio, 33 testes do encoder e as suítes auxiliares de região, webcam, visibilidade,
relógio e ciclo de fonte; o compositor Rust e o instalador NSIS também foram gerados.

O pacote local `0.1.0-alpha.1` ficou identificado como `openScreenCopilot`, sem
assinatura Authenticode e sem publicação:

- instalador: 179.022.050 bytes, SHA-256
  `BD1324626023AFA127698E7B27F46C4B63AC284B72201A7DEEE77C651CA55DEB`;
- `app.asar`: 15.898.619 bytes, SHA-256
  `0023953E627E622B2998C437514FD8E13649002CE4B5ADA5F49D30FF13333551`;
- 24 recursos nativos destinados ao pacote conferidos bidirecionalmente e byte a
  byte contra o staging, sem ausentes ou extras;
- helper Whisper empacotado: SHA-256
  `9A5A0740BEAB8E70C5F792251300B28737D019742122248A117175401295AE36`,
  idêntico ao extraído do instalador oficial OpenScreen v2.1.2 já registrado acima;
- bundles main/preload/renderer dentro do `app.asar` contêm os três canais IPC, o
  schema JSON v1 e o componente da interface pós-gravação;
- teste de integridade 7-Zip do NSIS concluiu `Everything is Ok` (o aviso de dados
  após o arquivo 7z é o envelope executável normal do NSIS).

O helper executado diretamente **do diretório `win-unpacked`** processou novamente o
WAV pt-BR de 7,37 s em CPU: 1 segmento/15 palavras, idioma `pt`, guardrail DTW,
intervalos de fala, limites e monotonicidade aprovados; 3,16 s, RTF 0,428. Isso fecha
staging, DLLs e execução real do provider no pacote, mas ainda não substitui o E2E da
interface Electron.

Antes da adição do ensaio opt-in de cancelamento longo, a suíte completa no toolchain
fixado terminou com 5.397 testes aprovados, 12 ignorados e zero falhas; typechecks de
app/testes, i18n e lint também passaram (os mesmos 26 avisos herdados). O novo ensaio
opt-in passa typecheck/Biome e fica ignorado sem a mídia longa explícita; a suíte final
será repetida depois de executá-lo.

## Ainda pendente antes de declarar a branch concluída

- validar o fluxo completo em uma gravação sintética encerrada no aplicativo;
- testar cancelamento real durante um chunk Whisper longo (cancelamento após extração
  e antes do chunk já foi validado); a mídia sintética de 125 s e o teste opt-in estão
  preparados, ainda não executados;
- validar falhas reais de helper/modelo/caminho no runtime empacotado;
- repetir a suíte completa depois do ensaio longo e registrar o resultado final;
- confirmar salvamento TXT/JSON e retry pela interface em build desta branch.

Transcrição ao vivo, parciais, journal/recovery, diarização, resumo e tarefas continuam
fora deste corte.
