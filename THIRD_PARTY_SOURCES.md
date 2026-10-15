# Fontes incorporadas

Este repositório deriva de duas bases MIT. Nenhuma atribuição original foi removida.

| Base | Titulares conforme licença | Licença preservada |
|---|---|---|
| OpenScreen | Siddharth Vaddem; OpenScreen contributors | [LICENSE](LICENSE) |
| meeting-copilot | Zackriya Solutions, conforme arquivo original | [LICENSE.md](vendor/meeting-copilot/LICENSE.md) |

As versões/SHAs, diretórios e procedimento de manutenção estão em
[project/UPSTREAMS.md](project/UPSTREAMS.md) e
[project/upstreams.lock.json](project/upstreams.lock.json).

[THIRD-PARTY-NOTICES.md](THIRD-PARTY-NOTICES.md) continua sendo o aviso do OpenScreen
para bibliotecas/binários herdados. Este registro não substitui esse arquivo nem
os avisos do meeting-copilot. Dependências de modelos/FFmpeg/Whisper/ONNX devem ser
auditadas antes de distribuir o produto integrado.

A segunda base é uma importação versionada, não um segundo app instalado e nem uma
alegação de autoria do código original. Marcas, certificados, feeds e contas de
publicação upstream não são transferidos pela licença MIT.

## Extração isolada para speech-core — 2026-10-15

[downmix.rs](crates/speech-core/src/downmix.rs) adapta somente
`audio_processing.rs::audio_to_mono` do commit meeting-copilot fixado acima.
Copyright Zackriya Solutions e [licença MIT completa](crates/speech-core/LICENSE-MEETING-COPILOT)
preservados no crate. Alterações: política explícita de canais, guardas de tamanho/
frames completos/valores finitos e acumulação f64. Sem resampler, engine, Tauri,
hardware ou integração runtime; vendor não foi editado. Essa extração não certifica
licenças/modelos/dependências de funções futuras. Detalhes no README do crate e STATUS.
