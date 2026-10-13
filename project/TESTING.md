# Estratégia de testes e aceite

Este documento define testes futuros. Os testes efetivamente executados ficam em
[STATUS.md](STATUS.md). Um teste escrito na tabela não equivale a resultado aprovado.

## Evidência mínima por execução

Commit do app e de cada helper, Windows/build ou distribuição/desktop, CPU/GPU,
driver, RAM, dispositivos/roteamento, codec/provedor/modelo/idioma, resolução/fps,
perfil e conteúdo utilizado. Registrar comando, duração útil, bytes finais, latência,
uso máximo de RAM/VRAM/CPU/GPU e problemas observados.

Usar material de teste autorizado. Não enviar gravações de reuniões reais nem
transcrições privadas para CI, issues públicas ou ferramentas de avaliação remota.

## Matriz

| Área | Casos obrigatórios |
|---|---|
| Seleção | Monitor, janela, retângulo, cancelamento, janela fechada/minimizada |
| Geometria | DPI 100/125/150/200%, monitores com DPI distinto, origem negativa, rotação |
| Áudio | Só sistema, só mic, ambos, nenhum, sem sinal, dispositivo errado |
| Roteamento | Teams/Slack/YouTube; comunicação vs console; fone USB/Bluetooth |
| Dispositivos | Desconectar/reconectar, mudar padrão, alterar sample rate |
| Encoder | AV1 real, hardware sem AV1, fallback, competição com GPU do ASR |
| Conteúdo | Texto pequeno/slides/código, rolagem, webcam e movimento intenso |
| Duração | 5 min para smoke; 30 min para orçamento; 60 min para estabilidade |
| ASR | pt-BR, silêncio, fala contínua, sotaques, ruído, falas simultâneas |
| Sessão | Pausas múltiplas, stop durante inferência, ASR atrasado ou travado |
| Recuperação | Crash de sidecar, crash do app, disco cheio, cache no limite |
| Saídas | MP4 em player externo/editor, TXT/SRT/JSON, revisões e idempotência |
| Privacidade | Sem upload por padrão, logs sem conteúdo, arquivos com acesso local |
| Linux posterior | RegataOS real; KDE/portal, Wayland/X11, PipeWire e VAAPI |

## Métricas e metas iniciais

- Tamanho: <= 300.000.000 bytes para 1.800 segundos úteis no perfil compacto
  e cenários homologados. Medir arquivo final, não bitrate configurado.
- Qualidade: comparar com referência capturada equivalente, mesma região e resolução.
  VMAF/SSIM são evidência auxiliar, não substituem legibilidade de texto. Fixar
  o limiar por corpus no spike, antes de declarar aprovação.
- Sincronia: usar marcador visual/sonoro conhecido; alvo inicial de drift <= 250 ms
  no início e no fim. Tempos estimados de ASR não são precisão fonética garantida.
- Desempenho ASR: RTF = tempo de inferência / duração de áudio. Para acompanhar ao vivo,
  RTF sustentado < 1, com folga no hardware alvo.
- Latência final P50/P95 medida do fim da fala ao evento final persistido; primeira
  meta experimental P95 <= 10 s. Se não atender, mostrar atraso e revisar perfil/modelo.
- Memória: filas limitadas por bytes; não crescer proporcionalmente à duração da sessão.
- Resiliência: falha ASR preserva captura; revisões e replay não duplicam finais;
  gaps aparecem no JSON e na UI, sem texto inventado.

Metas acima são critérios de projeto, não medições já obtidas. Não extrapolar
benchmark offline AV1 para captura + ASR concorrentes.

## Camadas automatizadas

1. Rust unit: resampling, VAD, máxima duração, dedup, fonte/época, cancelamento.
2. Contratos TS/Rust: versões, limites, seq, revision, inteiros 64 bits, payload inválido.
3. Sessão: pausas e conversão de relógio, sourceEpoch, checkpoint e replay idempotente.
4. Integração: PCM fixture -> sidecar -> journal -> SRT/JSON esperado.
5. Falhas: processo morto, pipe rompido, slow consumer, disco cheio e cache limitado.
6. Regressão OpenScreen: typechecks, lint, unit tests, editor/exportação.
7. Nativo real: WGC, WASAPI e encoder em máquina Windows, fora dos mocks de CI.

## Comandos da fundação

```powershell
npm run docs:check
npm run lint
npx tsc --noEmit
npx tsc -p tsconfig.test.json --noEmit
npm test
git diff --check
```

Instalar dependências não compila automaticamente os helpers nativos. Binários
emprestados ou antigos não validam código novo: registrar seus hashes/builds.
Os testes do vendor não são executados como testes do app raiz; o core extraído
terá seu próprio alvo e CI quando existir.
