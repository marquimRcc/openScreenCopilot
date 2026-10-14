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
Essa distinção também aparece em uma legenda curta na prévia (15 idiomas),
sem abrir configuração extra nem obrigar exportação para acessar o original.

## Compartilhar e GIF — desenho do próximo incremento

Fundação 02G implementada isoladamente em `electron/recording/derivedRecordingTarget.ts`;
**ainda não conectada ao IPC, diálogo, compositor ou botões**. Tokens opacos de uso
único vinculam dono e snapshot main-owned de fontes; nenhuma autorização genérica
de caminho é criada no renderer. Um job por dono, revalidação de sessão/estado e
parent canônico. Qualquer destino existente é recusado (inclui original/aliases).
Temporário em diretório exclusivo no mesmo filesystem; publicação com hardlink
exclusivo, nunca rename sobrescritor, seguido de remoção apenas do temporário próprio.
Filesystem sem hardlink falha explicitamente; suporte FAT/exFAT/rede não homologado.

Limites: integração deve obter destino do diálogo da mesma janela, fornecer fontes
aprovadas e identidade atual, aguardar término/cancelamento do writer antes de
`discard`, e validar codec/decode em `publish`. Fechar dono invalida publicação,
mas não apaga arquivo em uso nem cancela o compositor por si só. O futuro job
deve distinguir cancelamento antes da publicação de uma publicação já iniciada.
Não é defesa contra outro processo local malicioso com os mesmos privilégios.
Crash pode deixar o diretório temporário para recuperação; não existe varredura
automática de órfãos neste incremento. Uma integração posterior deve registrar
propriedade/estado antes de adicionar limpeza de startup, sem apagar só por prefixo.
Bridge exportador legado não foi alterado; não anunciar essa proteção como global.

Análise do código em 2026-10-14: GIF já usa compositor nativo, mesma cena/lista
de clipes do MP4, progresso por ID e cancelamento por dono da janela. Não criar
segundo encoder, fallback renderer ou pipeline FFmpeg independente. Reutilizar
`ExportDialog`, `buildSceneDescription`, `assetCameraSource`,
`resolveClipSourceEndSec` e o gerenciamento `ExportJobs`, extraindo somente a
orquestração necessária à tela simples. Não importar o shell inteiro do editor.

| Ação proposta | Fluxo | Proteção necessária antes de habilitar |
|---|---|---|
| Compartilhar original | Escolher arquivo original e destino explicitamente; adaptador de plataforma abre a escolha de destino | Não enviar automaticamente; não tratar caminho local como link público; cancelamento não é erro nem envio |
| Preparar cópia | Opção separada e nomeada como cópia, escolhida pelo usuário | Cópia exclusiva, fonte main-owned, recusar destino igual/alias do original; não anunciar compartilhamento concluído |
| GIF | Escolher trecho, resolução/FPS, confirmar estimativa e arquivo novo; exportar cena pelo compositor | Sem áudio, pode ser maior que MP4; destino validado no main, original imutável, progresso/cancelamento e limpeza apenas do derivado próprio |
| Vídeo com câmera/edições | Construir documento efêmero a partir da sessão validada, compor e mostrar o derivado antes de compartilhar | Preservar câmera/offset/cursor e proporção; não aplicar zoom/layout automático surpreendente; não sobrescrever sessão nem documento aberto |

Contratos propostos (ainda não implementados): pedido da tela leva identidade da
gravação + opções, nunca autorização irrestrita de caminho. Main revalida sessão,
fonte aprovada, estado ocioso e destino selecionado pela mesma janela; reserva um
job e arquivo temporário próprios. Cancelar/fechar a janela aguarda finalização do
job antes de liberar Nova captura. Sucesso só após derivado final existente e
validado; mostrar tamanho medido, não confundir estimativa com garantia.

Riscos encontrados: o picker genérico existente devolve caminho ao renderer e o
bridge nativo recebe `outPath`; isso por si só não satisfaz o novo contrato de
destino main-owned e original protegido. Adicionar guardas/testes antes de ligar
GIF/Compartilhar na tela simples. Não reutilizar `write-export-to-path` como
permissão para substituir um MP4. Não houve upload nem conversão nova nesta análise.

Aceites sintéticos obrigatórios: original com hash idêntico antes/depois, arquivo
com espaços/acentos, destino igual/alias/hardlink, recusa de sobrescrita, sessão
trocada durante diálogo, janela fechada/cancelamento, falta de addon/disco e
decode GIF/duração/frames. A validação real de compartilhamento deve usar somente
arquivo sintético e destino explicitamente autorizado; mídia privada permanece local.

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
