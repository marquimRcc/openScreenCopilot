# Etapa 02 — região e dispositivos no Windows

Estado: **02A implementada; 02B com seletor visual em código e pacote local**;
o aceite visual do retângulo continua pendente, assim como o seletor de saída de áudio. Não é aceite da
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
- `src/lib/windowsCaptureRegion.ts`: contrato puro usado pelo overlay,
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
não comando pronto. O IPC agora envia o crop validado no main; o helper isolado
continua sem produzir o sidecar editável do aplicativo.

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

## 02B — seletor visual implementado, aceite manual pendente

Incremento de 2026-10-13 à noite:

- Fonte → Região → monitor → Marcar área → arrastar → Usar esta área.
- Contorno tracejado durante a seleção, dimensões físicas, confirmação explícita,
  Escape/Cancelar e suporte a arraste nos quatro sentidos. Uma região por monitor.
- Overlay fecha antes da captura. **Não é ainda o indicador persistente durante a tomada.**
- Main confere o remetente IPC, mantém snapshot confiável, revalida a geometria e
  publica fonte + crop atomicamente; não há seleção transitória de tela inteira.
- Crop não é persistido entre relançamentos. Reenumerar fontes não remove seu
  marcador; região inválida fica explícita até nova escolha, sem restaurar monitor inteiro.
- `--capabilities` distingue helper com crop de executáveis antigos que ignoram
  campos JSON desconhecidos. Sem compatibilidade, região não é oferecida.
- Cursor editável normalizado contra origem/tamanho físicos do recorte, sem
  segunda conversão DPI; pontos externos ficam invisíveis. Snapshot fixo por tomada.
- Hook recusa captura Chromium de tela inteira se o helper de região faltar/falhar.
- WGC compilado e copiado no pacote local: SHA256
  `ca762c882370794abf63575ae9e0f037a5d6e609e059a5e9b3f183c9578a6a48`.

### Evidência e limites desta rodada

Testes focados cobrem geometria, UI React, ownership, cancelamento, capacidade,
cursor e proibição de fallback; TypeScript aplicativo/testes e i18n aprovados.
Build nativo aprovado, incluindo 33 regressões do encoder. Não há novo codec,
perfil de qualidade ou seletor de endpoint neste incremento.

Tentativa de input real com computer-use no pacote: HUD observado, mas cliques
convertidos para `(664, 1080)` ficaram sobre outro processo, mesmo após restaurar
e reobservar a janela; teclado não confirmou foco no documento. **Não aprovado:**
abrir a aba Região, arrastar, Escape e gravar pelo fluxo completo de interface.

Smoke isolado WGC, monitor 1920×1200 a 150%: crop 960×600, H.264 hardware,
5,033700 s, 11.418 bytes, parada limpa (~61 ms), decodificação integral sem erro.
**Imagem preta**, portanto tamanho/duração/decodificação não aprovam conteúdo.
Controle sem crop: 1920×1200, 5,034133 s, 19.004 bytes, também preto. Não há
evidência para atribuir esse resultado só ao novo recorte ou afirmar uma causa
de sessão/driver. Investigar com referência visual no desktop acessível.
Um harness Electron inicial não encerrou pelo timer: seus processos sintéticos
foram identificados por PID/parentesco/caminho e encerrados; não houve interrupção
da gravação do usuário. A repetição em Node encerrou normalmente.

### Reteste nativo após desbloqueio

O usuário informou que a tela estava bloqueada e a desbloqueou. A repetição
isolada, com os mesmos bounds e helper, produziu **conteúdo correto**: 960×600,
5,033733 s, 266.116 bytes, H.264 hardware, decodificação integral sem erro,
parada limpa (~82 ms). Os quatro cantos do quadro amarelo sintético estão no
recorte (RGB 232/253/0), fundo verde medido (21/127/59), texto legível e relógio/
bola em movimento (14.299 canais mudaram >15 entre frames em 1 s e 3 s).
O aviso laranja externo ficou fora da imagem. Isto valida o crop WGC real a
150% neste monitor, não o arraste/IPC pelo fluxo completo do HUD.

Pendentes: pixels/legibilidade/movimento pelo fluxo completo, 100%/125%/150% pela interface,
múltiplos monitores físicos/DPI misto, cursor fora da região no MP4/editor e
regressão captura→edição→exportação. Evidência de textura WARP e smoke isolado
não substituem esses aceites.

### Critérios de homologação

1. Seletor de fonte oferece Monitor / Janela / Região, com monitor explícito.
2. Main abre um overlay nesse monitor e fornece snapshot confiável. Arrastar gera
   coordenadas locais; Escape/cancelamento fecha sem iniciar captura.
3. Main revalida display e região, converte para pixels locais e passa a seleção
   ao helper. Nunca aceitar bounds arbitrários do renderer sem conferir o display.
4. Cursor/zoom recebem origem e tamanho recortados; pontos externos são excluídos.
   Reprojeção implementada e coberta por testes; homologar no MP4/editor antes de release.
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

Padrão de áudio implementado em código em 2026-10-14: store durável, fallback IPC,
painel de preparação e browser shim passam a iniciar com sistema ligado; uma
preferência booleana `false` salva continua desligada. Microfone e câmera continuam
desligados por padrão. Leitura de preferências antigas sem a chave não reescreve
o arquivo. O HUD continua aguardando o snapshot do main, sem ativação antecipada
do áudio ou migração forçada do perfil atual. Testes de store/IPC/painel/shim
cobrem padrão, desligamento persistido e reinício.

Isso não implementa seleção de endpoint/medidor, não reativa escolhas existentes
e não aprova ainda uma tomada com áudio audível a partir de perfil novo no pacote.
O pacote aberto de QA ainda é o incremento anterior de região; requer rebuild
para incorporar este padrão. Não é aceite completo de 02C.

Demais itens **ainda não implementados/homologados**:

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
