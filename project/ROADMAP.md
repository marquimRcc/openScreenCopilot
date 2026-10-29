# Plano passo a passo

## Ordem humana vigente — 2026-10-16

Concluir e homologar gravação Windows (01/02); depois core/sidecar e transcrição
durante gravação (04/05), recuperação (06), Windows/Copilot/Linux (07/08/09),
e só então o backlog. Compressão/AV1 (03) foi explicitamente adiada e deixa de
ser pré-requisito de 04/05/07: manter H.264 existente. Isso não dispensa estabilidade,
legibilidade, sincronização, ownership/cancelamento ou os aceites de captura/áudio.
Redução de ruído mic e GIF/Compartilhar permanecem no backlog final.
Os números das etapas abaixo são identificadores, não a nova ordem de execução;
esta decisão prevalece sobre dependências antigas que exigem 03 antes de ASR.

## Prioridade atualizada — 2026-10-14

Por pedido explícito do usuário, **estimativa de tamanho do GIF** e
**Compartilhar** ficam para o final, somente após concluir o restante do roadmap.
Não bloqueiam os aceites das etapas 01–09 nem devem ocupar os próximos incrementos.
Preservar a base de GIF já implementada; a ação simples continua não ativada enquanto
seus requisitos de integração estiverem pendentes, sem inventar estimativas.
Próxima prioridade: áudio/dispositivos e homologação da captura/resultado nas etapas
01/02; depois qualidade/compressão, transcrição, recuperação, Windows e Linux conforme
as dependências abaixo. Aceites de GIF/Compartilhar descritos adiante são backlog final,
não requisitos para encerrar a etapa 02 nesta ordem revisada.

Sequência deliberada: estabilizar gravação antes de juntar ASR. Uma etapa só termina
quando os critérios abaixo têm evidência em [STATUS.md](STATUS.md). Abrir branch e PR
por etapa; não fazer push direto em main. Não confundir este plano com o roadmap do upstream.

## 00 — Fundação deste repositório

- [x] Fork GitHub do OpenScreen com nome openScreenCopilot.
- [x] Importar meeting-copilot em vendor, sem esmagar sua genealogia.
- [x] Preservar licenças e fixar os commits de origem.
- [x] Registrar arquitetura, contratos, riscos e matriz de testes.
- [x] Validações locais concluídas e entrega versionada por branch/PR (ver STATUS.md).
- [x] Isolar automações não auditadas com guardas de repositório e teste de política.

## 01 — Baseline Windows e identidade isolada

Dependência: 00.

Estado: em validação; identidade e pacote local concluídos; falha nativa de
timestamps corrigida. Exportação e ASR CPU passaram com mídia sintética.
Ainda faltam o aceite visual completo e estabilidade sob carga.
Evidências em [WINDOWS11-BASELINE.md](WINDOWS11-BASELINE.md).

- Registrar Windows/build, CPU/GPU, driver, RAM, dispositivos e ferramentas.
- Usar Node/npm fixados e documentar toolchain C++/Rust necessário.
- Separar productName/appId/userData/protocolos/atalhos, URLs e auto-update do fork.
- Auditar e neutralizar publicação, notificações, CODEOWNERS e identidades de Store
  herdados antes de habilitar distribuição; não publicar nos destinos dos autores.
- Revisar a CI do fork e validar builds próprios; hash Nix ajustado na fundação.
- Reproduzir uma captura original com sistema e microfone; guardar métricas.
- Manter editor, transcrição pós-gravação e exportação funcionando.

Aceite: build próprio identificável, sem colisão de dados nem atualização upstream;
gravação baseline reproduzível. Evidência: versão/commit, logs, ffprobe e vídeo de teste.

## 02 — Seleção de região e dispositivos

Dependência: 01.

Estado: crop D3D11, seletor retangular e resultado simples implementados;
indicador persistente em validação (02E). Enumeração/resolução nativa de saídas
preparadas em02Q/02R, consulta main/preload implementada02S. Seletor de endpoint,
persistência e preflight main-owned implementados02T; medidor do sistema e aceite
audível/visual real ainda pendentes. Fundação CLI/protocolo de medidor implementada
e validada isoladamente02U. Transporte/controller validado isoladamente02V;
02W integra drenagem no main antes da captura nativa/Chromium e no quit.
02X conecta API/preload start/stop/event;02Y monta teste explícito no seletor existente.
Persistência da fonte agora distingue persistir/preservar/limpar: confirmar região
limpa fail-closed o descritor durável de tela inteira antes da publicação em memória,
enquanto seleções temporárias CLI/MCP preservam a preferência existente.
Ownership de processo WGC também fica separado do estado lógico da tomada e só libera
novo spawn após `close` observado da geração exata, inclusive após timeout/kill incerto.
Aceite GUI/áudio audível segue pendente. Evidências no STATUS.
QA real pela rota Ctrl+N → Record identificou que o seletor inline do editor
não oferecia retângulo. Windows agora encaminha ao seletor dedicado existente,
mantendo autorização/crop no main e sem autostart; abertura/arraste/Escape passaram
em monitor único150%. Retorno visual do seletor após Escape bloqueou a confirmação
e tomada real; captura→resultado e DPI misto seguem pendentes.
Fundação independente autorizada pelo usuário;
aceites de 01/02 continuam pendentes. Sequência detalhada e evidências em
[WINDOWS11-REGION-DEVICES.md](WINDOWS11-REGION-DEVICES.md).

- Overlay retangular em monitor único, crop GPU e validação DPI.
- Indicador persistente: borda vermelha discreta e pontilhada da área efetivamente
  capturada, fora do vídeo final, inclusive com HUD oculto; pedido de 2026-10-13.
- Confirmação pós-gravação com caminho/nome do MP4 e "Abrir local salvo" acessível
  no editor; usar o arquivo efetivo da sessão, não apenas a pasta padrão.
- Seletor de endpoint de saída, microfone independente e medidor de nível.
- Melhoria futura solicitada em 2026-10-14: redução/cancelamento de ruído do
  microfone, com opção simples de ligar/desligar, preservando a voz. Processar
  somente o microfone antes da mistura, sem filtrar o áudio do sistema.
  Avaliar solução local open-source e licença para Windows/Linux; medir latência,
  CPU, sincronização e efeito na transcrição. Validar teclado, ventilador e ruído
  ambiente com comparação ligado/desligado, sem cortes perceptíveis na fala.
  Apenas registrado; implementação e escolha do padrão ainda pendentes.
- Tratamento de fechamento de janela, desconexão e mudança de formato.
  Fechamento ativo/pausado com aceite parcial em win-unpacked 811C; ensaio do harness
  privado (run 5920ed60-b925-416c-8f5f-74b489599cd3 em 2026-10-24, helper SHA-256
  811CD9051F90C35DBCE0EA4355737E2CB3BA24EB3F6DE3B9DF957468E778E7B6 verificado)
  resultou em 8/8 INIT_REJECT no Caso A (INCONCLUSIVE) e INIT_REJECT/OTHER no Caso B
  antes de gravação ativa, por limitação do ambiente em inicializar sessões WGC.
  Sem timeout, cleanupCompleted true, zero resíduos, árvore limpa. Harness privado
  corrigido (about:blank, timeout idempotente, ciclo window-all-closed) e mantido ignorado
  (não commitado). Sem bug funcional confirmado; repetição no mesmo ambiente não agrega
  evidência e a validação de startup/legado exige ambiente com WGC operacional.
  Prioridade 01/02 preservada; avanço ao próximo trabalho independente seguro do roadmap.
- Fixar contrato do relógio de sessão e das pausas antes de adicionar ASR.

Aceite: monitor/janela/retângulo com pixels corretos em DPI misto; Teams, Slack e
YouTube capturados no endpoint escolhido, com aviso claro do escopo de loopback.

### 02B — prioridade de UX pós-gravação

Primeiro incremento implementado (02D), ainda sem homologação GUI completa;
Compartilhar e GIF continuam pendentes. Prévia mostra o MP4 original, sem compor
camadas de webcam/cursor/zoom. Detalhes e limites em [SIMPLE-RECORDING-UX.md](SIMPLE-RECORDING-UX.md).

Adotar resultado simples como tela principal após Parar: prévia, arquivo salvo,
localização, Abrir pasta e Nova captura. Manter Editar em aba/ação secundária.
Em incrementos seguintes, adicionar Compartilhar (destino explícito, sem upload
automático) e Transformar em GIF (trecho, estimativa, cancelamento e original intacto).
Pedido registrado em 2026-10-13; especificação e aceites em
[SIMPLE-RECORDING-UX.md](SIMPLE-RECORDING-UX.md). Primeiro incremento implementado;
aceite completo e ações Compartilhar/GIF continuam pendentes.

## 03 — Spike e perfil de compressão ao vivo

Dependência: 02.

Inspeção/preparação em [WINDOWS-COMPRESSION-SPIKE.md](WINDOWS-COMPRESSION-SPIKE.md):
H.264 High e VBR best-effort atuais; AV1/controle por qualidade ainda não implementados.
Não confundir inventário ou captura sintética curta com comparação de compressão.

- Provar AV1 hardware no caminho WGC -> encoder -> MP4.
- Comparar integração MF/libavcodec e auditar licença do build escolhido.
- Comparar controle por qualidade/bitrate, 30/60 fps e resolução nativa;
  expor codec real e estimativa sem diminuir legibilidade silenciosamente.
- Fallback visível, sem prometer qualidade ou tamanho universal.
- Executar testes de 30 minutos em conteúdo estático e dinâmico.

Aceite: redução mensurada contra a baseline, com texto legível, áudio sincronizado
e editor capaz de abrir/exportar. Qualidade tem prioridade sobre tamanho; os
300 MB/30 minutos não são mais limite de aceite. Registrar os tradeoffs observados.

## 04 — Extrair speech-core e sidecar

Inventário e primeira adaptação isolada registrados em
[SPEECH-CORE-INVENTORY.md](SPEECH-CORE-INVENTORY.md); nenhum runtime ASR/sidecar
integrado, sem dispensar dependências/aceites.

Rascunho v0 de mapa amostras→mídia em
[SPEECH-TIMELINE-DRAFT.md](SPEECH-TIMELINE-DRAFT.md), com fixtures compartilháveis
e aritmética TypeScript isolada/testada, sem imports de runtime. Não é sidecar,
extração de VAD/provider, protocolo congelado ou relógio já emitido pela captura.

Preparação adicional: crate speech-core isolado usa std e executa a mesma fixture
aritmética JSON do TS, com testes/overflow verificado. Não é extração de VAD/provider
do vendor nem sidecar/ASR implementado; integração e aceites continuam pendentes.
Registro Rust limitado de mapas por sessão/fonte agora valida ordem/replay/épocas,
sem PCM/persistência/autorização e sem import runtime. Tetos são provisórios do
protótipo, não negociação v1. Ver SPEECH-TIMELINE-DRAFT. Primeira adaptação pequena
do vendor: downmix mono com política de canais explícita/limites/validação e MIT
preservada; sem resampling/VAD/provider/integração ou dispensa de aceites anteriores.
Experimento subsequente de resampling44.1/48k→16k existe SOMENTE nos testes Rust,
com rubato0.15 dev-only, contagem/partições/cauda/impulsos/tons/cancelamento.
Não é API de normalização nem ASR. Convenção de fase/atraso foi medida antes de
qualquer integração; uma fala sintética pt-BR e falha parcial injetada passaram,
mas voz natural/diversa e épocas live continuam pendentes. Interface provider/tipos
do vendor adaptados para Rust std, com PCM emprestado/guardas/cancel aguardado;
nenhum engine/provider concreto, Tauri, sidecar ou ASR novo integrado.
Planejador original limitado de janelas16k também existe isolado, guiado por
fronteiras fornecidas; não é Silero/VAD ou bufferPCM. Gate de atividade RMS real
e determinístico existe isolado para frames mono16k (5–100ms), com histerese,
debounce limitado e reset explícito; não é classificador semântico/Silero, adaptação
de ruído ou validação live. Deduplicação conservadora
isolada compara somente tokens exatos no sufixo/prefixo (máximo256, texto<=65.536
bytes), preserva o sufixo UTF-8 original e, em dúvida, não remove texto; não é
matching fuzzy, política parcial/final, timestamp nem autorização entre fontes/épocas.
Descritor binário v0 experimental com parsersRust/TS e fixtures compartilhadas em
[AUDIO-FRAME-DRAFT.md](AUDIO-FRAME-DRAFT.md), sem transporte/IPC/captura/runtime.
Contrato SessionLifecycle implementado em Rust std puro (commit 2e13475c) com estados Opening, Active,
Draining e Closed; discontinuity como evento atômico (avanço checked de epoch e redefinição
de sequência); guarda fail-closed observacional contra fechamento do pool por clone externo antes
de activate, advance e discontinuity (sem mutação e sem atomicidade cross-mutex); remoção
do accessor pool() público sem uso; e drain coordenado com TransportBudget (Closed apenas
quando leases e managed_decoders zeram por observação explícita). Normalizador mono whole-buffer
real isolado aceita 16/44.1/48kHz e produz 16kHz, com limite inclusivo de 1.048.576
amostras, cancelamento entre blocos e descarte integral em falha/cancelamento. Usa
rubato0.15 pinado sem features padrão; entrada e saída completas coexistem em memória,
portanto não é streaming nem arquivo longo. 159 testes unitários (14 session_lifecycle +
4 normalizer) + 8 core_pipeline + 8 resample_spike aprovados, fmt e clippy -D warnings.
Ingestão WAV limitada também existe no core: PCM16/float32 little-endian, 1–32 canais,
16/44,1/48kHz, arquivo máximo16MiB, RIFF/formatos validados, política mono explícita e
saída normalizada16kHz. O host deve autorizar o caminho; bytes codificados, PCM
interleaved, mono e saída podem coexistir, portanto não é streaming/arquivo longo nem
limite RSS. Com 3 testes WAV, 4 de sobreposição e 5 do gate de atividade são 171
unitários. Sidecar v0 executável abre somente stdin/stdout NDJSON e implementa
handshake estrito hello/ready/shutdown/completed com schema, identidade limitada e
sequência monotônica; anuncia `providerAvailable:false`. Fixture ready/completed é
serializada em Rust e validada por parser TS main-only estrito. Cinco testes Rust,
20 TS (7 de protocolo/codec/correlação, 5 de framing limitado, 4 de sessão de stream
e 4 de controlador/deadlines)
e smoke real do processo passam, além de
debug/release/clippy/fmt no CI isolado.
Binding host isolado tem3testes com processo fake e supervisor por geração; ainda
há3testes adicionais do launcher dormente (path canônico, shell off e falhas antes
de ownership). Sem integração no startup, path empacotado, pipe PCM, ACL, VAD
semântico, provider ou engine.
Um teste de integração Vitest opt-in também conclui handshake real TS→binárioRust,
shutdown e exit0 observado; fica skip sem path absoluto fornecido explicitamente.
Resolver de recurso tem4testes para slots dev/package win/mac/linux, ausência
fail-closed e rejeição de symlink que escape do diretório canônico da plataforma;
build/staging do binário em cada plataforma continua pendente.
Script de staging tem2testes e executou build release offline/locked no Windows,
copiando somente o executável; ainda não participa dos builds oficiais.
Sidecar ganhou modo diagnóstico separado de WAV autorizado pelo host: normaliza
arquivo limitado para16k, mede frames completos de10ms com o gate RMS determinístico
e devolve somente metadados, com2testes Rust. Não produz transcrição, não é VAD
semântico, não integra provider e não aceita caminho pelo protocolo runtime.
Parser TS estrito desses metadados tem4testes de schema/rates/counters/teto e
consistência das transições/cauda; ainda não há comando Electron público que forneça
caminhos ao probe.
Runner main-only isolado tem3testes, canonicaliza binário+WAV autorizados, usa
shell=false, timeout5s e stdout máximo4KiB. Integração opt-in adicional tem2testes
com WAVs temporários16k/48k e processo Rust release reais, incluindo o resampler;
mantém skip sem executável absoluto e ainda não está exposto por IPC/UI.
Serviço dormente de probe tem2testes e compõe resolver+runner sem spawn quando o recurso
não existe; não é referenciado pelo startup nem amplia autorização do caminho WAV.
Factory dormente tem2testes e compõe resolver/launcher, retornando indisponível sem
spawn quando o recurso falta; ainda não referenciada pelo startup.
Conclusão técnica:
session_ingress e session_decoder não implementados
para evitar duplicação de AudioDecoderV0 (dono da continuidade por fonte), ExpectedStream e
TransportBudget; lifecycle.sequence é âncora da sessão e não governa first_sequence das
fontes independentes. Próximo avanço real requer orquestração no host (05) sob os aceites
vigentes; 04 permanece em checkpoint isolado.
Contrato isolado WorkerProcessSupervisor implementado em TypeScript (electron/stt/workerProcessSupervisor.ts, 11 testes)
e integrado de forma segura ao WhisperServerManager (electron/stt/whisperServer.ts, 41 testes em whisperServer.test.ts)
para supervisão determinística de encerramento e ownership por geração monotônica de processos helpers,
com coalescência de stop concorrente, prazos injetáveis TERM->KILL, preservação de campos/running em stopping/uncertain,
fallback GPU->CPU condicionado a exit observado e propagação honesta de timeout/uncertain em shutdown/stop. Sem
ativar PCM live, modelo real ou novo provider nesta rodada.

Preparação isolada pode avançar; integração com captura aguarda aceites01/02 e contratos de relógio/lifecycle;03 adiada.

- Inventariar dependências Tauri/FFI/Whisper/ONNX e licenças de modelos.
- Extrair normalização, VAD, segmentação, provider e ciclo de sessão para Rust puro.
- Remover AppHandle do core por interface de eventos/cancelamento.
- Definir protocolo v1 e fixtures compartilhadas com TypeScript.
- Testar PCM de arquivo antes de usar captura ao vivo.
- Limitar segmentos longos e integrar a deduplicação conservadora no host com
  envelopes de fonte/época e política explícita de parciais/finais.

Aceite: executar sidecar sem Tauri/Electron e produzir segmentos finais de uma
amostra pt-BR conhecida, com memória limitada e cancelamento/reconexão testados.

## 05 — Transcrição durante gravação

Dependências: 02, 04 (03 adiada ao backlog, não bloqueia ASR).

- Ramificar PCM antes do mix, separado por fonte.
- Journal de áudio, fila com créditos, checkpoints e limites de retenção.
- Coordenar sessionId, contadores, pausas, epochs e finalização independente.
- UI de parcial/final, atraso, provider, áudio ausente e erro.
- Evitar captura duplicada e conflito com o STT pós-gravação herdado.

Aceite: gravar + transcrever sistema/mic simultaneamente por 30 minutos;
falha/atraso de ASR não interrompe MP4 e não provoca crescimento ilimitado de memória.

## 06 — Arquivos e recuperação

Dependência: 05.

- TXT/SRT/JSON derivados de finais; manifest e journal versionados.
- Escritas atômicas e reabertura de sessão interrompida.
- Recuperar ASR do último checkpoint e registrar lacunas.
- Política explícita de áudio temporário, limpeza e disco cheio.

Aceite: crash controlado, retomada sem duplicatas e exports sincronizados
com o MP4. Não apagar áudio pendente por um simples ACK de transporte.

## 07 — Homologação e pacote Windows de teste

Dependências: 05, 06 (03 adiada ao backlog).

- Rodar matriz completa, regressão do editor e testes nativos reais.
- Revisar privacidade, SBOM/avisos, binários, modelos e origem dos downloads.
- Publicar apenas pacote do fork, com identidade e atualização próprias.
- Checklist e limitações visíveis; assinatura/SmartScreen tratados honestamente.

Aceite: relatório reproduzível com hardware, métricas e falhas conhecidas. Nenhuma
afirmação de suporte a dispositivo/codec sem teste. Pacote não é release upstream.

## 08 — Recursos Copilot opcionais

Dependência: 07.

Pesquisar transcrição, gerar resumo ou extrair tarefas por adaptação do meeting-copilot,
com provedor local opcional. APIs remotas exigem escolha e consentimento explícitos.
Não enviar gravações nem iniciar respostas automáticas em reuniões por padrão.

Aceite: tarefas Copilot não degradam captura/ASR; funcionalidades isoladas e desativáveis.

## 09 — Linux / RegataOS

Dependência: contratos estabilizados em 06; distribuição após 07.

- Testar desktop/versão RegataOS real, PipeWire, portal e permissões.
- Reutilizar helper Linux herdado; implementar seleção/crop e fontes de áudio.
- Detectar VAAPI/codec real e prover fallback informado.
- Empacotar RPM/AppImage com dependências corretas para RegataOS.
- Repetir testes de áudio, pausa, recuperação, 30 minutos e transcrição pt-BR.

Aceite: relatório em máquina RegataOS, não apenas build Linux ou teste Fedora.
Core ASR e formato de sessão permanecem compartilhados, adaptadores são específicos.
