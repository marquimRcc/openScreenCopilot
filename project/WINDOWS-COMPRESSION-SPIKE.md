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

### Enumeração MF isolada — 2026-10-15

Probe C++ privado `.cache/mf-codec-enum.cpp/.exe`, MSVC19.44/SDK10.0.26100,
CoInitializeEx MTA + MFStartup(NOSOCKET), MFTEnumEx categoria VIDEO_ENCODER,
input NULL e output subtype explícito. Dois filtros separados: HARDWARE e ALL,
sem SORTANDFILTER, sem registro local de MFT, ActivateObject, encode/capture,
streams, downloads ou mudança de registro/driver. Release/CoTaskMemFree,
MFShutdown/CoUninitialize; exit0. Log privado `.cache/mf-codec-enum.log`.

| Subtype | HARDWARE | ALL | HRESULT |
|---|---:|---:|---|
| H.264 | 2 | 4 | S_OK nas duas consultas |
| HEVC | 2 | 4 | S_OK nas duas consultas |
| AV1 | 2 | 2 | S_OK nas duas consultas |

Contagem é de objetos de ativação registrados, NÃO GPUs físicas, sessões simultâneas
ou codecs homologados. ALL inclui hardware e não é contagem de software. A API
documenta que enumeração retorna activation objects, e instanciar exige chamada
separada; filtros/registro podem afetar resultados. Fonte primária:
[Microsoft MFTEnumEx](https://learn.microsoft.com/en-us/windows/win32/api/mfapi/nf-mfapi-mftenumex).
Não alterar chaves de hardware MFT para forçar disponibilidade.

Resultado torna AV1 candidato ao spike, não prova ativação/input D3D11/NV12,
encode/MP4/decode/editor, controle de qualidade, aceleração efetiva ou licença de
redistribuição. Continua faltando prova com quadros sintéticos pelo caminho futuro
e teste30min. Encoder atual do app permanece H.264; nenhum binário de produção,
manifest/pacote ou fallback foi alterado. Etapa03 não foi concluída.

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

### Ativação AV1 isolada — 2026-10-15

Nova sonda privada `.cache/mf-av1-activate.cpp/.exe/.log`, compilada com toolchain
MSVC existente. MFTEnumEx(HARDWARE, VIDEO_ENCODER, AV1) retornou2objetos/S_OK.
Cada ActivateObject(IMFTransform) passou com S_OK; GetStreamCount retornou1entrada/
1saída e GetAttributes/MF_TRANSFORM_ASYNC retornou1/S_OK. Transform liberado e
ShutdownObject passou nos dois; MFShutdown/CoUninitialize, exit0, processo próprio
com guarda10s (não disparou). Não foi criado encoder alternativo no app.

Zero amostras submetidas, sem SetInputType/SetOutputType, D3D manager, BeginStreaming,
ProcessInput/ProcessOutput, captura ou arquivo de vídeo. Portanto só prova que esses
componentes registrados puderam ser instanciados/consultados nesta máquina, não
que aceitam NV12/D3D11/resolução/FPS ou produzem AV1 válido/eficiente. Não inferir
GPU física ou capacidade simultânea de2objetos. Próximo gate ainda é negociação
de mídia e encode/decode sintético pelo caminho escolhido, sem duplicar encoder,
seguido de MP4/editor/licenças e30min. H.264 continua codec real do aplicativo.

### Consulta de tipos AV1 sem desbloqueio — 2026-10-15

Sonda privada `.cache/mf-av1-types.cpp/.exe`, compilada com MSVC existente,
executada20:46:58–59UTC com recibo/log privados. Enumeração HARDWARE retornou2/S_OK;
ativação e GetStreamCount passaram nos dois (1entrada/1saída). GetStreamIDs retornou
0xC00D6D77 nos dois: MF_E_TRANSFORM_ASYNC_LOCKED, confirmado no mferror.h do SDK
10.0.26100.0. Portanto GetInputAvailableType/GetOutputAvailableType NÃO foram
executados; não houve inventário de tipos, nem prova negativa de suporte AV1/NV12.
Não aplicar fallback de IDs destinado a E_NOTIMPL a outro HRESULT.

ShutdownObject passou nos dois, processo terminou code3/signalnull; guarda10s não
disparou. Exit3 registra consulta incompleta, não falha do encoder do produto.
Nenhum atributo de desbloqueio foi escrito, nenhuma amostra/tipo foi submetida,
sem streaming/D3D/captura/vídeo. Não continuar desbloqueando ou negociando formatos
como se isso ainda fosse uma consulta GET-only. Tipos anunciados também podem ser
parciais e depender do tipo oposto; enumeração não substitui negociação e encode.
Referência: [GetInputAvailableType](https://learn.microsoft.com/en-us/windows/win32/api/mftransform/nf-mftransform-imftransform-getinputavailabletype)
e [GetOutputAvailableType](https://learn.microsoft.com/en-us/windows/win32/api/mftransform/nf-mftransform-imftransform-getoutputavailabletype).
H.264 de produção/pacote permanecem inalterados; etapa03 sem aceite.

Estado e dependências em [ROADMAP.md](ROADMAP.md) e [STATUS.md](STATUS.md).
