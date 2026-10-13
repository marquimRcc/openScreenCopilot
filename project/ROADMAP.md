# Plano passo a passo

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

- Overlay retangular em monitor único, crop GPU e validação DPI.
- Seletor de endpoint de saída, microfone independente e medidor de nível.
- Tratamento de fechamento de janela, desconexão e mudança de formato.
- Fixar contrato do relógio de sessão e das pausas antes de adicionar ASR.

Aceite: monitor/janela/retângulo com pixels corretos em DPI misto; Teams, Slack e
YouTube capturados no endpoint escolhido, com aviso claro do escopo de loopback.

## 03 — Spike e perfil de compressão ao vivo

Dependência: 02.

- Provar AV1 hardware no caminho WGC -> encoder -> MP4.
- Comparar integração MF/libavcodec e auditar licença do build escolhido.
- Ajustar 30 fps/resolução/bitrate e expor codec real e estimativa.
- Fallback visível, sem prometer teto no hardware incompatível.
- Executar os testes completos de 30 minutos do perfil compacto.

Aceite: MP4 <= 300.000.000 bytes/1.800 s nos casos homologados, texto legível,
áudio sincronizado e editor capaz de abrir/exportar. Registrar casos que não atendem.

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
