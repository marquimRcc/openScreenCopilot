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

Fundação 02G em `electron/recording/derivedRecordingTarget.ts`, agora conectada à
ação local **Salvar uma cópia** (02I), não ao GIF/compartilhamento/compositor.
Tokens opacos de uso
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

### 02I — salvar cópia do original

Botão separado, sem anunciar envio/compartilhamento: escolhe destino em diálogo
nativo ligado à janela atual de resultado. IPC recebe só o caminho esperado do
original, nunca um destino autorizado pelo renderer. Main valida janela/papel,
sessão/fontes aprovadas e estado ocioso antes/depois do diálogo. MP4 e WebM são
copiados em stream, sem recompressão; o formato original é preservado. SHA256
do stream original e do staged file devem coincidir, com identidade/tamanho/mtime
da fonte estáveis; então publica sem substituir destino existente. Verificar
hash basta para esta cópia byte-a-byte; GIF futuro ainda exige decode/codec.

Cancelar/fechar dono aborta o stream e aguarda pipeline fechar antes de limpar.
Ao começar a publicação final, cancelamento pode ser recusado: não anunciar que
arquivo publicado foi desfeito. Nova captura/edição ficam desabilitadas durante
o job; preparação também bloqueada no main. Caminho efetivo da cópia é mostrado,
original continua selecionado e intacto. Arquivo existente exige nome novo,
mesmo se o diálogo nativo oferecer substituir. Sem upload, link público ou
composição de câmera/cursor/edições; apenas bytes do original.

Análise do código em 2026-10-14: GIF já usa compositor nativo, mesma cena/lista
de clipes do MP4, progresso por ID e cancelamento por dono da janela. Não criar
segundo encoder, fallback renderer ou pipeline FFmpeg independente. Reutilizar
`ExportDialog`, `buildSceneDescription`, `assetCameraSource`,
`resolveClipSourceEndSec` e o gerenciamento `ExportJobs`, extraindo somente a
orquestração necessária à tela simples. Não importar o shell inteiro do editor.

### 02J — preflight de GIF por trecho (isolado)

Contrato puro `src/lib/savedRecordingGif.ts`, ainda NÃO ligado a IPC/UI ou encoder.
Pedido explícito `mode: original`, início/fim, FPS 15/20/25/30 existentes, altura
480/720 e repetição. Rejeita campos extras, inclusive caminhos/cena; metadados
precisam vir do probe do original aprovado pelo main, nunca do renderer.
Não concede autorização de fonte/destino nem substitui guardas de sessão/owner.

Política inicial SOMENTE da ação simples: trecho até 60 s dentro da fonte,
maior aresta até 1280 px, sem upscale, proporção com arredondamento par e
até 1 bilhão de pixel-frames. Trecho longo pode exigir menos FPS/resolução;
essa guarda limita trabalho, não garante tempo/consumo máximo nem tamanho GIF.
Não impõe limites novos ao editor existente ou à gravação de vídeo.
Contagem de frames reutiliza `clipOutputFrameCount` e epsilon do compositor;
trecho sem frames é recusado. Repetição usa o contrato nativo existente 0/1.

`pixelFrames` é estimativa de trabalho, NÃO bytes GIF ou RAM simultânea. Não
mostrar como tamanho estimado ao usuário. Estimativa de arquivo permanece
pendente de amostras reais pelo compositor; GIF pode ser maior que MP4 e não tem
áudio. Nenhuma composição de webcam/cursor/edições foi adicionada implicitamente.
Próximo: conectar probe main-owned, cena/trecho original explícito, ExportJobs,
diálogo/destino 02G e validação decode/codec, depois UI/progresso/cancelamento.
Teste unitário desse preflight não homologa GIF real ou o fluxo por input OS.

### 02K — cena original compartilhada e prova nativa isolada

`electron/recording/savedRecordingGifScene.ts` constrói documento efêmero com uma
fonte e um trecho; reutiliza `buildSceneDescription`, sem importar shell/editor
nem modificar documento/preferências reais. Modo original explícito: câmera nula,
cursor editável/zoom/efeitos/moldura/áudio desligados; cursor já embutido no vídeo
permanece nos pixels. Retângulos normalizados cobrem o quadro inteiro, sem crop;
output e params usam as mesmas dimensões. Redimensionamento tem a pequena
aproximação de proporção inerente ao arredondamento par.

Descoberto no addon existente: `resolve_output_size` reduz também GIF a pixels
pares. Preflight agora faz o mesmo, nunca anuncia 853 se o addon grava 852.
Fonte menor que 2 px/eixo e formato extremo que viraria zero são recusados,
sem upscale silencioso. Não houve alteração/rebuild do código Rust/C++.

Prova isolada com fonte sintética, probe Chromium, cena real, `startGifExport`,
ExportJobs e destino 02G: trecho 1,25–3,25 s, GIF 768×480, 30 frames/2 s,
1.898.617 bytes, decode integral aprovado, original com mesmo SHA256. Cancelamento
nativo imediato aceito, writer aguardado, nenhum GIF cancelado publicado.
Comparação do primeiro frame com fonte redimensionada: erro RGB médio3,84/255;
quatro cantos amarelos presentes, movimento confirmado. NÃO é homologação visual
do GIF/interface ou medição de fidelidade para conteúdo arbitrário.

Esse GIF de2s é maior que o MP4 sintético original de5s/266.116bytes. Não usar
taxa MP4 para estimar GIF. `stats.fps` é throughput de exportação, não FPS de
reprodução; UI futura deve mostrar FPS solicitado e tamanho final medido.
Callback de progresso é throttled e pode omitir o último frame: só concluir após
writer, validação e publicação, nunca porque porcentagem chegou a100%.
Adapter ainda isolado, sem IPC/botão novo. Diálogo real/cancel UI/sessão trocada/
fechamento de dono/fluxo completo continuam pendentes na integração runtime.

Integração mapeada (ainda não implementada): reutilizar
`electron/mcp/hidden-video.ts:openVideoInHiddenWindow` para obter metadados da
fonte já autorizada; sempre fechar a janela oculta em `finally` e revalidar
sessão/dono após o await. Não confiar no `video.duration` enviado pela UI.
Documento efêmero/cena compartilhada devem desabilitar layout/zoom/cursor
automático no modo original, sem alterar configurações reais do usuário.
Não passar JSON de cena arbitrário do renderer ao novo endpoint. `startGifExport`
exige addon com controles de cancelamento; ausência deve falhar explicitamente.
Publicação do destino 02G somente após término do writer e decode válido, nunca
porque a promessa retornou estatísticas. Validar conteúdo/duração/frame count e
medir bytes finais; atraso GIF em centésimos pode quantizar a duração.

| Ação proposta | Fluxo | Proteção necessária antes de habilitar |
|---|---|---|
| Compartilhar original | Escolher arquivo original e destino explicitamente; adaptador de plataforma abre a escolha de destino | Não enviar automaticamente; não tratar caminho local como link público; cancelamento não é erro nem envio |
| Preparar cópia | Opção separada e nomeada como cópia, escolhida pelo usuário | Cópia exclusiva, fonte main-owned, recusar destino igual/alias do original; não anunciar compartilhamento concluído |
| GIF | Escolher trecho, resolução/FPS, confirmar estimativa e arquivo novo; exportar cena pelo compositor | Sem áudio, pode ser maior que MP4; destino validado no main, original imutável, progresso/cancelamento e limpeza apenas do derivado próprio |
| Vídeo com câmera/edições | Construir documento efêmero a partir da sessão validada, compor e mostrar o derivado antes de compartilhar | Preservar câmera/offset/cursor e proporção; não aplicar zoom/layout automático surpreendente; não sobrescrever sessão nem documento aberto |

Contratos futuros para GIF/compartilhamento (cópia byte-a-byte acima já implementada):
pedido da tela leva identidade da
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
