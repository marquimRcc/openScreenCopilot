# Automações da fundação

O fork foi criado com aviso de Actions desativadas. Após a publicação da branch/PR,
o GitHub passou a executar os workflows herdados. Não presumir que o aviso inicial
é um bloqueio permanente nem que ele substitui condições dentro dos workflows.

## Política versionada

- ci.yml e nix-check.yml podem validar código, testes e o hash do lockfile no fork.
- Todos os jobs dos demais workflows exigem explicitamente que github.repository
  seja getopenscreen/openscreen; portanto são ignorados em openScreenCopilot.
- Isso inclui publicação, Store, winget, AUR, Homebrew, site, Discord, aprovação
  automática, bookkeeping e builds auxiliares/schedules ainda não auditados.
- O teste .github/scripts/fork-workflow-policy.test.mjs protege essa lista e exige
  guardas para qualquer novo workflow não autorizado.
- Para habilitar um fluxo próprio depois, revisar destinos, permissões, credenciais,
  identidade dos pacotes e teste de distribuição, além de atualizar esta política.

As guardas preservam o código herdado como referência; não configuram um canal
de distribuição funcional para o novo projeto. Não adicionar secrets upstream.

## Execução inicial

A primeira CI expôs o hash Nix desatualizado após a declaração da dependência de
teste. O valor esperado foi obtido do prefetch-npm-deps executado pelo próprio job
e aplicado em nix/package.nix. O novo job deve confirmar a correspondência.
Isso não equivale a build Nix completo nem homologação RegataOS.

O primeiro job Discord não enviou mensagens: seu log registra que token/canal
não estavam disponíveis e que a sincronização foi ignorada. A guarda versionada
evita depender dessa ausência de secrets nas próximas execuções.

Eventos pull_request_target usam a base do PR; enquanto a inicialização não chega
a main, os jobs antigos ainda podem ser disparados. Após merge, passam a usar
as guardas. Não houve publicação de release ou instalador nesta etapa.

## Validação independente speech-core

ci.yml agora declara job speech-core, sem ampliar triggers/distribuição. Permissão
contents:read, timeout15min, Rust1.98.1 fixado como validação local, manifest/lock
próprios crates/speech-core. Fetch do lock antes de testes debug/release/clippy/fmt
offline; target no temp do runner, sem compositor/SDK/FFmpeg/modelos/artefatos.
Teste local .github/scripts/speech-core-ci.test.mjs protege comandos/isolamento.
É configuração validada localmente, não evidência de execução CI remota ou RegataOS.
O npm/compositor não executam esses testes Rust implicitamente; job separado evita
que futuras mudanças do core deixem de ser exercitadas nos eventos CI existentes.
