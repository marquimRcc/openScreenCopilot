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
perfil 300 MB, core Rust extraído, sidecar novo, transcrição durante gravação,
persistência nova, rebranding/isolamento de identidade e homologação RegataOS.

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

## Próxima etapa

01 — Baseline Windows e identidade isolada, conforme [ROADMAP.md](ROADMAP.md).
Começar pelo inventário do ambiente e isolamento de userData/auto-update; somente
depois produzir um pacote de teste. Preservar instalações existentes.

## Regra de atualização

A cada PR, registrar: escopo, commits/helpers, comandos, resultados e testes não
executados com motivo. Não marcar metas de desempenho como concluídas por estimativa.
