# Estado atual — openScreenCopilot

Checkpoint operacional em2026-10-16. Git e este arquivo são autoritativos.
O registro anterior foi preservado INTEGRALMENTE em
[STATUS-HISTORY-2026-10-15.md](STATUS-HISTORY-2026-10-15.md), mesmo blob Git
d692b88dffc902c2314e3941c6a6e7b153f2ad86 do STATUS em7ee332dd.
Pausas, próximos passos e estados do arquivo histórico não são instruções atuais.
Consultar histórico só para evidências antigas, não reler como checkpoint de retomada.

## Continuidade e prioridades humanas

- Trabalho contínuo, sem prazo final; usuário revogou meio-dia e autorizou continuar
  até pedir pausa/encerramento. Status/perguntas não revogam autorização.
- Watchdog1min só recupera chat ocioso/interrompido; não parar entre incrementos
  para esperar wake nem trabalhar apenas por fatias de1/5/15min.
- Conferir hora/limites reais antes da rodada e entre incrementos. Parar aos89%
  usados5h OU95%semanal ou hardlimit; preservar checkpoint e retomar só após reset
  aplicável+5min E confirmação real de saldo. Respeitar ambos se atingidos.
- Não comprar/consumir créditos/resets, trocar modelo/conta ou contornar limites.
  Dois créditos de reset continuavam disponíveis na última consulta, não usados.
- Se resetsAt passado mas quota alta, não inventar renovação/reset futuro:
  verificações temporárias5min só durante pausa, sem loops. Scheduler BYHOUR é UTC;
  wake pode antecipar, garantir tentativa posterior à guarda, nunca DAILY isolado.
- Renovação REAL14:49:47UTC15/10 confirmou5h2%/semanal16%, allowedtrue, superando
  notas históricas90–100%/timestamp antigo. Watchdog1min ACTIVE restaurado/conferido.
  RETOMADA REAL19:51:14UTC15/10:5h1%/semanal31%,allowedtrue,primaryreset1792111875.
  Pausa89 anterior e guarda18:34:42UTC JÁ CUMPRIDAS; saldo só renovou depois,
  não usar timestamp passado como prova. Watchdog1min restaurado;nenhumresetconsumido.
  Consultar novamente antes de iniciar trabalho, não usar esse snapshot como saldo vivo.
- Renovação REAL00:56:51UTC16/10 confirmou1%5h/46%semanal,allowedtrue;
  guarda00:56:15 cumprida e watchdog1min restaurado, sem consumir reset.
  Consulta01:04:22UTC:11%5h/47%semanal. Snapshots não são saldo vivo.
- Estimativa do GIF e Compartilhar SOMENTE após TODO restante roadmap.
  Base existente preservada, integração incompleta não ativada.
- Qualidade antes de tamanho, sem teto rígido300MB/30min.
  Redução de ruído mic é backlog futuro separado do sistema, padrão indefinido.
- Ao pedido humano de parar:checkpoint/pausar automação. Escopo concluído:
  desativar/informar. Silêncio em wake sem mudança; avisar entrega/falha/bloqueio real.

## Checkout e entregas

Repo C:\Users\marcos.gomes\Documents\Codex\2026-10-13\new-chat\work\openScreenCopilot,
branch feat/windows-region-foundation.
Este chat01a13ac2-d4ba-7362-8640-b031f0b49e41 é o único escritor autorizado ativo.
Chat original01a13651-66a1-76a1-8ee0-d74f053a7833 estava notLoaded na última consulta;
confirmar novamente antes da rodada, nunca escrever em paralelo.

Checkpoint funcional atual:OwnedInputChunk/orçamento misto sobre propriedades
windowac546706/códigosdiagnóstico60060ecd/factorydecoders160a3107/Debugtimelinee1a57d0c,
errosproviderdb273eba/UTF8exhaustivo81f72884/sondaMF50d4bf06,
downmixf32le/OwnedMonoFrame isolados sobre admissãoRust406af964,
adaptadorTSd7054621,
epoch/header→range sobre
notificação limitada Rust4f19a3f8/duração84a3dd79,
hardening1e991554 do orçamento3737afc1/decoder79f2d8c8;
5ede5b01 documenta requisitos host futuros, sem runtime novo.
Antes:3210ef93 (phase/DC),33094a84 (CI core),5b0dd5ef (janelas),
5448f744 (provider interface),da483512 (falha/voz),348a0d4f (spike resampler).
Git atual prevalece; reorganização documental posterior não muda runtime.
Não repetir incrementos concluídos; conferir alterações em andamento no Git.

Não publicar instaladores/releases, instalar, relançar perfil humano, pushmain,
abrir PR prematuro ou enviar mídia privada. Commit/push só validado branch própria.
PR2 de01 continua dependente dos aceites; não promover distribuição por testes parciais.

## Etapas do roadmap

| Etapa | Estado real |
|---|---|
|00 fundação|Concluída:fork/históricos/licenças/vendor/contratos/política CI|
|01 Windows/identidade|Código/pacote isolados, timestamps corrigidos; GUI completa/carga longa pendentes|
|02 região/dispositivos/resultado|Implementados; homologação física/audível/fluxo completo pendente|
|03 compressão|Inventário/sondas MF apenas; AV1 não grava, comparação30min não feita|
|04 speech-core|Preparação isolada com testes abaixo; sem VAD/engine/provider concreto/sidecar ativo|
|05 ASRlive|Não integrado; depende02/03/04/relógio/journal/créditos|
|06 recuperação|Não implementada; depende05|
|07 pacote Windows homologado|Pendente; nenhum release aprovado|
|08 Copilot|Pendente/opcional, APIs remotas exigem consentimento|
|09 Linux/RegataOS|Pendente de máquina real/contratos estabilizados, não homologado|

Detalhes e dependências em [ROADMAP.md](ROADMAP.md).
Não anunciar etapas concluídas por planejamento, build Linux ou fixture curta.

## Runtime preservado — último37d4a1c8

- Windows Record do editor abre picker dedicado existente main-owned, sem inline
  limitado aScreens/Windows, fallbackfullscreen ou autostart. ForaWindows preservado.
- Região React/arraste/Escape, cropD3D11 GPU, cursor físico recortado; requests
  inválidos recusados. Borda pontilhada helper-owned protegida, independenteHUD,
  removida stop/cancel/reset/exit. DPI misto/borda física ainda sem aceite.
- SistemaON só perfilnovo/chaveausente, false salvo preservado; mic/câmera opcionais.
- Seletor saída Windows HUD/RecStage porID MMDevice, persistência independente mic,
  desconectado visível/preservado, resetdefault explícito e reenumeração sem polling.
  Main valida própria escolha/capability antes da tomada; semfallbackChromium para
  ID explícito+sistemaON. Default é fixado por tomada.
- Medidor sistema nativo/main/IPC/preload/hook/UI completo:teste explícito30s,
  UUIDmain,picos limitados/coalescidos,semPCM/MediaStream/AudioContext/autorestart.
  Pico antesvolume; softwareexclusive podezero, atividade não prova áudio gravado.
  Capture/quit/prefchange/owner drenam helper e aguardam close antes de capturar.
- Resultado simples ORIGINAL/local/nome/tamanho/duração/Abrirpasta/Novacaptura
  semautostart/Editarsecundário. Prévia não compõe webcam/cursor editável/zoom;
  legenda15idiomas esclarece. CLI/MCP mantêm editor.
- Cópia segura streaming MP4/WebM sem recompressão/upload, fonte/dialog/main-owned,
  hash/stat/identidade e publicação exclusiva fs.link, nunca sobrescreve original
  ou destino existente/alias/hardlink. Cancel/drain esperamwriter antescleanup.
- GIF backend/main/preload/controller/decoder/compositor existente preservados,
  formulário isolado sem botão ativo. Preflight60s,15/20/25/30FPS,480/720,
  maxedge1280,semupscale/paridade,1bilhão pixelFrames =trabalho,NÃO bytes/RAM.
  Decode completo e publicação antes sucesso, jamais porcentagem100% como prova.
- Quit usa ciclo existente before/will-quit; derivações/medidor drenados, veto de
  edição não salva preserva gerente STT legado. Sem segundo listener/forcedquit.

Limites:filesystem semhardlink falha; FAT/exFAT/rede não homologados. Crash/kill/
app.exit podem deixar órfãos; nunca limpar porprefixo semprova de propriedade.
Exportador legado não protegido globalmente; não é defesa mesmo-privilégio.
Compartilhar exige destino explícito/consentimento, cópia local não é link público.

## Pacote e validações do aplicativo

.cache/result-package/win-unpacked atualizado37d4a1c8, NÃO instalado/relançado
no perfil humano.23payloads/entrymain.js/main-C-zXdXuj/preload.mjs e27rendererassets/
index SHA iguais ao dist/origem na conferência. WGC atual:
aaa797a9c1adeceed256f8bce9c8c0c511bc92d55e330250a14d49d6f3c6a1d5.
Checker privado.cache/check-meter-ui-package.cjs respeita pathsWindowsasar;
extraResources não são arquivos internos do asar.

Última validação TS completa:368arquivos/5216pass/5skip/422,33s,
Node22.22.1/2workers,exit0/sem signal,fim2026-10-15T20:13:18Z.
Recibo/log.cache/audio-timeline-full.{json,log}.71focadosTS adapter/parser/mapa passaram.
Anterior79f2d8c8:367arquivos/5211pass/5skip/461,94s,audio-decoder-full aprovado.
Conferência auxiliar posterior de check-docs.test.mjs/speech-core-ci.test.mjs foi
iniciada em88% com `node --test`, runner INCORRETO para testes Vitest, terminou
exit1 após a consulta89. Não é regressão de produto/suíte completa invalidada.
Corrigida após renovação real:Vitest correto/Node22.22.1/2workers,2arquivos/9pass,
exit0,3,40s em19:52UTC. Mensagens de links inválidos são probes esperados dos testes.
check-docs.mjs standalone passou55files antes da pausa; testes Rust67+8 aprovados.
Ambos tsc,lint0erros/26avisos herdados,i18n15/1000chaves,docs55/diffcheck OK.
Anterior7ee332dd:366arquivos/5201pass/5skip/382,70s,audio-frame-full.
Anterior33094a84:365arquivos/5170pass/5skip/383,64s,recibo speech-core-ci-full.
Não repetir full sem mudança/necessidade; novas bibliotecas isoladas não mudam
bundle/runtime. Não rebuildar compositor/WGC/pacote por Rust não ligado ao app.

## Preparação04 isolada — estado atual do core

Crate crates/speech-core, workspace/Cargo.lock próprios, Rust/cargo1.98.1 instalados.
Biblioteca normal std-only; serde_json1.0.150 e rubato0.15.0 apenas testes.
Rubato semdefaultfeatures/FFT/log; lock adicionou num-integer0.1.47,num-traits0.2.19,
autocfg1.5.1 do cacheoffline. num-traits build.rs só probe de compilador.
MIT/proveniência downmix/provider meeting-copilot e avisos testdeps preservados.
Vendor/Cargo.lock compositor imutáveis, nenhum modelo/download/vendorbuild novo.

Implementado/testado, sem imports runtime:

- Mapa amostras/mídia u64/u128, epochs/overflow/ambiguidade e8fixtures comunsTS/Rust.
  Registro limitado por sessão/fonte/order/replay/capacidade, não auth/journal.
  Consulta agora filtra spans emprestados sem lista temporária; contagem de fontes
  usa scratchfixo64. Cópias de sessão/metadados e reservaVec são falháveis:
  RegistryError::Allocation preserva mapas/capacidade lógica, semevicção.
  4testes novos cobrem cada recusa/retry e limite64 inclusivo. Não é tetoRSS,
  garantia contra OOM do processo nem autorização/runtime.
  Regressão adicional preenche4096mapas/64fontes/64épocas intercaladas a16/44.1/48k,
  confere âncoras/replay/4097recusado com cópias negadas. Sintético metadata,
  não teste de gravação longa/RSS/clockhardware.
- Downmix AverageAll/FirstStereoPair explícitos,1–32canais,frames completos,
  finiteantesalloc/f64sum e1.048.576scalarscap. Semclip/gain/noise/resample.
  Entrada f32le desalinhada compartilha implementação,não cria cópia interleaved;
  alocação mono falhável.5testes adicionais/13downmixpass.
  OwnedMonoFrame exige inputleased ao MESMO pool,outputreservadoantesalloc,
  inputretido,metadataorigempreservada,rate original/sem16k automático.
  5testesownership/capacidade/duração/erro/poolforeign(c/nonceigual)pass.
  Contabiliza input+output simultâneos,inclusive duração conservadora duplicada;
  Capacity imediato,não esperarpara sempre porcopyimpossível. Semnormalizerruntime.
- Provider INTERFACE adaptada MIT/futuresstd/PCMemprestado/cancelperjobmonotônico;
  wrapper aguarda provider e descarta cancelado. Dropfuture/crash não comprova drain.
  Sem engine real/segundomodelo/executor; texto/confidence só aceitação limitada.
- Planejador original de janelas16k guiado por fronteiras fornecidas, não VAD.
  maxwindow<=providerbudget,overlap<=25%,novel separado,2eventosfixos/advance,
  gap/epoch/discard semcolarcontexto. Não cancela jobs emitidos nem deduplica texto.
- Descritor binário v0 candidato80bytes/Rust+TSmain-only/27fixtures,4MiB/f32le/
  scalarcaps/counteroverflow/finite. U64TS→strings, snapshotfrozen/byteOffset.
  Decoderincremental isolado agora existe abaixo; sempipe/IPC/ACL/replayglobal/
  backpressurepipeline/journal. Nonce nãoauth.
  Epochu64 difere do safeNumber no mapaTSv0:adaptador isolado agora recusa>MAX_SAFE
  ANTESNumber,semrounding;samplecountersstrings preservados.5testes/71focadospass.
  Headerapenas;host ainda confere sessão/source/rate/flags no original,semruntime.
  [AUDIO-FRAME-DRAFT.md](AUDIO-FRAME-DRAFT.md) não congela v1.
- Decoderincremental Rust/TS isolado:1frame/instância,expectativas nonce/source/
  epoch/rate/channels/sequence/start antes de alocar payload, atécap+160bytes de
  buffers próprios,ready bloqueia entrada atéhandoff. EOF parcial/erro terminal,
  stop idempotente,sequence semwrap,alocaçãofalhável,semresync/padding. Handoff não
  édurableACK nem limita fila externa/frames retidos;semprocesso/pipe/ACL/journal.
  9testesRust/10TS do decoder,41focadosTS comheader passaram;full5211pass aprovado.

- Pool transporteRust opcional por sessão/fonte,bytes/frames/leases,hardcaps64MiB/
  4096leases,contagem atômica eepochs agregadas. Reservaantesalloc elease não
  clonável até consumidor liberar frame;capacidade temporária espera sóheader,
  retry explícito sempolling,oversize terminal. Close não revoga owners;stop não
  recupera frame entregue.8testespool+6integração,10mil operações modelo independente;
  EOFaguardando/PCM inválido/drop e snapshot imutável de metadadosOwnedFrame.
  Não é crédito da conta/RSS/auth;
  sempoolTS/pipe/notificaçãohost/workerdrain/journal/PCMlive.

Orçamento opcional AudioTimeLimits por sessão/fonte acrescentado isoladamente:
try_reserve_frame revalida header bruto e deriva bytes/frames/duração ceil(ns).
Recusa genericCost em pool temporizado;sumas/caps/epochs/RAII seguem atômicos.
Por pacote ceil é conservador e pode admitir menos que pacote coalescido;NÃO PTS/
clockmap/tempo de parede.12testespool+7integração,semTS/pipe/runtime/ASRlive.

Notificação opcional BudgetChange/Revision Rust:2slots fixos/1porfonte,observeANTES
da reserva para impedir lostwake,Future semexecutor/pipe/inputpolling,Ready não
reserva. Release/close wake foraMutex,Drop sóregistropróprio,overflowfailclosed.
8testesnotificação+1integração decoder/100corridas;poison/executor travado ainda
exigem supervisão externa. Semhost/TS/liveASR.

ProviderAdmission Rust opcional limita1–16jobsgeridos,semfila/executor/engine.
Admiteantesprovider,aguarda cancel tardio/erro antesdevolvervaga;close sóadmissão.
Dropfutureiniciada/panic deixa incerto e conserva cobrança;outrosjobs completados
não apagam abandonado.9testesfakeprovider/concurrency/cap/close/cancel/erro/panic/
poison. Não é workerdrain/timeout/recovery/lockSTTglobal;host devecompartilharumgate
porengine real e manterfuture atéfim,semcriaroutrogateparacontornarincerto.

ControlLineDecoder Rust isolado:UTF8incremental/1linha pronta/capconfigaté1MiB,
LF/CRLF(CRcontano limite),semfila/concatenaçãounbounded;erros/EOFparcialterminal,
Stringreusa buffer,Debugsemtexto.10testesfragmentosUnicode/cap/stop/overflow,
65.280payloadscurtos e todosescalarsUnicode/splits determinísticos;
NÃO JSON/schema/handshake/IPC/pipeaberto,host ainda limita chunks/instâncias/retidos.

DebugRust de header/expected/decoder/frames/mono/request/result/error/pool agora
omite PCM/texto/languagehint/errostr/nonce/contadoresdeorigem;poolusa try_lock.
3testes adicionais,acessoexplícitopreservado. Não é loggingglobal:Display de erro
provider ecampos/getters ainda contêmdados,hostprecisasanitizar;semimportruntime.

Fronteira checkedprovider recusa detalhes EngineFailed/UnsupportedLanguage acima
4.096bytesUTF8 comoInvalidResult apóscompletion,semtruncar/ecoar recusado.
Errosaceitoscontinuamdados explícitos,nãosanitização/tetoallocengine.2testes
limitesmultibyte/latecancel/aguardacompletion,semruntime/providerconcreto.

DebugSourceSpan/Range/TimelineRegistry também omiteIDssessão/fonte/contadores/âncora;
1testeguarda marcadores privados e mapeamento explícito inalterado.

FactoryRustwith_managed_budget opcional:2slotsfixos no poolEXATO,1porfonte entre
épocas/clones. Stop/EOF/erro conserva slot atéDrop;handoff mantém leasebuffer.
7testeslimits/close/drop/concorrência16/notificação/poison/invariante/overflow;
integraçãocomponentes usa factory. Lowlevelnew/with_budget continuamnãogeridos,
host futuro não deve misturar/criarpoolbypass. Semlimitechunks/control/session/RSS/auth.

diagnostic_code() de erroprovider/managed retorna categoria localestática,
semstr/caminho/contadores/idioma;2testestodasvariantes/delegação. Não éwirev1,
UItraduzida/telemetria/consentimento nem sanitizaDisplay/camposexplícitos.

Propriedadeswindowplanner max1..64/todossobreposições/fragmentos/gaps/finish/
discard/4épocas confirmamnovel+descartadoexato,semcontaroverlap/preencherlacuna.
Debugwindow/discard/planner omiteépoca/ranges/contextoanterior;2testesnovos,
semVAD/textdedup/resampler/clockreal.

OwnedInputChunk opcional copia sóapósreserva bytes+lease noMESMOpool/fonte,
maxcaller1..65.536bytes;allocfalhável/capacidadeguardada/dropbytesanteslease.
Inputnãoparseado contabilizaZEROamostras/duração,semfabricartempo;framevalidado
reserva separadamente.5testes+1integração raw96+frame96 bloqueiammonoatérawDrop.
Slice/filaoriginal nãoécontada por mágica;semreader/IPC/auth/tetoRSS/sessões/control.

Modelo misto10miloperações raw+áudio16k/44.1k/48k/caps/drop/close recalculacustos
retidos emcadaetapa;raw nunca criaamostras/tempo. Não é30minreal/RSS.

BudgetSnapshot lêusage/duração/decoders/closed sobUMAtrava,semcombinarobservações
rasgadas;2testesclose/owners/concorraw-áudio,poison/brokenrecusam. Snapshot pode
ficarvelho imediatamente,nãoéreserva/ACKdurável/auth/cleanup/workerdrain.

2integrações adicionais:EOFparcial libera sóframepending,mono/providerativo
continua cobrado atécompletion/cancel;janela16ksintética mapeia rangeoriginal
viaregistryâncora5s,nunca arrivalprovider. Semclockreal/resampler/ASR/checkpoint.

1integração com2providersfalsos/mesmogate:segundo recusadoatéprimeirocancelado
completar. Gatesindependentesbypassariam;NÃO coordenaSTTherdado real.

Rust139unitários+8integraçõescomponentes+8spikes aprovados debug/release offline/locked,clippyalltargets
-Dwarnings/fmt. Clippy exigiu as_chunks::<4> no parser; corrigido/revalidado.
Avisos de hardlink no cache incremental levaram a cópia, não falha dos testes.
core_pipeline.rs junta decoderbytespartidos/mono/pool/request/admissão/provider
fake lento:cap184bytes,copyseguinte recusada atéliberação,notificaçãocapacidade,
cancelawait/close,48kmono recusado como16k.7testesfuncionais+1diagnóstico,semengine/processo/pipe/captura/
journal/timestampsreais. Clippy drop_non_drop corrigido,sem alterarproduto.

Spikes SOMENTE testes:mono44.1/48k→16k,partições/tails/limites/cancel/erro real após
2blocos/flush/impulsos/tons. EOFfloorcount é política experimental, não streammap.
Outputdelay46/42framesSAÍDA não é prefixo removível; trimming adiantou impulso.
DCripple7,451/1,550ppm e rampa indicam offsets~1,76/~2,01framesENTRADA, não PTS exato.
Entradas/saídas completas limitadas ainda ficam em memória, não streaming constante.

QA privada da fala sintética SAPI Daniel já existente:44.1/48k produziram204608
samples16k/12,788s; gerente WhisperCPU HERDADO único,requests sequenciais/cache,
redeexternabloqueada/shutdownawait/exit0; ambas24palavras/0edições/WER0.
.cache/resample-voice-qa-9a62ff42-db23-4103-8802-fa476b3f5e70/metrics.json.
Não é providerRust conectado, fala natural/timestamps/ASRlive/30min/diarização.

CI speech-core separado configurado33094a84:Rust1.98.1,lockfetch antesoffline
debug/release/clippy/fmt,contentsread/timeout15min/targettemp,semSDK/model/artifact.
Guardas locais aprovadas; execução CI remota desse job ainda não observada.
Consulta read-only GitHub do commit5ede5b01 em17:06UTC retornou0runs dePR.
Esse endpoint filtraPR/primeirapágina, portanto não prova ausência de todosruns.
ci.yml só dispara push para main, feat/ai-edition, release/** e PRs para esses destinos;
push da branch de trabalho não dispara CI por si. Não abrir PR/alterar triggers/
dispatch de distribuição só para obter CI; ghCLI ausente, nenhum instalado.
Não alegar homologação Linux/RegataOS por teste localWindows.

Relógio Windows atual usa steady_clock/pausas/mixerframes e descarta timestamps
WASAPI/QPC; integração exige device→sessão/source/epoch/amostras/mapas validados.
Não usar arrivalASR comoPTS, índiceFrame/FPS ou contador16k como48/44.1k.
VAD/providerconcreto/normalizadorruntime/hostsidecar/journal/créditos ainda pendentes.

## GUI — bloqueio operacional, não repetir a cada wake

Autorização humana Sim para cobertura opaca temporária de TODOS monitores permanece.
Não é aceite. Pergunta assíncrona PCsemuso5min segue pendente; outra apphumana
apareceu acima da cobertura, fatia parou antesinput/captura. Não relançar GUI sem
disponibilidade/condição segura, nem repetir pergunta a cada wake.

GUI só skillcomputer-use/refs/@oai/sky,seleçãoúnica/observaçãofresca/umaação/reobserve;
semDOMinjection/cliquescegos/forçarChrome/alterarWindows/contornar hit-test/rejeição/
desktopbloqueado. Respeitar Escape físico. InterativoNormal/helpersHidden.
ContentprotectionOFF sóQAisolada, nunca gravação real. Remover covers próprias ao fim.
Últimasfixtures24420/13404 identificadas/ociosas encerradas e ausentes; PIDsantigos
não reutilizar. Appantigo21240 de.cache/indicator-package foi deixado intacto:
verificar identidade/caminho/args/estado atuais antes de qualquer limpeza.

Parcial real:CtrlN→Record→Source→Region→monitor→Draw→drag158,120a798,520DIP mostrou
960×600px150%; Escape fechouoverlay, semfonte/autostart/MP4. Depois imagem picker
divergiu deUIA (editor/cover); ativaçãofresh única não resolveu. Causa não diagnosticada;
não alterar zorder/transparência por suposição. Medidor componente/Stop passou parcial.
Captura→resultado,confirmarárea,bordafísica,DPImisto,endpointaudível,disconnect/retorno/
formatos/TeamsSlackYouTube/carga30min continuam SEM aceite.

Provas curtas nativas usaram sóHWND opaco próprio/endpoint explícito,mic/cursor/camOFF.
Baseline/pausa/rápidas passaram decode; PTSreais deram áudio−vídeo39/6/6/6ms,
40/6/5/6ms e52/20/-38/-38ms. Nominais10ms não garantidospelostimers. Não homologam
GUI,precisãoASR,30min,mic ou todos dispositivos. Loopback é toda saída,não porprocesso.
Sondas MFAV1 enumeraram/ativaram2componentes,S_OK, mas ZEROamostras/tipos/streaming/
encode; não comprovam NV12/FPS/MP4/editor/licença/eficiência. App segueH264.
Consulta GET-only20:46:58–59UTC de tipos parou antes GetAvailableType: ambos
GetStreamIDs=MF_E_TRANSFORM_ASYNC_LOCKED(0xC00D6D77), SDK confirmado. Shutdown2S_OK,
code3/signalnull/guarda10s não disparou. Não é AV1 indisponível nem falha de produto;
nenhum unlock/SetType/frame/captura. Detalhes em WINDOWS-COMPRESSION-SPIKE.
Sonda SEPARADA21:06UTC habilitou só2MFTs próprios viaASYNC_UNLOCK,S_OK. IDsE_NOTIMPL
→0documentado;1saídaparcialAV1porobjeto,semFRAME_SIZE/RATE;entradaTYPE_NOT_SET.
Shutdown2S_OK/exit0/signalnull/guardaoff;ZEROSetType/frames/streaming/D3D/captura.
Não prova NV12/FPS/encode nem mudaH264produção;detalhes/refs no spike.

## Próximo trabalho seguro

Revisãoestática STTherdado emSPEECH-CORE-INVENTORY:singleton/cache/processo/fila
Promise/cancelentrechunks/timeoutHTTP/exitnãoequivalem gateRustglobal/drain.
Nenhumhelper/modelo/rede iniciado. Adapterconcreto exige coordenaçãoexclusive,
admissãobounded e exitobservado;prioridade/preempção humana ainda pendente.

1. Trabalho independente04:lifecycle/supervisão/replay e ligação host/TS futura
   do orçamento Rust; reader/ownership/cópiaMono/factorydecoders isolados já feitos.
   OwnedInputChunk limita cópiaopcional,mas filaoriginal/instânciascontrol/sessões
   e integraçãohost ainda pendentes;
   notificaçãoRust isolada feita,host não conectado.
   Não prometer tetoRSS,drain de worker ou recuperação por FutureDrop.
   Requisitos de transições/gaps/normalização/drain/reconexão estão no final de
   AUDIO-FRAME-DRAFT; tabela não é implementação nem teste de memória30min.
   Não criar pipe/API/PCMlive nem confundir binding/accepted com auth/durabilidade.
2. Quando tela disponível, retomar GUI01/02 com fixture/perfil próprios/cobertura
   autorizada, respeitando rejeições; completar confirmação/tomada/resultado/áudio.
3. Qualidade03 no caminho encoder existente e testes sintéticos/30min/licenças
   depois das dependências; não criar segundo encoder/fallback renderer.
4. Core/sidecar/ASR/journal/recuperação e etapas seguintes conformeROADMAP.
   Coordenar engine/cache com STT herdado, não duplicar captura/inferência.
5. EstimativaGIF/Compartilhar somente ao final de TODO restante.

## Execução e registro

Use apply_patch,Node22.22.1/npm10.9.4 via cacheoffline; preservar vendor/licenças/
históricos/mídia/alterações humanas. Focados durante edição; ambos tsc/lint/i18n/docs,
fulluma vezfim2workers/recibo quando TS muda. Sem nativeQA/build concorrentes ao full.
Rustisolado tem seus testes debug/release/clippy/fmt próprios. Nativebuild só quando
fonte produção nativa mudar; pacotecompleto23payloads/codehash quando app mudar.
.cache mídias/logs privados/ignorados nunca subir. Nunca interromper gravação/
transcrição/edição não salva do usuário. Nova permissão/decisão necessária:relatar/parar.
Registrar commits/resultados/limites/skips; não prometer desempenho por estimativa.
