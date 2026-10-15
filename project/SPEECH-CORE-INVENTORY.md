# Inventário inicial para speech-core

Inspeção somente leitura em2026-10-14. NÃO é extração implementada, auditoria
completa de dependências/modelos, nem aceite da etapa04. Captura/qualidade e
homologação das etapas01–03 continuam dependências da integração. Nenhum build,
instalação, download ou alteração de vendor foi feito para este inventário.

Origem congelada: meeting-copilot3c299c99abf7c38c1e3bac34c4aecdc010c911dd;
licença [MIT original](../vendor/meeting-copilot/LICENSE.md), copyright Zackriya
Solutions. Extrações futuras devem manter esses avisos e registrar alterações.
Ver [UPSTREAMS.md](UPSTREAMS.md), [ARCHITECTURE.md](ARCHITECTURE.md) e
[relógio Windows](WINDOWS11-REGION-DEVICES.md).

## Fronteiras encontradas

| Origem em `frontend/src-tauri/src/audio` | Reuso candidato e limite |
|---|---|
| [transcription/provider.rs](../vendor/meeting-copilot/frontend/src-tauri/src/audio/transcription/provider.rs) | Trait sem Tauri direto, erros e resultado comum. Espera f32 mono16kHz. Resultado não inclui session/source/epoch/amostras/cancelamento; não copiar como protocolo completo. |
| [transcription/whisper_provider.rs](../vendor/meeting-copilot/frontend/src-tauri/src/audio/transcription/whisper_provider.rs) | Adaptador de engine global do app original; não é backend autônomo só por implementar trait. |
| [transcription/engine.rs](../vendor/meeting-copilot/frontend/src-tauri/src/audio/transcription/engine.rs) | Validação/configuração via AppHandle, Manager, API e comandos de engines. Separar factory/cache do core. |
| [transcription/worker.rs](../vendor/meeting-copilot/frontend/src-tauri/src/audio/transcription/worker.rs) | AppHandle/Emitter/Runtime, contadores estáticos e canais unbounded. Não importar worker/ciclo global para Electron. |
| [vad.rs](../vendor/meeting-copilot/frontend/src-tauri/src/audio/vad.rs) | Segmentação/silero e testes candidatos; timestamps Silero já absolutos à sessão, não adicionar processed_samples de novo. |
| [audio_processing.rs](../vendor/meeting-copilot/frontend/src-tauri/src/audio/audio_processing.rs) | Mistura DSP com pastas, encoding e escrita de transcrição. Extrair funções/estados por responsabilidade, não módulo inteiro. |
| [pipeline.rs](../vendor/meeting-copilot/frontend/src-tauri/src/audio/pipeline.rs) | Captura/dispositivos, métricas, resampler e estado da aplicação; há unbounded_channel. Core novo não deve abrir hardware ou copiar fila infinita. |
| [recording_state.rs](../vendor/meeting-copilot/frontend/src-tauri/src/audio/recording_state.rs) | AudioChunk contém Vec, sample_rate, timestamp, chunk_id e tipo de dispositivo; falta contrato explícito interoperável de relógio/epoch. |
| [common.rs](../vendor/meeting-copilot/frontend/src-tauri/src/audio/common.rs) | Lock/engines globais, API TranscriptSegment e escrita JSON. SessionStore novo deve ser main-owned, não reutilizar singletons/nome de temporário global. |

## Dependências: manifest não é lock

O [workspace Cargo](../vendor/meeting-copilot/Cargo.toml) está na raiz do snapshot,
assim como seu [Cargo.lock](../vendor/meeting-copilot/Cargo.lock), não em src-tauri.
Versões abaixo são as RESOLVIDAS nesse lock; não inferidas de comentários do
[manifest](../vendor/meeting-copilot/frontend/src-tauri/Cargo.toml).

| Dependência | Resolução observada | Decisão pendente |
|---|---|---|
| whisper-rs |0.13.2 | Comparar com helper Whisper já existente; evitar dois engines/GPU/model caches para a mesma sessão. |
| silero |0.1.0, rev26a646003cd8532ae2dde424ccdab1b6cdf5d7b0 | Auditar código/modelo e contrato de timestamps; não baixar durante captura. |
| ort |2.0.0-rc.10 | Conferir ABI e DLLs com ONNX já empacotado; versão do crate não comprova compatibilidade do runtime. |
| rubato |0.15.0 direto e0.16.2 transitivo do Silero | Definir uma normalização e mapa de amostras; não assumir resampling duplo inofensivo. |
| nnnoiseless |0.5.2 | Somente backlog de redução de ruído do microfone; não filtrar sistema nem habilitar por padrão nesta extração. |
| tauri |2.11.1 | Não carregar no speech-core/sidecar; substituir eventos/configuração/persistência por interfaces próprias. |
| ffmpeg-sidecar |2.5.0, commit b0f48a514235d1278d860f4a0af66aa9d6e1618d | Manifest acompanha branch main, lock fixa commit; não portar download/encoder alternativo para o core. |

MIT do projeto não substitui licenças dessas bibliotecas, binários e modelos.
Inventário não certifica redistribuição. Ainda faltam avisos/licenças por artefato,
hashes de modelos, avaliação pt-BR e proveniência do build. Não executar build.rs
ou instalar vendor como atalho para descobrir dependências.

## Armadilhas que os primeiros testes devem fixar

- Backpressure: worker/pipeline usam canais ilimitados, apesar dos comentários
  sobre ausência de perdas. Limitar memória/créditos e persistir áudio com lacunas
  explícitas; ASR lento não pode bloquear ou derrubar MP4.
- Relógio: devicePosition WASAPI, tempo Silero, chegada ao processo e PTS MP4 não
  são intercambiáveis. Definir sessão/fonte/epoch, contador de amostras e mapa de
  pausas antes de ramificar PCM; regressão de timestamp VAD absoluto entra na fixture.
- Provider: Vec16kHz e is_partial não bastam para recuperação/deduplicação/drain.
  Distinguir segmento provisório/final e cancelamento que aguarda inferência terminar.
- Ruído: comentários de NoiseSuppressionProcessor dizem comprimento igual, mas
  process emite apenas frames completos e guarda o restante; flush preenche um
  frame e trunca ao tamanho original. Testar partições e flush pelo comportamento,
  não pelo comentário. Continua melhoria futura, separada da integração ASR.
- Captura única: excluir CPAL/capture/devices e backend arquivado do core; aceitar
  áudio fornecido pelo host. Não importar telemetria, notificações, updater, APIs
  remotas ou credenciais só porque aparecem no manifest do aplicativo original.

## Ordem de spike proposta, ainda sem runtime novo

1. Fixtures PCM sintéticas/pt-BR conhecidas e contrato de eventos/amostras, sem hardware.
2. Extrair normalização/segmentação puros com licença/proveniência e limites testados.
3. Provider local com lifecycle/cancelamento e cache coordenado com STT existente.
4. Sidecar versionado, handshake/créditos/drain/reconexão e testes de fila/disco.
5. Integrar PCM antes do mix somente após estabilizar relógio/qualidade/captura.

Aceites continuam no [ROADMAP.md](ROADMAP.md). Esta análise não dispensa teste de
fala real, gravação30min, falha/crash, recuperação ou RegataOS.

## Primeira extração limitada — 2026-10-15

Somente `audio_to_mono` foi adaptado em
[downmix.rs](../crates/speech-core/src/downmix.rs), mantendo origem/commit/copyright
e [MIT completa](../crates/speech-core/LICENSE-MEETING-COPILOT). Não importar
audio_processing inteiro. Políticas AverageAll/FirstStereoPair explícitas: heurística
mic-array do original não descarta canais do sistema silenciosamente. Canais1–32,
frame completo, orçamento de frames e teto provisório1.048.576floats de entrada;
valores finitos conferidos em TODOS canais antes de alocar saída. f64 evita overflow
intermediário ao somar f32 finitos; não há clipping/ganho/filtragem.

Mantém taxa e número de frames; não faz16kHz, layout-aware surround, resampling,
delay/flush ou buffering entre chunks. Partição só em fronteira de frames completos;
caller futuro retém bytes/amostras parciais. Média estéreo pode cancelar antiphase,
limite inerente que não foi ocultado por teste de voz ou fallback de canal.
7testes novos,21totais Rust debug/release/clippy/fmt aprovados offline. Sem dependência
nova/Cargo.lock alterado, downloads, runtime, captura, modelo ou extração VAD/provider.
Etapa04 ainda NÃO concluída; qualificação de fala pt-BR/normalização segue pendente.
