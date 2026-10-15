# Situação e registro de execução

Data da inicialização: 2026-10-13.

## Continuidade autorizada — regra humana de 2026-10-14

Desenvolver continuamente após a renovação, sem pausas entre incrementos nem espera
de15min. Parar aos89% usados da janela5h; proteção semanal95% permanece. Preservar
checkpoint e retomar após resetsAt aplicável+5min, sem consumir créditos de reset.
Watchdog agendado serve apenas para recuperar chat ocioso, não interromper trabalho
ativo nem criar segundo escritor. Disparo antecipado precisa de nova tentativa após
a guarda temporal; regra diária isolada perdeu a retomada de14/10 e foi corrigida.

## Repriorização humana — 2026-10-14

Estimativa de tamanho do GIF e Compartilhar ficam para o final, somente depois
de concluir o restante do roadmap. Nenhuma implementação existente foi removida;
formulário GIF continua isolado, sem botão ativo. Esta decisão substitui a indicação
anterior de começar pela estimativa/GIF. Próximo trabalho: áudio/dispositivos e
homologação das etapas 01/02, seguido das dependências de qualidade, ASR, recuperação,
Windows e Linux. Os aceites das duas ações adiadas ficam no backlog final e não
bloqueiam o restante. Mudança apenas de planejamento, sem alteração de runtime.

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

## Incremento 02Q — enumeração WASAPI, ainda sem UI

Helper `--list-audio-outputs` enumera somente eRender ativos com
ID/nome/padrão eConsole, sem abrir stream. Capability separada, sem prometer seleção.
Adaptador main-only valida schema/escopo/dados, limita tempo/saída e recusa erro,
duplicatas ou padrão ambíguo sem inventar default/fallback Chromium. Não importado
pelo runtime; sem IPC/preload/UI novo. Captura continua no padrão até integrar
escolha explícita com validação de fluxo/estado, ID nativo e erro sem fallback.

Build nativo aprovado após corrigir ordem de headers Windows; inclui33 testes
encoder e regressões de crop/áudio existentes. QA real helper+adaptador detectou
2 saídas ativas,1padrão e IDs estáveis em duas consultas, sem capturar ou alterar
dispositivos. `.cache/audio-output-qa.json`, SHA WGC e7fc8d74…75f4cd.
30 testes focados/2arquivos, ambos tsc e lint26 herdados aprovados.
Primeiro lint recusou regex de controle; substituída por verificação de caracteres,
sem supressão de regra. Suíte completa isolada uma vez:354 arquivos/4.991 aprovados/
5 ignorados/352,39s, Node22.22.1, dois workers, exit0/sem signal; recibo/log
`.cache/audio-output-full.{json,log}`, fim14:35:37UTC. i18n15/964chaves e docs50
aprovados. Vite e pacote completo local gerados com sucesso; sem instalação,
publicação ou relançamento do app do usuário. Logs `.cache/audio-output-{vite,package}.log`.
Conferência SHA256: entry/chunk/preload iguais ao dist e23 payloads nativos iguais
à origem atual; FFmpeg estático permanece excluído. Novo helper de enumeração
empacotado, mas não instalado/relançado. Adaptador ainda não importado no main.
Nenhuma homologação de seleção, medidor, GUI ou captura nova foi feita; não são
oferecidos na interface. App do usuário não tocado, nenhuma mídia enviada.

## Incremento 02R — seleção nativa de saída, sem UI

Resolução MMDevice por ID exato, checagem eRender/ativo e falha sem fallback.
Default é resolvido somente no início; escolha explícita não depende do nome ou
da enumeração de dispositivos não relacionados. Campo opcional systemAudioDeviceId:
ausente mantém compatibilidade, presente vazio/null/não string recusa parse antes
de capturar. Capability audioOutputSelection, comando read-only --check-audio-output,
audio-format com ID/nome efetivos do sistema. Sem ligação main/UI/persistência nova.

Teste nativo preliminar passou para2 saídas/default, ausência/nome/config inválidos;
versão final foi refinada para não depender das propriedades de saídas alheias e
reportar identidade efetiva. Rebuild final completo aprovado, incluindo33 testes
encoder; script real passou novamente para2 saídas e recusas, sem streams.
SHA256 WGC bd69b1e17200c9b8d01740f5f8674551c47d752132b8d958f44af0b1248bfbbd.
Ambos typechecks/lint26 herdados/i18n15/docs50 aprovados. Suíte final uma vez:
354 arquivos/4.991 aprovados/5 ignorados/352,53s, Node22.22.1, dois workers,
exit0/sem signal, fim14:51:52UTC, recibo/log `.cache/audio-selection-full.{json,log}`.
Essa execução antecede a coleta dos novos testes IPC02S (isolados e não importados);
não aprova a futura integração. Vite e pacote02R completos aprovados;
entry/chunk/preload e23 payloads nativos conferidos por SHA256, incluindo WGC
bd69b1e1…48bfbbd. Pacote não instalado/relançado. Logs
`.cache/audio-selection-{validated-native,lint,vite,package}.log`.
Script de QA versionado não abre stream nem captura a tela. Não homologados áudio
audível escolhido, troca/desconexão física, GUI ou evento numa tomada real.
App do usuário intacto. GIF/estimativa/Compartilhar continuam adiados.

## Incremento 02S — consulta de saídas main/preload

`list-windows-audio-outputs` registrado no main e preload/tipos opcionais.
Consulta somente janela atual HUD/editor, frame principal e URL file/origem dev
configurada. Revalida dono após resolver helper e após enumerar; uma consulta
pendente por registro, helper/argumento fixos main-owned e erros tipados sem
diagnóstico privado. Não abre stream, grava nem altera escolha/padrão do Windows.
Sem seletor UI, persistência de saída, mudança no request de captura ou medidor novo.
Helper/captura ainda usam padrão porque main não envia seleção explícita.

33 testes focados/2arquivos (IPC e parser), ambos typechecks, lint26 avisos herdados,
i18n15/964chaves e docs50 aprovados. QA programática real Electron/preload/IPC/helper
passou com exit0:HUD/editor atuais receberam2saídas/1padrão; outra janela e papel
resultado recusados. Sem streams/alteração de dispositivos ou teste GUI. Recibo
`.cache/audio-output-ipc-qa-rC9gkm/metrics.json`, logs `audio-output-ipc-qa.*`.
Suíte completa própria concluída uma vez:355 arquivos/5.003 aprovados/5 ignorados/
346,40s, Node22.22.1, dois workers, exit0/sem signal, fim15:05:17UTC;
recibo/log `.cache/audio-output-ipc-full.{json,log}`. Pacote02S completo aprovado
após renovação em14/10/2026 às14h30Brasília; docs50 revalidado. Entry/chunk/preload
e23payloads nativos conferidos por SHA256; WGCbd69b1e1…48bfbbd preservado.
Log `.cache/audio-output-ipc-package.log`. Sem instalação/relançamento/publicação.
Não confundir full02R anterior com validação desta integração. App do usuário
intacto; pacote anterior02R não foi instalado ou relançado.

Pausa95 real confirmada em14/10/2026 ~15:05UTC:janela5h95%, semanal60%.
Não iniciar novos trabalhos antes de17:27:34UTC (14:27:34Brasília), reset
1791998554+300s. 02R commit03dd3212 enviado;02S ainda NÃO COMMITADO, preservado
em handlers/preload/tipos, módulo IPC/testes e documentação. A suíte02S já passou;
não repetir sem mudança/necessidade. Ao retomar: conferir Git/STATUS/limites,
revalidar docs, gerar pacote completo02S e conferir23payloads/codehash antes de
commit/push. Vite02S já aprovado, helperbd69b1e1…48bfbbd inalterado neste incremento.
Não instalar/lançar pacote parcial, nem anunciar seletor UI/medidor disponíveis.
Automação agora aponta a este chat openScreenCopilot (2), evitando continuar no
chat original sobre o mesmo checkout. Sem prazo final; continuar até pedido humano.

Retomada confirmada17:30:30UTC/14h30Brasília:janela5h0%,semanal61%,allowedtrue.
A pausa95 acima foi cumprida e é registro histórico, não bloqueio atual.
Continuidade15min restaurada neste chat. Finalização02S sem repetir a suíte já
aprovada; próximo trabalho é persistência/seletor Windows e validação antes da
tomada, sem fallback silencioso. Nenhuma escolha de saída foi ativada na UI ainda.

## Incremento 02T — seletor Windows, escolha persistida e preflight

Preferência Windows independente windowsSystemAudioDeviceId:null significa
padrão por tomada; ID MMDevice explícito persiste entre reinícios e desconexão.
Store recusa patch vazio/default literal/controle/tipo inválido; leitura legada
não reescreve arquivo. Escrita IPC desse campo exige HUD/editor/frame principal
atual e não pode ocorrer durante preparação/captura Windows; setter main legítimo
continua disponível. Campo opcional no tipo IPC preserva compatibilidade de clientes.

Main lê escolha própria, confere capability audioOutputSelection e reenumera IDs
ativos antes de passar systemAudioDeviceId ao helper. Default omite o campo para
compatibilidade; ID ausente não vira default. Revalida escolha após awaits e antes
do spawn. Hook recusa fallback Chromium quando sistema ligado e saída explícita.
Gate de startup serializa preparação/cleanup Windows, impedindo que falha de um
segundo start limpe o processo de outra tomada; liberação idempotente no finally.

Seletor simples nas configurações de dispositivos do HUD e no RecStage, apenas
Windows com API disponível. Mostra nomes amigáveis, padrão e escolha indisponível;
Atualizar reenumera sem polling. Não altera toggle sistema/mic nem o padrão do OS.
Escolha desconectada permanece salva/visível; usuário pode escolher explicitamente
o padrão mesmo após falha de enumeração. Aguarda persistência, trata erro e snapshots
mais novos sem sobrescrevê-los com resposta antiga. Bloqueado durante captura no
HUD e durante escrita. Oito textos novos nos15 idiomas.

83 testes backend focados/6arquivos e142 UI/3arquivos aprovados. Typecheck detectou
Object.hasOwn fora do lib alvo; usar hasOwnProperty.call com supressão localizada
para impedir autofix incompatível. QA real isolada preload/prefs/store/helper PASS:
2saídas, ID exato persistido/preflight, foreign owner/startup recusados, ID ausente
preservado e reset explícito para default. Sem streams; recibo privado
`.cache/audio-output-choice-qa-WkS7vn/metrics.json`.
Ambos typechecks finais aprovados, incluindo correção do tipo do mock UI;
lint26 avisos herdados, i18n15/980chaves e docs50 aprovados. Suíte completa uma vez:
357arquivos/5.041aprovados/5ignorados/369,40s, Node22.22.1, dois workers,
exit0/sem signal, fim18:17:41UTC; recibo/log `.cache/audio-output-picker-full.{json,log}`.
Vite e pacote completos aprovados; entry/chunk main-B3cM0hdN/preload e23payloads
nativos SHA256 iguais ao dist/origem. WGCbd69b1e1…48bfbbd inalterado, sem novo
build C++/Rust. Logs `.cache/audio-output-picker-{lint,vite,package}.log`.
Pacote não instalado/relançado. Tentativa GUI em fixture própria com perfil separado:
processo iniciou, mas janela não apareceu em list_windows/list_apps do computer-use.
Sem input OS, screenshot ou aceite visual; não inferir desktop bloqueado. Fixture18580
encerrada somente após conferir caminho/argumento, sem streams ou edição. Perfil/logs
privados preservados. Ver results log manual; app do usuário intacto.
Ainda sem medidor novo ou homologação de gravação audível, main completo,
desconexão física ou input OS. Próximo incremento: medidor sistema limitado/main-owned,
prévia parada antes da captura e homologação de endpoint audível/GUI. GIF/Compartilhar
permanecem no final do roadmap. App do usuário e mídia preservados.

## Incremento 02U — fundação isolada do medidor de saída

CLI nativa --meter-audio-output ID consulta IAudioMeterInformation do endpoint
eRender ativo resolvido uma vez, sem IAudioClient/PCM/keepalive/reprodução/alteração
de volume. Aceita apenas stdin pipe, stop com newline e EOF; erros tipados, sem
fallback. Ready anuncia ID efetivo/hardware/scope render-peak/posição anterior ao
volume do endpoint. No máximo300 valores inteiros peakPermille0–1000, dez/s sem
catch-up, lease30s. Revalida estado do mesmo endpoint, sem seguir mudança de padrão.
Comandos/saída inválidos encerram; objetos COM são liberados no retorno. Startup COM
e stdout bloqueado precisam de watchdog main na integração: lease30s não é prova
de saída se uma chamada COM/escrita síncrona travar. Drenar pipes e, se necessário,
encerrar somente o helper próprio, aguardando close antes de capturar.

Parser main-only WindowsOutputMeterProtocol, ainda NÃO importado pelo runtime:
confere ID explícito, schema/campos exatos/ordem/seq/pico/terminal, recusa PCM e
limita20KiB/linha,128KiB total,300amostras. Futuro transporte precisa limitar também
chunk sem newline, UTF8 parcial, eventos/UI e processos concorrentes. Não há
IPC/preload/HUD ativo, owner/cancel/drain main ou bloqueio antes captura ainda.
Não anunciar medidor pronto; próximo incremento conecta essas garantias primeiro.

Limite documentado pela Microsoft: pico antes do volume da saída; medidor software
em modo exclusivo pode mostrar zero. Atividade não comprova áudio capturado nem
silêncio/falha; UI deverá explicar a limitação e não marcar gravação como homologada.
Referência: [IAudioMeterInformation](https://learn.microsoft.com/en-us/windows/win32/api/endpointvolume/nn-endpointvolume-iaudiometerinformation).
15focados aprovados, ambos typechecks/lint26 herdados/i18n15/980chaves/docs50
aprovados. Build nativo completo aprovado, incluindo33encoderpass. QA real CLI
passou com2saídas explícitas, default/EOF, stop, comando inválido, ID ausente,
stdin não-pipe e expiração30s/274amostras; stop/EOF→close67–100ms, sem streams/PCM/
reprodução. Script versionado scripts/test-windows-audio-output-meter.mjs;
log privado `.cache/audio-meter-native-qa.log`. Seleção CLI anterior passou novamente.
Suíte completa uma vez:358arquivos/5.056pass/5skip/347,44s, Node22.22.1, dois
workers,exit0/sem signal,fim18:37:16UTC; `.cache/audio-meter-full.{json,log}`.
Vite e pacote completos aprovados;23payloads e entry/main-B3cM0hdN/preload SHA
iguais ao dist/origem. Main/preload continuam02T porque parser02U está isolado.
Novo WGC SHA256aaa797a9c1adeceed256f8bce9c8c0c511bc92d55e330250a14d49d6f3c6a1d5.
Logs `.cache/audio-meter-{native-final,lint,vite,package}.log`. Não instalar/relançar/
publicar pacote. CLI sem GUI não homologa HUD, captura audível ou desconexão física;
fatia e skips no results log manual. App do usuário/mídia privada preservados.

## Incremento 02V — transporte/controller do medidor validado isoladamente

WindowsOutputMeter reserva job/UUID antes de lookup, verifica owner/destroyed e
admissão global. Lookup somente resolve caminho (não pode possuir subprocesso);
timeout/cancelamento libera essa fase e impede spawn tardio. Capability obrigatória
audioOutputMeter para default/ID explícito, com processo separado e fechamento
aguardado. Depois usa argumento fixo e escolha main-owned no helper de pico.
UTF8 incremental fatal,20KiB pending sem newline,128KiB stdout/4KiB stderr,
parser estrito e coalescing100ms de níveis. Nenhum PCM ou diagnóstico privado
vai ao callback. Ready só após evento validado/entregue; terminal só no resultado
depois de close. Error/exit não liberam ownership nem autorizam outro helper.

Watchdogs3s lookup/startup/capability e32s meter; cancel envia stop, grace750ms
e eventual kill só do filho próprio. Falha/throw no kill não libera job vivo:
continua aguardando close, sem saída forçada que finja drain completo. Owner
destruído cancela, listener removido no finally, pauseAndDrain bloqueia admissão
sincronamente e pausas são balanceadas/idempotentes. Callback inválido/throw é
contido e encaminhado como erro tipado, sem desanexar processo.

Controller ainda NÃO IMPORTADO pelo runtime/main de produção, sem IPC/preload/UI
e sem proteção real do gravador/quit. Próximo incremento precisa conectar gate de
captura e barreira quit existentes antes de habilitar API/UI; não anunciar medidor pronto.
35focados/2arquivos aprovados; ambos tsc aprovados após tipar mock onEvent e remover
import de teste não usado. QA real Node/controller/helper PASS,4eventos escalares,
stop→close84ms; helper Node sintético que ignora stop foi encerrado e teve close
aguardado em769ms,2processos próprios confirmados fechados (capability+meter).
Recibo privado `.cache/audio-meter-controller-qa.json`; sem streams/UI/captura.
Lint26 herdados/i18n15/980chaves/docs50 aprovados. Full uma vez:359arquivos/
5.076pass/5skip/347,83s, Node22.22.1,2workers,exit0/sem signal,
fim18:58:07UTC; `.cache/meter-controller-full.{json,log}`. Vite e pacote completos
aprovados;23payloads nativos e entry/main-B3cM0hdN/preload SHA iguais ao dist/origem.
Como o controller continua isolado, main/preload ainda02T e WGC02U inalterados:
aaa797a9c1adeceed256f8bce9c8c0c511bc92d55e330250a14d49d6f3c6a1d5.
Sem rebuild C++/Rust, instalação/relançamento/publicação. Logs
`.cache/meter-controller-{lint,vite,package}.log`. Fatia programática e skips GUI/
captura/quit no results log manual. App do usuário e mídia privada preservados.

## Incremento 02W — integração captura/quit

WindowsOutputMeter agora instanciado no main, mas SEM API/preload/UI de início.
WindowsMeterCaptureGuard reserva admissão antes de drenar; captura nativa aguarda
close do medidor antes de spawn e mantém a pausa até close do gravador, não exit.
Chromium Windows valida frame principal/janela HUD-editor atual/local, fonte atual,
ausência de região e ausência de saída explícita quando há áudio; revalida após
awaits. Falha de startup no hook libera preparação; owner fechado libera a lease.
Mudança de preferência cancela/drena prévia. Quit usa a barreira existente, sem
segundo listener; epochs impedem preparação antiga reviver após veto de saída.

QA real isolada encontrou saída terminal parada na reentrada imediata após
promessas já resolvidas. Três tentativas diagnósticas preservadas; somente processos
próprios ociosos encerrados após conferir identidade. Reentrada agora usa setImmediate,
mantendo admissão congelada até o callback; will-quit também drena antes de STT/flush.
QA final Electron/helper passou: drenagem antes da concessão browser simulada,
lease nativa ligada ao close de subprocesso capabilities (NÃO captura de tela),
veto e retomada, saída terminal exit0. Recibo
`.cache/meter-guard-qa-7ee1f53f-3c0c-4721-8496-7c4b2af90812/metrics.json`.
Rechecagem STT real/preload/IPC passou antes/depois de veto programático, mesmo
manager, silêncio sintético2s, shutdown único e quatro flushes; exit0, recibo
`.cache/stt-veto-qa-KrFudH/metrics.json`. Não mede precisão de fala/ASR ao vivo.

Testes focados e ambos typechecks aprovados; lint26 avisos herdados, i18n15/980chaves
e docs50 aprovados. Suíte completa uma vez:360arquivos/5.088pass/5skip/472,84s,
Node22.22.1,dois workers,exit0/sem signal,fim19:40:02UTC;
`.cache/meter-capture-full.{json,log}`. Vite e pacote completos aprovados;
23payloads nativos e entry/main-CX0K8b7A/preload SHA256 iguais ao dist/origem.
WGCaaa797a9…f3c6a1d5 inalterado. Logs `.cache/meter-capture-{final-lint,vite,package}.log`.
Pacote `.cache/result-package/win-unpacked` atualizado02W, não instalado/relançado.
Não houve mudança C++/Rust, captura de desktop privado, instalação ou relançamento
do app do usuário. GUI/input OS, handlers completos captura→resultado, áudio audível,
DPI/borda física e desconexão continuam sem homologação. Próximo: IPC/preload do
medidor com snapshot main-owned, depois UI existente e aceite real. GIF/Compartilhar
permanecem no final, conforme prioridade humana.

## Incremento 02X — IPC/preload do medidor

API start/stop/event tipada, ainda SEM UI montada. Start aceita somente intenção
sem argumentos; main lê preferência e cria snapshot literal de escolha, owner e
callbacks. Apenas HUD/editor atual, frame principal e URL local/origem dev; sistema
ligado e guardas02W/gate/estado ociosos. UUID nasce no controller e identifica
starting/ready/level/ended; níveis já limitados/coalescidos, nunca PCM. Starting
significa pedido admitido, NÃO medidor pronto. Falhas de helper/capability chegam
como terminal tipado; ready valida endpoint efetivo. Stop exige UUID e owner/frame
corretos e só responde após close. Registry permanece ocupado até drain inclusive
erro no envio inicial. Snapshot do frame não reutiliza getter IPC após navegação;
navegação principal, inclusive reload, invalida e cancela startup/helper, sem
entregar eventos à página nova. Troca prefs/owner fechado/captura/quit usam02W.

47focados/3arquivos aprovados (17novos IPC); ambos typechecks e lint26 herdados
aprovados. QA real final isolada Electron/preload/IPC/helper passou com default,
recusa foreign/busy/token incorreto, UUID coerente, stop apósclose, captura guardada,
reload e veto/retomada/quit terminal exit0. Recibo privado
`.cache/meter-ipc-qa-b7334e20-c790-4f80-a2ec-cf260e787d1e/metrics.json`.
Sem IAudioClient/PCM/captura de tela/input OS; não homologa áudio audível ou GUI.
Suíte completa uma vez:361arquivos/5.105aprovados/5ignorados/393,96s, Node22.22.1,
dois workers,exit0/sem signal,fim23:01:47UTC; `.cache/meter-ipc-full.{json,log}`.
Docs50/i18n15/980chaves aprovados. Vite/pacote completo aprovados;23payloads
nativos e entry/main-C-zXdXuj/preload SHA256 iguais ao dist/origem. Sem alteração
C++/Rust; WGCaaa797a9…f3c6a1d5 inalterado. Pacote `.cache/result-package/win-unpacked`
atualizado02X, não instalado/relançado. Logs `.cache/meter-ipc-{lint,final-vite,package}.log`.
App do usuário intacto. Próximo: hook/componente no seletor existente, textos15
idiomas, estado honesto de atividade antesvolume e lease30s sem autorrestart cego.

## Incremento 02Y — medidor visual

Hook useWindowsOutputMeter e componente WindowsOutputMeterTest integrados ao
seletor existente HUD/RecStage. Teste explícito30s; sem autoplay, MediaStream,
AudioContext, polling ou renovação automática. Start/stop, nível scalar0–100 e
estados iniciando/ativo/encerrando/encerrado/erro. UI distingue atividade antesvolume
de áudio gravado, zero em modo exclusivo possível. Novos textos15idiomas.
Busy permanece até terminal/stop main; erro de stop não finge drain. ACK tardio após
unmount/disable/choice cancela UUID recebido; ready/level/ended antes ACK ficam
em buffer limitado com coalescing. Eventos de outro job são ignorados. Choice/
sistemaOFF/locked/loading/saving/saída ausente suspendem teste. Main02W/02X ainda
garante exclusão/close antescaptura independentemente do cleanup React.

166focados/5arquivos aprovados, ambos typechecks, lint26 herdados e i18n15/998chaves
aprovados; Vite aprovado. Suíte completa uma vez:363arquivos/5.129aprovados/
5ignorados/385,86s, Node22.22.1,dois workers,exit0/sem signal,
fim23:18:59UTC; `.cache/meter-ui-full.{json,log}`. Pacote completo aprovado;
23payloads/entry/main-C-zXdXuj/preload e27assets/index renderer SHA256 iguais ao
dist/origem. Primeiro verificador próprio usou separadores POSIX em caminho asar
Windows aninhado e falhou; corrigido para paths nativos e exclusões extraResources,
sem mudar/reempacotar conteúdo por causa do checker. WGC inalterado, sem C++/Rust.

GUI: primeira fixture PID28524 iniciada com WindowStyleHidden não apareceu nas
janelas; encerrada ociosa após conferir exe/args. Reteste como janela interativa
visível apareceu e foi controlado por computer-use. Primeiro clique sem screenshot
falhou geometry unavailable; nova seleção+observação com screenshot recuperou.
Cliques OS reais Testar/Parar mostraram iniciando→atividade→encerrando→encerrado,
botão retornou ao teste, nível0 honesto em saída sem atividade observada. Fechamento
normal Alt+F4; recibo `.cache/meter-panel-qa-90c8905b-2ab5-40f3-9716-c6e086948ed8/metrics.json`:
ready1,children2,closed2,busyfalse,noStreams. Não foi DOM injection; é aceite PARCIAL
do componente real/preload/IPC/helper em wrapper de QA, não HUD completo, layout/DPI,
áudio audível ou captura→resultado. Logs/perfil privados preservados; app do usuário
intacto. Não deixar flags de conteúdo desprotegido em gravações reais.

## Prova sintética de janela/áudio — 2026-10-14

Primeira tentativa com processo oculto falhou CreateForWindow0x80070057 antes
Recording started; nenhum MP4/sinal iniciado. Reteste com janela visível e mesmo
handle/config passou, sem fallback para monitor/desktop. MicOFF/cursorOFF/webcamOFF,
somente HWND próprio, secondaryWindows desabilitado no filho. Quatro tons440Hz
baixos (gain0,015) e flashes; endpoint explícito igual ao ID efetivo audio-format.
Loopback continua de TODA saída, não isolamento de processo. Mídia/logs privados.
Recibo `.cache/window-tone-qa-3635812d-27b0-473a-81d2-b563d3bb2f8f/metrics.json`:
decode integral limpo,764.997bytes,áudio8,128s/vídeo8,133333s; onsets áudio menos
vídeo40/7/7/7ms. Tolerância diagnóstica do harness200ms, não aceite de longo prazo,
30min/carga/pausa/DPI/mic/Teams/Slack/YouTube ou todos endpoints. Nenhuma mudança OS,
download, upload ou captura de desktop privado. Confirma apenas este caso sintético.

## 02Z — fluxo GUI completo pendente de autorização visual

App compilado abriu em perfil QA próprio `.cache/full-app-qa-fa2d1ba3-afcb-482b-aa1d-97f00026f397`,
com appData isolado antes initialize-identity e appPath do checkout; helper atual
fixado no processo. HUD de QA desprotegido somente nessa instância; fonte sintética
em processo separado. Startup/prefs padrão observados, sem clicar Gravar, sem MP4.
Screenshot do HUD transparente mostrou fundo de Teams/navegador. Auto-review
rejeitou ativação+nova screenshot por risco de conteúdo privado fora da fixture.
Tentativa da alternativa de cobertura opaca em todos monitores também rejeitada
por interferência ampla sem autorização explícita; NÃO executada. Não contornar.

Solicitada autorização humana para cobertura temporária opaca de QA, sem alterar
Windows/capturar apps ao fundo; ainda pendente. Não repetir GUI desse fluxo até
resposta. Limpeza segura: observação apenas texto confirmou HUD ocioso/sem arquivos,
AltF4 normal em HUD e fonte; processos próprios15480/25280 confirmados encerrados.
Nenhuma instância com content-protection OFF ficou ativa. App/perfil/mídia do usuário
intactos. Arraste/Escape/borda física/DPI/captura→resultado ainda NÃO homologados.
Trabalho independente seguro pode continuar sem essa autorização; não tratar
dependência de GUI como aceite nem repetir pedidos a cada wake.

## Preparação independente — inventário speech-core

Enquanto autorização visual02Z está pendente, leitura do snapshot congelado
registrou [SPEECH-CORE-INVENTORY.md](SPEECH-CORE-INVENTORY.md). Mapa de fronteiras
Tauri/captura/provider/VAD/persistência, versões do Cargo.lock raiz e riscos de
filas unbounded/relógios/engines duplicados. Ruído mic já tem candidato nnnoiseless
no snapshot, mas permanece backlog: comentários e comportamento de buffering
precisam testes. Nada foi extraído, executado, instalado ou alterado em vendor.
Documento não é auditoria completa de licenças/modelos nem aceite etapa04.

## Prova sintética de pausa — 2026-10-14

Teste independente do HUD bloqueado, apenas HWND opaco próprio e endpoint explícito,
sem screenshot de fundo/cobertura de monitores/microfone/cursor/webcam.10s de wall,
pause aos3s/resume aos5s (um ACK cada), cinco tons/flashes programados. Um marcador
na pausa foi excluído; quatro restaram. Decode integral limpo, áudio8,128s/vídeo8,1s,
759.446bytes, diferenças áudio menos vídeo40/7/7/7ms. Recibo privado
`.cache/window-pause-qa-a7ef5d7b-9013-4c4f-99bd-86841023bb4f/metrics.json`, exit0.
Sem alteração de produção/nativo/vendor e sem novo build nativo. Não prova precisão
de ASR, carga longa, pausas rápidas ou todos dispositivos. GUI02Z continua pendente
de autorização, não foi contornada. Mídia privada preservada e não enviada.

## Prova sintética de pausas rápidas e correção de medição — 2026-10-14

HWND opaco próprio, endpoint explícito, mic/cursor/webcam OFF,8s de wall:
três pares pause/resume nominais10ms, três ACKs de cada, exit0/decode limpo,
740.692bytes. Timers do host NÃO garantiram10ms: intervalos de envio medidos
15,0/0,126/15,8ms; não são duração efetiva nativa. Recibo privado
`.cache/window-rapid-pause-qa-a3889ecf-1fe9-4477-ac2d-b71366ffe76e/metrics.json`.

A primeira análise usava índice de quadro/30 como tempo e reportou53/20/130/130ms.
Isso é inadequado para frames com PTS variáveis, especialmente após pausas.
Reanálise dos MESMOS arquivos, sem captura adicional, correlacionou cada frame
decodificado ao best_effort_timestamp_time do ffprobe; contagem de frames conferida.
Recibos `metrics-pts.json` nas três pastas privadas: baseline39/6/6/6ms;
pausa2s40/6/5/6ms; rápidas52/20/-38/-38ms (áudio menos vídeo). Vídeo rápido
tem duração de stream8,068267s, não237/30=7,9s; áudio decodificado8,021333s.
O PASS do harness original era tolerância diagnóstica ampla200ms, NÃO aceite.
Não alterar relógio nativo a partir de deriva aparente causada pelo analisador.

Marcadores curtos não revelaram deriva crescente após a última pausa, mas houve
mudança de offset; ainda faltam repetição, carga longa e teste dentro da fala/tons.
Áudio usa offsets de amostras decodificadas; priming AAC/origem do stream e resolução
temporal de10ms/um frame limitam a comparação. Sem homologação de pausas10ms,
precisão ASR,30min, interface ou todos endpoints. Sem fonte de produção/vendor
alterada, sem rebuild/reempacotamento; GUI02Z continua bloqueada pela autorização
pendente e não foi contornada. Docs apenas; suíte02Y não repetida.

## Preparação04 — mapa amostras/mídia v0 (isolado, validado)

[SPEECH-TIMELINE-DRAFT.md](SPEECH-TIMELINE-DRAFT.md) detalha domínios separados,
épocas, pausas/lacunas, resampling/VAD e accepted versus checkpoint durável.
Oito fixtures compartilháveis em contracts/copilot/source-timeline.v0.fixture.json;
nenhum PCM/texto privado. sourceTimeline.ts é aritmética pura com BigInt, sem
imports no runtime e sem IPC/permissão/transport. Caller precisa isolar sessão/fonte;
não é validador do registro global. Rejeita u64 não canônico/overflow, epoch/rate
inválido, range vazio/reverso, ausência ou ambiguidade inclusive interseção parcial.
Não arredonda duração acumulada por chunk nem desconta pausa novamente.

35 testes focados aprovados, ambos tsc, lint26 avisos herdados, i18n15/998chaves
e docs52 aprovados. Suíte completa única364arquivos/5164pass/5skip/389,14s,
Node22.22.1/2workers,exit0/sem signal, término2026-10-15T00:04:11Z;
`.cache/source-timeline-full.{json,log}`. Vite e pacote completo aprovados;
23payloads nativos, entry/main-C-zXdXuj/preload e27rendererassets/index SHA
iguais ao dist/origem. Como o módulo não é importado no runtime, bundle de captura
continua02Y. Pacote `.cache/result-package/win-unpacked` conferido, sem instalar
ou relançar no perfil do usuário. Logs `.cache/source-timeline-final-*.log`.
Sem fonte nativa/vendor alterada, modelo/download/extração Rust ou ASR novo.
GUI02Z permanece bloqueada por autorização, sem contorno nem aceite inventado.

## Preparação03 — compressão Windows

[WINDOWS-COMPRESSION-SPIKE.md](WINDOWS-COMPRESSION-SPIKE.md) registra o caminho
observado: H.264 High, orçamento18/28/45Mbps por pixels, VBR/meanbitrate best-effort,
runtime efetivo distinto da preferência. Não há AV1 nesse caminho implementado.
Plano de comparação estático/rolagem/dinâmico/30min ainda não executado; não promete
tamanho ou qualidade por bitrate/nome da GPU. Docs somente, sem alterar encoder,
pacote ou repetir suíte já aprovada. GUI01/02 e autorização continuam pendentes.

## 02Z — autorização recebida; reteste GUI bloqueado no hit-test

Usuário respondeu Sim à cobertura opaca temporária de todos os monitores.
Em2026-10-15T03:39UTC créditos renovados(5h1%/semanal90%); watchdog1min restaurado,
sem pausa entre incrementos. A falta de autorização descrita acima é HISTÓRICA.

Cobertura própria foi executada e conferida por computer-use: um monitor retornado,
bounds1280×800DIP/fullscreen/visível/opaco, somente pixels sintéticos no fundo.
Recibo `.cache/opaque-source-qa-4533692b-7434-4c6f-9ff9-6c0cf69badb3/coverage.json`.
App compilado02Y em appData privado `.cache/full-app-qa-d5b3ab81-c015-4a11-a28c-430932f778fe`,
HUD QA desprotegido somente nessa instância. Árvore/screenshot mostrou controles
e aviso inicial de idioma, mas clique Switch-to-Português falhou:
`point (1052,986) is over electron.exe Chrome Legacy Window, not target openScreenCopilot`.
Uma ativação+observação nova e uma tentativa por coordenadas frescas falharam
novamente(1052,984). Tab não produziu foco utilizável. Sem cliques adicionais,
DOM injection ou relaxamento de hit-test. Não foi identificado se causa está no
app, DPI ou controle; HudNotice já tem data-hud-interactive, portanto não alterar
esse código por suposição. NÃO homologa clique HUD, idioma, região ou resultado.

Sem Gravar/MP4/streams. AltF4 normal fechou app e cobertura, processos próprios
20620/21020 confirmados ausentes após conferir identidade/caminho/estado.
Nenhuma cobertura ou instância desprotegida ficou ativa. Não reutilizar PIDs.
Autorização continua válida; novo bloqueio é técnico, não pedir a mesma permissão.
Arraste/Escape/borda física/DPI/fluxo completo seguem pendentes. Trabalho seguro
independente pode avançar; próximo reteste precisa recuperar controle confiável
ou ajuda humana, não repetir cegamente a mesma ação. Sem mudança de produção.

## Preparação03 — enumeração MF real sem captura

Probe C++ isolado MSVC/SDK existentes passou exit0: H2642hardware/4all,
HEVC2hardware/4all,AV1 2hardware/2all; S_OK nas seis consultas. Sem ActivateObject,
encode, captura, registro local, driver/OS changes ou downloads. Não confundir
ALL com software ou número de MFTs com GPUs. Evidência e fonte Microsoft em
[WINDOWS-COMPRESSION-SPIKE.md](WINDOWS-COMPRESSION-SPIKE.md), log privado
`.cache/mf-codec-enum.log`. AV1 é candidato, NÃO suporte comprovado/MP4 pronto.
App continua H264 e pacote/runtime02Y inalterados; não rebuildar nativo ou repetir
suíte por esta análise documental. GUI02Z agora tem autorização, mas input técnico
continua bloqueado; app/coberturas encerrados. Nenhum aceite dispensado.

## Preparação04 — aritmética Rust isolada validada

Novo crates/speech-core, workspace/lock próprios sem alterar compositor/vendor.
Biblioteca std-only, sem build.rs/Tauri/modelos/hardware/provider/sidecar/ASR.
Implementação original do mapa v0, não código extraído do meeting-copilot.
u128 intermediário e conversão u64 verificada; strings canônicas, épocas,
rate1–192000 provisório, intervalos/gaps/ambiguidade como versão TS. Caller deve
isolar sessão/fonte; ainda não existe validador global/transport/wire.

Rust/cargo1.98.1 estáveis já instalados, sem atualizar toolchain; cargo test offline
passou7testes debug e7release (um verifica as mesmas8fixturesJSON), clippy all-targets -Dwarnings
passou. serde_json1.0.150 é somente dev-dependency/cache existente; runtime sóstd.
Sem download ou build de vendor/modelo/app. Saídas em.cache/speech-core-target.
Focados TS35pass, ambos typechecks, lint26 herdados,i18n15/998chaves,docs53 e
check de pacote aprovados:23payloads/entry/main-C-zXdXuj/preload/27rendererassets
SHA iguais ao dist/origem. App/runtime/pacote02Y não alterados nem relançados;
não reconstruir compositor/WGC por biblioteca isolada que não é ligada a eles.
Contadores próximos de u64::MAX e partições variadas em sete taxas testados.
Workspace Rust novo não é exercitado automaticamente pela CI/npm do compositor;
README registra comandos explícitos offline/locked, sem alegar cobertura CI.
suíte TS completa anterior5164pass não precisa repetir sem alteração TS/runtime.
Aceites04/05 não concluídos por port da aritmética.

## 02Z — rota de teclado abriu editor; cobertura ocluiu imagem

Tentativa distinta por menu nativo existente Ctrl+N, sem repetir cliques do HUD:
perfil privado `.cache/full-app-qa-079dcf6e-ba37-48ce-a52b-3a11b83bbd22` e cobertura
`.cache/opaque-source-qa-5faf904f-d107-4171-98de-a9723ed5e9f3`. Computer-use enviou
Ctrl+N; janela mudou e primeira observação falhou `foreground window did not report
a process id`. Uma seleção nova recuperou janela real windowType=editor, No project,
abas Media/Edit/Record e controles. Prova PARCIAL de atalho/abertura, não de mouse.

Screenshot do editor retornou a cobertura sintética à frente, não imagem do editor.
A cobertura always-on-top pode explicar essa oclusão; não inferir falha do render.
Sem clicar controles ou iniciar captura. AltF4 normal no editor vazio e cobertura;
processos próprios16004/6480 confirmados ausentes, semMP4. Logs privados
`.cache/keyboard-{app,cover}.{stdout,stderr}.log`. Nenhuma cobertura ativa.

Harness privado da cobertura foi ajustado para NÃO ser always-on-top, mantendo
fullscreen opaco, para permitir ativar editor acima dele sem expor apps ao fundo.
Essa alteração de fixture AINDA NÃO EXECUTADA/VALIDADA. Próximo reteste deve conferir
cobertura/ordem de janelas frescas antes screenshots e parar se aparecer fundo privado.
Não constitui fix no produto, aceite visual/layout/DPI ou dispensa do bloqueio HUD.
Não repetir a tentativa antiga; usar rota Ctrl+N e recuperação de seleção já observadas.

## PAUSA95 semanal — 2026-10-15T04:04:09Z

Limites reais:5h30%/semanal95%, ordinaryUsageAllowedtrue. Parar desenvolvimento
conforme guarda humana; próximo instante permitido após reset semanal+5min é
2026-10-20T21:10:17Z (20/10 às18:10:17Brasília), reset1792530317+300.
Nenhum crédito/reset consumido. Código validado enviado atéda5d4049, sem operação,
captura, app desprotegido ou cobertura QA ativos. Autorização de cobertura continua.

Falha administrativa real: automation_update deixou de responder. Duas tentativas
de reagendar e uma de pausar watchdog não confirmaram; execs foram interrompidos
após espera, o resultado externo tardio continua incerto. Leitura SQLite READ-ONLY
após as duas primeiras ainda mostrou ACTIVE/FREQ=MINUTELY;INTERVAL=1,
next_run_at2026-10-15T04:05:00Z, não o reset semanal. Não editar TOML/banco manualmente
nem prometer que reagendamento foi aplicado. Pode existir pedido externo pendente:
conferir estado salvo antes de tentar novamente. Não repetir esse erro em loop.

Se heartbeat antigo acordar antes20/10T21:10:17Z, NÃO executar código/testes/build/GUI,
nem sondagens repetidas do agendador. Preservar pausa e reportar somente mudança real.
Retomada automática ainda NÃO confirmada; precisa recuperar serviço de automações
ou ajuste humano no app. Esta nota prevalece sobre checkpoints antigos94%/retomada.
Não consumir resets/trocar modelo/conta/contornar limite semanal. Após a guarda,
consultar limites reais de ambas janelas antes de restaurar watchdog/trabalho.

## Retomada por limites reais renovados — 2026-10-15T11:39:22Z

Consulta atual da mesma conta:5h27%/semanal4%, ordinaryUsageAllowedtrue,
resetsAt primário1792075364 e semanal1792662164. Ambos mudaram desde a pausa;
os dois créditos de reset continuam disponíveis e o agente NÃO os consumiu.
Não foi identificada a causa da renovação; não atribuir a compra/reset automático.

A previsão20/10 da nota anterior foi derivada do resetsAt ANTIGO, não prazo humano
fixo. Pela duração das janelas, a nova âncora inferida é1792057364
(15/10T08:22:44Z); +5min08:27:44Z já passou. Regra humana continua retomar após
renovação real+5min, trabalhar até89%5h/95%semanal. Portanto a guarda histórica
20/10 não deve manter trabalho parado após esta evidência de limites renovados.
Consultar dados reais entre incrementos; não contornar novos limites ou comprar resets.

HEAD base982f8d8f/árvore limpa antes desta nota. Retomar QA autorizado com coverage
normal-z-order e rota Ctrl+N, não repetir cliques do HUD já falhos. Autorizações,
privacidade, validações e dependências do roadmap permanecem. Falha anterior do
agendador não foi declarada corrigida; uma nova tentativa precisa ser confirmada.

## QA 02Z — editor visível e lacuna no seletor Record — 2026-10-15

Com cobertura sintética fullscreen opaca em z-order normal (1 display1280×800DIP),
Ctrl+N abriu editor real acima da cobertura. Clique OS em Record passou. Testar
áudio do sistema mostrou Stop test/Output activity e encerrou por lease30s,
voltando a Test ended. Pico observado0: não comprova áudio audível/capturado.
Sistema ON inicial, microfone/câmera OFF. Sistema foi desligado no perfil privado
antes de abrir fontes, para não gravar áudio de aplicativos privados.

O seletor INLINE de RecStage abriu somente Screens/Windows, sem Região: causa
confirmada no código, distinto de launch/SourceSelector. Não selecionar tela inteira
como substituição. Cancel passou, Alt+F4 fechou editor vazio e depois cobertura.
PIDs próprios28352/29344 confirmados ausentes, diretório recordings sem arquivo.
Logs privados .cache/normal-{app,cover}.{stdout,stderr}.log. Chromium listagem teve
timeout WGC de primeira frame; não é prova de defeito no gravador nativo.

Correção PARCIAL: Windows RecStage encaminha escolha ao picker dedicado existente;
nenhuma mudança em autorização IPC/crop/helper. Eventos main atualizam a fonte no
editor; abrir/selecionar não chama Start. Erro de abertura mostra texto já traduzido,
sem fallback para tela inteira. Apple/system picker e inline fora Windows preservados.
Regressão reproduzida2falhas/34pass antes; após40pass/2arquivos focados.
Typecheck app aprovado. Testes detectaram mock incompleto (thumbnail/appIcon),
corrigido e typecheck testes revalidado. Vite aprovado. Full uma vez:364arquivos,
5167pass/5skip,396,67s, Node22.22.1/2workers/exit0/sem signal, fim12:05:55UTC;
.cache/rec-region-full.{json,log}. Lint26 avisos herdados; i18n15/1000chaves OK.
docs53 OK após terminar suíte: primeira checagem concorrente viu probe temporário
criado pelo teste do próprio docs checker; não era quebra documental permanente.
Pacote completo .cache/result-package/win-unpacked atualizado e conferido:
23payloads nativos, entry/main-C-zXdXuj/preload e27rendererassets/index SHA iguais
ao dist/origem. Sem fonte nativa alterada/rebuild nativo. Primeira chamada de pacote
usou caminho CLI inexistente e falhou antes de executar; corrigida para
node_modules/electron-builder/cli.js, exit0. Logs rec-region-{vite,package,lint}.log.
Pacote não instalado/relançado no perfil humano; QA usou build dist em perfil isolado.

Reteste com código compilado corrigido e outro perfil isolado: Ctrl+N → Record →
Source abriu janela dedicada windowType=source-selector com Region. Clique Region,
monitor e Draw area abriram overlay real. Arraste OS(158,120)→(798,520)DIP mostrou
960×600px (escala150%), borda e Use this area habilitado. Escape fechou overlay,
seletor permaneceu no UIA e editor continuou sem fonte, sem autostart/MP4.
Não houve confirmação da área nem tomada real.

Após Escape, screenshot do seletor mostrou editor atrás em vez do seletor; uma
ativação+reobservação não recuperou. Fatia interrompida sem novos cliques cegos.
Alt+F4 editor vazio passou, mas seletor remanescente não fechou com Alt+F4 próprio.
Fixture17108 conferida por caminho/args, nenhuma instância WGC/MP4; encerrada somente
essa fixture ociosa. Cobertura19012 fechada normalmente. Sem mudança no perfil humano.
Logs .cache/rec-region-{app,cover}.{stdout,stderr}.log; perfil
.cache/full-app-qa-896cc233-b324-498f-80a5-f836d11d85fd. Isso não demonstra a causa
da imagem divergente (oclusão/visibilidade/driver ainda a diagnosticar); não alterar
z-order do produto por suposição. Nova pendência: retorno visual do picker após Esc.
Não declarar fluxo captura→resultado, confirmação de área, borda de gravação,
DPI misto ou áudio homologados; arraste/Escape passou somente nesta configuração.

Automação voltou a responder: atualização via ferramenta confirmou ACTIVE e
FREQ=MINUTELY;INTERVAL=1, também conferidos no arquivo salvo read-only.
Guardas antigas de previsão semanal foram superadas pelos limites reais novos,
sem consumo de reset. Isso confirma configuração salva, não prova ainda uma wake
futura após renovação. Continuidade e limiares humanos não foram relaxados.

## Preparação04 — registro limitado de mapas — 2026-10-15

Após37d4a1c8 (correção Record enviada), crate Rust independente ganhou
timeline_registry.rs. Biblioteca std-only, sem dependência nova, Cargo.lock intacto,
vendor/compositor imutáveis. UMA sessão por instância, fonte exata, queries isoladas;
append valida intervalo inteiro/overflow, ordem amostras/épocas/mídia e taxa fixa
por época. Época nova permite reset contador/taxa, nunca reset mídia. Replay exato
não consome capacidade (mesmo cheio), replay conflitante falha. Inserts inválidos
não reservam fonte nem removem mapas antigos. Limites positivos configuráveis com
tetos provisórios64fontes/4096trechos/128bytesID; capacidade falha explicitamente.

14debug+14release, clippyalltargets-Dwarnings e fmt aprovados offline/locked,
Rust/cargo1.98.1, CARGO_TARGET_DIR=.cache/speech-core-target. 7testes novos cobrem
sessão/fonte, replay/capacidade, fronteiras/gaps/pausa, overlap/ordem/taxa, reset
época, metadados inválidos/atomicidade e limites UTF-8/configuração. Originais incluem
as8fixturesTS compartilhadas. Não repetir fullTS5167pass já aprovado: nenhuma
alteração TS/runtime neste incremento. Pacote app continua37d4a1c8; crate não é
dependência do compositor/app nem incluído como novo runtime.

NÃO é registro global do host, parser wire, autorização, dedup de áudio/sequence,
journal/recuperação ou normalização/ASR/sidecar. Estado se perde ao descartar objeto.
Limites não prometem duração/gravação longa/memória de inferência. Sem novo download,
buildvendor, modelo, áudio capturado, Tauri ou FFI. Gates01–03/04 permanecem.

## Regra de atualização contínua (entregas)

A cada PR, registrar: escopo, commits/helpers, comandos, resultados e testes não
executados com motivo. Não marcar metas de desempenho como concluídas por estimativa.
