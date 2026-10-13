# Requisitos e limites

Estado: especificação inicial, ainda não implementada pelo fork.

## MVP Windows 11

1. Selecionar monitor, janela ou retângulo de um monitor.
2. Visualizar os limites da seleção antes de gravar, com cancelamento por Escape,
   e manter um contorno discreto durante a captura (detalhes abaixo).
3. Selecionar explicitamente o dispositivo de saída de áudio e, opcionalmente,
   um microfone. Gravar sistema, microfone, ambos ou vídeo sem áudio.
4. Gravar enquanto transcreve localmente, sem enviar áudio, vídeo ou transcrição
   a serviços externos por padrão.
5. Salvar vídeo e texto separadamente; nenhuma legenda deve ser queimada no vídeo
   sem uma ação explícita posterior.
6. Pausar, retomar e finalizar com vídeo e transcrição sincronizados.
7. Indicar gravação ativa, áudio recebido, codec efetivo, tamanho estimado,
   atraso da transcrição e erros.
8. Falha de ASR não encerra uma gravação saudável. Áudio pendente pode ser
   reprocessado com autorização de retenção e espaço em disco disponível.
9. Exportar TXT, SRT e JSON; recuperar sessões interrompidas sem sobrescrever
   gravações anteriores.

## Indicador persistente da área gravada

Pedido do usuário em 2026-10-13 para a próxima versão; **ainda não implementado**.

- Borda vermelha fina e pontilhada/tracejada delimitando exatamente o monitor,
  a janela ou o retângulo que está sendo capturado. Visível durante toda a gravação,
  mesmo com o HUD oculto ou outro aplicativo em foco; sem piscar ou bloquear cliques.
- A borda informa o recorte visual real, não apenas o último item selecionado.
  Ao capturar uma janela, acompanha sua geometria; um retângulo fixo continua fixo
  no monitor, mesmo se a janela dentro dele se mover.
- Pausa deve ser distinguível de gravação ativa, com indicação textual no HUD,
  sem depender só da cor. Parar, cancelar, falhar ou encerrar a sessão remove a borda.
- A sobreposição não pode aparecer no MP4 nem nos frames exportados, ou mudar os
  pixels/dimensões da seleção. Comprovar a exclusão em captura de monitor/janela/região,
  incluindo DPI misto; não presumir isso só porque o HUD já possui proteção.
- Não alterar ou reiniciar a gravação em curso para entregar este ajuste futuro.

## Confirmação de salvamento e acesso ao arquivo

Pedido do usuário em 2026-10-13 após encerrar uma captura e não encontrar o MP4;
**ainda não implementado no fluxo pós-gravação do fork**.

- Ao finalizar com sucesso, mostrar "Gravação salva", nome do arquivo e caminho
  completo, com ação explícita "Abrir local salvo" / "Abrir pasta da gravação".
- A ação abre o Explorador com o MP4 efetivo selecionado, sem mover, renomear,
  exportar novamente ou duplicar o vídeo. Deve continuar acessível no editor,
  não apenas em uma notificação que desaparece rapidamente.
- Usar o caminho persistido da sessão, não a pasta padrão ou a pasta configurada
  posteriormente. Distinguir o MP4 original do projeto e de uma exportação editada.
- Informar falha de gravação/salvamento sem anunciar sucesso; se o arquivo tiver
  sido movido/apagado ou o Explorador falhar, mostrar erro claro, sem recriar dados.
- Exibir estado de áudio sem ambiguidade: vídeo intencionalmente sem áudio continua
  permitido, mas não pode parecer que áudio do sistema/mic está sendo capturado.

## Seleção de áudio é independente da seleção visual

Pedido confirmado em 2026-10-13: **áudio do sistema ativado por padrão**, microfone
opcional e desligado por padrão. Ainda é requisito, não mudança aplicada ao pacote.
Em perfis novos/preferência ausente, iniciar com sistema ligado; permitir desligar
explicitamente e respeitar essa escolha salva. Não reativar áudio silenciosamente
quando o usuário escolheu "Sem áudio", nem ativar mic/câmera por essa mudança.
Mostrar estado e endpoint efetivos antes de gravar; indisponibilidade/falha de
captura deve ser visível, sem afirmar que há áudio apenas porque o toggle está ligado.

Selecionar a janela do Teams **não** significa capturar somente o Teams. No MVP,
WASAPI loopback captura os aplicativos que saem no endpoint selecionado. Um fone
é um dispositivo de reprodução, não uma fonte distinta de "áudio do sistema".

Teams pode usar o dispositivo de comunicação enquanto YouTube usa outro dispositivo
padrão. Mostrar o endpoint efetivo e permitir teste de nível antes da gravação.
Captura por processo é uma evolução separada e não requisito do MVP.

A separação sistema/microfone identifica fontes, não os participantes de uma reunião.
Diarização de falantes, cancelamento de eco e isolamento de aplicativos exigem
avaliações próprias. Não duplicar a voz do usuário quando ela já retorna no loopback.

## Qualidade e tamanho

- Prioridade confirmada em 2026-10-13: qualidade visual e áudio claro, com o menor
  arquivo que preserve esses critérios. Os 300 MB/30 minutos deixam de ser teto
  obrigatório; não sacrificar legibilidade para alcançar um número arbitrário.
- Comparar controle de qualidade variável e bitrate, 30/60 fps, resolução nativa
  e AV1 por hardware quando disponível. Selecionar o perfil por evidência real.
- Preservar detalhes de texto e interfaces; não reduzir resolução ou fps em silêncio.
- Cenas dinâmicas podem exigir arquivo maior. Informar o conflito em vez de
  prometer qualidade sem perdas ou um tamanho fixo para qualquer conteúdo.
- Medir bytes do MP4, qualidade e sincronia juntos, contra a mesma captura baseline.
  A UI deve informar também uso de disco por TXT/SRT/JSON, temporários e modelos.
- CRF isolado não garante tamanho fixo e bitrate nominal não garante tamanho exato.

## Transcrição

Português brasileiro é o primeiro idioma de aceite; permitir idioma explícito.
Whisper é o candidato inicial. Avaliar Parakeet somente com modelo compatível,
licença conferida e amostras pt-BR reais. Não afirmar aceleração GPU automática.

Transcrição incremental pode revisar texto provisório. Somente segmentos finais
compõem a exportação estável. Exibir "processando" quando ASR estiver atrasado e
permitir finalizar o vídeo sem descartar o processamento pendente.

## Fora do MVP

Não incluir inicialmente um segundo aplicativo Tauri, o backend FastAPI legado,
assistente LLM, respostas automáticas em reuniões, diarização real, captura
multimonitor em um único retângulo, DRM bypass ou gravação oculta.
Linux/RegataOS vem depois da homologação Windows. Não alterar a instalação atual
de OpenScreen nem reutilizar sua identidade de atualização.
