# Etapa 02 — região e dispositivos no Windows

Estado: **02A implementada em código e testada no nível de textura/contrato**;
overlay e seletor de saída de áudio ainda não implementados. Não é aceite da
etapa 02 nem substitui a rodada visual/sob carga pendente da etapa 01.
O usuário autorizou avançar; esta fundação independente foi preparada enquanto
o controlador do Windows não conseguia ativar a janela de QA.

## 02A — recorte GPU e contrato de coordenadas

- `capture_region.cpp/.h`: copia somente o retângulo selecionado para uma textura
  BGRA própria usando D3D11 CopySubresourceRegion. O encoder não recebe o monitor
  inteiro. Não há resize ou passagem pela CPU para executar o crop.
- Integrado aos caminhos pull padrão e callback legado do helper WGC.
- Região é relativa a um único monitor em **pixels físicos**, nunca a coordenada
  global DIP multiplicada por um scaleFactor.
- Dimensões pares, origem não negativa, tamanho mínimo 2×2 e containment são
  obrigatórios. Nenhum fallback para tela inteira, clamp ou monitor primário.
- Bounds explícitos do monitor são exigidos; o matcher existente recusa bounds
  sem correspondência. Tamanho WGC e bounds precisam concordar no início.
- Mudança posterior de tamanho da textura interrompe o caminho de região com
  erro, em vez de deslocar a seleção ou vazar pixels. Isso não cobre todas as
  mudanças de display/dispositivo ou fechamento de janela do restante da etapa.
- `src/lib/windowsCaptureRegion.ts`: contrato puro para o futuro overlay,
  com snapshot de display, origens negativas, escala por monitor, bordas
  arredondadas para dentro e ajuste par também para dentro. Cancelar retorna null.

Extensão do JSON do helper (schemaVersion 2, opcional e desligada por padrão):

```json
{
  "sourceType": "display",
  "hasDisplayBounds": true,
  "displayX": 0,
  "displayY": 0,
  "displayW": 1920,
  "displayH": 1080,
  "hasCaptureRegion": true,
  "regionX": 100,
  "regionY": 100,
  "regionWidth": 800,
  "regionHeight": 600
}
```

Os campos normais de output/áudio continuam necessários. Exemplo só de geometria,
não comando pronto. O HUD/IPC ainda não envia esses campos: o acesso via interface
fica retido até implementar seleção e reprojeção do cursor editável, sem oferecer
um retângulo que grava vídeo correto mas cursor/zooms em coordenadas erradas.
O helper isolado não produz o sidecar editável do aplicativo.

Validação local Windows 11, 2026-10-13:

- Teste D3D11 real, com WARP e textura de pixels distintos: cada um dos 48 pixels
  do recorte 8×6 coincide exatamente com a origem; tamanho, reuso, origens ímpares,
  overflow, bordas inválidas, alteração de fonte/destino passam. WARP é execução
  D3D11 por software: não equivale a recorte WGC no driver Intel real.
- Contrato TypeScript: 18 testes aprovados, incluindo 125%/150%, origem negativa,
  frações, cancelamento, monitor cruzado, NaN/infinito e snapshot inválido.
- Três requests inválidos ao executável real (janela, ausência de bounds e
  dimensão ímpar) recusados com exit 1 antes de gravar; nenhum arquivo criado.
- `npm run build:native:win` aprovado; regressão do encoder continua 33/33.
- WGC deste checkpoint: SHA256
  `31efe29dd2fde5bddeec832c5646c03a2e375e203695415e2f39c92634b9ff06`.

Não executados: recorte real do desktop via overlay, conteúdo legível em recorte
H.264, DPI misto em múltiplos monitores físicos e interação mouse/Escape do overlay.
Não houve nova compressão: codec, bitrate e resolução não selecionada permanecem
herdados. Otimização por qualidade/tamanho pertence à etapa 03.

## 02B — overlay e integração com o aplicativo (próximo)

1. Seletor de fonte oferece Monitor / Janela / Região, com monitor explícito.
2. Main abre um overlay nesse monitor e fornece snapshot confiável. Arrastar gera
   coordenadas locais; Escape/cancelamento fecha sem iniciar captura.
3. Main revalida display e região, converte para pixels locais e passa a seleção
   ao helper. Nunca aceitar bounds arbitrários do renderer sem conferir o display.
4. Cursor/zoom recebem origem e tamanho recortados; pontos externos são excluídos.
   Até essa parte existir, não habilitar região com editable-overlay no HUD.
5. Testar bordas por imagem exportada, não só thumbnail, em 100%/125%/150% e DPI misto.

### Indicador persistente — solicitado para a próxima versão

Ainda não implementado. Requisito confirmado pelo usuário em 2026-10-13:
contorno vermelho fino, pontilhado/tracejado e discreto que permita reconhecer
o que está ou não sendo gravado durante toda a tomada, não só ao selecionar.

O main deverá manter uma sobreposição dedicada, sem roubar foco ou cliques,
associada à fonte e ao estado reais da sessão. Para janela, acompanhar a geometria
capturada; para região fixa, conservar os limites do crop. Continuar visível com
o HUD oculto; distinguir pausa e remover ao parar, cancelar, falhar ou fechar a fonte.

A borda não pertence à textura gravada nem ao compositor do vídeo. Sua exclusão
precisa ser verificada no MP4 e nos frames exportados de monitor/janela/região,
em DPI misto e junto ao cursor editável. Não presumir proteção herdada do HUD,
nem deslocar/reduzir a área capturada para esconder a borda. Critérios completos
em [REQUIREMENTS.md](REQUIREMENTS.md) e [TESTING.md](TESTING.md).

Este checkpoint registra o pedido, sem reiniciar ou alterar a gravação de teste
que o usuário já iniciou. Nenhum overlay persistente está disponível no pacote atual.

### Confirmação de arquivo salvo — solicitado após a primeira captura do usuário

Ainda não implementado no fluxo pós-gravação. Ao terminar, exibir confirmação
persistente com nome/caminho do MP4 original e botão "Abrir local salvo". Abrir
o Explorador com esse arquivo selecionado; manter ação acessível no editor e
não confundir com salvar projeto ou exportar uma edição.

Pedido adicional: botão "Nova captura" destacado na edição após finalizar.
Reutilizar o fluxo de preparação existente, preservando MP4/projeto anterior e
tratando mudanças não salvas. Não iniciar nova gravação sem ação explícita do usuário.

Já existe infraestrutura `revealInFolder` no preload/IPC e uso na exportação;
a existência desse código não aprova a descoberta do arquivo após gravar.
A integração deve usar o arquivo da sessão validado no main e tratar arquivo
ausente/erro do shell sem apresentar sucesso falso. Critérios em
[REQUIREMENTS.md](REQUIREMENTS.md) e [TESTING.md](TESTING.md).

## 02C — saída de áudio, microfone e falhas

Proposto, **ainda não implementado**:

- Áudio do sistema ligado por padrão em perfis novos/preferências ausentes;
  microfone desligado por padrão. Respeitar desligamento explícito salvo e mostrar
  estado/endpoint efetivos, com aviso se a captura de áudio falhar. Pedido de 2026-10-13.
- Enumerar endpoints WASAPI eRender ativos, com ID e nome amigável; escolha de
  saída separada da escolha de microfone. Padrão significa o endpoint resolvido
  no começo da tomada, não autorização para trocar silenciosamente no meio.
- A captura é loopback da **saída escolhida**, não isolamento por processo. Teams,
  Slack e YouTube precisam tocar nessa saída; outros sons dessa saída também entram.
- ID explícito inválido/desconectado não pode recair em outro endpoint. Mostrar
  falha claramente, sem fingir que há áudio. Não usar o ID Chromium como se fosse
  o ID MMDevice: enumerar/validar no adaptador nativo.
- Medidor separado de sistema/mic, com stream de níveis limitado e sem PCM bruto
  enviado ao renderer. Parar medidor de prévia antes da captura real.
- Desconexão, mudança de formato e janela fechada devem gerar evento tipado e
  finalizar/salvar o material possível; teste de retorno e nova tomada obrigatório.

## 02D — relógio e aceite

Documentar e testar T0 monotônico compartilhado por vídeo/áudio, pausas removidas
uma vez, PTS preservados e distinção entre instante de captura e chegada ao ASR.
Não usar hora civil/tempo de chegada como relógio de transcrição. Epochs e filas
do sidecar continuam propostas das etapas 04/05, não implementadas aqui.

Aceite final continua o do [ROADMAP.md](ROADMAP.md): interação real, pixels corretos,
áudio no endpoint escolhido, avisos de escopo/falha e matriz de DPI/dispositivos.
Manter [STATUS.md](STATUS.md) e [WINDOWS11-BASELINE.md](WINDOWS11-BASELINE.md) atualizados
com evidências e testes pulados. Não distribuir este checkpoint como release.
