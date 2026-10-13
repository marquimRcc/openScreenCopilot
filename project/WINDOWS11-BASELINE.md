# Baseline Windows — etapa 01

Data: 2026-10-13. Branch `feat/windows-baseline-identity`, baseada em
`023b30c1719c58d7411b26e1757aec9e2173f98d`. Versão local `0.1.0-alpha.1`.

**Parcial, não homologada.** Este é um pacote de desenvolvimento gerado localmente,
não um artefato CI aprovado, um instalador público ou uma release candidate.
A captura e os codecs partem dos herdados; a correção temporal abaixo modifica o
helper Windows. meeting-copilot permanece congelado.

## Ambiente observado

| Item | Observado |
|---|---|
| Sistema | Windows 11 Pro x64, 10.0.26300, build 26300 |
| CPU | Intel Core Ultra 5 125U, 12 cores / 14 processadores lógicos |
| GPU | Intel Graphics; driver 32.0.101.8826 |
| RAM | 31,5 GiB reportados pelo Windows como memória física instalada |
| Áudio enumerado | JBL Quantum 350 Wireless, Intel Smart Sound (USB/digital mic/Bluetooth), Senary Audio |
| Node/npm do projeto | 22.22.1 / 10.9.4, execução temporária, sem trocar o runtime global |
| C++ | Visual Studio Build Tools 2022 17.14.41, MSVC 19.44.35229, SDK 10.0.26100 |
| CMake/Ninja/LLVM | Ferramentas existentes do VS; libclang existente em LLVM |
| Rust | Toolchain MSVC existente, compositor compilado em modo release |

Não inferir AV1 disponível, VRAM real ou velocidade de ASR apenas pelo nome da GPU.
Nomes de máquina, IDs de endpoints e caminhos pessoais ficam fora deste relatório público.

## Identidade e distribuição

- Nome: `openScreenCopilot`; appId: `io.github.marquimrcc.openscreencopilot`.
- Perfil packaged: `%APPDATA%/openScreenCopilot`; dev: `%APPDATA%/openScreenCopilot-dev`.
- SessionData Chromium: subpasta `chromium` do perfil correspondente.
- Inicialização ocorre antes dos imports que calculam caminhos e do lock de instância.
- Atalho padrão: Ctrl+Shift+Alt+O, distinto do upstream. Projetos `.openscreen`
  continuam compatíveis; não foi registrada associação de arquivo/protocolo do upstream.
- `publish: []`, `SELF_UPDATE_ENABLED=false`, download/install bloqueados antes de
  importar electron-updater. Menus/timer de atualização desativados.
- Hooks de descoberta AppImage desconectados. Comando `build:win:store` recusa uso;
  identidade AppX é um placeholder próprio, não credencial Partner Center registrada.
- Licenças e atribuições upstream permanecem. Não há certificado de assinatura.

## Build local

Comandos npm executados com Node 22.22.1 / npm 10.9.4. CMake/Ninja do VS foram
disponibilizados somente ao processo de build, sem modificar o PATH do Windows.

1. `npm run build:native:win`: executáveis compilados; suites utilitárias passam,
   mas o comando termina com erro no teste hardware descrito abaixo.
2. `npm run fetch:ffmpeg`: artefatos LGPL fixados, hash/licença verificados.
3. `npm run build:native:compositor`: sucesso; avisos Rust herdados.
4. `npm run fetch:onnxruntime` e `npm run stage:vcomp`: sucesso.
5. Whisper CPU via CMake Visual Studio, `OSC_ENABLE_VULKAN/METAL/CUDA=OFF` e
   `OSC_NATIVE_CPU=OFF`; código fixado em whisper.cpp v1.9.1. EXE e DLLs
   correspondentes copiados juntos. Isso **não** demonstra aceleração GPU ou ASR completo.
6. `npm run build-vite` e `npm run licenses:generate`: sucesso.
7. `electron-builder --win --dir --publish never --config.npmRebuild=false`: sucesso,
   guardas de payload aplicadas. Pacote local não assinado; não foi instalado/publicado.

O empacotamento direto do item 7 serve somente à investigação local. Ele não anula
o erro de `build:native:win` nem constitui caminho de release com teste ignorado.

| Artefato local | SHA256 |
|---|---|
| wgc-capture.exe | 85941406691cf65dc3525c4062f9adafe7e079a046833d87ba559ceae7631d1f |
| compositor_view.node | 667d270cd8c00c4175e31e127c0ef872665b6c98a06695103cd65192bdc1a5bc |
| whisper-stt-server.exe | dd36d97a0a4dcb9be6042c174aef945f50d77498f573bd06faae0565c02c066c |
| openScreenCopilot.exe | a142a1c7b12996ed9779c7ac07e1cf7b4e346a84496ac804ad9ecd06484c91bf |

## Resultados automatizados e captura curta

| Verificação | Resultado |
|---|---|
| Biome | Sem erros; 26 avisos herdados |
| TypeScript app / testes | Ambos aprovados |
| Traduções | 15 locales / 7 namespaces aprovados |
| Suíte unitária final | 335 arquivos, 4.732 testes aprovados, 5 ignorados, 0 falhas; 248,76 s |
| Snapshot vendor | Nenhuma alteração |
| Captura WGC curta | Janela Paint vazia, sistema + microfone, sucesso; stop 173 ms |

Comando da captura: `npm run test:wgc-helper:win -- --window --system-audio --microphone`.
Helper hardware H.264, input CPU RGB32, container fragmented MP4. Dispositivo
de mic reportado: JBL Quantum350 Wireless. Dados de ffprobe:

- Vídeo: 1518×952, 30 fps, High, BT.709 limited; duração 5,033800 s.
- Áudio: AAC LC, 48 kHz, estéreo; duração 5,034667 s.
- Arquivo: 460.913 bytes; primeiro frame não preto.
- Diferença de duração entre streams: 0,867 ms. Isso não mede lip sync.
- Mix muito baixo: média −78,3 dBFS, pico −39,1 dBFS. Não houve fala/tom de
  referência; portanto não comprova inteligibilidade ou presença de ambas as fontes.

Vídeo/áudio permanecem locais, fora do Git. Janela vazia e 5 s não representam
reunião real: não extrapolar tamanho, qualidade, estabilidade ou drift de 30 minutos.

## Alerta nativo reproduzido — checkpoint anterior, resolvido abaixo

`mf_encoder_color_test.exe`: 22 testes, 21 passam e 1 falha, em duas execuções.
Cores BT.709, High profile, ausência de B-frames e repetição de frame passam no
hardware e software disponíveis. O caso de timestamps usa 160 frames, cadência
efetiva diferente da taxa nominal e uma lacuna deliberada de 300 ms.

- Software: 160/160 frames, erro máximo de PTS aproximadamente zero.
- Intel hardware: 160/160 frames, erro máximo de PTS **325 ms**.
- Falha: `sample-times-kept-default`. Não é falha de compilação.

A causa exata dentro do MFT/driver/muxer não foi determinada. Não atribuir ao driver
sem isolar o pipeline. Também não extrapolar esse erro sintético como drift medido
de toda reunião real. É uma evidência concreta de que este caso temporal não passa.

Esse resultado histórico foi preservado. A investigação e a correção posteriores
estão registradas a seguir; não extrapolar o ensaio sintético para reuniões longas.

## Correção temporal e validações adicionais — 2026-10-13

Na configuração testada, a duração entregue depois do encoder hardware não
preservava a duração de entrada, inclusive nas fronteiras de fragmentos MP4.
A observação isolou a divergência de metadados nesse pipeline; não identifica
uma falha universal de todo driver Intel. Habilitar low-latency não corrigiu e
foi revertido. Não foi necessário desativar hardware, fragmentação ou testes.

Foi adicionada uma camada de sink que repõe a duração original de cada sample
de vídeo pela correspondência exata de PTS antes do muxer. PTS e áudio não são
reescritos. Samples sem correspondência e pendências no finalize são erros;
a tabela é limitada a 512 entradas, com sincronização separada do writer.

Um segundo problema era de build: MSVC em português emitia o prefixo de includes
com codificação diferente da armazenada pelo Ninja. Headers não eram rastreados
corretamente e um build incremental misturou layouts de classes. O script agora
usa UTF-8 antes da configuração e invalida somente seu build gerado antigo.

| Ensaio real do encoder | Antes | Depois |
|---|---|---|
| 160 frames, taxa efetiva diferente da nominal e lacuna de 300 ms | Hardware: 325 ms de erro máximo | Hardware e software: 160/160; erro numérico aproximadamente zero |
| 240 frames, jitter e lacunas de 200/1.400/350 ms | Novo caso de regressão | Hardware e software: 240/240; erro máximo 0,0083 ms |
| Suíte encoder (cores, perfil, B-frames, repetição e tempos) | 21/22 | 33/33, incluindo novos testes de metadados |

`npm run build:native:win` passou por completo, incluindo testes de áudio, webcam,
visibilidade, relógio e encoder. Hash do WGC **somente com a correção da etapa 01**:
`d28621a0222aa93dd373b73affcdb5411a3f4034f317bba4069120ffcdfd1ed9`.
O pacote local foi regenerado com esse helper, sem assinatura/instalação/publicação.
Os hashes na tabela de build acima pertencem ao checkpoint anterior.

Validações adicionais, todas com conteúdo sintético próprio e arquivos locais:

- Timeline WASAPI: silêncio inicial, tom de 440 Hz solicitado aos 4 s, início
  detectado aos 4,7 s em faixa de 10,84 s; passou na tolerância de 1 s do teste.
  Inclui latência do player: não é uma medição precisa de lip sync.
- Whisper small-q8_0 + Silero, downloads com SHA verificado: fala pt-BR de
  12,788 s, 24 palavras, 3 intervalos VAD, WER 0; 3,46 s em CPU, RTF 0,270.
  Tempos por palavra, backend, idioma e guardrail DTW passaram. Alinhador CTC
  português não disponível: teste correspondente ignorado explicitamente.
- Exportação pelo runner CLI do aplicativo empacotado, usando o mesmo compositor
  Rust da interface: projeto v2, vídeo sintético 720p/30 e fala pt-BR, saída
  1080p/30 H.264 High (`h264_qsv`) + AAC LC 48 kHz estéreo. Sucesso, 13.506.131 bytes,
  vídeo 12,733333 s / áudio 12,766000 s. Diferença de duração de 32,667 ms não é
  lip sync. O log registra corte final de 22 ms da fonte disponível.
- Fala extraída do MP4 exportado: WER 0 novamente, 3,61 s em CPU, RTF 0,283;
  confirma inteligibilidade dessa amostra depois da exportação.

Comandos adicionais: `npm run test:wgc-audio-timeline:win`,
`npm run test:whisper-stt -- --wav <fixture-16k.wav> --language pt --cpu --ref <texto>`,
`openScreenCopilot.exe export <fixture.openscreen> --out <saida.mp4> --quality good --fps 30 --json`.
O novo `--cpu` é explícito no teste; a verificação GPU padrão não foi desativada.
Logs ficam em `.cache/`, ignorados pelo Git. Nenhuma fala/MP4 foi enviado ao GitHub.

## Validação de interface e lacunas

Computer-use, aplicativo empacotado real: startup, controles em pt-BR, atalho
Ctrl+Shift+Alt+O, abertura do editor por Ctrl+O, wordmark próprio, versão
`0.1.0-alpha.1` e menu sem Check for Updates. Exportar sem projeto fica desabilitado.

O HUD é click-through: dois cliques foram bloqueados pelo controlador porque a
janela por baixo recebia o hit-test. Não foram convertidos em cliques injetados
no DOM; a acessibilidade/leitura não prova alcance de mouse do HUD. O menu opaco
do editor foi acionado por input real. O flag de proteção de conteúdo foi
desativado só na execução de QA e deve ficar ausente em gravações de uso real.

O seletor nativo de importação abriu na pasta de gravações própria, mas o
controlador continuou reportando foco na busca, mesmo após tentar focar Nome.
Nenhum caminho foi digitado sem confirmar foco. A importação foi cancelada com
Escape; preview/exportação com mídia não foram validados nessa execução.

Na tentativa de nova rodada visual após recompilar, o controlador não conseguiu
ativar a janela mesmo após uma recuperação. A rodada foi interrompida, sem
substituir os cliques do Windows por eventos DOM. Foi solicitado ao usuário que
deixe a área de trabalho e a janela acessíveis. Não há novo passe visual aprovado.

Revisão GitHub: checkpoint em branch, não aceito para release. A regressão temporal
foi corrigida, mas falta fechar o aceite manual. O [PR 2](https://github.com/marquimRcc/openScreenCopilot/pull/2)
permanece draft. O hash Nix renomeado foi recalculado pelo prefetch remoto e
corrigido em `eb058f12`; o job Nix da nova execução passou. Os demais checks da CI
devem estar todos verdes antes de merge; resultados intermediários em [STATUS.md](STATUS.md).

Pendentes: rodada completa capture-to-export pelo HUD, texto pequeno/movimento,
fala e playback neutro capturados pelo HUD, pós-transcrição pela interface,
estabilidade 30/60 minutos,
sincronia sob carga, DPI misto, segundo monitor, troca de dispositivos, RegataOS,
assinatura/distribuição. Nada disso é aprovado por um simples build ou mock de CI.
