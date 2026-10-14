# Situação e registro de execução

Data da inicialização: 2026-10-13.

## Implementado nesta etapa

- Fork GitHub OpenScreen criado como marquimRcc/openScreenCopilot.
- Snapshot completo meeting-copilot importado em vendor/meeting-copilot.
- Históricos conectados por merge com dois pais; sem squash.
- Licenças e conteúdo do snapshot preservados; submódulo legado não inicializado.
- Arquitetura proposta, decisões, contratos, requisitos, roadmap e testes registrados.
- Biome configurado para não tratar vendor como código do aplicativo raiz.
- Verificador de documentação ampliado para project, sem verificar arquivos de arquivo.
- Testes de regressão para links de project e exclusão do arquivo histórico.
- Dependência de teste @noble/hashes v2 declarada explicitamente, sem mudança de produção.
- Finais LF fixados também para JSON/JS/CJS/YAML no Windows.
- Guardas de repositório isolam workflows não auditados; CI e verificação de hash Nix permitidas.
- Hash Nix atualizado pelo valor esperado produzido no job remoto.

## Ainda não implementado

Homologação da seleção retangular, seletor novo de endpoint de saída, encoder AV1 na captura,
perfil de compressão por qualidade, core Rust extraído, sidecar novo,
transcrição durante gravação, persistência nova e homologação RegataOS.

Não há release ou instalador do fork aprovado. A presença do código dos dois projetos
no mesmo Git não significa que seus runtimes estejam integrados.

## Validações da inicialização

| Verificação | Resultado |
|---|---|
| Documentação | OK, 47 arquivos; links novos e arquivo histórico cobertos por testes |
| Biome | OK, sem erros; 26 avisos herdados |
| TypeScript aplicativo | OK, tsc --noEmit |
| TypeScript testes | OK, tsc -p tsconfig.test.json --noEmit |
| Regressões focadas | 4 arquivos / 39 testes aprovados |
| Regressões finais de scripts/workflows | 18 arquivos / 174 testes aprovados / 1 ignorado |
| Sintaxe de workflows | YAML válido; 39 jobs analisados |
| Suíte completa final | 331 arquivos aprovados; 4.702 testes aprovados, 6 ignorados |
| Runtime da suíte final | Node 22.22.1 / npm 10.9.4, Windows, maxWorkers=4 |
| Integridade do snapshot | Tree Git 8c1d5521283853c9d19e89c74bbe4ac34b27d822, igual ao original |
| Whitespace do código/documentação próprios | git diff --cached --check aprovado, excluídos vendor e arquivos históricos |
| GitHub Actions | Aviso inicial de desativação; execução observada após push/PR; política agora em CI-POLICY.md |

A primeira execução de dependências usou Node 24/npm 11 do sistema e scripts
desativados. Não foi o resultado de aceite: faltava o binário Electron e a
dependência de teste peer opcional. O binário oficial foi instalado, a dependência
foi declarada e a suíte foi repetida com o runtime fixado até passar.

Whitespace herdado no snapshot é preservado para manter identidade dos blobs.
Não foi "corrigido" nem reformado apenas para satisfazer o verificador do fork.

A suíte completa acima foi executada antes do ajuste final de automações.
As regressões finais de scripts/workflows passaram após esse ajuste.
A primeira CI remota aprovou lint, TypeScript, unit tests, build, AppStream,
Swift e verificações/testes Rust Windows/macOS/Linux; apontou somente o hash Nix,
cujo valor esperado foi aplicado. A nova execução deve validar essa correção.
A branch de inicialização é chore/bootstrap-openscreen-copilot, revisada no
[PR 1 do próprio repositório](https://github.com/marquimRcc/openScreenCopilot/pull/1).
Consulte [CI-POLICY.md](CI-POLICY.md) para a mudança de estado de Actions observada
e as guardas que impedem automações/destinos upstream de executar neste fork.

Não executados: captura nativa, ASR integrado, instalador, benchmarks 30/60 minutos,
RegataOS e Nix. Não há alteração nativa nesta etapa, nem alegação de homologação.
O hash Nix foi atualizado a partir do prefetch remoto; build Nix completo continua
fora do aceite desta etapa.

## Etapa 01 — execução em 2026-10-13

Branch: `feat/windows-baseline-identity`, base `023b30c1719c58d7411b26e1757aec9e2173f98d`.

- Inventário Windows/CPU/GPU/driver/áudio e toolchain registrado.
- Produto `openScreenCopilot`, appId próprio, perfis packaged/dev separados,
  cache Chromium próprio e novo atalho Ctrl+Shift+Alt+O.
- Auto-update bloqueado antes de carregar electron-updater, feed vazio,
  hooks AppImage desconectados e comando Store bloqueado.
- URLs de projeto, CODEOWNERS e metadados de manutenção apontam ao fork;
  avisos legais e autores originais preservados. Marca atualizada nas 15 línguas.
- Compositor Rust, WGC/cursor e Whisper CPU compilados localmente;
  FFmpeg LGPL e ONNX Runtime verificados pelos scripts de origem/hash.
- Pacote local `0.1.0-alpha.1` gerado com `--dir --publish never`; nenhuma instalação,
  publicação, assinatura ou atualização de software existente foi realizada.
- Abertura real, editor, idioma pt-BR, versão própria e ausência de atualização
  no menu conferidos com computer-use. Não equivale a captura/exportação homologadas.
- Qualidade passa a ter prioridade sobre teto fixo de tamanho, conforme o pedido
  atualizado; 300 MB/30 minutos não é mais critério obrigatório.

**Checkpoint inicial:** o teste nativo de timestamps falhou no encoder Intel
(erro máximo de 325 ms), reproduzido duas vezes. Essa falha foi corrigida no
checkpoint a seguir; o aceite manual da etapa continua pendente.
Resultados detalhados, hashes e lacunas: [WINDOWS11-BASELINE.md](WINDOWS11-BASELINE.md).

Suíte final desta etapa: 335 arquivos, 4.732 testes aprovados, 5 ignorados e
nenhuma falha, com Node 22.22.1/npm 10.9.4. Biome sem erros, 26 avisos herdados;
dois typechecks, i18n (15 línguas) e docs:check (48 arquivos) aprovados.
Captura curta WGC de janela, sistema + microfone: 460.913 bytes, H.264 30 fps,
AAC 48 kHz, vídeo 5,033800 s / áudio 5,034667 s. Material quase silencioso:
não comprova inteligibilidade, ambas as fontes separadamente ou estabilidade longa.

### Correções e validações adicionais

- Duração dos samples de vídeo restaurada por PTS entre MFT e muxer fragmentado,
  sem trocar encoder por software ou alterar áudio. Memória limitada e falhas explícitas.
- Corrigido rastreamento de includes MSVC/Ninja em Windows com toolchain português.
- Build nativo completo aprovado: 33/33 testes do encoder; tempos hardware/software
  aproximadamente zero no caso original e erro máximo 0,0083 ms no caso irregular.
- Timeline WASAPI com tom conhecido aprovada na tolerância do teste de 1 s.
- Whisper pt-BR real em CPU: 12,788 s de fala sintética, 24 palavras, WER 0,
  transcrito em 3,46 s. Não equivale à futura transcrição durante gravação.
- Exportação real pelo CLI do aplicativo e compositor Rust aprovada, 1080p/30,
  H.264 QSV + AAC. Fala do MP4 exportado novamente transcrita com WER 0.
- Não houve instalação, publicação de pacote, envio de gravações ou mudança de vendor.

**Pendente para aceitar 01:** fluxo completo por input real do HUD/editor, captura
sob carga com referência visual/sonora e estabilidade longa. A nova rodada visual
foi bloqueada pela impossibilidade de ativar a janela; foi solicitado acesso ao
usuário. CLI/export/helper não foram registrados como passe da interface.
CI remota e hash Nix ainda devem confirmar o checkpoint antes do merge.
Detalhes e limites: [WINDOWS11-BASELINE.md](WINDOWS11-BASELINE.md).

## Etapa 02 — fundação independente iniciada

Branch: `feat/windows-region-foundation`, sobre o checkpoint da etapa 01.
O aceite manual de 01 não foi dispensado: somente a parte independente de 02
foi iniciada enquanto a janela de QA estava inacessível, conforme autorização
do usuário para avançar.

- Crop D3D11 implementado no helper (pull e callback legado), sem resize e sem
  fallback para capturar conteúdo fora do retângulo. Região requer monitor explícito.
- Teste real de textura com WARP aprovado, comparação pixel a pixel e guardas.
- Contrato de coordenadas do futuro overlay aprovado em 18 testes (125%/150%,
  origens negativas, frações, cancelamento e entradas inválidas).
- Requests inválidos recusados pelo executável sem criar gravação.
- Regressão nativa de timestamps permanece aprovada: 33 testes do encoder.

**Atualização noturna:** seletor Região, arraste/confirmar/cancelar, IPC validado,
capacidade do helper e cursor recortado implementados em código/pacote local.
Ainda não homologados por input real; endpoint de saída e medidor seguem pendentes.
WARP/contratos não homologam recorte real WGC ou DPI misto físico.
Escopo, protocolo e próximos passos: [WINDOWS11-REGION-DEVICES.md](WINDOWS11-REGION-DEVICES.md).

Rodada final do workspace (01 + fundação 02): 337 arquivos, 4.752 testes aprovados,
5 ignorados, 0 falhas; 251,69 s. Regressões focadas: 3 arquivos / 34 testes.
TypeScript app/testes aprovados; Biome 0 erros / 26 avisos herdados; 15 línguas
aprovadas. Documentação da etapa 02 validada: 49 arquivos / links aprovados.
Snapshot vendor inalterado (`8c1d5521283853c9d19e89c74bbe4ac34b27d822`).

Entrega em branches separadas, sem push em main. O PR de 01 fica em draft até
concluir os aceites manuais; 02 depende de 01 e seu PR não será aberto para merge
antes de resolver essa base. Não habilitar CI/distribuição upstream para contornar
essa dependência; a CI existente valida o [PR 2 de 01](https://github.com/marquimRcc/openScreenCopilot/pull/2).
Na primeira execução, lint, ambos os typechecks, docs, build e AppStream passaram;
o job Nix identificou o hash alterado pela identidade do lockfile. O valor
`sha256-1t3UZ5qbn0S6NZnuW3z2hAhx4VpOGddRGnlkSho/YMk=` foi aplicado a partir
do prefetch remoto em `eb058f12`; a nova execução Nix
[38477762767](https://github.com/marquimRcc/openScreenCopilot/actions/runs/38477762767)
confirmou a correção. Na CI desse commit, lint, ambos os typechecks, docs, build,
AppStream, título e Swift passaram; unit tests e jobs Rust ainda estavam em execução
ao registrar este checkpoint. Não há alegação de CI totalmente verde ainda.
Isso não é build Nix completo nem homologação Linux/RegataOS.

## Pedido para a próxima versão — indicador persistente

Em 2026-10-13, durante o teste iniciado manualmente pelo usuário, foi solicitado
um contorno vermelho discreto e pontilhado mostrando a área realmente gravada,
visível ao longo de toda a tomada, sem aparecer no vídeo final.
Requisito e aceite registrados na etapa 02B em [WINDOWS11-REGION-DEVICES.md](WINDOWS11-REGION-DEVICES.md),
[REQUIREMENTS.md](REQUIREMENTS.md) e [TESTING.md](TESTING.md).
**Só planejamento:** nenhum código/runtime foi modificado, nenhuma gravação foi
reiniciada ou interrompida e o pacote atual ainda não possui esse indicador.

## Captura manual localizada e descoberta do arquivo — 2026-10-13

O usuário iniciou/encerrou uma captura de janela no pacote local e informou
que a imagem estava boa, mas não conseguiu descobrir onde o MP4 foi salvo.
Localização efetiva confirmada: `%APPDATA%/openScreenCopilot/recordings`.
Não houve cópia/upload da mídia nem modificação do aplicativo neste checkpoint.

- MP4: 90.424.882 bytes (90,4 MB decimais), 421,502533 s (7min01,5s), H.264 High,
  1480×940, BT.709 limited, taxa média aproximadamente 60 fps.
- Decodificação integral do vídeo aprovada; 25.286 packets, PTS estritamente
  crescentes, maior intervalo entre frames 86,017 ms, nenhum intervalo > 100 ms.
- **Nenhuma faixa de áudio**. O log da captura confirma sistema e microfone
  desativados; não é evidência de falha WASAPI, nem passe de áudio/transcrição/sincronia.
- Hash da mídia local: `a47f057aa5e24bf3b45f5c3ef347dfeebd9c82f84e98b3b1b9cbdfe9cb286658`.
- Pacote `0.1.0-alpha.1` com WGC `d28621a0…ed9` (correção da etapa 01), não o
  helper posterior com crop 02A. Captura encerrada pelo usuário, não teste automatizado
  de 10 minutos sob carga. Não foram medidos qualidade objetiva, congelamentos,
  uso de recursos, exportação dessa tomada ou áudio/vídeo sincronizados.

Pedido registrado para 02B: confirmação "Gravação salva", nome/caminho do MP4 e
ação persistente "Abrir local salvo" no editor. Requisitos e critérios em
[REQUIREMENTS.md](REQUIREMENTS.md), [WINDOWS11-REGION-DEVICES.md](WINDOWS11-REGION-DEVICES.md)
e [TESTING.md](TESTING.md). Só especificado; nenhum botão novo foi implementado.

Pedido adicional de 2026-10-13 registrado para 02C: áudio do sistema ativado por
padrão em perfis novos/preferências ausentes; microfone opcional/desligado.
Desligamento explícito salvo deve ser respeitado, sem reativação silenciosa.
Requisito e testes em [REQUIREMENTS.md](REQUIREMENTS.md) e [TESTING.md](TESTING.md).
Somente documentação; preferências e binário existentes não foram alterados.

Pedido adicional pós-gravação: mostrar "Nova captura" de forma evidente na tela
de edição, junto do acesso ao arquivo salvo. Abrir preparação sem gravar
automaticamente, preservar a tomada anterior e tratar alterações não salvas.
Registrado para 02B; ainda não implementado como ação destacada pós-gravação.

## Direção de UX registrada — simplicidade primeiro

Pedido adicional de 2026-10-13: a tela principal pós-gravação deve mostrar a
gravação salva, sua localização e ações diretas (Abrir pasta, Compartilhar,
Transformar em GIF e Nova captura). A edição permanece em aba/ação secundária,
sem abrir obrigatoriamente após parar. Referência de simplicidade: Windows 11 nativo.
Escopo, critérios e sequência em [SIMPLE-RECORDING-UX.md](SIMPLE-RECORDING-UX.md).
**Somente planejamento neste registro; nenhuma dessas ações está sendo declarada pronta.**

## Checkpoint noturno — seleção visual de região

Branch continua `feat/windows-region-foundation`. Pacote local não instalado
regerado com crop e capability; helper `ca762c88…a48`, idêntico ao payload de origem.
Reprojeção de cursor e proibição de fallback Chromium cobertas por testes.
UI/IPC/componentes, guardas e limitações em [WINDOWS11-REGION-DEVICES.md](WINDOWS11-REGION-DEVICES.md).

Manual parcial com computer-use: HUD observado; cliques bloqueados por hit-test
em coordenadas fora da janela a 150%. Região não declarada aprovada pela interface.
Smoke nativo isolado produziu crop 960×600 e parou/decodificou corretamente,
mas imagem preta; controle do monitor inteiro também preto. Conteúdo visual e
causa inicialmente sem aceite. Após o usuário confirmar bloqueio e desbloquear
o desktop, reteste isolado aprovado: 960×600, 5,033733 s, 266.116 bytes, texto e
movimento presentes, quatro cantos corretos, conteúdo externo excluído e decode
integral sem erro. Isso não aprova arraste/IPC/HUD ou DPI misto físicos.
Nenhuma mídia do usuário foi enviada ou alterada.
O indicador persistente e o redesenho simples ainda são próximos incrementos.

Validação final do código de região: 340 arquivos, 4.781 testes aprovados,
5 ignorados, 0 falhas; 305,50 s com Node22.22.1/npm10.9.4 e maxWorkers=4.
TypeScript app/testes aprovados; Biome 0 erros / 26 avisos herdados; i18n 15 línguas.
Build Vite e pacote `--win --dir --publish never --config.npmRebuild=false`
aprovados. Docs:check aprovado (50 arquivos), antes do registro final de QA.

Autorização adicional: avançar autonomamente pelas etapas/pontos registrados,
respeitando dependências, permissões e testes, até 2026-10-14 às 12h Brasília;
pausar aos 95% do limite e retomar após reset + 5 minutos. Não dispensa aceites
manuais, liberações de distribuição ou testes em hardware/SO indisponível.

## Incremento 02C — padrão de áudio do sistema

Em 2026-10-14, implementado padrão ligado em perfil novo/chave ausente no store,
fallback IPC, painel de preparação e browser shim. `false` salvo permanece
desligado após mudanças em outras preferências e reinício; mic/câmera continuam
desligados. Nenhum arquivo real de preferências do usuário foi editado/migrado.
Testes focados: 5 arquivos / 59 testes aprovados; todas as regressões afetadas
(`vitest --run --changed HEAD --maxWorkers=4`): 9 arquivos / 86 testes aprovados,
0 falhas, 15,93 s. Biome sem erros / 26 avisos herdados; typechecks app/testes e
docs:check (50 arquivos) aprovados.
A suíte completa de 4.781 testes acima é anterior a este incremento estreito;
não é apresentada como reexecução após os novos defaults.

Pacote local aberto ainda é o build de região anterior; novo padrão requer
rebuild/reempacotamento. Aceite de áudio audível em perfil novo, fonte escolhida,
desconexão e medidor seguem pendentes. Detalhes em
[WINDOWS11-REGION-DEVICES.md](WINDOWS11-REGION-DEVICES.md).

## Incremento 02D — resultado simples inicial

Implementado em 2026-10-14: prévia do original, nome/local/tamanho/duração,
Abrir pasta, Nova captura sem auto-início e Editar secundário após salvamento.
Validação de arquivo e transições pertence ao main; CLI/MCP mantêm editor.
Compartilhar/GIF, indicador persistente e aceite GUI completo seguem pendentes.
Prévia não compõe webcam/cursor editável/zoom separados do MP4 original.

Suíte completa: 343 arquivos, 4.812 testes aprovados, 5 ignorados, 278,48 s,
Node22.22.1/npm10.9.4, quatro workers. Typechecks app/testes, Vite e i18n15
aprovados; lint sem erros e 26 avisos herdados. Testes focados: 39 aprovados.
QA isolada com Electron real observou metadados e ações via acessibilidade;
screenshot mostrou janela sobreposta mesmo após ativação, sem aprovar layout,
reprodução, cliques ou fluxo captura → resultado. Não repetir cliques cegos.
Pacote local atualizado gerado em `.cache/result-package/win-unpacked`, com
`--dir --publish never --config.npmRebuild=false`; não instalado nem aberto.
23 arquivos do payload nativo conferem por SHA256; `ffmpeg.exe` estático é
excluído intencionalmente pelo builder (usa `ffmpeg-shared.exe` e DLLs).
WGC permanece ca762c882370794abf63575ae9e0f037a5d6e609e059a5e9b3f183c9578a6a48;
sem mudança nativa neste incremento. Docs:check aprovado (50 arquivos).
App QA aberto permanece anterior e com proteção de conteúdo desativada para
teste: verificar estado/encerrar somente instância própria ociosa e relançar
sem a flag antes de gravações reais. Não interromper gravação/edição não salva.

## Incremento 02E — indicador persistente da região

Borda vermelha pontilhada, 2 DIP, ligada por padrão para captura retangular nativa
Windows. Janela transparente, sem foco/taskbar/preload/IPC e click-through;
permanece com HUD oculto e durante pausa. Usa o crop físico efetivo (incluindo
arredondamento par/interno) convertido localmente ao monitor, não o arraste bruto.
Janela sempre protegida contra captura, mesmo com override de QA do HUD.
Criada somente após helper anunciar início; removida ao parar/cancelar/reset/exit.
Identidade do helper impede saída atrasada de uma tomada de fechar borda da próxima.
Falha do indicador gera aviso no log sem destruir gravação já iniciada.

Escopo atual: retângulo em monitor único. Não adiciona borda a janela móvel ou
monitor inteiro; DPI misto, mudança de monitor e posicionamento físico da borda
ainda dependem de aceite real. O indicador aproxima arestas em DIP inteiro, com
erro visual possível de até meio DIP; não modifica os pixels efetivos do crop.

Testes focados: 3 arquivos / 23 aprovados; typechecks app/testes e Vite aprovados;
lint sem erros / 26 avisos herdados. Helper/payload nativo sem alteração de código.
QA via computer-use observou fixture real, mas borda protegida é excluída das
screenshots por definição. O primeiro smoke foi ocluído pela outra janela de QA;
assert visual falhou (não é aceite). Repetição com fixture topmost confirmou janela
da borda visível antes da captura e MP4 H.264 960×600, 5,034 s, 105.077 bytes,
0 pixels vermelhos, 42.840 amarelos da referência, decode integral sem erro;
stop 94 ms. Prova estreita de exclusão em cenário sintético, não de GUI completa.
As duas fixtures antigas próprias (39108/10260) foram encerradas após conferir
PID/executável/argumentos; nenhum arquivo foi apagado nem mídia privada enviada.

Suíte final: 344 arquivos / 4.817 aprovados / 5 ignorados / 328,51 s, runtime
fixado e quatro workers. Pacote isolado `.cache/indicator-package/win-unpacked`
gerado sem instalador/publicação; 23 arquivos nativos conferidos por SHA256, zero
diferenças (FFmpeg estático intencionalmente excluído). Não instalado/publicado.
Após observar HUD antigo ocioso (sem fonte/gravação/editor) e conferir ausência
de WGC ativo, encerrou-se somente o processo QA próprio 21796, com caminho
verificado. Novo pacote relançado como PID 21240, sem
`OPENSCREEN_DISABLE_CONTENT_PROTECTION`; janela própria retornada pelo computer-use
e startup/atalho próprio confirmados no log. Não equivale a captura homologada.

## Incremento 02F — prévia original e desenho de derivados

Legenda curta na tela de resultado explica que câmera separada, cursor editável
e edições aparecem no editor, não incorporados ao MP4 original. Traduzida nos
15 idiomas; não muda captura, preferências, arquivos ou compositor.
Análise registrada em [SIMPLE-RECORDING-UX.md](SIMPLE-RECORDING-UX.md): GIF já
usa compositor nativo com cancelamento/progresso; corrigida documentação antiga
que ainda descrevia fallback renderer. Nenhum GIF/compartilhamento novo habilitado.
Antes de ligar ações, implementar destino main-owned, recusa de sobrescrever/alias
do original e jobs canceláveis com arquivo temporário próprio. Não enviar mídia.

Testes focados (resultado + exportador existente): 4 arquivos / 26 aprovados;
typechecks app/testes, i18n15 (958 chaves) e lint sem erros / 26 avisos herdados.
Suíte final: 344 arquivos / 4.817 aprovados / 5 ignorados / 301,04 s, runtime
fixado e quatro workers. Docs:check50 e Vite aprovados. Pacote local atualizado
em `.cache/result-package/win-unpacked`, sem instalador/publicação; 23 arquivos
nativos com SHA256 idêntico. Não relançado: instância em uso continua 02E,
PID21240 de `.cache/indicator-package`, protegida, anterior somente à legenda.
Nenhum novo aceite GUI alegado para esta legenda; fluxo completo ainda pendente.

## Incremento 02G — fundação isolada de destinos seguros

Implementado `DerivedRecordingTargets` com capacidade opaca/uso único por dono,
snapshot de sessão/fontes, janela fechada/estado ocupado e um job por janela.
Destino deve vir de diálogo nativo main-owned (contrato; IPC ainda não ligado).
Recusa arquivos existentes, inclusive original/hardlinks/aliases, extensões
incompatíveis, caminho relativo, ADS e nomes reservados portáveis. Resolve parent
canônico, usa diretório temporário exclusivo e publicação por hardlink sem
substituição; corrida EEXIST mantém destino alheio intacto. Limpeza usa somente
unlink/rmdir de paths próprios, nunca recursive delete nem destino publicado.

Testes com filesystem real Windows e dados sintéticos: 3 arquivos / 33 aprovados,
incluindo hash SHA256 do original inalterado, hardlink, corrida de criação,
owner estrangeiro/token antigo/replay, sessão/fontes trocadas, owner fechado,
estado ocupado após await, arquivo vazio/hardlink staged e validação rejeitada.
Primeira expectativa do caminho curto 8.3 foi corrigida para o parent canônico;
reexecução aprovada. Lint: 0 erros / 26 avisos herdados.

Backend isolado e não importado pelo runtime: nenhum botão/API novo, mudança no
exportador legado, publicação de mídia ou alteração no app aberto. Integração
com diálogo/compositor/decoder/cancelamento continua pendente. Typechecks app e
testes aprovados. Suíte final: 345 arquivos / 4.827 aprovados / 5 ignorados,
306,54 s, Node22.22.1/npm10.9.4, quatro workers. Docs:check50 e Vite aprovados.
Pacote local `.cache/result-package/win-unpacked` regerado sem instalador/publicação;
23 arquivos nativos SHA256 idênticos. Stub main.js preservou hash
6d17a3b30bc2b92bc6257196e5e4041f8e68a1ab2d9a4731ea48b49f01002683;
não alegar que classe isolada está ativa ou que filesystem sem hardlink é suportado.
Nenhuma fonte nativa/i18n alterada; não houve novo aceite GUI ou build C++/Rust.
App em uso não foi fechado/reaberto; nenhuma mídia privada foi usada.

## Incremento 02H — janela fechada durante inicialização do exportador

Reproduzida por unit test uma lacuna de `ExportJobs`: fechamento do dono dentro
de `start()` acontecia antes do listener `destroyed`, sem solicitar cancelamento.
Guarda mínima reconsulta `isDestroyed()` após registrar o listener, dentro do
try/finally existente, mantendo espera pelo resultado do writer e limpeza de owner.
Regressão falhou antes da correção (1 falha / 12 aprovados), passou depois.
Focados: 2 arquivos / 23 aprovados, incluindo destinos seguros; lint26 herdados.
Typechecks app/testes aprovados; suíte final e pacote em execução;
ainda não commitado neste checkpoint. Sessões 41290 (suíte/tipos) e 67777
(Vite/pacote), logs `.cache/export-init-full.log`, `export-init-vite.log` e
`export-init-package.log`: ler resultados antes de repetir execução após reset.
Nenhum GIF/compartilhamento novo habilitado. Logs `.cache/export-init-*`.
Pausa automática aos 95% em 2026-10-14: checkpoint local não commitado preservado.
Reset real primário 07:10:56 UTC; retomada somente após 07:15:56 UTC
(04:15:56 Brasília), agendada para cerca de 04h16. Pacote terminou sem erro;
suíte ainda ativa ao pausar. Após reset, conferir logs/hashes/docs antes de commit;
não repetir full suite por rotina nem alegar código pronto sem ler o resultado.
Retomada em 2026-10-14 às 04h16 Brasília, após reset natural (primário 0%,
semanal 31%, nenhum crédito consumido). Logs finais conferidos sem repetir suíte:
345 arquivos / 4.828 aprovados / 5 ignorados / 288,01 s. Vite/pacote terminaram
sem erro. Payload nativo: 23 arquivos SHA256 idênticos, sem build C++/Rust novo.
Pacote local atualizado não relançado; app em uso não tocado, sem novo aceite GUI.
Pedido humano de redução de ruído do microfone mantido como backlog no ROADMAP,
sem implementação nem mudança de padrão nesta rodada.

## Incremento 02I — cópia segura do original na tela simples

`SavedRecordingCopies` conecta destinos 02G ao diálogo nativo/IPC/preload e ao
botão Salvar uma cópia. Dono precisa ser a janela main atual no papel resultado;
destino vem exclusivamente do diálogo main-owned, não do renderer. Originais
MP4/WebM são copiados em stream, sem recompressão e sem upload/composição.
Fonte aprovada/sessão/estado e SHA256/size/mtime/identidade conferidos antes de
publicação exclusiva; cancelamento/owner fechado abortam stream, aguardam fechamento
e limpam somente staged próprio. Nova captura bloqueada no main durante cópia.
Destino existente gera orientação traduzida para escolher outro nome, nunca overwrite.
UI mostra caminho real, ocupado/cancelar; original permanece selecionado.

41 testes focados / 4 arquivos aprovados (bytes MP4/WebM, original intacto, cancel,
owner/expectativa estrangeiros, sessão/fonte trocada no diálogo, colisão, duplicata,
cancelamento UI e navegação desabilitada). Typechecks app/testes e i18n15/964chaves
aprovados após corrigir namespace do título e usar owner estrutural mínimo; lint26
avisos herdados, sem erros. Suíte completa: 346 arquivos / 4.841 aprovados /
5 ignorados / 305,81 s, Node22.22.1/npm10.9.4 e quatro workers.
Build/pacote final aprovados, 23 arquivos nativos SHA256 idênticos e docs:check50
aprovado. Pacote `.cache/result-package/win-unpacked` atualizado, não instalado
nem relançado; app protegido em uso continua anterior. Fixture própria PID22580
encerrada após conferir identidade/estado ocioso; cópia/logs sintéticos preservados.

QA computer-use isolada com renderer/preload/controller reais, diálogo Save e
fixture MP4 sintética: clique Salvar uma cópia abriu diálogo; após ativação ficou
visível; índice Save indisponível foi recuperado com observação nova/coordenadas.
Salvar criou `.cache/copy-qa-1791964064643.mp4` e exibiu caminho correto.
Origem/cópia SHA256 d6a5106181cef45aab7199326d25e86a1fceb9e460099f07de9207751dbe2365,
H264 960×600, 5,033733 s, 266.116 bytes, decode integral sem erro.
Após fechar modal screenshot voltou sobreposta; uma ativação não resolveu, sem
mais cliques cegos. Cancel nativo, layout final após ajustes CSS/ordem, wiring da
janela completa e fluxo captura→resultado seguem sem aceite real; unidade/harness
não os substituem. App protegido PID21240 não tocado. Sem novo GIF/Compartilhar.

## Incremento 02J — contrato limitado de GIF por trecho

Preflight puro e isolado em `src/lib/savedRecordingGif.ts`: pedido sem caminhos,
fonte/probe main-owned obrigatório na futura integração, trecho original explícito,
intervalo válido até 60 s, FPS existentes e alturas 480/720. Sem upscale,
maior aresta 1280 px, proporção com arredondamento inteiro, limite de trabalho de
1 bilhão pixel-frames e contagem reutilizando grid/epsilon do compositor.
Nenhum novo encoder/fallback, IPC, botão ou GIF habilitado. Não modifica o editor.
Estimativa de trabalho NÃO equivale a bytes/RAM; estimativa de arquivo ainda pendente.
Contrato e integração restante em [SIMPLE-RECORDING-UX.md](SIMPLE-RECORDING-UX.md).
Preflight + grid: 2 arquivos/55 testes aprovados. Ambos tsc, lint26 herdados,
i18n15/964chaves e docs50 aprovados inicialmente. Primeira suíte final encontrou
timeout15s em teste herdado MCP `runs one export at a time`: esperava 20ms antes
da segunda chamada, sem confirmar runner iniciado. Leitura mostrou que o segundo
pedido podia chegar antes do primeiro sob carga; diagnóstico de corrida de teste,
não regressão de exportação demonstrada. Duas esperas fixas dos testes de export
foram substituídas por Promise sinalizada pelo FakeRunners após instalar release.
Primeira suíte: 1 falha/4.882 aprovados/5 skip/324,08s; log preservado em
`.cache/gif-plan-full.log`. Após corrigir a sincronização: 3 arquivos/94 focados
aprovados; ambos tsc novamente aprovados e lint26 sem novos avisos. Suíte final
corrigida: 347 arquivos/4.883 aprovados/5 ignorados/283,42s, runtime fixado e
quatro workers, log `.cache/gif-plan-final-full.log`. Sem mudança de produção MCP.
Docs50 e i18n15 aprovados; Vite/pacote completos aprovados, 23 payloads nativos
SHA256 idênticos. Pacote `.cache/result-package/win-unpacked` atualizado, não
relançado/instalado. Sem fonte nativa alterada, build C++/Rust não necessário.
App aberto não tocado. Preflight isolado não importado pelo runtime: sem mudança
visual/encoder nesta rodada, portanto sem novo teste GUI/GIF real; integração e
homologação nativa seguem pendentes, não inferidas da suíte unitária.

## Incremento 02K — cena original e GIF nativo sintético

Adapter isolado `savedRecordingGifScene.ts`: documento efêmero, fonte/trecho
main-owned, `buildSceneDescription` compartilhado, modo original sem camadas
extras/efeitos/áudio e sem crop. Não importa shell nem muda preferências reais.
Sincronizado preflight com arredondamento par existente no addon; dimensões
menores que2/formatos extremos recusados sem upscale. Sem mudança Rust/C++.
Focados: 3 arquivos/198 aprovados. Expectativa inicial blur=false corrigida para
contrato numérico0; tsc encontrou layoutByClip potencialmente nulo, guardado.
Ambos typechecks aprovados após correção. Suíte final: 348 arquivos/4.895
aprovados/5 ignorados/289,01s, Node22.22.1/npm10.9.4, quatro workers.
Lint sem erros/26 avisos herdados, i18n15/964chaves e docs50 aprovados.
Vite e pacote completos aprovados; 23 payloads nativos SHA256 idênticos.
Pacote `.cache/result-package/win-unpacked` gerado da árvore atual, não instalado
nem relançado. Adapter não importado por código ativo: não anunciar GIF no pacote.

Prova nativa isolada (não GUI) usa somente mídia sintética privada em `.cache`:
probe real, adapter, CompositorViewService/startGifExport, ExportJobs e destinos
02G, validação FFprobe/GIF/decode antes da publicação. Trecho1,25–3,25s produziu
768×480/30frames/2s/1.898.617bytes; original SHA256d6a51061…2365 inalterado.
Cancel imediato aceito, resultado rejeitado como cancelado, writer aguardado e
somente derivado próprio limpo, sem destino cancelado. Frame inicial vs fonte
redimensionada MAE RGB3,8401/255; 28.439pixels amarelos, 262.373canais diferentes
entre início/fim (70.738 com diferença>16/255), quatro cantos amarelos corretos.
Não é teste universal de qualidade.
Artefatos `.cache/gif-scene-qa-MHH0rT`, logs `gif-scene-qa3.*`; nenhum upload.

Primeiras duas execuções do harness encerraram antes da exportação, sem resultados
válidos: janela oculta do probe era fechada antes de criar owner. Harness corrigido
mantém owner desde o início e trata window-all-closed. Diretórios temporários
privados dessas tentativas preservados, sem varredura automática/remoção por prefixo.
Exit0 anterior não foi tratado como passe. Terceira execução validou GIF/cancel.
Adapter ainda NÃO importado pelo runtime; sem IPC/botão/novo aceite GUI. App
protegido em uso não tocado; não homologados diálogo/cancel UI/captura→resultado.

## Incremento 02L — controlador de GIF e decode final

`SavedRecordingGifs` isolado do runtime: snapshot imutável de sessão/fonte,
main-owned owner/picker/probe, revalidação após awaits, SHA256 em stream,
ExportJobs/destino02G, progresso finito e cancelamento que aguarda writer.
Cancel que lança não abandona writer; cancel durante init é reaplicado.
`validateSavedGif`: header/dimensões + demux GIF/decode integral por FFmpeg
compartilhado, frames/duração, timeout60s e logs limitados; aguarda close mesmo
após abort/error antes de devolver ao cleanup. Nenhum novo encoder/fallback.
ExportOwner tornou-se interface estrutural mínima, sem alteração de lógica de jobs.

QA nativa isolada, componentes reais/controller/decoder, somente MP4 sintético:
sucesso2s/30frames/768×480/1.898.617bytes, cancel nativo e owner destruído durante
writer retornam canceled e não publicam GIF. Diretório final contém só sucesso;
estado busy liberado após writer, fonte/hash revalidados. Decoder resolvido foi
`electron/native/bin/win32-x64/ffmpeg-shared.exe`; não depende de FFprobe empacotado.
Logs `.cache/gif-controller-final.*`, artefatos `.cache/gif-controller-qa-9rigCp`.
Primeiro QA O5ZpAz passou antes de explicitar demuxer GIF; final acima repetiu
com demuxer explícito. Sem fonte Rust/C++ alterada nem aceite GUI alegado.
Teste negativo real: GIF truncado aos13bytes, com header/dimensões válidos,
foi recusado por frames/duração. FFmpeg terminou exit0 com zero frames: o teste
confirma por que header/exit0/estatísticas não bastam. Fixture privada em
`.cache/gif-negative-*`, harness `.cache/gif-validator-negative.ts`.

Validações finais: 4 arquivos/58 focados, ambos tsc, lint26 herdados, i18n15/
964chaves e docs50 aprovados. Suíte completa: 350 arquivos/4.930 aprovados/
5 ignorados/297,82s, Node22.22.1/npm10.9.4, quatro workers. Vite/pacote completos
aprovados, 23 payloads nativos SHA256 idênticos. Pacote local atualizado em
`.cache/result-package/win-unpacked`, não instalado/relançado. Sem rebuild nativo
porque não houve fonte C++/Rust alterada. Dados/fontes/vendor preservados.
Não há IPC/preload/botão GIF novo nem import
runtime do controlador/decoder. App aberto não foi tocado; pacote ativo ainda
anterior. Próximo: wiring main/result owner, busy mútuo com cópia/navegação,
probe com finally, opções/progresso/cancelamento e GUI real. Não anunciar pronto.

## Incremento 02M — GIF conectado ao main/preload (sem UI)

APIs export/cancel/progress agora ativas. Main usa fonte aprovada e janela atual
no papel resultado, apenas frame principal, URL file/dev da origem configurada.
Probe fecha em finally; falta de decoder falha antes de probe/dialog. Destino é
do diálogo main-owned; opções/caminho esperado apenas no renderer. Progresso com
UUID gerado no main e início0. Cópia/GIF bloqueiam-se mutuamente; Nova captura e
rotas UI de editor/HUD/start recusam transição enquanto derivados ativos.
Não muda lock geral de bridge/MCP legado. Nenhum botão GIF novo ainda.

Testes focados incluem owner estrangeiro/fechado, editor, URL vazia/remota, origem
dev divergente, subframe, fonte não aprovada, busy, caminhos/cena não autorizados,
probe fechado, decoder indisponível, progresso e regressões de cópia/resultado.
Tipo inicial do mock compositor corrigido para assinatura nativa completa;
typecheck detectou o mock excessivamente genérico antes da correção.

QA programática real de preload/IPC + factory/controller/compositor/decoder:
GIF2s/30frames/768×480/1.898.617bytes publicado em `.cache/gif-ipc-qa-FmL5yF`;
outra janela e busy recusados antes de picker; UUID único, primeiro evento0 e
total30, cancel estrangeiro recusado. Logs `.cache/gif-ipc-guard.*`.
Primeira QA falhou ao retornar função unsubscribe por executeJavaScript; harness
corrigido para void, duas execuções seguintes passaram (última com guardas URL/frame).
Não equivale a cliques OS, diálogo real, handlers/main completo ou captura→resultado.
App protegido em uso não tocado. Shutdown completo/recuperação de órfãos pendentes.

Validações finais: 4 arquivos/55 focados, ambos tsc, lint26 herdados,
i18n15/964chaves, docs50, Vite e pacote completos aprovados. Suíte completa:
351 arquivos/4.945 aprovados/5 ignorados/302,32s, runtime fixado e quatro workers.
23 payloads nativos SHA256 idênticos; sem fonte Rust/C++ alterada/rebuild novo.
Pacote `.cache/result-package/win-unpacked` atualizado, não instalado/relançado.
Não anunciar recurso disponível na interface; botão e aceite GUI seguem pendentes.

## Inspeção seguinte — encerramento coordenado antes do botão GIF

Inspeção de `electron/main.ts` confirmou que `window-all-closed` solicita
`app.quit()` e que o único adiamento assíncrono de `before-quit` espera
`shutdownStt()` e `flushChatPersistence()`. Cópia/GIF aguardam seus writers e
limpam staging no finally enquanto o processo está vivo, mas não expõem uma
barreira de encerramento ao main. Portanto owner destruído em QA não comprova
encerramento seguro do processo inteiro; permanece o risco de temporário órfão.
O original segue protegido; não há evidência de perda nem teste de quit completo.

Próximo incremento, ainda NÃO implementado: oferecer cancelamento e espera da
conclusão dos jobs de cópia/GIF, incluindo writer/decoder e limpeza própria;
integrar essa espera ao before-quit existente, sem um segundo listener que
reentre em app.quit prematuramente. Bloquear novos jobs durante essa fase e
definir o comportamento se o fechamento for cancelado por alterações não salvas.
Não apagar temporários por prefixo nem forçar encerramento por timeout.

Testes necessários: writer/decoder adiados, cancel nativo que lança, publicação
já iniciada que recusa cancelamento, limpeza terminando antes da liberação do
quit, coordenação com STT/persistência e fechamento cancelado. Usar fixture
isolada para quit real; não interromper gravações/edições do app do usuário.
O retorno de `registerIpcHandlers` é o ponto disponível para fornecer essa
barreira ao main, sem criar outro encoder ou alterar vendor. Esta rodada fez
somente inspeção/documentação; runtime e pacote permanecem no incremento 02M.

## Incremento 02N — barreira de quit para cópia/GIF

`pauseAndDrain` congela admissão sincronamente e solicita cancelamento dos jobs
atuais, aguardando stream/writer/decoder e finally de limpeza própria. A fronteira
de publicação continua não cancelável; espera em vez de desfazer arquivo publicado.
Pausas balanceadas/idempotentes permitem retomar admissão se o fechamento for
vetado. Não há timer que force saída, remoção recursiva ou varredura por prefixo.

Main recebe a barreira pelo retorno de registerIpcHandlers e a integra ao único
before-quit existente com `createQuitBarrier`. Quit repetido durante espera não
contorna jobs; reentrada passa uma vez. Admissão é liberada imediatamente antes
da reentrada síncrona, permitindo novas cópias/GIFs se a janela vetar close; a
próxima tentativa drena novamente. STT e flush seguem depois dos derivados;
flush com erro mantém app aberto e pode ser tentado novamente. Falha de limpeza
pode deixar órfão, mas não antecipa espera do writer nem apaga original/destino.

QA isolada Electron + compositor real Windows: dois GIFs sintéticos cancelados
por app.quit, duas barreiras; primeiro close vetado, segundo job admitido e
segundo quit finalizado exit0. will-quit escreveu PASS; zero staging/derivados
restantes e SHA256 original d6a51061…2365 preservado em ambas as esperas.
Evidências `.cache/derivative-quit-qa-SDOvub/metrics.json` e
`.cache/derivative-quit-final.*`. Primeira execução sem recibo final verificável
ficou apenas diagnóstica; harness passou a escrever recibo síncrono em will-quit
e a capturar exit com Start-Process -Wait. Processo do usuário não tocado.

Limites: fixture usa veto programático e callback de shutdown sintético, não
cliques OS/diálogo de edição nem Whisper real. O comportamento herdado do STT
após cancelar quit continua pendente: shutdownStt marca sttShuttingDown e o IPC
retém manager; não afirmar retomada de ASR após veto. Esta barreira restaura
admissão de cópia/GIF, não reformula o ciclo STT legado. app.exit/crash/kill não
passam por before-quit; recuperação de órfãos e exportador legado fora do escopo.
Botão GIF e homologação GUI continuam pendentes. Validações finais aprovadas:
4 arquivos/52 testes focados; ambos tsc, lint26 avisos herdados, i18n15/964chaves,
docs50, Vite e pacote completo. Suíte completa uma vez:352 arquivos/4.953
aprovados/5 ignorados/320,92s, Node22.22.1/npm10.9.4 e quatro workers.
23 payloads nativos idênticos por SHA256; FFmpeg estático excluído conforme
configuração. WGC ca762c88…a48, sem mudança/rebuild de fonte Rust/C++.
Pacote `.cache/result-package/win-unpacked` atualizado, não instalado/relançado.
Logs finais `.cache/derivative-quit-{full,lint,vite,package}.log`.
Typecheck inicial detectou Promise<void> versus Promise<undefined> no callback
neutro; corrigido e ambos checks repetidos com sucesso antes do build final.

## Incremento 02O — preservar STT quando edição veta saída

Causa confirmada: before-quit precede close das janelas; shutdownStt terminal
antes da confirmação tornava o gerente retido pelo IPC inutilizável após Cancelar.
Não ressuscitar singleton nem relaxar guardas contra respawn durante shutdown.
`createAppQuitLifecycle` separa preparação reversível de encerramento terminal:
before-quit drena derivados e flush; will-quit, emitido somente após aceites de
close, aguarda shutdownStt e novo flush antes de reentrar em quit. As duas fases
usam createQuitBarrier; pedidos repetidos não contornam nenhuma espera. Reentrada
terminal cruza novamente a fase anterior. Atalhos só são removidos quando o
will-quit efetivamente passa. Callbacks de erro STT mantêm tratamento herdado.

Cancelar close mantém o mesmo manager, helper e IPC; não cancela/transfere
transcrição apenas por tentativa de quit. Derivados continuam com cancelamento
e limpeza 02N. Flush também ocorre após confirmação/salvamento do editor.
Não altera contratos/provedores/modelos nem a implementação nativa STT.

4 arquivos/68 focados aprovados, ambos tsc e lint26 herdados aprovados. Fixture
real isolada Windows com preload/IPC/STT e modelos já em cache: processou dois
pedidos de silêncio sintético2s (um antes e outro após veto programático), mesmo
manager, backend whispercpp-cpu, shutdown terminal uma vez, flush quatro vezes,
will-quit PASS e exit0. `.cache/stt-veto-qa-RInQR4/metrics.json` e
`.cache/stt-veto-final.*`. Downloads externos bloqueados no harness; somente
HTTP loopback do helper permitido. Sem fala/segmentos: prova de ciclo operacional,
NÃO qualidade/precisão ou retomada de uma transcrição longa em andamento.

Primeiro harness apontou binário isolado `.cache/whisper-cpu/Release` e falhou
startup3221225781; logs `.cache/stt-veto-qa.*` preservados. Repetido com helper do
payload completo e suas DLLs, sem modificar/copiar binários: passou. App do
usuário não tocado. Não equivale ao diálogo de edição/cliques OS nem ao app main
completo. GUI e botão GIF seguem pendentes; crash/app.exit continuam fora do
before/will-quit. Segunda QA real com window-all-closed chamando app.quit,
como no main: `.cache/stt-veto-qa-YCCJZT/metrics.json` PASS e exit0;
logs `.cache/stt-veto-lifecycle.*`, um shutdown e quatro flushes novamente.

Ambos typechecks, lint26 herdados, i18n15/964chaves, docs50, Vite e pacote
completo aprovados; 23 payloads nativos SHA256 idênticos, sem fonte nativa nova.
Não declarar suíte completa aprovada: primeira execução encerrou quatro workers
inesperadamente (348 arquivos aprovados/4 erros; `.cache/stt-veto-full.log`).
Repetição isolada perdeu a sessão e deixou somente bytes nulos no log; sem recibo
de saída, também inválida (`.cache/stt-veto-full-isolated.log`). Causa não
confirmada; memória disponível medida depois não comprova OOM anterior.
Terceira tentativa concluída com dois workers, sem build/QA simultâneos e runner
que grava recibo JSON do exit code: `.cache/stt-veto-full-receipt.{log,json}`.
352 arquivos/4.956 aprovados/5 ignorados/378,42s, Node22.22.1, exit0 e sem signal,
terminou em2026-10-14T13:38:24Z. Sem mudança de código para obter esse passe.
As tentativas inválidas permanecem preservadas, não são contadas como aprovadas.
Pacote também conferido por hash: entry main.js, chunk efetivamente referenciado
main-ClSkljfg.js e preload.mjs dentro de app.asar iguais ao dist atual, além dos
23 payloads nativos. Verificador privado `.cache/check-stt-package.cjs`.
Pacote não instalado/relançado; app do usuário intacto. Botão GIF ainda ausente.

## Incremento 02P — opções GIF isoladas, ainda sem botão no resultado

`RecordingGifOptions` oferece início/fim, opções adicionais de resolução/FPS e
repetição, aviso fornecido pelo chamador e dimensões/duração previstas. Padrão
trecho0–10s limitado pela fonte,480p/15FPS/loop. Usa o preflight compartilhado:
recusa vazio, intervalo inválido, mais de60s, metadados ausentes e orçamento
excedido; não upscala. NaN/Infinity não viram atributos max do input.

Componente NÃO importado/montado por RecordingResult. Só chama onReview com as
seis opções permitidas, nunca caminho, cena ou plan/pixelFrames. Nenhum IPC,
encoder, upload, arquivo ou conversão automática. Campos/submit bloqueados
durante revisão, trava síncrona evita duplicatas; Cancelar permanece disponível
e delega ao pai. Erro não anuncia arquivo salvo. Metadados são consultivos na UI;
integração main ainda deve re-probar a fonte aprovada e manter identidade/owner.

Labels/locale são props explícitas para futura integração com os15 idiomas;
nenhuma string nova fixa em inglês/português foi ligada ao runtime. Testes usam
labels sintéticas. Antes de montar: fornecer traduções reais, estimativa honesta
de bytes por serviço main-owned, progresso/cancelamento/arquivo final e focus
apropriado à abertura inline. Não confundir dimensões/duração com tamanho GIF.

3 arquivos/69 testes focados aprovados (formulário, preflight e resultado).
Validações finais aprovadas: ambos tsc, lint26 avisos herdados, i18n15/964chaves,
docs50, Vite e pacote completo. Suíte completa uma vez, isolada com dois workers:
353 arquivos/4.970 aprovados/5 ignorados/355,40s, Node22.22.1, exit0 sem signal.
Recibo `.cache/gif-options-full.json` e log correspondente, fim13:59:09UTC.
Entry main.js/chunk atual/preload no app.asar conferidos por SHA256, mais23
payloads nativos idênticos; código runtime efetivo igual ao02O, como esperado
para componente não importado. Sem fonte Rust/C++ alterada/rebuild nativo.
Pacote `.cache/result-package/win-unpacked` atualizado, não lançado/instalado.
Logs `.cache/gif-options-{lint,vite,package}.log`. Sem homologação visual/OS:
componente isolado não aparece no app; app do usuário não tocado.

## Regra de atualização contínua

A cada PR, registrar: escopo, commits/helpers, comandos, resultados e testes não
executados com motivo. Não marcar metas de desempenho como concluídas por estimativa.
