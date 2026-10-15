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
que transporte externo manteve buffering limitado. O decoder isolado abaixo não
cria pipe, timeout de processo ou loop de transporte ativo.

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

## Decoder incremental isolado (subsequente, ainda sem transporte)

[audio_decoder_v0.rs](../crates/speech-core/src/audio_decoder_v0.rs) e
[audioDecoderV0.ts](../electron/copilot/audioDecoderV0.ts) aceitam fragmentos sem
concatenar chunk arbitrário. Feed consome no máximo um pedaço de header/payload e
devolve bytes consumidos; caller retém sufixo e deve limitar sua própria fila.
Esperado por instância:nonce/source/epoch/rate/channels/sequence/start/maxpayload,
snapshot literal main/host-owned futuro, nunca objeto do renderer. Igualdade desses
campos é binding local, não handshake/ACL/autenticação de sender.

Só depois de validar header, expectativa, ordem e orçamento aloca buffer único
de frame completo. Header scratch80 + frame80+payload <=cap+160bytes de buffers
OWNED. Não inclui metadata/allocator/GC/chunks recebidos/frames já entregues ao
caller, portanto não é teto deRSS ou de memória do pipeline inteiro.
Um frame pronto bloqueia feed até take. Handoff move ownership, NÃO confirma
persistência/ACKdurável nem limita quantos frames o consumidor retém.

Sequência/start precisam ser contíguos e são atualizados só após payload válido.
Não há wrap de sequenceu64MAX. Mudança de fonte/época/formato exige instância nova
e lifecycle do host; decoder não negocia reconexão/replay/checkpoint. Flags ainda
exigem política de reset do normalizador/VAD pelo host, não há clockmap aqui.

Erro/schema/binding/ordem/budget/PCM nãofinite/alocação recusada é terminal;
sem scan para ressincronizar magic. EOF parcial falha sempadding; EOF com frame
pronto preserva take. Stop idempotente descarta só buffers próprios; não retrai
frames já entregues nem cancela inferência/writer/filho real. Rust try_reserve_exact
trata recusa reportável; não promete sobreviver aOOMkill/crash doSO.

Testes de partições1..frame+1, todasposiçõesEOF, framescoalescidos, busy/ordem,
snapshots/aliases, cap exato4MiB, stop/erro/sequenceexhaustion e recusa de alocação
injetada semOOM. Nada disso prova processo/pipe/timeout/ACL/créditos globais/journal,
nem autoriza PCMlive antes dos aceites01–03/04.

## Orçamento opcional Rust de buffers (não créditos da conta)

[transport_budget.rs](../crates/speech-core/src/transport_budget.rs) limita reservas
compartilhadas por sessão:bytes,frames de trabalho e número de leases; fontes sistema
e microfone têm limites agregados entre épocas. Hardcaps protótipo64MiB/4096leases,
configuração host-owned, não negociação v1 nem duração equivalente entre taxas.
Nonce só isola escopo, não autentica. Operações concorrentes são atômicas; overflow,
poison/invariante falham fechados. Close impede novas reservas mas aguarda ownership
externo: não fabrica crédito nem revoga buffers vivos.

Decoder Rust opcional reserva80+payload ANTES de alocar. Falta temporária mantém
só header80 e pausa consumo de payload; retry explícito depende de futura notificação
do host, sem polling/fila de waiters implementados. Custo impossível falha terminal.
Lease não clonável acompanha pending→ready→consumidor; bytes são liberados ANTES da
reserva. Stop descarta apenas ownership próprio, não frame entregue/inferência.
Oito testes do pool e seis de integração cobrem também EOF aguardando, sessão
alheia, PCM inválido, drop pending/ready e10mil operações contra modelo independente.
OwnedFrame Rust mantém metadados privados e retorna snapshot por valor: consumidor
não pode alterar o header validado nem custo da reserva. Nenhuma conexão TS/pipe/runtime.

Isso NÃO limita RSS, chunks externos, scratch/metadata, número de decoders, cópias
normalizadas ou engine. Host ainda precisa limitar/admitir esses recursos, coordenar
notificação sem corrida, cancelamento/drain e journal/ACK durável. Sem áudio live.
