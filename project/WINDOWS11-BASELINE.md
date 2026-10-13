# Baseline Windows — etapa 01

Data: 2026-10-13. Branch `feat/windows-baseline-identity`, baseada em
`023b30c1719c58d7411b26e1757aec9e2173f98d`. Versão local `0.1.0-alpha.1`.

**Parcial, não homologada.** Este é um pacote de desenvolvimento gerado localmente,
não um artefato CI aprovado, um instalador público ou uma release candidate.
A captura e os codecs ainda são os herdados; meeting-copilot permanece congelado.

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

## Alerta nativo reproduzido

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

Próxima investigação: observar PTS/duração antes/depois do encoder e na fronteira
dos fragments, comparar container e input DXGI sem trocar o padrão global, corrigir
com regressão e repetir 10 minutos sob carga com marcadores visuais/sonoros.

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

Revisão GitHub: checkpoint em branch, não aceito para merge/release. O erro do
teste nativo precisa ser resolvido antes do PR de conclusão da etapa 01. CI
remota e hash Nix do lockfile renomeado ainda não foram revalidados neste checkpoint.

Pendentes: rodada completa capture-to-export pelo HUD, texto pequeno/movimento,
fala e playback neutro, pós-transcrição com modelo real, estabilidade 30/60 minutos,
sincronia sob carga, DPI misto, segundo monitor, troca de dispositivos, RegataOS,
assinatura/distribuição. Nada disso é aprovado por um simples build ou mock de CI.
