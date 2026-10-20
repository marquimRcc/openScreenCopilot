# Estado atual — openScreenCopilot

Checkpoint operacional em 2026-10-19. Git e este arquivo são autoritativos.
O registro anterior foi preservado INTEGRALMENTE em
[STATUS-HISTORY-2026-10-15.md](STATUS-HISTORY-2026-10-15.md), mesmo blob Git
d692b88dffc902c2314e3941c6a6e7b153f2ad86 do STATUS em7ee332dd.
Pausas, próximos passos e estados do arquivo histórico não são instruções atuais.
Consultar histórico só para evidências antigas, não reler como checkpoint de retomada.

## Continuidade e prioridades humanas

- Retomada humana em 2026-10-19 autorizada sob supervisão Codex: conclusão de build
  e empacotamento local do patch pré-spawn já aceito e commitado/enviado em
  74b16c9fb021db9f9cd9327f5187e2137bd905de, sem novo runtime. Antigravity como única
  implementadora/escritora de código, supervisora técnica Codex em verificação independente;
  commit e push somente após aceite formal.
- Pausa histórica em 2026-10-16 (desenvolvimento e automação pausados após envio do patch pendente)
  preservada como registro operacional documental, agora superada pela retomada autorizada
  em 19/10/2026 para build/empacotamento local sob supervisão técnica.
- Alinhamento de diagnóstico: alteração de posição de monitor isolada não prova captura errada,
  pois monitor_utils resolve por bounds e o helper nativo já verifica dimensões; a guarda pré-spawn
  revalida fail-closed e síncrona a coerência de fonte, região e snapshot imediatamente antes de spawn.
- Checkpoint base confirmado: 74b16c9f na branch feat/windows-region-foundation, árvore limpa.
- Ordem humana vigente 16/10 e 19/10: concluir 01/02; depois 04/05 → 06 → 07/08/09 → backlog.
  Compressão/AV1 (03) adiada para o backlog, não bloqueia ASR/Windows; manter H264 e aceites
  reais de captura/áudio/sincronização. Micruído/GIF/Compartilhar no backlog final.
- Trabalho contínuo supervisionado, sem prazo final; continuar até pedido humano ou da supervisora de pausa/encerramento (pedido humano STOP respeitado como pausa imediata).
- Supervisão técnica ACTIVE em 19/10 e 20/10/2026; watchdog atual de 5min e margem pós-reset de reset + 180s (a margem anterior de 5min foi substituída por determinação humana; estado anterior PAUSED em 16/10 preservado como histórico superado). Watchdog só recupera chat ocioso/interrompido; não parar entre incrementos para esperar wake nem trabalhar apenas por fatias de 1/5/15min.
- Conferir hora/limites reais antes da rodada e entre incrementos com saldo REAL medido (snapshots anteriores não são estado vivo). Parar aos 89% usados 5h OU 95% semanal ou hardlimit; preservar checkpoint e retomar só após reset aplicável + 180s E confirmação real de saldo renovado. Respeitar ambos os limites se atingidos.
- Não comprar/consumir créditos/resets, trocar modelo/conta ou contornar limites.
  Dois créditos de reset continuavam disponíveis na última consulta, não usados.
- Se resetsAt passado mas quota alta, não inventar renovação/reset futuro:
  verificações temporárias 5min só durante pausa, sem loops. Scheduler BYHOUR é UTC;
  wake pode antecipar, garantir tentativa posterior à guarda, nunca DAILY isolado.
- Disponibilidade de GUI: autorização humana expressa concedida em 19/10/2026 (SIM do usuário
  para listar títulos de janelas e deixar PC sem uso durante homologação). Supervisora técnica conduziu
  execução real via computer-use/skill sob perfil privado isolado e cobertura opaca controlada.
  Preservar apps/jobs humanos, não interferir nos processos da supervisora (app PID 28284, cover PID 16096).
- Estimativa do GIF e Compartilhar SOMENTE após TODO restante roadmap (backlog final).
  Base existente preservada, integração incompleta não ativada.
- Qualidade antes de tamanho, sem teto rígido 300MB/30min.
  Redução de ruído mic é backlog futuro separado do sistema, padrão indefinido.
- Ao pedido humano/supervisora de parar: checkpoint/pausar automação. Escopo concluído:
  desativar/informar. Silêncio em wake sem mudança; avisar entrega/falha/bloqueio real.

### Histórico operacional (recibos e snapshots numéricos anteriores — não são instruções vigentes)

- Renovação REAL 06:05:53 UTC 16/10: 2% 5h / 61% semanal, allowed true, primary reset 1792148456;
  guarda 06:01:51 cumprida, sem consumir reset. HEAD a03e86bb enviado/árvore limpa; snapshots anteriores não são saldo vivo.
- Renovação REAL 00:56:51 UTC 16/10 confirmou 1% 5h / 46% semanal, allowed true;
  guarda 00:56:15 cumprida e watchdog 1min restaurado, sem consumir reset.
  Consulta 01:04:22 UTC: 11% 5h / 47% semanal. Snapshots não são saldo vivo.
- Renovação REAL 14:49:47 UTC 15/10 confirmou 5h 2% / semanal 16%, allowed true, superando
  notas históricas 90–100% / timestamp antigo. Watchdog 1min ACTIVE restaurado/conferido.
  RETOMADA REAL 19:51:14 UTC 15/10: 5h 1% / semanal 31%, allowed true, primary reset 1792111875.
  Pausa 89 anterior e guarda 18:34:42 UTC JÁ CUMPRIDAS; saldo só renovou depois,
  não usar timestamp passado como prova. Watchdog 1min restaurado; nenhum reset consumido.
  Consultar novamente antes de iniciar trabalho, não usar esse snapshot como saldo vivo.

## Checkout e entregas

Build e empacotamento local em 2026-10-19: patch pré-spawn commitado em 74b16c9fb021db9f9cd9327f5187e2137bd905de
empacotado via Vite + electron-builder --win --dir em `.cache/package-windows-region/win-unpacked`
(offline Node 22.22.1 / npm 10.9.4, sem rebuild nativo, sem sobrescrever pacote anterior .cache/result-package).
Verificação de integridade aprovada (.cache/verify-package-windows-region.cjs): app.asar gerado com SHA256
99dbed44acd5c6466c0eaa4d03161974f25d461c53403a62d929665ff4513329 (79.250.262 bytes); main/preload/assets
idênticos por SHA256, strings da guarda pré-spawn presentes no bundle do app.asar, conjunto de 23 binários
nativos em resources/electron/native/bin/win32-x64 conferido bi-direcionalmente byte a byte (ffmpeg.exe excluído,
zero extras e zero ausentes), e todos os 7 extraResources validados. Recibo e log privados em
`.cache/package-windows-region-receipt.json` e `.cache/package-windows-region.log`.
Pacote win-unpacked puramente local, gerado em `.cache/package-windows-profile-isolation/win-unpacked` (app.asar SHA256 5810df70feb90abf0a2494cfecdfff8c3f7135ff6b4d8152edac0c07db607670, exe 0f3399f13fcb075b447eaa69c681ca52998ea92f1c271c540c4d0887ebc3e35f; anterior 99dbed44 preservado): verificação de integridade aprovada (.cache/verify-package-profile-isolation.cjs) com presença de OPENSCREEN_APP_DATA_DIR e 23 binários nativos idênticos. Executado diretamente via launcher privado `.cache/launch-package-qa.cjs` (PID 35068) em ambiente por processo com raiz UUID isolada (.cache/package-qa-f9b33c62-32c4-4d33-b649-922841ae8a75). Aceite parcial da execução empacotada autônoma (win-unpacked) para captura de região (30s), pausa, resultado, playback, Open folder e New capture; homologação longa 30min no pacote com áudio, microfone e integração ASR permanecem pendentes e NÃO aceitos.
Isolamento de perfil via OPENSCREEN_APP_DATA_DIR: override explícito opcional implementado em electron/app-identity.ts e electron/initialize-identity.ts (validação estrita de raiz absoluta por plataforma, rejeição de caminhos vazios/brancos/relativos/drive-dependentes, criação da raiz e setPath("appData") antes da derivação de userData/sessionData e stores; falha explícita sem fallback ao perfil humano).

Validação de testes: suíte completa executada em 2026-10-19 com 2 workers (.cache/profile-isolation-full.json e
.cache/profile-isolation-full.log) totalizou 5240 testes aprovados (testResults.length=369, numPassedTests=5240,
numPendingTests=5, success=true; vs 5229 histórico de 2026-10-16 em .cache/capture-startup-final.json, refletindo os +11 novos
testes focados do override OPENSCREEN_APP_DATA_DIR em app-identity.test.ts), 5 ignorados e 0 falhas em 369 arquivos de teste;
recibos preservados. Histórico de 16/10 (automação PAUSED) superado pela supervisão técnica ACTIVE em 19/10 e 20/10/2026 sob autorização humana.

Patch de ciclo de vida para término inesperado do helper Windows (2026-10-20):
- Implementação estritamente fail-closed e reentrância-safe em electron/recording/nativeWindowsMidCaptureWatch.ts, electron/ipc/handlers.ts, electron/preload.ts, electron/electron-env.d.ts e src/hooks/useScreenRecorder.ts.
- Handshake tipado e assíncrono (determinístico com identidade): listener onNativeWindowsCaptureEnded registrado antes do start; consulta assíncrona queryNativeWindowsCaptureStatus(expectedRecordingId) pós-confirmação (await) para término ocorrido antes do registro do handle no renderer; Stop canônico compartilhado por tomada com promise vinculada via Promise.resolve().then(performStop).finally(...) antes da invocação do callback (previne reentrância síncrona).
- Validação fail-closed de dono e frame: exige event.senderFrame === webContents.mainFrame não nulo, isDestroyed === false, matching estrito de URL do documento capturado, e getters encapsulados em try/catch contra frames descartados (sem fallbacks a getMainWindow() ou webContents.send indiscriminado).
- Efeitos e limpeza: windowsRegionIndicator.clear() e desativação do estado de gravação executados exclusivamente sob validação de autorização de dono/tomada.
- Testes automatizados utilizam helper fake / EventEmitter (processo simulado em Node), NÃO execução ou terminação do wgc-capture.exe nativo real, nem IPC/main completo por smoke (wiring de handlers validado via revisão estática).
- Limitações e escopo explícitos: (1) O patch testa o término inesperado do processo helper (saída/close), NÃO reproduzindo nem comprovando fechamento de HWND, freeze ou exceção WinRT em runtime real do Windows; (2) Manual GUI SKIPPED; zero nova GUI; (3) O pacote win-unpacked 5810df70 testado anteriormente é anterior e não incorpora este patch de código; (4) Em caso de renderer ausente ou crash, o main process não finaliza nem autosalva autonomamente sem dono (estado permanece retido na tomada para ação canônica); (5) Validação por URL não autentica novo documento em caso de reload para mesma URL (não há defesa universal contra navegação); (6) O parâmetro expectedRecordingId em stopNativeWindowsRecording é opcional para manter compatibilidade com a assinatura legada (rejeição de requisições stale atua apenas em chamadas com ID); (7) Simulação de unmount/discard em testes unitários não é quit real do app; (8) SEM aceite dos estágios 01 ou 02.
- Relato honesto das duas execuções da suíte completa de testes (offline Node 22.22.1 / npm 10.9.4 medidos, 2 workers):
  1. Primeira execução (.cache/windows-mid-capture-full.json / .log / -receipt.json, 10:52:48Z–10:59:23Z, code 1, signal null): 371 arquivos, 5260 aprovados, 5 ignorados, 1 falha em src/hooks/useScreenRecorder.restartFailure.test.tsx:158 (expectativa estrita toHaveBeenCalledWith(true) falhou ao receber (true, 7), refletindo a propagação de recordingId no hook).
  2. Incidente de ensaio temporário no hook (11:02 UTC → revertido 11:05 UTC): após a falha do primeiro full, foi realizado breve ensaio não autorizado tornando expectedRecordingId condicional no hook (SHA 1FB5695B3C67483F3ED0FAB0CEF6230A299A30CA1431948F0AAF23715AAFFA47), logo descartado e revertido para o contrato planejado (sempre com ID). Não houve alegação de produção byte-idêntica durante toda a reparação; o estado final foi integralmente restaurado com SHA atual 01FBDD3D4310EEDB5F1FDD1BBFCE97AA44DF99AEEA85BE3B5666DBF89343E60E antes da execução final.
  3. Reparo autorizado mínimo SOMENTE na expectativa do teste (true, 7) sem alteração de código produtivo.
  4. Reexecução final (.cache/windows-mid-capture-final.json / .log / -receipt.json, 11:07:28Z–11:13:39Z, code 0, signal null, 368.57s): 371 arquivos, 5261 aprovados, 5 ignorados, 0 falhas (sucesso verificado por JSON e receipt). Ambas as evidências mantidas intactas no cache privado.

Repo C:\Users\marcos.gomes\Documents\Codex\2026-10-13\new-chat\work\openScreenCopilot,
branch feat/windows-region-foundation.
Escritor ativo: IA implementadora Antigravity, sob supervisão técnica Codex (chat original
confirmado notLoaded; nenhum trabalho paralelo).

Checkpoint funcional atual: guarda pré-spawn síncrona fail-closed de fonte, região e geometria/DPI em startupWindows (windowsCaptureStartupValidation.ts, 13 testes focados aprovados); OwnedInputChunk/orçamento misto sobre propriedades
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
|01 Windows/identidade|Código/pacote isolados, timestamps corrigidos; GUI curta/longa 30min sintética (dist) e execução empacotada curta (win-unpacked 30s) aprovadas; pacote 30min com áudio/títulos reais/DPI misto pendentes|
|02 região/dispositivos/resultado|Implementados (guarda pré-spawn, região e loopback sintético 30min validados); borda física/mic audível/DPI misto/fluxo completo pendente|
|03 compressão|Inventário/sondas MF apenas; AV1 não grava, comparação30min não feita|
|04 speech-core|Preparação isolada com testes abaixo; sem VAD/engine/provider concreto/sidecar ativo|
|05 ASRlive|Não integrado; depende02/04 (03 adiada ao backlog)/relógio/journal/créditos|
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

Rust140unitários+8integraçõescomponentes+8spikes aprovados debug/release offline/locked,clippyalltargets
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

## GUI e homologação física — parciais reais em 19/10/2026 e 20/10/2026

Autorização humana expressa concedida em 19/10/2026: SIM explícito do usuário para listar
títulos de janelas e deixar PC sem uso durante homologação. Execução real realizada
pela supervisora técnica via computer-use/skill: perfil privado `.cache/full-app-qa-cdb1eca9-7958-47af-823a-535017a731d2`,
app processo 28284 via wrapper `.cache/full-app-qa.mjs`; cobertura própria curta `.cache/opaque-qa-source.cjs`
(PID 16096, 15min timeout) e longa `.cache/opaque-qa-long.cjs` (PID 7348, 60min timeout).
CORREÇÃO OPERACIONAL: A homologação de 19/10 executou o código compilado em `dist/` através de wrapper isolado (`.cache/full-app-qa.mjs`),
NÃO o pacote `win-unpacked`; o pacote em `.cache/package-windows-region/win-unpacked` (SHA256 app.asar `99dbed44…`)
foi apenas verificado por hash/recursos. Os PIDs citados (cover longa 7348, main 28284, WGC 8800) são registros históricos
de processos já encerrados normalmente e ausentes no Get-Process, não processos permanentes em execução.

Regras operacionais de segurança mantidas: GUI só via skill computer-use (refs/@oai/sky), seleção única, observação fresca, uma ação por vez e reobservação obrigatória; sem DOM injection, sem cliques cegos, sem forçar Chrome, sem alterar Windows, sem contornar hit-test, rejeição ou desktop bloqueado. Respeitar Escape físico. Interativo Normal / helpers Hidden. OPENSCREEN_DISABLE_CONTENT_PROTECTION=1 apenas para QA isolada, nunca em gravação real. Remover covers próprias ao fim de qualquer ensaio.

Parcial real aprovado (curta e longa passaram nos escopos testados; pendências globais de 30min e loopback sintético retiradas):
- Passada curta (57s, 19/10/2026, wrapper dist):
  - Fluxo: Ctrl+N → Record → Source → Region → monitor → Draw → arraste (157,120) a (797,520) → UI 958×600 px → Enter.
  - Editor reativado por skill, fonte confirmada em 958×600 px; sistema/mic/cam/cursor Off.
  - Gravação iniciada (Start); pausa com contador em 00:51 imóvel enquanto fixture animada continuou; resume; Stop.
  - Tela de resultado exibiu Original 00:57 / 4.8MB; playback avançou; "Open folder" com arquivo selecionado; "Nova captura" retornou ao HUD sem autostart.
  - Integridade do arquivo: SHA256 original antes/depois idêntico: `2b2c63d1bdfff23a053ab7e57f96af58f18fec2f0e2adbede11bb25b875a8333`.
  - Mídia gerada: MP4 privado `recording-1792436046920.mp4` (4.765.146 bytes, 958×600, H.264 High 60fps, duração 57.58s, 3455 frames decode).
  - Frame extraído t=1s (`.cache/qa-20261019-first-frame.png`): 4 bordas amarelas e texto legível preservados, sem vazamento de área externa.
  - ffmpeg decode nulo: aviso inicial DTS por arredondamento tbn 60; PTS showinfo estritamente crescente; decode completo via `-fps_mode passthrough -enc_time_base 1:60000 -f null NUL` exit 0 sem avisos.
  - Fonte WGC reportou `videoInput cpu-rgb32 / runtime hardware`; zeroCopy GPU não comprovado.
- Passada longa (30m32s, 19/10/2026, wrapper dist):
  - Execução contínua das 19:02:58Z às 19:33:31Z; Stop/Save normal; tela de resultado exibiu 30:32 / 195,1MB; playback avançou de 0:00 a 0:10.
  - MP4 privado `recording-1792436577801.mp4` (195.128.727 bytes, SHA256 `34e984e5293e6e80f49cb1519fbe953e9067556efc026fc8d4c4d0d42ee42308`, duração 1832.41s, 958×600, H.264 High, 109.942 quadros; AAC LC 48000Hz stereo 192kb/s).
  - Decode AV COMPLETO exit 0 sem avisos com `-fps_mode:v passthrough -enc_time_base:v 1:60000 -f null NUL`.
  - Tom sintético local 440Hz ativado por gesto OS na fixture longa `.cache/opaque-qa-long.cjs`; endpoint explícito Alto-falantes (Senary Audio), medidor 5%; start enquanto medidor ativo drenou helper anterior (só 1 WGC captura ativo).
  - Astats de áudio: início RMS -28.535807 / peak -25.394006 dB; últimos 10s RMS -28.530503 / peak -25.414331 dB, zero-cross 0.018334 (não prova audibilidade física nem sincronização com fala humana).
  - Frame extraído t=1825s (`.cache/qa-20261019-long-end.png`): quatro bordas amarelas, texto legível e relógio em 1963s preservados, sem vazamento de área externa ou exibição de HUD.
  - Memória: 18 amostras agregadas de 10 processos entre 19:07:47Z e 19:31:47Z com PrivateMemorySize64 (private committed bytes, não working set) entre 2016 e 2030 MiB sem crescimento sustentado (não prova limite absoluto de RSS; inclui processo whisper herdado com 1158 MiB sem ASR executado).
  - Escala: 1 único monitor a 150%, não DPI misto.
- Passada em runtime empacotado autônomo win-unpacked (30s, 20/10/2026, EXE real):
  - Execução conduzida pela supervisora Codex via skill (minuto aproximado 05:09 UTC; medições de mídia por Codex, registradas por Antigravity), executando diretamente o EXE real do pacote (`.cache/package-windows-profile-isolation/win-unpacked/openScreenCopilot.exe`, app.asar `5810df70…`, exe `0f3399f1…`, WGC `aaa797a9…a1d5`) via launcher privado `.cache/launch-package-qa.cjs` (launcher executado em Node 22.22.1 / npm 10.9.4 offline; app executou runtime Electron empacotado, NÃO wrapper dist), removendo `ELECTRON_RUN_AS_NODE`.
  - Processo próprio PID 35068 (histórico encerrado) iniciado às 05:02:25.043Z; raiz isolada `.cache/package-qa-f9b33c62-32c4-4d33-b649-922841ae8a75`; logs stdout/stderr e receipt homônimos em `.cache`. Logs confirmam `RECORDINGS_DIR` e `userData` nessa raiz (não prova ausência global de IO de pre-bootstrap ou do SO).
  - Fixture curta própria `.cache/opaque-qa-source.cjs` (cover PID 28132, iniciada às 05:01:27.813Z), `coverage.json` em `.cache/opaque-source-qa-6224ed65-d8e2-4641-9ee7-3c7dff4d0499`; monitor único 1280×800 DIP / 1920×1200 px (150%). Cobertura observada antes da captura; não garantia 100% contra janelas de terceiros no topo.
  - GUI: Ctrl+N → Record → Source → Region → monitor → Draw → arraste (157,120) a (797,520) → 958×600 px → Enter → reativar preparo → Start. Sistema/mic/cam/cursor editável OFF; sem voz, sem ASR, sem modelos.
  - WGC helper PID 25820, start 1792472721982 (05:05:21.982Z), `cpu-rgb32 / runtime hardware (fragmented MP4)`, não GPU zero-copy.
  - Pausa no HUD em 00:12 permaneceu fixa em 00:12 enquanto fixture progrediu de 246.67s a 261.09s; clique Resume com HUD em 00:12, contador avançou até 00:26 → Stop.
  - Resultado: Original 00:30 / 2,4 MB; playback avançou de 0:00 a 0:10 e 0:18; "Open folder" selecionou MP4 correto em nova janela Explorer (Window.id opaco 264106 retornado pelo sky, NÃO HWND); apenas essa janela foi fechada, preservando janela de usuário existente (Window.id opaco 8784030 retornado pelo sky).
  - "Nova captura": HUD retornou ao estado ocioso ("Start recording"), 0 helpers ativos.
  - Mídia gerada: `recording-1792472720844.mp4` (2.352.276 bytes, ffprobe H.264 High 958×600, r_frame_rate 60000/1001, 1798 frames, duração 30.018317s, SEM stream de áudio). Decode COMPLETO exit 0 sem avisos (`-fps_mode:v passthrough -enc_time_base:v 1:60000 -f null NUL`).
  - SHA256 antes e depois de playback, Open folder e New capture idêntico: `1e3a9b14cff40168e6873da6fee013d0c7219e07f8fc1f8345ee9c6b187c9525`.
  - Frames t=1s e t=29s inspecionados visualmente na raiz QA: 4 bordas amarelas, texto legível e movimento confirmados; sem área externa ou HUD em ambas as amostras (não prova cada frame individual).
  - Limitações e incidentes: stderr contém aviso de erro do Chromium WGC thumbnail timeout (5000ms GetFrame às 05:04:05 UTC) ANTES da tomada (não declarar QA globalmente sem avisos). Clique no Quit do HUD recusado 2 vezes por hit-test apontando para `electronChromeLegacyWindow`; 1 reativação/reobservação/retry feita sem forçar clique. Alt+F4 normal fechou o app; cover fechada com Alt+F4; conferência às 05:09 UTC confirmou 0 processos `openScreenCopilot`, `wgc-capture`, `whisper` ou `electron`. PIDs são históricos e não devem ser reutilizados. Nenhum processo ou cover deixado.
  - Aceite PARCIAL de execução empacotada autônoma (win-unpacked) no escopo coberto (captura de região curta, pausa, resultado, playback, open folder, new capture). Recibo privado em `.cache/qa-20261020-standalone-receipt.json`.
- Ensaio de seleção de janela e fechamento de fonte no pacote win-unpacked (20/10/2026, SKIPPED / sem aceite):
  - Tentativa adicional conduzida pela supervisora Codex via skill às ~05:13 UTC com raiz isolada `.cache/package-qa-34e17800-3e1a-480f-bff7-c555b02bb4fc` (launcher app PID 14592, histórico encerrado).
  - Coberturas: cover base PID 13368 (`opaque-qa-long.cjs`, tom não ativado) e alvo PID 7112 (`opaque-qa-source.cjs`), logs `.cache/window-close-{base,target}-59f0df09-65f0-454b-bf4b-aabd45286864.*`.
  - Na aba Windows, acessibilidade utilizada sem capturar screenshots de miniaturas pessoais. Navegação por teclado selecionou `openScreenCopilot` em vez do alvo; nome conferido no preparo e gravação NÃO iniciada.
  - Reabertura do seletor e tentativa no botão exato `OPAQUE SYNTHETIC QA COVER`: erro `point (172,715) outside window bounds 680x580`; navegação e rolagem por teclado não alcançaram o alvo.
  - Seguindo política de segurança: clique não forçado, sem contorno de hit-test ou limites de janela; defeito de captura não declarado. Caso de teste de fechamento de janela segue SEM aceite.
  - Botão Cancel funcionou normalmente; Alt+F4 encerrou o app e ambas as fixtures.
  - Conferência posterior: 0 processos `openScreenCopilot`, `wgc-capture`, `whisper` ou `electron`, e ZERO arquivos gerados em `recordings` nessa raiz. Todos os PIDs são históricos e não devem ser reutilizados. Não houve segunda gravação, áudio, ASR, alteração produtiva ou upload. Recibo privado em `.cache/qa-20261020-window-close-skipped-receipt.json`.
- Permanece SEM aceite (pendências ativas):
  - Comprovação física da borda vermelha protegida no desktop real.
  - Microfone real / fala audível / sincronização labial.
  - Escala de DPI misto / múltiplos monitores.
  - Janelas / aplicações reais de terceiros ou títulos pessoais do usuário.
  - Execução longa (30min) com áudio/mic no runtime empacotado autônomo (win-unpacked standalone teve apenas passada curta 30s sem áudio aprovada).
  - Ensaio de fechamento de janela/fonte durante a captura (caso segue sem aceite após interrupção no seletor).
  - Etapas 01 e 02 completas e integração ASR (05).

Alinhamento da auditoria de speech-core: "nenhum defeito confirmado" na auditoria estática dos módulos isolados não prova ausência absoluta de defeitos nem garante limites RSS de processo; git status limpo não prova que `target/` foi mantido limpo ou ignorado.

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

A pergunta sobre convivência STTmanual/Copilot NÃO bloqueia revisão/testes isolados
e contratos independentes; não ficar ocioso em wakes por essa pendência específica.
Regressão nova providerfake:primeiro pollPending,depois cancel+close+panic em poll
posterior preserva active1/closed/uncertain e recusa novo job sem entrarengine.
Não é workerreal/crashabrupto/drain; comportamento runtime não alterado.

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
3. Compressão03 adiada para backlog após07/08/09 por decisão humana16/10;
   manterH264, não criar segundo encoder/fallback renderer.
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
