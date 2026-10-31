# Contratos propostos v0

Proposta para o primeiro spike; existe somente um handshake executável v0 estrito
`hello -> ready -> shutdown -> completed`, ainda sem provider/PCM/engine.
Congelar v1 somente após um teste ponta a ponta Electron -> sidecar -> exportação.

Detalhamento ainda v0 do relógio/amostras/pausas e fixtures iniciais em
[SPEECH-TIMELINE-DRAFT.md](SPEECH-TIMELINE-DRAFT.md). Não são campos já emitidos
pelo backend Windows ou uma autorização para conectar PCM sem mapa validado.

Descritor binário CANDIDATO agora tem parsers/fixtures isolados nos dois lados:
[AUDIO-FRAME-DRAFT.md](AUDIO-FRAME-DRAFT.md). Não é transporte ativo/v1 congelado;
IDs/nonce não concedem permissão; adaptador isolado TSv0 agora recusa epochu64
acima deMAX_SAFE_INTEGER antesNumber,semarredondar. Isso não congela wirev1 nem
liga parser/adapter à captura; ver limites emAUDIO-FRAME-DRAFT.

## Transporte e isolamento

Preparação isolada Rust control_lines.rs enquadra UTF-8/LF/CRLF com limite por linha
e contrapressão de1mensagem. O executável `crates/speech-sidecar` abre somente
stdin/stdout, valida JSON/schema/version/identidade ASCII limitada/seq u64 decimal
monotônica e falha fechado. Aceita apenas um hello e shutdown correspondente,
anuncia `providerAvailable:false` e não abre pipe/socket/PCM/modelo. Nonce não é
autenticação; ACL, timeout e supervisão pelo host seguem pendentes. Caps e v0 não
são negociação v1 congelada. Fixture compartilhada Rust/TS cobre ready/completed;
o parser TS main-only valida campos exatos/identidade/u64/capacidades, mas não
spawna nem autentica processo. Correlação stateful recusa ready/completed fora de
ordem, replay ou outra sessão e exige seq exata de hello/shutdown. Detalhes nos
READMEs dos dois crates. Decoder TS isolado de linhas aplica o mesmo teto por
mensagem, UTF-8 fatal, LF/CRLF e contrapressão de uma mensagem com buffer fixo;
encoder TS valida identidade ASCII limitada e u64 canônico antes de emitir
hello/shutdown exatos. Driver de stream TS compõe framing e correlação sem fila,
falhando fechado em protocolo/ordem/EOF. Controlador isolado acrescenta deadlines
de handshake/shutdown e abort tipado. Ainda não inicia ou supervisiona processo.
Binding isolado pode anexar um processo já criado ao supervisor por geração,
preserva recibo de saída observada e encerra em stdout inválido/prematuro; spawn,
caminho autorizado e ACL continuam pendentes.
Stderr é drenado separadamente para buffer diagnóstico fixo de4KiB; nunca entra
no framing stdout nem cresce sem limite.
Launcher dormente recebe caminho absoluto autorizado pelo main, canonicaliza e
spawna sem shell/argumentos; não está ligado ao startup e ainda não define ACL.
Teste de integração opt-in confirmou handshake e saída real TS→Rust→TS; não é
ativação do sidecar no produto nem prova de provider/PCM/ASR.
Resolver isolado limita o executável ao slot exato dev/empacotado por plataforma e
arquitetura, canonicaliza e retorna indisponível quando ausente, sem busca em PATH.
Gerador isolado usa valores aleatórios distintos de192bits para session/nonce; nonce
continua correlação e não substitui ACL/autenticação do SO.

- Controle e eventos: NDJSON UTF-8 em stdin/stdout do sidecar supervisionado pelo main.
- Logs técnicos: stderr, nunca misturados com mensagens do protocolo.
- Áudio: canal binário dedicado, pipe local Windows / socket local Unix. Evitar base64,
  áudio no renderer, servidor TCP aberto e novas portas públicas.
- ACL/permissões limitadas ao usuário e processo da sessão; identificador aleatório
  de sessão e handshake com nonce. Definir ameaça de processos do mesmo usuário:
  nonce não substitui ACL ou isolamento do SO.
- Handshake negocia versão, capacidades, formatos, limites e tamanho máximo de frame.
  Versões incompatíveis falham antes do início de ASR.
- Todas as mensagens têm version, type, sessionId, seq e requestId quando são respostas.
  Validar schemas, tamanho, limites numéricos e strings em ambas as linguagens.

## Comandos e eventos

| Direção | Mensagem | Significado |
|---|---|---|
| Host -> sidecar | hello / prepare | Negociar; carregar provider/modelo/idioma |
| Host -> sidecar | start | Abrir sessão e fontes habilitadas |
| Host -> sidecar | pause / resume | Delimitar intervalos com posição de amostras |
| Host -> sidecar | drain | Não aceitar áudio novo; terminar até watermark por fonte |
| Host -> sidecar | cancel | Interromper ASR sem destruir a gravação |
| Sidecar -> host | ready / credit | Disponibilidade e orçamento de áudio em voo |
| Sidecar -> host | accepted / checkpoint | Áudio recebido vs resultado duravelmente confirmado |
| Sidecar -> host | transcript.partial / transcript.final | Revisões de um segmento identificado |
| Sidecar -> host | lag / gap / error / completed | Atraso, lacuna explícita, falha, término |

Transport ACK não autoriza apagar áudio. O host confirma persistência do resultado
e avança um checkpoint por fonte; só esse checkpoint autoriza limpeza conforme retenção.

## AudioFrame

Cabeçalho binário com tamanho fixo/versionado, endian explícito e comprimento validado:

- sessionId, sourceId (`system` ou `microphone`), sourceEpoch, sequence;
- sampleRate, channelCount, sampleFormat (`f32le` inicialmente);
- sampleStart (inteiro por fonte/época), frameCount;
- captureMonotonicNs, payloadBytes e sinalizadores de descontinuidade.

Registrar formato original no manifest. Resampling para 16 kHz mono fica no core
ASR; a captura/mix do vídeo não precisa perder qualidade para acompanhar o ASR.
Inteiros de 64 bits atravessam JSON como strings decimais para não perder precisão
em JavaScript. PCM binário não atravessa essa limitação.

Fila limitada por bytes e tempo de áudio, com créditos; um teste deve demonstrar
memória estável quando ASR fica mais lento que a captura. Reconexão retoma do último
checkpoint confirmado usando os mesmos IDs. Lacunas são eventos, nunca silêncio inventado.

## Segmento

Exemplo ilustrativo de evento final; não pressupõe diarização nem precisão por palavra:

```json
{
  "version": 0,
  "type": "transcript.final",
  "sessionId": "example-session",
  "seq": 42,
  "segment": {
    "id": "system-0-0007",
    "revision": 2,
    "source": "system",
    "sourceEpoch": 0,
    "startMs": 12500,
    "endMs": 16800,
    "sourceSampleStart": "600000",
    "sourceSampleEnd": "806400",
    "text": "Vamos revisar a gravação.",
    "language": "pt",
    "final": true
  }
}
```

`startMs/endMs` referem-se à linha de mídia, não ao horário civil.
A taxa original deste exemplo é 48 kHz; o mapeamento inclui as pausas da sessão.
O par `(sessionId, segment.id)` é estável; revision cresce. Repetições idênticas
são idempotentes, revisões antigas são ignoradas e inconsistências são reportadas.
Não inventar confidence se o provider não a produz de forma comparável.

## Segmentação e exportação

VAD não pode esperar silêncio indefinidamente. Impor duração máxima de segmento,
sobreposição curta e deduplicação por tempo/texto. Preservar contexto sem emitir
duplicatas no SRT. Timestamps por palavra são capacidade opcional do provider.

TXT agrupa finais por tempo com identificação de fonte. JSON preserva IDs, revisões
finais, fontes, modelo e metadados. SRT exige ordenação determinística; falas simultâneas
podem formar uma única cue multilinha identificada por fonte. Não deslocar timestamps
para fingir ausência de sobreposição. UI distingue parcial de final.

O manifest inclui schemaVersion, upstream/build, endpoints, codec efetivo e razão
de fallback, limites, modelo/licença, idioma, intervalos, checkpoints, arquivos,
gaps e estado por subsistema. Caminhos são relativos à pasta da sessão e validados:
sem traversal, sem comandos de shell construídos a partir de nome de dispositivo.
