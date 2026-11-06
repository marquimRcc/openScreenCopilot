# Transcrição local pós-gravação

Estado em 2026-11-06: primeiro corte vertical implementado e validado na branch
`feat/post-recording-transcription`; provider real, pacote Windows local e E2E pós-gravação
aprovados no escopo descrito abaixo. Ainda não é release, instalador assinado nem
transcrição durante a gravação.

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

Essa primeira evidência qualificou o provider concreto e a amostra conhecida. O helper
veio de um release upstream; staging, empacotamento e E2E da branch foram validados
separadamente na etapa seguinte.

## Validação do pacote local da branch

Em 2026-11-06, a branch foi reconstruída no Windows com o toolchain fixado pelo
repositório (Node 22.22.1/npm 10.9.4). O build nativo WGC passou seus 177 testes de
áudio, 33 testes do encoder e as suítes auxiliares de região, webcam, visibilidade,
relógio e ciclo de fonte; o compositor Rust e o instalador NSIS também foram gerados.

O pacote final local `0.1.0-alpha.1`, reconstruído depois das correções de publicação
atômica e encerramento, ficou identificado como `openScreenCopilot`, sem assinatura
Authenticode e sem publicação:

- instalador: 179.794.754 bytes, SHA-256
  `323FD9BB9F3E4DC45C0797E76524849639AF95CAD40449B4B94B8EF874E8F5DB`;
- `app.asar`: 20.185.363 bytes, SHA-256
  `8E945F43C3D20965708492F89EBD4AAA839D6191DEDADE5B8B1CA96AB5E5F03A`;
- executável unpacked: 223.298.048 bytes, SHA-256
  `AE292B17807F1743845214E22A0267DA434FD61013065570816AE98F420DDDC3`;
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
staging, DLLs e execução real do provider no pacote.

## E2E pós-gravação no pacote Windows

Em perfil isolado, o pacote `win-unpacked` gravou a tela inteira por 20 s com áudio do
sistema, microfone e câmera desligados. O resultado foi salvo normalmente. Para manter
o ensaio determinístico e sem captar voz ou áudio privado, o MP4 silencioso original foi
preservado como `recording-1793986070634.silent-original.mp4` (2.737.839 bytes,
SHA-256 `6CE8F3A1…C979`) e uma cópia da gravação recebeu a amostra pt-BR sintética conhecida.
O MP4 autorizado resultante tem 1.147.410 bytes, SHA-256 `DEA3A1A9…2236`, H.264
1920×1200 e AAC mono 16 kHz. A decodificação completa terminou com exit 0; o muxer
avisou um DTS não monotônico herdado do timing da fonte, portanto esta rodada não afirma
container temporalmente limpo.

Pela interface real pós-gravação:

- um `stt-models` inválido produziu `Transcription failed` sem expor caminho privado;
- um helper deliberadamente inválido produziu falha, e `Retry` iniciou nova tentativa;
- com modelos e helper restaurados, `Retry` concluiu como `Transcript ready` e mostrou
  exatamente “Olá, esta é uma gravação de teste em português brasileiro para validar a
  transcrição local.”;
- TXT e JSON foram relidos do disco; o JSON tem schema
  `openscreencopilot.post-recording-transcript`, versão 1, idioma `pt`, backend
  `whispercpp-vulkan` e um segmento; não restaram `.tmp` ou `.bak`;
- o log registrou 7,4 s de áudio em 1,9 s (RTF 0,26; 3,8× tempo real) e redigiu os
  caminhos conhecidos como `[private-path]`;
- app, helper e captura foram encerrados, com zero processo residual.

Depois do rebuild final, um smoke adicional repetiu o caminho no pacote identificado
pelos hashes desta seção. A automação remota não conseguiu atingir o botão Stop porque
o HUD ficou input-transparent; o helper WGC exato foi então encerrado para exercer a
recuperação suportada. O resultado salvou 2:18/22,6 MB, o original silencioso foi
preservado (SHA-256 `4EB5C3E5…24AC7`) e a cópia autorizada recebeu a mesma amostra
sintética (SHA-256 `A7933D4B…74F24`). A UI do pacote final mostrou `Transcript ready`
com o texto exato; TXT (`81E40047…A7B1`) e JSON (`E6B042FE…BAB1`) repetiram schema,
idioma, backend e ausência de temporários/backups. O encerramento final deixou zero
processo próprio. Esse smoke confirma a transcrição no pacote final, mas não conta como
novo aceite do Stop normal do HUD.

O seletor visual permaneceu em “Loading screens and windows...” apesar de o main ter
retornado sete fontes em 5,973 s e o Chromium ter registrado timeout do primeiro frame
WGC. O ensaio prosseguiu com a fonte `screen:0:0` descoberta pelo CLI empacotado e salva
no perfil isolado. Isso é uma limitação observada do picker e impede chamar esta rodada
de homologação global da captura; não invalida o fluxo pós-gravação exercitado.

O teste opt-in real também processou a mídia sintética de 125 s e cancelou depois que a
inferência Whisper começou: três casos passaram em 39,8 s, com o cancelamento longo em
22,679 s e preservação dos derivados anteriores. A suíte final no Node 22.22.1/npm
10.9.4 terminou com 5.402 testes aprovados, 13 ignorados e zero falhas; os dois
typechecks, i18n, docs, lint (26 avisos herdados), Biome dos arquivos alterados e
`git diff --check` passaram.

Os gates desta branch para transcrição pós-gravação estão satisfeitos. A limitação do
picker acima e a checklist global de captura permanecem trabalhos separados; não são
reclassificados como aprovados por esta validação direcionada.

Transcrição ao vivo, parciais, journal/recovery, diarização, resumo e tarefas continuam
fora deste corte.
