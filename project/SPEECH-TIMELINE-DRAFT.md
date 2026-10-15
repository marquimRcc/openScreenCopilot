# Relógio speech-core — rascunho v0

Preparação da etapa04, não protocolo v1 congelado nem API/runtime implementado.
Captura Windows atual NÃO fornece estes mapas. Não conectar PCM ao sidecar usando
timestamps de chegada, frameIndex/FPS ou os campos WASAPI atuais como substitutos.
Ver [CONTRACTS.md](CONTRACTS.md), [inventário](SPEECH-CORE-INVENTORY.md) e
[evidências do relógio](WINDOWS11-REGION-DEVICES.md). Vendor permanece imutável.

## Três domínios distintos

- Dispositivo: contador de frames por canal e época da fonte. Um frame estéreo
  contém duas amostras escalares; frameCount NÃO é quantidade de floats.
- Mídia: nanossegundos relativos ao início da sessão, com pausas já removidas.
  É o domínio destinado ao MP4/SRT, não o relógio civil nem tempo de inferência.
- ASR: índices de amostras mono16kHz de cada trecho normalizado. O resampler/VAD
  deve preservar o vínculo ao domínio de origem, inclusive atraso/buffering/flush.

sessionId/sourceId/sourceEpoch identificam a origem; um contador isolado não basta.
Troca de endpoint, reset de contador ou formato abre época nova. O host mantém
um registro de trechos mapeáveis; pausas/lacunas NÃO viram fala ou silêncio criado
pelo ASR. Reconexão do sidecar não cria uma época de captura nova por si só.

## Trecho mapeável proposto

Um trecho representa frames contínuos em formato fixo, sem pausa/descontinuidade:
sourceSampleStart inclusivo, sourceSampleEnd exclusivo, sampleRate inteiro e
mediaStartNs relativo à sessão. Todos os contadores/tempos64-bit são strings
decimais canônicas no JSON; cálculo usa inteiros largos (BigInt/inteiro Rust
com overflow verificado), nunca conversão intermediária para Number/f64.

Para uma fronteira de amostra s dentro do trecho, incluindo a fronteira final:

```text
mediaNs(s) = mediaStartNs + floor((s - sourceSampleStart) * 1_000_000_000 / sampleRate)
```

Fronteiras usam a mesma função, não duração arredondada acumulada por chunk.
Arredondamento inferior tem erro menor que1ns por fronteira. Exportar milissegundos
é outra conversão feita no final; não reinjetar tempos SRT arredondados no journal.
O mapeamento nominal não resolve drift de clock físico: adaptador precisa medir
âncoras e definir tolerâncias antes da integração. Não esticar fala silenciosamente.

Exemplo: fonte48kHz capturou [0,144000), pausa física até240000, depois retomou
[240000,384000). O segundo trecho começa em mediaStartNs=3000000000, NÃO5s.
240000–288000 mapeia3–4s de mídia. Intervalo na pausa não tem mapa; intervalo
atravessando a pausa exige segmentação/reinicialização de contexto, não subtração
da pausa uma segunda vez. Trechos podem compartilhar a fronteira final/inicial,
mas nenhuma amostra pertence simultaneamente a dois trechos da mesma época.

Segmento final deve estar contido num trecho validado. Cruzamento de pausa/gap,
época errada ou sobreposição ambígua falha explicitamente. Não dividir texto já
inferido em dois timestamps inventados; o segmentador deve impedir esse cruzamento
antes da inferência. Fonte ausente/desconectada gera gap com motivo, não frase vazia.

## Resampler e VAD

Não mapear saída16kHz apenas multiplicando a razão das taxas: atraso algorítmico,
frames guardados e padding de flush precisam ficar explícitos. Cada buffer entregue
ao provider carrega seu mapa de origem válido; padding não conta como áudio capturado.
VAD do snapshot trabalha com índices absolutos16kHz da sua sessão. Adaptador precisa
declarar se o resultado é absoluto ou relativo ao buffer e aplicar offset uma vez.
Não adicionar processed_samples a timestamp Silero já absoluto.

Spike de arquivo rubato0.15 mediu convenção específica: output_delay46/42frames
de saída NÃO é prefixo de zeros removível. Retirá-lo adiantou impulso; primeiro
bloco é menor nessa configuração. Rampa corrigida pelo ganho DC aponta offset
~1,76/~2,01frames de ENTRADA (44.1/48k), diferente de atraso de disponibilidade.
Medição f32/ganho ripple não congela origem exata de PTS. Não ligar contador16k
diretamente a44.1/48k nem subtrair output_delay sem mapa/phase convention validado.
São testes isolados, não timestamp já emitido pelo capture/normalizador runtime.

Pause/gap encerra ou descarta parcial com estado explícito; resume começa contexto
novo sem colar a fala anterior através da descontinuidade. Fontes sistema/mic têm
mapas independentes e podem sobrepor em mídia; isso não representa duplicata.

## Ordenação, créditos e durabilidade

Uma chave de frame inclui sessão/fonte/época/sequence. Repetição byte-a-byte pode
ser idempotente; mesmo ID com payload/mapa diferente é corrupção, não atualização.
Contadores, tamanhos, formato, limite negociado e mapa são validados ANTES de alocar
payload. Proibir NaN/Infinity em PCM e controlar comprimento real vs frameCount.

Crédito limita bytes E frames em voo por fonte e globalmente. Accepted libera
somente transporte, nunca prova resultado durável. Checkpoint de recuperação inclui
áudio/journal/mapa e resultados persistidos: um watermark de sequence sozinho não
autoriza remoção de PCM. Buraco impede avanço de watermark contíguo; resultado fora
de ordem pode ser persistido sem apagar o áudio anterior. Política de retenção/disco
e limites numéricos ainda serão medidos/negociados, não definidos por este rascunho.

Drain recebe fronteira final por fonte/época; completed exige cobertura explícita
por finais ou gaps persistidos até essa fronteira. Cancel invalida emissão nova,
aguarda inferência/writer encerrarem e não apaga MP4. Crash continua recuperável
apenas quando journal/manifest estiverem implementados; não prometer isso hoje.

## Fixtures iniciais e próximos gates

[Fixture compartilhável](../contracts/copilot/source-timeline.v0.fixture.json)
tem contadores decimais,48/44,1kHz, início acima de2^53, pausa removida uma vez,
época incompatível, gap e cruzamento. Não inclui áudio/texto privado ou modelo.
Sua aritmética foi conferida por runner Node privado com BigInt e pelo módulo
isolado [sourceTimeline.ts](../electron/copilot/sourceTimeline.ts), ainda NÃO importado
pelo runtime. Ele verifica u64 decimal canônico, epoch/rate e overflow, mapeia
intervalo contido em exatamente um trecho sem interseção ambígua e não acumula
arredondamento por chunk. Taxa1–192000 é guarda provisória de aritmética, não
negociação ou declaração de suporte a hardware. Não valida registro global de
sessões/mapas, formato de transporte ou autorização; o caller precisa isolar uma
sessão/fonte. A versão Rust isolada em
[speech-core](../crates/speech-core/src/lib.rs) agora executa as mesmas oito fixtures
JSON, usando u128 intermediário e saída u64 verificada. Sete testes Rust incluem
fixtures/overflow/canonicalidade/ambiguidade/partições em sete taxas e contadores
próximos de u64::MAX, aprovados debug/release. Isso prova equivalência da
aritmética nessas fixtures, NÃO transporte/IPC/ASR ou validação global de mapas.
Ainda faltam propriedades amplas, parser binário e interoperabilidade de processos.

O crate tem workspace/lock próprios, sem alterar compositor/workspace/vendor;
biblioteca usa apenas std. serde_json1.0.150 é dependência de TESTES, resolvida
offline de cache existente. Nenhuma função meeting-copilot foi copiada nesta base
aritmética original; futura extração ainda precisa manter licença/proveniência.
Não há build.rs, Tauri, ONNX, Whisper, dispositivos, inferência ou sidecar executável.

## Registro limitado isolado (preparação, não runtime)

[timeline_registry.rs](../crates/speech-core/src/timeline_registry.rs) acrescenta
registro de metadados para UMA sessão, fontes identificadas por igualdade exata
(sem normalizar/case-folding) e intervalos append-only. Consultas/insert de outra
sessão falham; fontes sistema/mic com mesmos contadores não se misturam. Isso não
autentica o caller nem concede acesso a PCM: IDs vindos do renderer não se tornam
confiáveis por passar no registro.

Insert valida aritmética/overflow do trecho inteiro antes de copiar dados. Rejeita
overlap de amostras, época regressiva, taxa alterada dentro da mesma época e tempo
de mídia anterior ao fim da fonte. Época nova permite reset de contador/taxa, mas
não de mídia. Gaps são permitidos sem inventar áudio; uma query atravessando gap
continua falhando na aritmética existente. Fontes diferentes podem se sobrepor
em mídia, o que não é duplicata.

Mesmo source/epoch/start com conteúdo idêntico é replay sem nova capacidade;
conteúdo diferente falha. Isso NÃO é deduplicação de frames/sequence/resultados ASR.
Limites configuráveis positivos têm tetos provisórios64fontes/4096trechos e IDs
128bytesUTF-8. Todos são guardas deste protótipo, não créditos wire negociados,
suporte a hardware ou promessa de duração. Atingir limite retorna erro, sem evict,
sem apagar mapas antigos e sem reservar fonte por um insert rejeitado. Sem journal,
persistência, retry automático, locks globais ou registro de sessões do app.

14testes Rust debug/release (7originais+7registro), clippyalltargets-Dwarnings e fmt
passaram offline/locked. Não há contraparte de registro TS/fixture wire ou import
runtime. A suíte TS e o pacote não mudam por esta biblioteca independente; não
reconstruir compositor como se dependesse dela. Normalização/VAD/provider e âncoras
do backend continuam pendentes antes de qualquer PCM ao vivo.

Antes de congelar v1: escolher layout/limites binários, produzir âncoras no capture
backend sem bloquear MP4, provar flush/resampling sob partições, implementar journal
limitado e executar fixture idêntica nos dois lados. Depois PCM de arquivo/pt-BR,
cancelamento/reconexão e finalmente captura ao vivo. Nenhuma dependência ou aceite
do roadmap foi dispensado por esse documento.
