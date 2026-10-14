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

## Regra de atualização

A cada PR, registrar: escopo, commits/helpers, comandos, resultados e testes não
executados com motivo. Não marcar metas de desempenho como concluídas por estimativa.
