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
- Disponibilidade de GUI: autorização humana expressa concedida em 19/10 e reiterada de forma contínua em 20/10/2026 ("Pc livre. Sempre livre. Qdo não estiver te aviso", dispensando novos pedidos de slot de tempo; qualquer aviso de indisponibilidade ou parada encerra imediatamente). Supervisora técnica conduziu
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

Empacotamento local offline e verificação de arquivos (2026-10-20):
- Commit 6434ed9915d782863f6e182832d2866cc12ffb2b empacotado em `.cache/package-windows-mid-capture/win-unpacked` via receita offline Node 22.22.1 / npm 10.9.4 (`build-vite` 44.36s + `electron-builder` 16.88s, ambos status 0 / signal null).
- Integridade de artefato aprovada (.cache/verify-package-windows-mid-capture.cjs): app.asar gerado com SHA256 61cc58291c2bc65eef7893f892eb0dba00d6782292a88859f9a2f5e26789ef2b (87.774.137 bytes), openScreenCopilot.exe com SHA256 0932824f09be3b9bf2e4293e0d2316543e0962355eb64b0a08a3c51aca3dc3b5 (223.298.048 bytes), e wgc-capture.exe inalterado (aaa797a9c1adeceed256f8bce9c8c0c511bc92d55e330250a14d49d6f3c6a1d5).
- Verificação bidirecional estrita: bundles main/preload e 33 assets destinados em dist/ vs app.asar/dist/ idênticos por hash (0 extras, 0 ausentes); presença de OPENSCREEN_APP_DATA_DIR, guardas e novos canais (`native-windows-capture-ended`, `query-native-windows-capture-status`) e hook wiring confirmados; 23 binários nativos win32-x64 idênticos (ffmpeg.exe excluído); 7 extraResources validados; pacotes anteriores profile-isolation (5810df70) e region (99dbed44) intactos. Recibos em `.cache/package-windows-mid-capture-receipt.json`.

Homologação de abertura real do pacote (2026-10-20, launch 17:29:19 UTC, encerramento verificado 17:32:38 UTC):
- Execução com autorização humana de PC livre (assistente planejou janela de ~5 min; launch às 17:29:19 UTC e devolução do PC com encerramento verificado às 17:32:38 UTC) conduzida pelo Codex via launcher em Node 22 com flag npm --offline (não constituindo prova de auditoria de rede independente; runtime do app foi o binário empacotado Electron 41.2.1), perfil isolado (`OPENSCREEN_APP_DATA_DIR` em `.cache/mid-capture-qa-36024967-22a3-4d08-bd91-ff693a04d6bc/app-data`) e proteção de conteúdo desativada exclusivamente para QA (`OPENSCREEN_DISABLE_CONTENT_PROTECTION=1`).
- Main PID 33620 e cover PID 1944 (históricos, terminados via Alt+F4 com encerramento verificado às 17:32:38 UTC); `app.stdout.log` confirmou resolução estrita de userData e recordings no diretório UUID isolado. Cobertura opaca (1280×800 DIP) não homologada visualmente por oclusão com janela do Antigravity.
- HUD abriu com modal de idioma, Áudio do Sistema ON (default de perfil novo) e mic OFF; clique em "Keep current language" recusado pelo hit-test duas vezes (1 retry), sem forçar; Esc não dispensou.
- Atalho Ctrl+N abriu o editor com sucesso (Window.id opaco retornado pelo sky mudou de 132540 HUD para 4262066 editor, não Electron ID ou Win32 HWND demonstrado). Aba Record confirmou controles de áudio do sistema, mic, câmera e cursor editável todos em OFF, pasta apontando para UUID.
- Botão Source abriu seletor com abas Screens (1), Windows (9) e Region. Tentativa de seleção em Windows via acessibilidade sem screenshot retornou geometria de entrada indisponível; Tab/activate/Escape não selecionaram (nenhum defeito de produto afirmado). Aba Screens mostrou própria aplicação; Cancel com geometria fresca retornou à preparação.
- Alt+F4 encerrou editor e cobertura. Verificação às 17:32:38 UTC confirmou 0 processos residuais (listwindowsfresh []) e 0 gravações geradas no diretório recordings. Log do Chromium registrou timeout de primeiro frame (5000 ms GetFrame failed) às 17:30:58.508Z durante enumeração do WGC antes de qualquer tomada.
- Classificação: **Partial / launch + editor + source Cancel**; gravação, fechamento do helper real em voo e salvamento da tomada via IPC SKIPPED por limite operacional da janela e política de privacidade. SEM aceite dos estágios 01 ou 02. Recibo em `.cache/qa-20261020-mid-capture-launch-only-receipt.json`.

Homologação de término inesperado real do helper Windows e salvamento (2026-10-20, 20:37–20:53 UTC):
- Autorização humana contínua concedida expressamente ("Pc livre. Sempre livre. Qdo não estiver te aviso", dispensando pedidos repetidos de slot de tempo; qualquer aviso de indisponibilidade ou pedido de parada encerra imediatamente); salvaguardas de perfil privado UUID, privacidade estrita e microfone OFF mantidas.
- Tentativa 1 (20:37–20:39 UTC, raiz `.cache/mid-capture-real-qa-2d8bf8e4-16a6-4189-9ad1-467394c8d411`): app PID 24420 e cover PID 18776 históricos. Start não foi clicado; a ferramenta sky reportou list_windows 919420 vs get_window not found / foreground sem PID durante transição de janela. Classificado como SKIPPED técnico da automação, não defeito de produto nem indisponibilidade do PC. Cleanup cirúrgico via Stop-Process exclusivamente nos PIDs 24420 e 18776 após conferência de path e start time (sem Alt+F4); zero processos residuais e zero gravações após encerramento. Logs e launch-receipt privados preservados.
- Retomada REAL com sucesso no escopo específico (20:49–20:53 UTC, raiz `.cache/mid-capture-recovery-qa-65f67699-35cd-40b3-82e4-cd18da4aa878`): launcher Node 22 (flag npm --offline, sem auditoria de rede) e binário empacotado Electron 41.2.1 (`openScreenCopilot.exe`); app PID 31324 e cover PID 26136 iniciados às 20:49:20Z. Controle de transição estabilizado após aguardar janela (não prova a causa da falha técnica anterior). Fonte própria confirmada visualmente; Ctrl+N → Record; controles de áudio do sistema, mic, câmera e cursor editável todos em OFF; seleção de Região com arraste de (157,120) a (797,520) DIP, 958×600 px confirmados → Start.
- Helper nativo `wgc-capture.exe` PID 23236 (parent 31324, pacote asar `61cc`, output na pasta recordings do UUID, recordingId 1792529495188) com início de captura registrado às 20:51:36.266Z (distinto do spawn do helper estimado em ~20:51:35Z via CIM creation; `cpu-rgb32 / runtime hardware / fragmented MP4`, sem áudio/cam; cursor modo SYSTEM ativo, não ausência de cursor). HUD timer observado em `00:20`.
- Codex solicitou encerramento cirúrgico de SOMENTE o processo helper PID 23236 via Stop-Process com horário do comando registrado às 20:52:07.9918856Z (impresso imediatamente antes do comando, não confirmação de exit exato) após conferência prévia estrita de PID/parent/path/commandline/output; o botão Stop do HUD NÃO foi clicado.
- O aplicativo processou o encerramento do processo em voo e abriu autonomamente a tela de resultado ("Recording saved 00:31 / 2.7 MB"). Stderr registrou: stop command channel already closed, helper-failed (código 4294967295) e salvamento/playback da saída fragmentada.
- Mídia gerada `recording-1792529495188.mp4` (2.683.398 bytes, 31.518350s, H.264 High 958×600, 1890 frames decodificados, único stream de vídeo; r_frame_rate 120/1 no container não significa 120 FPS real, avg_frame_rate 37800000/630367 ~59.965 fps, time_base 1/60000). Decodificação FFmpeg completa com `-fps_mode passthrough -enc_time_base 1:60000 -f null NUL` exit 0 SEM avisos no decoder. Amostras t=1s e t=30s inspecionadas na raiz QA confirmaram 4 bordas amarelas, texto e animação sem HUD ou área externa nessas amostras (não prova todos os frames).
- Playback avançou no preview de 0s a 10s. Clique em "New capture" retornou o HUD ao estado ocioso ("Start recording"), zero helpers WGC ativos. SHA256 do MP4 idêntico antes/depois do playback, New capture e encerramento: `E7AAF40E18688734BDC24145C1B57E4761216FA41A1F084FE6613A051A9779A9`.
- Alt+F4 normal fechou app e cover. Verificação de encerramento consultou nomes literais às 20:53:38 UTC (openScreenCopilot, electron, wgc-capture e whisper, todos com 0 processos); nova checagem com wildcard às 20:57:56.4942944Z (*whisper*, openScreenCopilot, electron, wgc-capture) confirmou zero processos residuais, sem retroagir essa prova a 20:53. Log do Chromium registrou timeout de primeiro frame (5000 ms GetFrame failed) com timestamp local 17:50:11.096 (Windows UTC-03, equivalente a 20:50:11.096Z) durante enumeração antes de qualquer tomada.
- Classificação: **Aceite PARCIAL SOMENTE encerramento inesperado REAL do helper + salvage / resultado / playback / New capture**. NÃO prova fechamento de HWND, freeze, WinRT, crash de renderer, áudio, DPI misto ou longa duração; NÃO constitui aceite global dos estágios 01 ou 02. Recibo em `.cache/qa-20261020-real-helper-termination-receipt.json`.

Homologação de fechamento de janela fonte (source close) e novo defeito real (2026-10-21, 00:55–01:00 UTC):
- Execução com autorização contínua sob perfil privado UUID (`.cache/source-close-qa-648c3e99-a1f0-415d-b9b5-79d65bb2e6aa`), pacote `61cc`, EXE `0932824f`. Base PID 2760, target PID 13692 e app PID 32416 iniciados às 00:55:23Z; covers sintéticas próprias, sem áudio/mic/cam/cursor editável (cursor SYSTEM embutido).
- Seleção de janela em Windows via a11y (ordem fresh de 10 cards: 2 overlays, 2 app, target 5º, base 6º; 6 Tabs individuais/Space, 7 Tabs/Enter); nome `OPAQUE SYNTHETIC QA COVER` confirmado antes do Start. Take `recordingId: 1792544289534`, WGC helper PID 25728 (`sourceType: "window"`, `windowHandle: 920000` via linha de comando do helper, sem inferir HWND por Window.id do sky, `cpu-rgb32 / hardware / fragmented MP4`), início de captura às 00:58:10.411Z.
- Comando de fechamento da janela alvo registrado às 00:58:25.490Z (`sourceCloseRequestedAt`, impresso imediatamente antes do Alt+F4 normal no alvo, não confirmação de exit exato); a janela sumiu e o encerramento do processo 13692 foi confirmado.
- **NOVO DEFEITO REAL REPRODUZIDO:** o aplicativo NÃO autofinalizou; o HUD continuou contando (00:23 → 00:32 → 01:14 com label Screen) e o helper WGC 25728 permaneceu ativo em loop repetindo o último frame capturado até o encerramento do app (~80.25s medidos; o código permite repetição contínua sem limite intrínseco, mas infinito não foi medido empiricamente).
- Tentativa de Stop via HUD foi recusada 2x pelo hit-test contra `electron ChromeLegacyWindow` (1 retry, sem forçar clique; Ctrl+Shift+O não recuperou foco). Comando de encerramento do app registrado às 00:59:30.501Z (`appCloseRequestedAt`, impresso imediatamente antes do Alt+F4 normal no app, não confirmação de exit exato), encerrando app e helper; base encerrada via Alt+F4. Verificações com wildcard às 00:59:46.5905730Z e 01:00:17.5767735Z confirmaram zero processos residuais (`*whisper*, openScreenCopilot, electron, wgc-capture`).
- Mídia gerada `recording-1792544289534.mp4` (2.944.527 bytes, 80.250817s, H.264 1920×1200, 4815 frames, único stream de vídeo sem áudio, `r_frame_rate: 120/1` no container metadata ≠ FPS real, `avg_frame_rate: 288900000/4815049` ~59.999 fps, SHA256 `6F53B7B02B1875B3B33C18E3EF55D3C7101140C7C18A598D81C90CE95BBBC1A6` idêntico antes/depois decode/quit). Decode FFmpeg completo (`-fps_mode passthrough -enc_time_base 1:60000 -f null NUL`) exit 0 sem avisos. Amostra em frame-60s.png confirmou imagem congelada no relógio 181.49s da fonte (que fechou em ~181s) com label OUTSIDE esperado (janela inteira, não região). Log do Chromium registrou timeout de primeiro frame (5000 ms GetFrame failed) com timestamp local 21:56:26.382 (Windows UTC-03, equivalente a 00:56:26.382Z) durante enumeração antes de qualquer tomada.
- Classificação: **SEM aceite de fechamento de janela fonte (source close), resultado, playback, New capture ou estágios 01/02**. Caso anterior de helper termination forçado permanece válido estreitamente em seu escopo. Preparação 21:06–21:10 UTC (root `51a099fb`) sem Start permanece SKIPPED. Recibo em `.cache/qa-20261021-source-close-failure-receipt.json`.

Reteste real de source close com pacote 0D1F (2026-10-21, ~16:00 UTC) — FALHA sem fallback:
- Execução pela supervisora técnica Codex via launcher Node 22 na raiz `.cache/source-close-fix-qa-4e0680f2-3bcd-4914-a131-56f897e0a36d`, com pacote `.cache/package-windows-source-close-fix/win-unpacked` (helper WGC SHA256 `0D1F079039AF1BCB7CDA793122F33FDC31AEBB71C7CD0669D0F2059D6748CC33`, sem fallback nativo de processo).
- Processos base PID 35232, target PID 28956 e app PID 32796; covers opacas sintéticas, sem áudio/mic/cam/cursor editável.
- Fonte `OPAQUE SYNTHETIC QA COVER` selecionada (ordem de 10 cards, target 6º); WGC helper PID 23320 (`sourceType: "window"`, `windowHandle: 1247950` explícito, `cpu-rgb32 / hardware / fragmented MP4`), take `1792598637996`, `captureStartedAtMs: 1792598638833` (~16:03:58.833Z).
- Janela alvo fechada com comando registrado às 16:04:25.560Z (`sourceCloseRequestedAt` solicitação antes de Alt+F4 normal, não exit preciso); processo 28956 e janela sumiram.
- **FALHA REPRODUZIDA:** o helper WGC 23320 continuou ativo em loop repetindo frames; HUD avançou até 00:47 com label Screen sem autoresultado; Stop UI recusado 2x por hit-test contra `electron Chrome Legacy Window` (1 retry sem forçar clique).
- App encerrado às 16:05:32.192Z (`appCloseRequestedAt` antes de Alt+F4 normal); depois base fechada. Verificações com wildcard às 16:05:48.230Z e 16:06:30.604Z confirmaram zero processos residuais. Mídia gerada `recording-1792598637996.mp4` (2.907.836 bytes, 93.834167s, congelada no frame da target fechada).
- Classificação: **FALHA do patch baseado unicamente no evento WinRT Closed sem fallback; NÃO aceito**. Pacote e recibos 0D1F preservados intactos no cache privado.

Implementação do fallback nativo Windows e reconciliação de build (2026-10-21):
- Implementação estrita e determinística em `electron/native/wgc-capture/src/wgc_source_state.h`, `wgc_session.h`, `wgc_session.cpp` e `main.cpp`:
  - Avaliação pura de vivacidade da fonte (`evaluateSourceLiveness`): combina evento WinRT `Closed`, sinalização do handle do processo alvo (`WaitForSingleObject(SYNCHRONIZE)` retornando `WAIT_OBJECT_0`), validação USER32 via `IsWindow(hwnd)` e consistência de thread/PID proprietários (`GetWindowThreadProcessId`). Falhas de consulta da API do SO (`WAIT_FAILED`, query retornando 0 com `IsWindow` válido) não inventam morte e emitem aviso uma única vez.
  - Ownership RAII estrito de handle de processo (`ScopedHandle` com reset/close automático em unwind e destrutores, sem vazamentos em falhas de inicialização e sem double-close). Handle retido estritamente com direito `SYNCHRONIZE`.
  - Logging no shutdown: razão de encerramento do helper registrada para diagnóstico; término em startup com `!wgcDrained` utiliza `TerminateProcess` + `_exit(3)`.
  - Suíte de testes unitários nativos `wgc_source_state_test.cpp` adicionada ao CMake (testes enumerados aprovados em Debug e Release com código 0).
- Reconciliação do build nativo via Node 22 com desvio registrado factual no recibo `.cache/wgc-build-20261021-source-close-fallback-node22-receipt.json`: tentativa 1 via PowerShell apresentou `NativeCommandError` na mensagem INFO MediaFoundation do teste `mf_encoder_color_test` mas concluiu os 33 probes PASS; tentativa 2 limpa via cmd.exe apenas verificou com `ninja: no work to do.` (código 0, sem recompilar o binário já gerado na tentativa 1); desvio de 2 execuções com log sobrescrito recuperado e preservado no recibo privado com SHA256 `811CD9051F90C35DBCE0EA4355737E2CB3BA24EB3F6DE3B9DF957468E778E7B6` (595.456 bytes; strings `process-signaled` e `encoder-selection` confirmadas).
- Novo pacote empacotado em `.cache/package-windows-source-close-fallback/win-unpacked` (app.asar SHA256 `61CC5829…`, exe `0932824F…`, helper WGC `811CD905…`, cursor `40A1A89DF2140C028A59C486E988838588EAEE40E702BD9642057E7F3734CA56`; pacotes anteriores 0D1F e AAA7 preservados). Recibo em `.cache/package-windows-source-close-fallback-receipt.json`.
- Verificação do runner de build e suíte de testes (`scripts/build-windows-wgc-helper.mjs` atualizado para invocar `wgc_source_state_test.exe`): executado de forma independente pela supervisora técnica Codex via Node 22.22.1 às 21:37:43.570Z (exitCode 0; logs `.cache/wgc-source-close-runner-verification-20261021.stdout.log` e `.stderr.log`). As 7 suítes antigas passaram, `mf_encoder_color` executou 33 testes, e `wgc_source_state_test` concluiu com sucesso ("All tests passed" / "Passed"). SHA256 do helper `811CD9051F90C35DBCE0EA4355737E2CB3BA24EB3F6DE3B9DF957468E778E7B6` e cursor `40A1A89DF2140C028A59C486E988838588EAEE40E702BD9642057E7F3734CA56` inalterados; stderr com mensagens INFO MediaFoundation normais.

Homologação real do fallback nativo para fechamento de janela fonte (source close) — tomadas ativa e pausada (2026-10-21, 21:17–21:26 UTC):
- Ambos os ensaios conduzidos pela supervisora técnica Codex via launcher Node 22 em perfil isolado com autorização humana contínua ("Retomada humana 21/10 PC livre") no pacote win-unpacked em `.cache/package-windows-source-close-fallback/win-unpacked` (app.asar SHA256 `61CC5829…`, exe `0932824F…`, helper WGC compilado com fallback nativo SHA256 `811CD905…`, cursor-sampler `40A1A89D…`).
- **Tomada 1 — Captura ativa (raiz `.cache/source-close-fallback-qa-14ec3ec8-0fc0-45cf-8510-87f3e8d00d0c`):**
  - Processos base PID 35264 (`opaque-qa-long.cjs`), target PID 13664 (`opaque-qa-source.cjs`) e app PID 23344 (`openScreenCopilot.exe`) iniciados sequencialmente às 21:17:02Z via launcher Node 22 com ambiente isolado (`OPENSCREEN_APP_DATA_DIR` no UUID, `OPENSCREEN_DISABLE_CONTENT_PROTECTION=1`, `ELECTRON_RUN_AS_NODE` removido de base/target e app). Coberturas sintéticas próprias sem áudio/mic/cam/cursor editável (cursor SYSTEM embutido).
  - Seleção em Windows via a11y (ordem fresh de 10 cards: target 5º, 6 Tabs/Space marcou target, clique OS em Select); nome `OPAQUE SYNTHETIC QA COVER` confirmado antes do Start.
  - Take `recordingId: 1792617584438`, WGC helper PID 29684 (parent 23344, helper `811CD905…`, `sourceType: "window"`, `windowHandle: 918988` explícito na linha de comando, `cpu-rgb32 / hardware / fragmented MP4`), início de captura às 21:19:45.527Z (`captureStartedAtMs: 1792617585527`).
  - Comando de fechamento da janela alvo registrado às 21:20:17.025Z (`sourceCloseRequestedAt` horário da solicitação antes de Alt+F4 normal no alvo, não confirmação de exit preciso do processo); a janela alvo e o processo 13664 foram encerrados.
  - **Auto-finalização observada com sucesso:** o helper WGC 29684 encerrou autonomamente sem clique no Stop do HUD nem comando kill de processo (stderr registrou `[native-wgc] stop command channel was already closed`); o aplicativo detectou o encerramento da tomada e abriu autonomamente a tela de resultado ("Recording saved 00:31 / 2.2MB").
  - Mídia gerada `recording-1792617584438.mp4` (2.245.517 bytes, duração medida ~31.82s, H.264 High 1920×1200, 1908 frames decodificados, único stream de vídeo sem áudio). Decodificação FFmpeg completa (`-fps_mode passthrough -enc_time_base 1:60000 -f null NUL`) exit 0 SEM avisos no decoder.
  - Amostra frame-30s.png inspecionada na raiz QA confirmou 4 bordas amarelas, texto e relógio 192.18s legíveis, sem HUD ou vazamento externo; label OUTSIDE esperado (janela inteira, não região).
  - Playback de 17s avançou no preview de 0:00 a 0:17. Clique em "Nova captura" retornou o HUD ao estado ocioso ("Choose a screen or window to record"), zero helpers WGC ativos. SHA256 do MP4 idêntico antes e depois de playback e Nova captura: `0F5D45031C471F83AFB24F191DB3BB96E5E0286F81247EB483F1C3804B121624`.
  - Alt+F4 normal encerrou app e fixture base. Verificação com wildcard às 21:21:26.228Z (`*whisper*, openScreenCopilot, electron, wgc-capture`) confirmou ZERO processos residuais.
- **Tomada 2 — Captura pausada (raiz `.cache/source-close-fallback-qa-ed9ad562-7055-4a73-8c1c-f260a0c3c95b`):**
  - Execução conduzida pela supervisora técnica Codex via GUI (mesmo launcher sem alteração). Processos base PID 14960, target PID 33408 e app PID 32564 iniciados às 21:22:33Z. Coberturas sintéticas próprias; controles de áudio/mic/cam/cursor editável OFF.
  - Seleção em Windows via a11y (ordem fresh de 10 cards: target 5º, 6 Tabs/Space marcou target, clique OS em Select -> nome confirmado); take `recordingId: 1792617868673`, WGC helper PID 18048 (parent 32564, `windowHandle: 986170`), início às 21:24:29.529Z (`captureStartedAtMs: 1792617869529`).
  - Pausa no HUD às 21:24:40.451Z; HUD amarelo em 00:11 / Resume confirmado de novo após 6s sem clique, enquanto relógio da fixture continuou de 126s a 139s; captura pausou e NÃO resumiu.
  - Comando de fechamento da janela alvo registrado às 21:25:03.361Z (`sourceClosePausedRequestedAt` horário da solicitação antes de Alt+F4 normal no alvo durante a pausa, não confirmação de exit preciso do processo, sem Resume, sem Stop e sem kill).
  - **Auto-finalização observada com sucesso durante pausa:** target e helper 18048 encerraram autonomamente (stderr registrou `[native-wgc] stop command channel was already closed`); o app autofinalizou abrindo a tela de resultado ("Recording saved 00:11 / 823KB").
  - Mídia gerada `recording-1792617868673.mp4` (822.979 bytes, ~11.10s, H.264 High 1920×1200, 664 frames, sem áudio). Decodificação FFmpeg completa com mesmo timebase exit 0 sem avisos.
  - Playback de 7s avançou no preview de 0:00 a 0:07. SHA256 do MP4 idêntico antes e depois de playback e Nova captura: `8E286B9DD0EFA02BCEE83A73A8A6C5D2A355F62708B670F4BDAE5B00118BCB56`. HUD ocioso ("Choose a screen or window to record"), 0 helpers.
  - Alt+F4 normal encerrou app e base. Verificação às 21:26:04.387Z com wildcard (`*whisper*, openScreenCopilot, electron, wgc-capture`) confirmou ZERO processos residuais.
- Stderr do Chromium registrou timeout de primeiro frame (`5000 ms GetFrame failed`) durante enumeração do WGC na abertura do picker antes de cada tomada (às 21:18:03.643Z na tomada 1 e às 21:23:33.992Z na tomada 2; não declarar QA globalmente sem avisos).
- Limitações e escopo explícitos: (1) Duas tomadas aprovadas: source close em captura ativa E durante captura pausada; (2) O ensaio não comprova qual mecanismo interno disparou primeiro (evento WinRT `Closed` vs fallback nativo com `WaitForSingleObject` no handle `SYNCHRONIZE` / `IsWindow` / `GetWindowThreadProcessId`), pois a UI/IPC não expõe o motivo detalhado em eventos externos; (3) Não rotula source close pré-primeiro frame, legacy real, janelas reais de terceiros ou WinRT vs fallback específico como aprovados; (4) A reciclagem rápida de HWND na mesma thread/PID (intra-thread recycling) permanece limitação inerente da arquitetura Win32; (5) Startup pré-primeira amostra, legacy real, áudio de sistema, microfone, webcam, cursor editável, escala mista de DPI, múltiplos monitores, sessões de longa duração (30min) e integração ASR permanecem pendentes e não aprovados; (6) SEM aceite global dos estágios 01 ou 02.
- Classificação: **Aceite PARCIAL SOMENTE fechamento de janela fonte (source close) com fallback nativo aprovado em captura ativa E durante captura pausada, auto-finalização autônoma da tomada, tela de resultado, playback e retorno ao HUD no pacote win-unpacked 811C; sem aprovação de source close pré-primeiro frame, legacy real ou WinRT vs fallback específico; SEM aceite global dos estágios 01/02**. Recibo privado consolidado em `.cache/qa-20261021-source-close-fallback-receipt.json`.

Homologação real de minimizar e restaurar janela fonte durante captura (2026-10-21, 22:12–22:17 UTC):
- Execução com autorização humana ("Retomada autorizada pelo humano") conduzida pela supervisora técnica Codex via launcher Node 22 na raiz isolada `.cache/source-close-fallback-qa-bff01f94-ca41-4ebf-bb10-f315d2361434`, com pacote win-unpacked (`811CD905…`, asar `61CC…`, exe `0932824F…`, cursor `40A1A89D…`).
- Processos base PID 29140 (`opaque-qa-long.cjs`), target PID 27108 (`opaque-qa-source.cjs`) e app PID 24104 (`openScreenCopilot.exe`) iniciados sequencialmente às 22:12:52Z com ambiente isolado (`OPENSCREEN_APP_DATA_DIR` no UUID, `OPENSCREEN_DISABLE_CONTENT_PROTECTION=1`, `ELECTRON_RUN_AS_NODE` removido de base/target e app). Coberturas sintéticas próprias; controles de áudio do sistema, microfone, webcam e cursor editável todos em OFF; cursor SYSTEM; tom não ativado.
- Seleção em Windows via a11y (ordem fresh de 10 cards: target 7º por 8 Tabs + Space, clique OS em Select -> nome `OPAQUE SYNTHETIC QA COVER` confirmado antes do Start).
- Take `recordingId: 1792620890603`, WGC helper PID 14096 (parent 24104, `sourceType: "window"`, `windowHandle: 1117118` explícito na linha de comando, `cpu-rgb32 / hardware / fragmented MP4`), início de captura às 22:14:51.494Z (`captureStartedAtMs: 1792620891494`).
- **Minimizar nativo:** menu Alt+Space -> clique em "Minimizar" às 22:15:13.684Z. A janela alvo saiu da frente exibindo a base underneath; consulta às 22:15:24Z confirmou target 27108 e helper 14096 vivos; o contador do HUD continuou progredindo de 00:12 a 00:37 sem autofinalização ou autoresultado falso (comprova que minimizar não é interpretado erroneamente como morte da fonte).
- **Restauração e continuidade:** restore executado via `sky.activate_window` às 22:15:35.114Z; fonte observada com relógio em 162.24s; a captura continuou ativamente.
- Tentativa de Stop via HUD foi recusada 2x por hit-test contra `electron.exe Chrome Legacy Window` (1 reativação/reobservação/retry, sem forçar clique; NÃO declarar Stop normal aprovado).
- Para encerramento do ensaio, comando Alt+F4 normal SOMENTE na janela alvo às 22:16:16.010Z; helper 14096 encerrou autonomamente (`stop command channel was already closed` no stderr) e a tela de resultado abriu autonomamente exibindo "Recording saved 01:24 / 5.1MB".
- Mídia gerada `recording-1792620890603.mp4` (5.103.053 bytes, duração exata 84.984050s via ffprobe existente `crates/thirdparty/ffmpeg-n8.1.2-win64-lgpl-shared/bin/ffprobe.exe`, 5098 frames, avg_frame_rate 101960000/1699681, r_frame_rate 60/1, time_base 1/60000, H.264 High 1920×1200, único stream sem áudio). Decodificação FFmpeg completa com `-fps_mode passthrough -enc_time_base 1:60000 -f null NUL` exit 0 SEM avisos no decoder.
- SHA256 do MP4 idêntico antes e depois de playback, Nova captura e quit: `D10AF3D0D74B4895426A8552BF0AD98480FA83BC0AC15D1A15F3439FEFE25B83`. Playback avançou no preview de 0:00 a 0:15; clique em "Nova captura" retornou o HUD ao estado ocioso ("Choose a screen or window to record"), zero helpers WGC ativos.
- Amostras visuais na raiz QA: `frame-minimized-35s.png` com relógio 140.67s estático; `frame-restored-65s.png` com relógio 183.23s confirmando conteúdo atualizado após restore; 4 bordas amarelas, texto legível e label OUTSIDE esperado (janela inteira, não região), sem HUD em ambas as amostras. Isso NÃO prova recepção de frames atualizados enquanto minimizada nem janela estática separadamente.
- App e base fechados com Alt+F4 normal. Consulta com wildcard às 22:17:24.688Z (`*whisper*, openScreenCopilot, electron, wgc-capture`) confirmou ZERO processos residuais.
- Stderr do Chromium registrou timeout de primeiro frame (`5000 ms GetFrame failed`) com timestamp local 19:13:49.893 (Windows UTC-03, 22:13:49.893Z) durante enumeração do WGC no picker antes da tomada (não declarar stderr vazio).
- Limitações e escopo: (1) Aceite PARCIAL estritamente para minimizar e restaurar janela fonte sem encerramento falso da captura; (2) Não declara Stop normal do HUD aprovado; (3) Não prova frames atualizados enquanto minimizada nem janela estática separadamente; (4) Startup pré-primeira amostra, legacy real, janelas reais de terceiros, WinRT vs fallback específico, áudio de sistema, microfone, webcam, cursor editável, escala mista de DPI, múltiplos monitores, sessões de longa duração (30min) e integração ASR permanecem pendentes; (5) SEM aceite global dos estágios 01 ou 02.
- Classificação: **Aceite PARCIAL SOMENTE minimizar e restaurar janela fonte durante captura sem falso encerramento, continuidade pós-restore, finalização autônoma via Alt+F4 na target, resultado, playback e retorno ao HUD no pacote win-unpacked 811C; Stop normal do HUD não aprovado; SEM aceite global dos estágios 01/02**. Recibo privado em `.cache/qa-20261021-source-minimize-receipt.json`.

Ensaio real de source close com flag de callback legado solicitada (2026-10-21, 22:20–22:23 UTC):
- Execução conduzida pela supervisora técnica Codex via launcher Node 22 na raiz isolada `.cache/source-close-fallback-qa-19052509-64fb-4d53-b151-b9e637eb7428`, com mesmo pacote win-unpacked (`811CD905…`, asar `61CC…`, exe `0932824F…`, cursor `40A1A89D…`).
- PowerShell do Codex definiu `OPENSCREEN_WGC_LEGACY_FRAME_CALLBACK=1` estritamente para o spawn dos processos e restaurou o ambiente pai em bloco `finally`; launcher repassa `process.env` e processo principal faz spawn do helper herdando o ambiente sem variáveis customizadas.
- **Limitação de confirmação interna:** o log bruto do helper (`[stop-timing] mode=legacy-callback`) NÃO foi extraído. O ensaio é classificado como flag legado solicitada e herdada no ambiente, SEM homologação inequívoca do caminho interno executado pelo helper ou do motivo do fechamento (WinRT vs fallback). Não considerar callback legado como concluído globalmente.
- Processos base PID 25156, target PID 13952, app PID 2644, helper PID 12776 (parent 2644). HWND 1575560 explícito no stdout (`window:1575560:0`, `OPAQUE SYNTHETIC QA COVER`). Take `recordingId: 1792621252034`, início às 22:20:52.844Z (`captureStartedAtMs: 1792621252844`).
- Controles: áudio do sistema, microfone, webcam e cursor editável todos em OFF; cursor SYSTEM; tom não ativado. Seleção fresh de 10 cards em Windows (target 7º por 8 Tabs + Space, clique OS em Select e nome confirmado antes do Start).
- HUD observado progredindo de 00:05 a 00:17. Fechamento da janela alvo via Alt+F4 normal às 22:21:28.703Z sem Stop da UI nem kill no helper.
- Helper encerrou autonomamente e tela de resultado abriu exibindo "Recording saved 00:36 / 2.5MB".
- Clique em "Edit" abriu o editor no perfil isolado de QA; playback verificado de 0 a 20.5s; estado "Saved"; sem export, sem ASR, sem modelos e sem edição realizada.
- Tentativa de SaveDiagnostics via tecla Alt em resultado e editor, F10 e menus do app não ofereceram o comando; nenhuma barreira de interface foi contornada via IPC/CDP/shell.
- Não houve Nova Captura (NewCapture) nesta tomada (NÃO aprovada neste ensaio).
- Mídia gerada `recording-1792621252034.mp4` (2.488.452 bytes, duração exata 36.100867s via ffprobe existente `crates/thirdparty/ffmpeg-n8.1.2-win64-lgpl-shared/bin/ffprobe.exe`, 2165 frames, H.264 High 1920×1200 sem áudio, avg_frame_rate 32475000/541513, r_frame_rate 60/1, time_base 1/60000). Decodificação FFmpeg completa com `-fps_mode passthrough -enc_time_base 1:60000 -f null NUL` exit 0 SEM avisos no decoder.
- SHA256 do MP4 idêntico antes e depois de Edit, playback e quit: `F5AF6060C3C6210F2BA622C956DAEB72741CBA4DC3E8140D30C30611E1BC2429`. Frame t=30s inspecionado na raiz QA (`frame-30s.png`) com relógio 158.53s, 4 bordas amarelas, texto legível, label OUTSIDE esperado (janela inteira, não região), sem HUD presente.
- App e base fechados com Alt+F4 normal. Consulta com wildcard às 22:23:15.442Z (`*whisper*, openScreenCopilot, electron, wgc-capture`) confirmou ZERO processos residuais.
- Stderr do Chromium registrou timeout de primeiro frame (`5000 ms GetFrame failed`) com timestamp local 19:19:53.595 (Windows UTC-03, 22:19:53.595Z) durante enumeração do WGC no picker antes da tomada.
- Limitações e escopo: (1) Aceite PARCIAL restrito a fechamento de janela alvo com flag legado solicitada no ambiente/herança, auto-finalização autônoma, resultado, transição via botão Edit e playback 0→20.5s no pacote 811C; (2) SEM homologação inequívoca do modo interno do helper (mode=legacy-callback não inspecionado); (3) Não atualiza callback legado como concluído globalmente; (4) NewCapture não executado nem aprovado; (5) SaveDiagnostics não disponível; (6) Startup pré-primeira amostra, áudio de sistema, microfone, webcam, cursor editável, escala mista de DPI, múltiplos monitores, sessões de longa duração (30min) e integração ASR permanecem pendentes; (7) SEM aceite global dos estágios 01/02.
- Classificação: **Aceite PARCIAL SOMENTE fechamento de janela fonte com flag legado solicitada no ambiente/herança, auto-finalização autônoma, abertura do editor via Edit e playback 0→20.5s no pacote win-unpacked 811C; sem confirmação inequívoca do mode interno do helper ou motivo WinRT/fallback; New capture não executado nem aprovado; SaveDiagnostics indisponível; SEM aceite global dos estágios 01/02**. Recibo privado em `.cache/qa-20261021-source-close-legacy-requested-receipt.json`.

Tentativa de startup / fechamento pré-primeira amostra via GUI sob stall artificial (2026-10-21, ~22:27 UTC) — SKIPPED:
- Execução única via GUI na raiz isolada `.cache/source-close-fallback-qa-16a3183d-f2dd-44a5-9934-fdfb396bf4de` com `OPENSCREEN_WGC_TEST_STALL_READBACK_MS=5000` e `OPENSCREEN_WGC_LEGACY_FRAME_CALLBACK=0`. Base PID 25252, target PID 31140, app PID 16208, helper PID 15796 (parent 16208, HWND 13896258).
- Condição pré-primeira amostra NÃO atingida: `captureStartedAtMs: 1792621652474` (22:27:32.474Z) precedeu o pedido de fechamento da janela alvo via Alt+F4 normal às 22:27:39.202Z por 6.728s; portanto condição pré-primeira amostra não alcançada (latência da supervisora/automação GUI; sem inferir causa temporal mais precisa).
- Captura já iniciada codificou 3 frames válidos sob stall; resultado autônomo "Recording saved 00:10 / 37.2 KB"; mídia `recording-1792621646620.mp4` (37.170 bytes, 10.030967s, 3 frames H.264 1920×1200 via `ffprobe -count_frames`, SHA256 `2D0BBB61ED7EA673D5EE8347E65014F057708D478F7864D055D1E4932F61B4EC`). Sem playback, Edit ou New capture; sem decode completo adicional. App e base fechados normalmente; 0 processos residuais às 22:28:16Z.
- Classificação: **SKIPPED de cobertura (condição pré-primeira amostra não atingida pela latência de interação na GUI; nenhum defeito de produto afirmado; fechamento pré-primeira amostra permanece pendente)**. Recibo privado em `.cache/qa-20261021-startup-close-missed-receipt.json`.

Ensaio do harness privado de source close em startup e legado (2026-10-24, ~22:50 UTC) — INCONCLUSIVO:
- Execução única conduzida pela supervisora Codex via Electron local a partir da raiz do repositório (`runUuid: 5920ed60-b925-416c-8f5f-74b489599cd3`), sem relançamento, sem testes concorrentes e sob safety global de 150 s.
- Helper WGC empacotado validado com SHA-256 `811CD9051F90C35DBCE0EA4355737E2CB3BA24EB3F6DE3B9DF957468E778E7B6` (`verified: true`, path `.cache/package-windows-source-close-fallback/win-unpacked/resources/electron/native/bin/win32-x64/wgc-capture.exe`).
- **Caso A (8 tentativas sequenciais):** Delays após `encoder-selection` em `[0, 1, 2, 4, 8, 12, 16, 24]` ms, cada uma com nova janela opaca (`about:blank`), HWND 64-bit BigInt (`591728`, `657264`, `722800`, `788336`, `853872`, `919408`, `984944`, `1050480`), UUID/diretório próprios e `OPENSCREEN_WGC_TEST_STALL_READBACK_MS=5000` (registrado: ocorre após obtenção da textura e não revalida sourceClosed antes da submissão; não é garantia). Helper PIDs: 25100, 27156, 8512, 5512, 33892, 31736, 28124, 25248.
- **Resultado do Caso A:** Todas as 8 tentativas (8/8) foram rejeitadas na inicialização gráfica pelo Windows com `ERROR: Failed to initialize WGC window session` antes da emissão de `encoder-selection` ou `recording-started` (exitCode 1, timedOut false, durações 180–235 ms). Classificação sem falso positivo: **8/8 INIT_REJECT; Caso A INCONCLUSIVO**.
- **Caso B (Legado e auto-encerramento pós-início):** Janela exclusiva HWND `1116016` (`0x110770`), helper PID 17840, `OPENSCREEN_WGC_LEGACY_FRAME_CALLBACK=1`, sem stall. O helper também retornou `ERROR: Failed to initialize WGC window session` (exitCode 1, timedOut false, duração 216 ms) antes de `recording-started`. Classificação: **INIT_REJECT / OTHER; a condição de fechamento de janela fonte pós-início não pôde ser exercitada**.
- **Isolamento, Limpeza e Ciclo de Vida:** Sem timeout global ou de tentativa (`timedOut: false`, duração total 4231 ms / 4,231 s); `cleanupCompleted: true`; conferência confirmou zero processos residuais de Electron ou helper e zero janelas abertas; árvore git permaneceu limpa.
- **Harness privado:** Corrigido com navegação local estável (`about:blank`), timeout idempotente e supressão explícita de auto-quit em `window-all-closed`, gravando recibo determinístico no `finally`. Permanece em `.cache/wgc-private-source-close-harness.cjs` ignorado no Git e NÃO deve ser commitado.
- **Classificação:** **Evidência INCONCLUSIVA POR LIMITAÇÃO DO AMBIENTE, NÃO falha de produto**. Não há bug funcional confirmado e nova repetição neste mesmo ambiente não agrega evidência; a próxima validação exige ambiente em que a API Windows Graphics Capture consiga inicializar sessões de janela. Preservar a prioridade vigente de estabilização da gravação Windows (01/02) e avançar para os próximos trabalhos independentes seguros do roadmap. Recibo privado consolidado em `.cache/wgc-source-close-harness-receipt.json` e run em `.cache/wgc-source-close-run-5920ed60-b925-416c-8f5f-74b489599cd3/`.

Repo C:\Users\marcos.gomes\Documents\Codex\2026-10-13\new-chat\work\openScreenCopilot,
branch feat/windows-region-foundation.
Escritor ativo: IA implementadora Antigravity, sob supervisão técnica Codex (chat original
confirmado notLoaded; nenhum trabalho paralelo).

Checkpoint funcional atual: SessionLifecycle isolado Rust std puro (2e13475c) com estados Opening/Active/Draining/Closed, discontinuity atômica, guarda fail-closed observacional contra fechamento por clone externo antes de activate/advance/discontinuity (sem atomicidade cross-mutex), remoção do accessor pool() público sem uso e drain coordenado ao TransportBudget (155 unitários [14 session_lifecycle] + 8 core_pipeline + 8 resample_spike, fmt e clippy -D warnings aprovados); integração de supervisão determinística WorkerProcessSupervisor em WhisperServerManager (electron/stt/whisperServer.ts, 41 testes em whisperServer.test.ts + 11 testes em workerProcessSupervisor.test.ts, ambos tsc e lint OK) com ownership fail-closed por geração monotônica, retenção de campos/running em stopping/uncertain, coalescência de stop, fallback GPU->CPU estritamente condicionado a exit observado e propagação transparente de timeout em shutdown; guarda pré-spawn síncrona fail-closed de fonte, região e geometria/DPI em startupWindows (windowsCaptureStartupValidation.ts, 13 testes focados aprovados); OwnedInputChunk/orçamento misto sobre propriedades
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
|02 região/dispositivos/resultado|Implementados (guarda pré-spawn, região, loopback sintético 30min, source close ativo + pausado e minimizar/restaurar validados); borda física/mic audível/DPI misto/fluxo completo pendente|
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
- Ownership independente do helper WGC permanece até o evento `close` exato;
  reset lógico, timeout/kill não confirmado e evento tardio de geração antiga não
  autorizam novo spawn. Contrato isolado/testado, sem alterar protocolo de stop,
  helper nativo ou declarar homologação de captura real.
- Seleção de região limpa de forma fail-closed a fonte inteira persistida antes de
  publicar a nova seleção em memória; reiniciar não pode ampliar silenciosamente o
  retângulo para tela inteira. Seleções temporárias CLI/MCP continuam sem alterar a
  preferência durável. Seleção normal também preserva a fonte anterior e não publica
  outra quando a escrita durável falha. Contrato coberto apenas por testes focados;
  GUI não homologada.
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
  - Fechamento de janela/fonte durante captura ativa E durante captura pausada teve aceite parcial no pacote win-unpacked 811C (autofinalização autônoma, resultado, playback, retorno ao HUD); minimizar/restaurar janela fonte sem falso encerramento validado com aceite parcial; fechamento pré-primeiro frame, legacy real, janelas reais de terceiros e DPI misto seguem pendentes (ensaio do harness privado em 2026-10-24 inconclusivo por limitação do ambiente gráfico/WGC, sem falha funcional de produto).
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

Como o ensaio de source close em startup/legado (run 5920ed60 em 2026-10-24) foi
inconclusivo por limitação do ambiente gráfico (WGC INIT_REJECT) sem bug funcional
confirmado, repetições no mesmo host não agregam evidência; nova validação deste item
exige ambiente que consiga inicializar sessões WGC. A prioridade vigente (2026-10-16)
prevalece: concluir e homologar gravação Windows (01/02) antes de ASR integrado (04/05).
O próximo trabalho seguro e independente deve avançar nos itens não dependentes de WGC
ativo dentro de 02 (como validações de DPI misto, borda física ou persistência) ou nos
contratos isolados de speech-core (04) sem depender de captura ativa.

1. Trabalho independente04: SessionLifecycle isolado implementado em Rust std puro
   (2e13475c, crates/speech-core/src/session_lifecycle.rs) com estados Opening, Active,
   Draining e Closed; discontinuity como evento atômico (record_discontinuity com
   checked_add somente de epoch e redefinição de sequence para o valor fornecido); guarda fail-closed
   observacional contra fechamento do pool por clone externo antes de activate, advance_sequence e
   record_discontinuity (sem mutação de estado/contadores e sem alegar atomicidade cross-mutex);
   remoção do accessor pool() público sem uso; TransportBudget como fonte de verdade de
   admissão e drain (begin_drain fecha admissão; Closed atingido apenas quando leases e
   managed_decoders zeram por observação explícita). Sem host/TS/IPC/PCM live/provider/engine.
   Testes: 155 unitários (14 session_lifecycle) + 8 core_pipeline + 8 resample_spike aprovados,
   fmt --check e clippy -D warnings sem resíduos.
   Conclusão de revisão arquitetural: não criar módulos intermediários como session_ingress
   ou session_decoder, pois duplicariam responsabilidades de AudioDecoderV0 (dono único
   da continuidade, verificação de cabeçalhos e avanço de sequência/amostras por fonte),
   ExpectedStream e TransportBudget. A sequence do SessionLifecycle atua como âncora de
   sessão e fica stale frente ao avanço independente de System e Microphone, não devendo
   governar first_sequence de ambas.
   Próximo avanço real requer orquestração no host/etapa05 e permanece condicionado
   às dependências/aceites vigentes (01/02), sem declarar 04 globalmente concluída além
   deste checkpoint isolado. Fila original, instâncias de controle e integração host
   seguem pendentes; notificação Rust isolada feita, host não conectado.
   Supervisão determinística de processo worker implementada em TypeScript
   (`electron/stt/workerProcessSupervisor.ts`, 11 testes) e integrada de forma segura ao
   `WhisperServerManager` (`electron/stt/whisperServer.ts`, 41 testes em `whisperServer.test.ts`):
   ownership de um processo por geração monotônica, coalescência de chamadas `stop()` concorrentes
   na mesma Promise, escalada TERM (prazo injetável) -> KILL (prazo injetável) sem tratar emissão
   de sinal como recibo de saída; timeout converte para estado incerto (`uncertain`) e retém ownership
   bloqueando `start`/`attach` de substituto; limpeza de processo/port/startedAt condicionada à
   observação real do evento `'exit'` da geração exata; fallback GPU->CPU fail-closed aguardando exit
   e recusando relançamento caso stopping termine uncertain; shutdown propaga falhas de encerramento
   sem mascaramento. Sem ativar PCM live, rede real, modelo real ou provider nesta rodada; ambos `tsc`
   e lint limpos.
   Não prometer teto RSS, drain de worker ou recuperação por FutureDrop.
   Requisitos de transições/gaps/normalização/drain/reconexão estão no final de
   AUDIO-FRAME-DRAFT; tabela não é implementação nem teste de memória30min.
   Não criar pipe/API/PCM live nem confundir binding/accepted com auth/durabilidade.
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
