# Requisitos e limites

Estado: especificação inicial, ainda não implementada pelo fork.

## MVP Windows 11

1. Selecionar monitor, janela ou retângulo de um monitor.
2. Visualizar os limites da seleção antes de gravar, com cancelamento por Escape.
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

## Seleção de áudio é independente da seleção visual

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

- Meta: arquivo MP4 final de até 300.000.000 bytes em 1.800 segundos de gravação útil,
  no perfil "Compacto 300 MB / 30 min", com conteúdo e hardware homologados.
- Ponto inicial de experimento: 30 fps, resolução até 1080p, AV1 por hardware,
  vídeo 1.100 kbit/s e áudio AAC 96 kbit/s.
- Preservar legibilidade de textos é prioritário; medir tamanho não basta.
- Cenas muito dinâmicas podem exigir resolução/fps menores ou um perfil maior.
  Informar o conflito em vez de prometer qualidade sem perdas.
- TXT/SRT/JSON, cache temporário e modelos **não** entram no limite do MP4.
  A UI deve informar também o uso total de disco.
- Meta de qualidade visual e orçamento dependem de teste real; CRF isolado não
  garante limite de tamanho e bitrate nominal não garante tamanho exato.

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
