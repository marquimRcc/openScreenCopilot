# Descritor binário experimental — v0, não transporte ativo

Preparação04 isolada. Layout candidato de fixture, NÃO protocolo v1 congelado,
capability de captura, endpoint IPC ou permissão para conectar PCM. Nenhum byte
deste formato é emitido pelo WGC/app atual. Integração depende dos aceites01/02/04 (03 adiada ao backlog),
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
Adaptador isolado audioTimelineAdapterV0 agora recusa epoch>MAX_SAFE_INTEGER
ANTES de converter paraNumber; mantém sampleStart/end u64 emstrings,semrounding.
Reparsa header bruto80,retorna snapshotfrozen de nonce/source/rate/range. Header
apenas,não payload/auth/sequence/replay;host ainda confere identidade/taxa do mapa,
flags de descontinuidade no headeroriginal e política de reset. Não cria PTS nem
usa captureMonotonicNs como origem;PCM16k não vira contador48k por esse adaptador.
Cinco testes cobrem fronteiras/byteOffset/snapshot/mapa fornecido e recusas.
Não é migração do contrato:epochs maiores continuam válidos no descritor/Rust,
mas incompatíveis com esse destinoTSv0. Nenhum import runtime.
CaptureMonotonicNs não corrige drift/pausas; ver
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
nem autoriza PCMlive antes dos aceites01/02/04.

## Orçamento opcional Rust de buffers (não créditos da conta)

[transport_budget.rs](../crates/speech-core/src/transport_budget.rs) limita reservas
compartilhadas por sessão:bytes,frames de trabalho e número de leases; fontes sistema
e microfone têm limites agregados entre épocas. Hardcaps protótipo64MiB/4096leases,
configuração host-owned, não negociação v1 nem duração equivalente entre taxas.
Nonce só isola escopo, não autentica. Operações concorrentes são atômicas; overflow,
poison/invariante falham fechados. Close impede novas reservas mas aguarda ownership
externo: não fabrica crédito nem revoga buffers vivos.

Decoder Rust opcional reserva80+payload ANTES de alocar. Falta temporária mantém
só header80 e pausa consumo de payload; retry explícito pode usar a future opcional
de mudança abaixo, sem polling/fila ilimitada. Custo impossível falha terminal.
Lease não clonável acompanha pending→ready→consumidor; bytes são liberados ANTES da
reserva. Stop descarta apenas ownership próprio, não frame entregue/inferência.
Oito testes do pool e seis de integração cobrem também EOF aguardando, sessão
alheia, PCM inválido, drop pending/ready e10mil operações contra modelo independente.
OwnedFrame Rust mantém metadados privados e retorna snapshot por valor: consumidor
não pode alterar o header validado nem custo da reserva. Nenhuma conexão TS/pipe/runtime.

Isso NÃO limita RSS, chunks externos, scratch/metadata, decoders low-level, cópias
normalizadas ou engine. Host ainda precisa limitar/admitir esses recursos, coordenar
notificação sem corrida, cancelamento/drain e journal/ACK durável. Sem áudio live.

## Próxima ligação host — requisitos, NÃO implementação

O pool isolado agora admite AudioTimeLimits opcionais, por sessão/fonte emns.
try_reserve_frame reparsa header bruto e deriva ceil(frameCount*1e9/rate) antesalloc;
pool temporizado recusa Cost genérico sem metadados de taxa. Somas u64 verificadas,
produto u128; canais não multiplicam duração. Host ainda escolhe limites/política.
Frames a44.1k/48k/16k não têm a mesma duração; não renomear `frames` para segundos.
Ceil por pacote é conservador, NÃO clockmap: partições podem esgotar limite antes
de pacote único, sem subcontagem. Quatro testespool+umdecoder adicionais passaram.
Isso não atende sozinho toda fila/host/cópias/engine ou comprova30min de captura.
Não somar captureMonotonicNs como PTS nem identificar sessão apenas pelo nonce wire.

| Transição futura | Invariante necessária |
|---|---|
|Abrir sessão|Host autentica endpoint/owner e negocia formato; limita decoders e chunks antes de ler; pool único da sessão, não um por request|
|Header aguardando|Reader para consumo; retém sufixo externo limitado; registra notificação e revalida capacidade sem janela de lost-wakeup|
|Frame entregue|Ownership da reserva acompanha consumidor; accepted significa só admissão, jamais journal/checkpoint durável|
|Normalizar/copiar|Reservar capacidade de saída/scratch ANTES de copiar; não liberar entrada antecipadamente nem segurar todas entradas enquanto espera saída impossível|
|Gap/nova época|Não inventar zeros; registrar lacuna e resetar contexto/relógio conforme contrato; leases antigas continuam contadas|
|Cancel/drain|Fechar admissão, parar reader, solicitar cancelamento e aguardar worker/consumidores e seus buffers; não dropar future como prova de shutdown|
|Erro/timeout|Propagar erro sanitizado; conservar ownership até fechamento real; não zerar contadores/recriar pool para admitir mais dados vivos|
|Reconectar|Somente depois de política de journal/checkpoint definida; IDs/replay/watermarks validados, sem retomar de accepted em memória|

Nenhum sidecar, checkpoint ou reconexão foi criado por esta tabela.
`retry_budget` NÃO agenda wakeup. Future opcional Rust de mudança está abaixo;
host/TS ainda precisa supervisão, consumidor lento, cópia bloqueada e
disconnect/reconnect com resultado tardio.
Teste de10mil operações do pool é contagem sintética, não comprova memória estável
de captura+ASR real30min. Não implementar ligação PCM antes de01/02/04 aceitos.

## Notificação limitada de mudança Rust (isolada)

[budget_change.rs](../crates/speech-core/src/budget_change.rs):observe_change ANTES
da tentativa de reserva, wait_for_change após Capacity, aguardar e tentar novamente.
Revisionprivada/registro sob mesma trava impede lost-wakeup se liberar antes de
registrar/pollar. Dois slots fixos,um porfonte;duplicata WaiterBusy,semFIFO/fairness.
Ready só indica mudança,não concede buffer nem garante capacidade. Token ligado
ao pool exato mesmo com nonceigual. Counteroverflow falha fechado,semwrap.

Release/close notificam foraMutex,sem bloquearthread àespera;cancelar porDrop remove
somente registro próprio. Não cancela worker/ownedframe. Close idempotente não
revoga reservas vivas. Wakers do executor confiável clonados/descartados fora da
trava;panic de wake contido no Drop da lease. Mutexpoison/worker/executor travado
ainda exigem supervisão/deadline externa; não prometer drain só porFutureDrop.
Oito testes de notificação+um integração decoder:before-register/poll,100corridas
threads,replace/cancel/close/overflow/callback reentrante,sem sleep/pollingentrada.
Semexecutor/host/TS/pipe/PCMlive,semteste30min e semliberar aceites01/02/04.

Admissão provider independente em provider_admission.rs agora limita jobs geridos
e mantém cobrança apósDropfutureiniciada/panic incerto. Cancel tardio aguarda
provider retornar antes liberar. Close não édrain;counterjobs não é threadcount.
Nove testes comfakeprovider,semengine/STTreal conectado. O host ainda precisa
supervisionar worker/processo/timeout e compartilharumgate porengine;criaroutra
instância não autoriza bypass nem prova queworkerantigo encerrou.

Fronteira mono_frame.rs isolada agora exige OwnedFrame com lease do pool EXATO,
nãobasta nonceigual. Reserva saída mono antesdownmixf32le,semcópia interleaved extra;
mantém input+output contados simultaneamente. OwnedMonoFrame conserva source/
epoch/sequence/rate/sampleStart/end/count,altera apenaslayout/payloadBytes.
Samples são liberados antesda lease;erro/Capacity libera sósaída,inputintacto.
Cinco testesownership/refusal/alloc/scope,semPCMlive/resampler/modelo/runtime.
Duplicação temporária de duração é guarda conservadora,nãotempo extra de mídia.
Host ainda precisa política antideadlock quando copy não cabe junto doinput;
Capacity retorna imediato,não criar outro pool para contornar o global.

Factory opcionalRustwith_managed_budget agora limita1decoder porfonte no poolEXATO
(2slotsfixos,agregamépocas/clones). Slot existe atéDrop mesmoStop/EOF/erro, liberado
após buffers próprios;frames handedoff conservam leases. Lowlevelnew/with_budget
nãoadmitidos continuam disponíveis:host deve escolherconsistentemente factorygerida,
nãomisturar/criarpoolsbypass. Isso não limita control-line decoders/chunks/sessões/RSS
nem abre pipe/autentica nonce/implementa workerdrain.7testes+integrações sintéticas.

OwnedInputChunk opcional agora reserva bytes+1lease noMESMOpool antescópia,
maxcaller1..65.536bytes. Raw input nãoéframevalidado:ZEROamostras/duração,
contabilizado porbytes/leases;validação/admissão de áudio continuam separadas.
5testes+1integração cobremcaps/alloc/alias/close e raw+frame bloqueando copyMono.
Não abre reader nem limita fila/sliceoriginal por mágica;host ainda precisa
storageleitura/sufixos/chunks/control/sessões/deadlines/headroompara todascópias.
Semauth/RSS/PCMlive,semusar reservasraw para inventarcréditos de áudio.

## Ciclo de vida da sessão e drain isolado (SessionLifecycle)

[session_lifecycle.rs](../crates/speech-core/src/session_lifecycle.rs) implementa
a máquina de estados finita em Rust std puro (`Opening` → `Active` → `Draining` → `Closed`)
derivada da tabela de transições acima (commit `2e13475c`).
`discontinuity` é evento atômico (`record_discontinuity`), avançando `epoch` de forma
checked (+1) e redefinindo `sequence`, permanecendo em `Active`.
Guarda fail-closed observacional contra fechamento do pool por clone externo antes de
`activate`, `advance_sequence` e `record_discontinuity` (recusa com `Closed` sem mutar
estado ou contadores; checagem é amostrada via snapshot e não introduz trava nem alega
atomicidade cross-mutex; `begin_drain` permanece o único caminho local coordenado).
O accessor `pool()` público sem uso foi removido para evitar bypass do ciclo de vida.
`TransportBudget` atua como fonte única de verdade de admissão e drain: `begin_drain`
fecha a admissão no pool exato, e `poll_drain` transita para `Closed` somente após
a observação explícita de zero `leases` e zero `managed_decoders` no snapshot.
Não alega drain de threads, workers ou processos do SO.
Sem host/TS/IPC/PCM live/provider/engine. 155 testes unitários (14 de `session_lifecycle`) +
8 pipeline + 8 resample aprovados, `cargo fmt --check` e `cargo clippy --all-targets -- -D warnings`.

Conclusão arquitetural de revisão: não criar camadas intermediárias (`session_ingress`
ou `session_decoder`) que duplicariam `AudioDecoderV0` (dono único da continuidade de
amostras, sequência e verificação de cabeçalhos por fonte), `ExpectedStream` e
`TransportBudget`. `lifecycle.sequence` atua como âncora de sessão e não governa
`first_sequence` de `System` e `Microphone`, que progridem de forma independente.
Próximos passos reais de integração dependem de orquestração no host (etapa 05) e
permanecem condicionados aos aceites de 01/02; este módulo permanece como checkpoint
isolado da etapa 04.
