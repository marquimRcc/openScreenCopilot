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
Arquivos são preparados com nome temporário exclusivo e substituídos por rename com
backup/rollback do destino anterior. A fase curta de publicação não aceita cancelamento,
para não prometer cancelamento depois de um derivado já ter sido publicado.

## Limites e segurança

- fonte de vídeo: no máximo 8 GiB neste fluxo;
- PCM extraído: teto global de quatro horas, 16 kHz mono (`230.400.000` amostras);
- extração: timeout herdado de 60 s e `SIGKILL` em timeout, cancelamento ou excesso;
- uma transcrição completa por vez no singleton existente;
- cópia/GIF e transcrição do resultado têm admissão mutuamente exclusiva;
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

## Ainda pendente antes de declarar a branch concluída

- validar o fluxo completo em uma gravação sintética encerrada no aplicativo;
- confirmar o helper e suas DLLs no pacote produzido a partir desta branch;
- testar cancelamento real durante um chunk Whisper longo (cancelamento após extração
  e antes do chunk já foi validado);
- validar falhas reais de helper/modelo/caminho no runtime empacotado;
- executar suíte completa relevante e registrar o resultado final;
- confirmar salvamento TXT/JSON e retry pela interface em build desta branch.

Transcrição ao vivo, parciais, journal/recovery, diarização, resumo e tarefas continuam
fora deste corte.
