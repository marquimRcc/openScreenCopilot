# Fontes, histórico e manutenção

## Origem fixada

| Base | Repositório / commit | Local |
|---|---|---|
| OpenScreen | [getopenscreen/openscreen](https://github.com/getopenscreen/openscreen) — `c3d167f2569a7f058d642e9fdbb09b0f02f052da` | Raiz |
| meeting-copilot | [marquimRcc/meeting-copilot](https://github.com/marquimRcc/meeting-copilot) — `3c299c99abf7c38c1e3bac34c4aecdc010c911dd` | `vendor/meeting-copilot/` |

Registro legível por máquina: [upstreams.lock.json](upstreams.lock.json).
As referências acima não acompanham main automaticamente.

GitHub registra um único projeto de origem para um fork. Por isso openScreenCopilot
é formalmente fork de OpenScreen. A segunda base entra em um prefixo próprio,
com merge de históricos não relacionados, sem squash. Não são dois forks
independentes apresentados falsamente como um só.

## Mapa de reaproveitamento

| Origem | Reuso planejado |
|---|---|
| `electron/native/wgc-capture/` | WGC, WASAPI, D3D11; região, endpoint e encoder novos |
| `electron/stt/` | Baseline pós-gravação, gestão de modelos e integração com editor |
| `crates/compositor/` | Editor/preview/exportação existentes, preservados |
| `vendor/meeting-copilot/frontend/src-tauri/src/audio/` | Extração de core Rust: resample, VAD, providers, sessão |
| `vendor/meeting-copilot/frontend/` | Referência de UX/contratos; não segundo frontend executado |
| `vendor/meeting-copilot/backend/` | Legado arquivado, não usar como backend da integração |

A implementação original de ASR contém dependências Tauri. "Reutilizar" não quer
dizer que a pasta possa ser importada diretamente em Electron.

## Licenças

Preservados [LICENSE](../LICENSE), [licença meeting-copilot](../vendor/meeting-copilot/LICENSE.md)
e avisos de terceiros de cada base. Consulte [THIRD_PARTY_SOURCES.md](../THIRD_PARTY_SOURCES.md).
Manter copyright dos autores quando extrair arquivos; documentar origem e modificações.

O submódulo legado `backend/whisper.cpp` é um gitlink fixado em
`d682e150908e10caa4c15883c633d7902d385237`. Seu mapeamento foi adicionado à
[.gitmodules raiz](../.gitmodules) com o prefixo vendor; não foi inicializado.
Não é necessário para o MVP. `git clone --recurse-submodules` pode baixar esse
componente legado; prefira clone normal para trabalhar na integração.

## Checkout e remotes

```powershell
git clone https://github.com/marquimRcc/openScreenCopilot.git
cd openScreenCopilot
git remote add upstream-openscreen https://github.com/getopenscreen/openscreen.git
git remote add upstream-meeting-copilot https://github.com/marquimRcc/meeting-copilot.git
git fetch --all
git switch -c feat/windows-baseline
```

Remotes são configuração local, não arquivos versionados. O manifest registra as URLs.
Não reconfigurar globais de Git nem sobrescrever o clone do meeting-copilot do usuário.

## Atualizar OpenScreen

Criar branch própria; buscar o remote e revisar diff/avisos/licenças antes de merge.
Resolver conflitos sem descartar modificações do fork, atualizar o manifest e rodar
testes. Não fazer reset ou force-push em main para "igualar ao upstream".

## Atualizar meeting-copilot

Atualizar o prefixo inteiro por um merge de subtree em branch própria, preservando
a história e sem editar manualmente o snapshot. Depois revisar diferenças e portar
seletivamente correções para speech-core quando ele existir.

```powershell
git switch -c chore/update-meeting-base
git fetch upstream-meeting-copilot main
git merge -s recursive -Xsubtree=vendor/meeting-copilot --allow-unrelated-histories upstream-meeting-copilot/main
```

O comando é um ponto de partida de manutenção: revisar o resultado, conflitos,
gitlinks e testes antes de commit/PR. Nunca executar na main nem confiar no merge
como validação automática. Atualizar .gitmodules se o upstream alterar seu gitlink.

## Dependências e automações

A raiz usa npm; vendor mantém seus próprios manifests/lockfiles, sem conversão
para o workspace raiz. Não executar instalação recursiva, backend Python nem
workflows vendor. TypeScript/Vitest da raiz já têm escopo explícito; Biome exclui vendor.
O pacote Electron inclui dist/dist-electron, não o snapshot inteiro.

Os workflows raiz ainda vêm do OpenScreen. Fork novo pode manter Actions desabilitado
até revisão. Não habilitar release, deploy de site, Store, winget, AUR, Homebrew,
Discord ou aprovação automática herdados. Não adicionar secrets dos autores.
A etapa 01 audita automações, identidade de pacote e feeds antes de distribuição.

Os arquivos arquivados em project/upstream mantêm conteúdo original: links relativos
não foram reescritos para não adulterar a referência. Use o commit fixado no upstream
se precisar navegar integralmente pela documentação original.

## Ajustes de desenvolvimento desta fundação

Foi declarada explicitamente a dependência de desenvolvimento `@noble/hashes` v2:
o teste de AppImage usa `blake2.js`, mas a versão aparecia apenas como peer opcional
no lockfile e não era instalada neste Windows. O lockfile preserva a versão já
resolvida; não há alteração de dependência de produção.

Foram fixados finais LF para JSON/JS/CJS/YAML, além dos tipos já cobertos, evitando
falhas de formatação e de testes que leem workflows como texto no Windows.
A árvore Git do snapshot meeting-copilot continua idêntica ao commit de origem.

O hash de dependências Nix precisa ser recalculado/validado em ambiente Nix após
esta alteração de lockfile. Não foi executado nesta fundação Windows, nem é prova
de compatibilidade com RegataOS. Tratar na auditoria de builds da etapa 01.
