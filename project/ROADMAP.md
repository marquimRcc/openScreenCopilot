# Plano passo a passo

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
API/preload/UI do medidor ainda não habilitados. Evidências02W no STATUS.
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

Pode iniciar depois de 01; integração depende de 02/03.

- Inventariar dependências Tauri/FFI/Whisper/ONNX e licenças de modelos.
- Extrair normalização, VAD, segmentação, provider e ciclo de sessão para Rust puro.
- Remover AppHandle do core por interface de eventos/cancelamento.
- Definir protocolo v1 e fixtures compartilhadas com TypeScript.
- Testar PCM de arquivo antes de usar captura ao vivo.
- Limitar segmentos longos e deduplicar sobreposições.

Aceite: executar sidecar sem Tauri/Electron e produzir segmentos finais de uma
amostra pt-BR conhecida, com memória limitada e cancelamento/reconexão testados.

## 05 — Transcrição durante gravação

Dependências: 02, 03, 04.

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

Dependências: 03, 05, 06.

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
