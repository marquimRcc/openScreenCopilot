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

Seleção retangular, seletor novo de endpoint de saída, encoder AV1 na captura,
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

## Regra de atualização

A cada PR, registrar: escopo, commits/helpers, comandos, resultados e testes não
executados com motivo. Não marcar metas de desempenho como concluídas por estimativa.
