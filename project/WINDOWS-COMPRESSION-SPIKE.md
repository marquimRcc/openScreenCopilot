# Preparação do spike de compressão Windows

Inspeção de código em2026-10-14; não implementação/aceite da etapa03.
Homologação01/02 e testes de carga continuam pendentes. Não modificar codec,
resolução, FPS ou bitrate por estimativa; qualidade antes de tamanho.

## Caminho atual observado

- [main.cpp](../electron/native/wgc-capture/src/main.cpp) escolhe orçamento por
  pixels:18Mbps abaixo de2560×1440,28Mbps a partir desse tamanho e45Mbps a partir
  de3840×2160. Isso é configuração, NÃO tamanho real garantido. O cálculo usa
  dimensões após crop e arredondamento par; não escala bitrate proporcionalmente
  a todo retângulo pequeno nem mede complexidade do conteúdo.
- [mf_encoder.cpp](../electron/native/wgc-capture/src/mf_encoder.cpp) configura
  MFVideoFormat_H264 e perfil High, com B-frames desabilitados. A enumeração de
  encoder neste caminho também procura H.264; não existe AV1 implementado aqui.
- applyHardwareRateControl solicita UnconstrainedVBR e MeanBitRate via ICodecAPI.
  Ambos são best-effort: falha gera warning, captura continua. Sucesso nessa
  chamada não comprova qualidade constante ou bitrate efetivo sob carga.
- encoder-selection relata seleção/input/container e runtime depois de BeginWriting.
  Registrar configuração solicitada separada do encoder efetivo. Não tratar
  preferSoftwareEncoder=false como prova de hardware ou nome da GPU como AV1.
- Comentários do upstream incluem medições em outros takes/encoders. Não são
  benchmark deste fork/hardware e não devem virar promessa de redução ao usuário.

As provas sintéticas curtas de sincronismo não têm texto/rolagem/carga suficiente
para escolher perfil de compressão. Bytes desses arquivos não extrapolam30min.
Nenhum encoder, licença, binário ou configuração foi alterado por esta inspeção.

## Comparação proposta, ainda não executada

1. Fixar fixtures próprias: texto pequeno/colorido estático, rolagem, cursor/movimento
   e conteúdo dinâmico sintético. Mesmos pixels, resolução, FPS e duração por perfil.
2. Medir baseline H.264 atual: bytes/tempo, CPU/GPU, frames/PTS, sincronismo de
   marcadores e legibilidade. Inspecionar warnings VBR e runtime efetivo.
3. Provar AV1 por enumeração E encode/decode reais no caminho de captura antes de
   oferecer seleção. Auditar proveniência/licença de qualquer componente novo.
4. Comparar controle por qualidade e bitrate sem reduzir resolução silenciosamente.
   Manter fallback informado; codec indisponível não autoriza alegar AV1 gravado.
5. Executar30min estático/dinâmico, pausa e carga; abrir/reproduzir/exportar no
   editor existente. Registrar falhas de driver/mux/player, não apenas bytes.

Não criar segundo encoder/download paralelo nem usar pós-compressão como prova
de que a captura ao vivo já grava naquele perfil. UI simples poderá expor perfil
depois das medições;300MB/30min não é teto. GIF/Compartilhar seguem no final.

Estado e dependências em [ROADMAP.md](ROADMAP.md) e [STATUS.md](STATUS.md).
