# Pós-gravação simples — execução incremental

Pedido do usuário em 2026-10-13. Primeiro incremento implementado em 2026-10-14;
homologação do fluxo real e ações Compartilhar/GIF permanecem pendentes.

## Primeiro incremento

Finalização bem-sucedida abre resultado com prévia do MP4 original, nome, caminho,
tamanho, duração, Abrir pasta, Nova captura e Editar secundário. O processo principal
confere arquivo existente, tamanho positivo e identidade atual antes de revelar/editar;
gravação ativa e edição não salva impedem transições incompatíveis. Nova captura
apenas prepara o HUD: não começa outra gravação. CLI/MCP preservam entrada no editor.

A prévia é do vídeo original, não da composição exportada pelo editor. Webcam,
cursor editável, zoom e demais camadas separadas não são incorporados pela tela
simples. Compartilhamento/conversão devem esclarecer original versus composição.
Não há upload nem conversão automática neste incremento.

Testes automatizados aprovados; árvore de acessibilidade da janela Electron isolada
mostrou arquivo sintético, 00:05, 266,1 KB e as três ações. A captura de tela retornou
outra janela sobreposta mesmo após ativação: layout, reprodução e cliques reais não
foram aprovados. Não equivale ao fluxo completo captura → parar → resultado.

## Princípio

A interface principal deve atender quem só quer gravar, encontrar o arquivo e usá-lo.
A experiência nativa do Windows 11 é uma referência de simplicidade, não de recursos
ou limitações de qualidade. Manter a edição em uma aba/ação secundária, sem exigir
que o usuário entenda timeline, exportação ou configurações avançadas.

## Fluxo proposto

1. Preparar: fonte/retângulo, áudio do sistema, microfone opcional e Gravar.
2. Gravar: tempo, Pausar e Parar; área capturada identificável.
3. Ao parar: tela de resultado simples, não entrada obrigatória no editor.
4. Resultado: prévia reproduzível, "Gravação salva", nome, pasta, duração e tamanho.
5. Ações: "Abrir pasta", "Compartilhar", "Transformar em GIF", "Nova captura".
6. "Editar" abre a edição existente como opção secundária, preservando o original.

## Critérios de aceite

- O MP4 original já está salvo antes de mostrar sucesso; nenhum passo de exportação
  é obrigatório para encontrá-lo e reproduzi-lo.
- "Abrir pasta" revela o arquivo correto; a localização continua visível após fechar avisos.
- "Compartilhar" exige ação explícita e confirmação do destino; não publicar/upload
  automaticamente. Definir numa etapa própria se será compartilhamento nativo ou cópia.
- GIF é derivado separado, nunca substitui o MP4. Oferecer trecho/duração e estimativa:
  GIF não tem áudio e pode ser maior que o vídeo. Manter conversão cancelável.
- "Nova captura" volta à preparação sem iniciar gravação e sem perder a tomada anterior.
- Falhas de salvamento/conversão são claras, com recuperação; sem mensagem falsa de sucesso.
- A aba de edição permanece acessível, mas não é a tela principal para usuários comuns.
- Validar o fluxo com input real no Windows 11; medir cliques e verificar descoberta
  do arquivo, reprodução, abrir pasta, cancelamento e preservação do original.

## Ordem sugerida

1. Tela de resultado + localização + Abrir pasta + Nova captura.
2. Navegação secundária para edição, tratando alterações não salvas.
3. Compartilhamento explícito com destino e privacidade definidos.
4. Conversão de trecho em GIF com progresso, cancelamento e orçamento de tamanho.

Dependências: finalização confiável da gravação e seleção por região da etapa 02.
Este pedido não dispensa os aceites de captura, qualidade, áudio e DPI.
