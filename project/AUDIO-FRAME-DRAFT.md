# Descritor binário experimental — v0, não transporte ativo

Preparação04 isolada. Layout candidato de fixture, NÃO protocolo v1 congelado,
capability de captura, endpoint IPC ou permissão para conectar PCM. Nenhum byte
deste formato é emitido pelo WGC/app atual. Integração depende dos aceites01–03,
relógio e lifecycle/ownership/journal/créditos necessários.

Código original std Rust em
[audio_frame_v0.rs](../crates/speech-core/src/audio_frame_v0.rs) e TS main-only em
[audioFrameV0.ts](../electron/copilot/audioFrameV0.ts), sem imports de runtime.
[27fixtures comuns](../contracts/copilot/audio-frame.v0.fixture.json) contêm apenas
metadados e poucos scalars sintéticos, nenhuma gravação privada.

## Cabeçalho fixo80bytes, little-endian

| Offset | Bytes | Campo/regra experimental |
|---|---|---|
|0|4|Magic ASCII OSCP|
|4|1|Versão0|
|5|1|Tipo1PCM, não controle|
|6|2|HeaderBytes80|
|8|4|PayloadBytes u32|
|12|4|SampleRate u32, guarda aritmética1–192000, não suporte hardware|
|16|2|ChannelCount1–32|
|18|1|SampleFormat1=f32le|
|19|1|SourceKind1system/2microphone, não ID MMDevice/caminho|
|20|4|Flags: somente bit0discontinuity|
|24|16|SessionNonce não nulo, opaco, não autentica sender|
|40|8|SourceEpoch u64|
|48|8|Sequence u64|
|56|8|SourceSampleStart u64, frames/canal, não floats|
|64|4|FrameCount u32 positivo|
|68|4|Reservado zero|
|72|8|CaptureMonotonicNs u64 bruto, não PTS/chegada ASR|

PayloadBytes=FrameCount*ChannelCount*4<=4MiB, inclusive tamanho derivado se o
declarado for pequeno. SampleStart+FrameCount não pode ultrapassaru64. Guardas
do protótipo, não créditos negociados/duração/memória de inferência. Float finito
fora[-1,1] aceito sem clipping; NaN/Infinity em qualquer canal recusados. Sem DSP.

Host futuro lê cabeçalho fixo e valida ANTES de reservar payload. validate_frame
reparseia cabeçalho original e confere tamanho real/scalars; não aceita objeto
Header/TS do renderer como autorização. Já recebe slice existente: NÃO comprova
que transporte externo manteve buffering limitado. Sem reader incremental, pipe,
timeout, cancelamento ou loop de leitura implementado.

## Inteiros e isolamento

TS DataView/BigInt devolve u64 em strings decimais, sem Number intermediário.
Rust usa u64/soma verificada. Snapshot TS congelado, nonce vira hex16bytes sem
reter view mutável. Validação PCM zero-copy não impede outro dono de memória
compartilhada de alterar bytes depois; ownership/cópia/journal ainda necessários.

Parser stateless não verifica replay, ordem de sequence/época, sessão alheia,
gap, relógio ou sender malicioso. Nonce/magic/schema não substituem ACL/handshake/
dono main-owned/endpoint. SourceKind precisa ser ligado à fonte efetiva pelo host,
nunca nome renderer. Sem MAC ou defesa contra processo de mesmo privilégio.

Epoch u64 deste candidato difere de epoch safeNumber da aritmética TS v0 anterior.
Não converter silenciosamente valores grandes; adaptador/protocolo ainda deve
reconciliar ou recusar. CaptureMonotonicNs não corrige drift/pausas; ver
[SPEECH-TIMELINE-DRAFT.md](SPEECH-TIMELINE-DRAFT.md). Saída16k não é contador da
captura44.1/48k; accepted não é checkpoint durável.

## Evidência e limites

27fixtures exercitam metadados iguais, >2^53/extremosu64, schema/formato/tamanho/
reservados/overflow e payloadcurto/extra/nãofinite nos dois lados. Testes adicionais:
todas truncagens, cap exato4MiB, byteOffset/snapshot TS, finite foraunitrange.
Não comprovam interoperabilidade de processos/reconexão/ACL/backpressure/ASR.
Sem PCM no renderer, nova porta, sidecar ativo, captura duplicada ou import runtime.
