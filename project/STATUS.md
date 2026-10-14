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

## Regra de atualização

A cada PR, registrar: escopo, commits/helpers, comandos, resultados e testes não
executados com motivo. Não marcar metas de desempenho como concluídas por estimativa.
