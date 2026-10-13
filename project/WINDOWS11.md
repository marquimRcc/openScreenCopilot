# Plano técnico Windows 11

Estado: projeto de implementação. Nenhuma mudança de captura foi aplicada aqui.

## Base observada

O helper WGC em `electron/native/wgc-capture/` já usa captura de monitor/janela,
D3D11, WASAPI e Media Foundation. O caminho nativo analisado usa H.264 e perfis
de bitrate elevados (18/28/45 Mbit/s por faixa de resolução), com 60 fps como padrão.
Isso explica por que herdar o gravador sem alterar o encoder não atende a meta.

A presença de um compositor/exportador com outros codecs não significa que a captura
nativa ao vivo já os use. A integração AV1 é trabalho no caminho de gravação.

## Seleção retangular

1. Overlay por monitor com teclado, Escape e prévia de dimensões.
2. Converter coordenadas lógicas Electron para pixels físicos do monitor.
3. Validar limites, origem negativa, rotação e DPI misto.
4. Recortar textura D3D11 antes de escala e encode, sem leitura CPU por frame.
5. Alinhar dimensões exigidas pelo encoder sem incluir pixels fora da seleção.
6. Excluir o overlay da captura e manter indicador visível ao usuário.

Primeiro MVP restringe o retângulo a um único monitor. Testar 100/125/150/200%,
dois monitores com escalas distintas e monitor à esquerda da origem principal.
Janela minimizada, fechamento, redimensionamento ou mudança de monitor devem
produzir comportamento explícito, sem capturar outra área silenciosamente.

## Áudio e roteamento

Enumerar endpoints de reprodução e captura, com ID persistente, nome e papel
console/communications. O helper herdado usa loopback do endpoint padrão de console;
adicionar seleção explícita evita "fone certo, áudio errado".

Separar PCM de sistema e microfone **antes** do mix AAC, duplicando o fluxo para ASR
sem abrir um segundo capturador. O mix do vídeo pode continuar sendo uma trilha só.
Eventos de desconexão, troca de formato, Bluetooth hands-free e mudança de padrão
precisam abrir nova sourceEpoch e registrar a transição.

MVP não segue automaticamente outro endpoint sem avisar. Oferecer seleção e teste
de nível. Loopback de dispositivo inclui todos os aplicativos naquela saída.
Captura por processo é possível como investigação futura, não filtro já existente.

## Encoder e orçamento

AV1 por hardware: verificar primeiro Intel QSV no equipamento de teste, depois
NVENC/AMF conforme capacidades reais. A API MF herdada não vira um encoder AV1
por trocar uma string. Fazer spike entre MF compatível e libavcodec/FFmpeg com
interoperabilidade D3D11, priorizando zero-copy e licenças redistribuíveis.

```text
orçamento bruto: 300.000.000 bytes * 8 / 1.800 s = 1.333.333 bit/s
ponto inicial: (1.100.000 vídeo + 96.000 áudio) * 1.800 / 8
             = 269.100.000 bytes, antes do overhead de container
reserva inicial: 30.900.000 bytes para overhead e variação
```

Esse cálculo é orçamento, não resultado medido de uma gravação. Validar controle
de bitrate médio/VBV, PTS, áudio, metadata e tamanho efetivo. Se não conseguir
cumprir o teto e a legibilidade juntos, informar incompatibilidade do perfil.
Não degradar resolução ou trocar codec silenciosamente.

CRF serve para qualidade variável, não para um teto rígido de tamanho. 30 fps é
candidato, não obrigação para qualquer uso. 1080p/720p/área nativa e conteúdo com
texto pequeno exigem comparação visual.

Fallback H.264 deve ser explícito: pode não atender 300 MB com qualidade equivalente.
AV1 por software é opção consciente após benchmark, nunca fallback que satura CPU
em silêncio. Reservar recursos para ASR e verificar competição GPU/VRAM.

## Validação incremental

- Baseline: arquivo e métricas do helper original antes de mudar o encoder.
- Teste curto: encode AV1 de frames capturados, não apenas de um arquivo offline.
- 30 minutos: vídeo estático com slides/texto e cenário com movimento.
- Captura + microfone + loopback + ASR simultâneos no mesmo hardware.
- Reproduzir MP4 em player externo, editor herdado e exportador.
- Falta de encoder, falta de modelo, dispositivo perdido e disco cheio.

Um benchmark isolado de ffmpeg não prova este pipeline. A qualidade medida da
compressão offline anterior também não substitui o teste de gravação ao vivo.

## Distribuição segura do fork

Antes de instalar: novo productName/appId, pasta userData própria, protocolos,
atalhos/conflitos, repositório/feed de atualização e destinos de publicação.
Não reutilizar Microsoft Store identity/publisher, certificados ou chaves dos autores.
Bloquear publicação/auto-update herdados até identidade própria validada.
O próximo passo do roadmap trata isso antes de qualquer instalador compartilhado.
