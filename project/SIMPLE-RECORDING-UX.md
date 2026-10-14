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
ação local **Salvar uma cópia** (02I) e ao controlador GIF via IPC (02M).
O botão GIF e o compartilhamento continuam pendentes.
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

### 02L — controlador e decoder final (isolados do runtime)

`SavedRecordingGifs` junta preflight/cena, snapshot da sessão/fonte, diálogo
main-owned, destino 02G, ExportJobs, progresso e cancelamento. Recebe caminho
esperado do original e opções, nunca caminho final/cena/controle nativo do
renderer. Valida dono/papel por dependência main antes/depois de awaits; uma
operação ativa, fonte MP4/WebM e identidade/tamanho/mtime antes do writer.
SHA256 em stream antes/depois impede publicar se a fonte mudou durante o job.

Cancelar/fechar dono aborta preparação/validação e solicita cancelamento nativo.
Mesmo se o cancel nativo lançar exceção, espera writer encerrar antes de limpar
staging. Cancel durante init é reaplicado após receber controle; durante publicação
final pode ser recusado. Caminho/tamanho final só retornam após publicação exclusiva.

`validateSavedGif` confere GIF87a/89a e dimensões no cabeçalho, depois executa
SOMENTE decode completo com FFmpeg compartilhado existente, forçando demuxer GIF,
ignorando repetição e sem criação de arquivo/encoder. Confere progresso final,
frames e duração (tolerância30ms para centésimos); timeout60s/logs limitados,
AbortSignal e espera `close` do processo antes da limpeza. Falta de decoder,
erro ou saída incompleta impedem publicação; nenhum fallback sem validação.
Não precisa de FFprobe no pacote. Estatísticas do encoder não bastam.

Prova isolada Windows com componentes reais: sucesso em arquivo novo, cancel
nativo e fechamento do dono durante writer; apenas o GIF de sucesso publicado.
Decoder efetivo foi `ffmpeg-shared.exe` do payload, original intacto. Nenhum
diálogo real/IPC/interface foi homologado por esse harness programático.
Fixtures unitárias do controlador/header são texto sintético, NÃO GIF real.

Antes de ligar ao runtime: usar dono mainWindow atual/papel resultado e fonte
aprovada, garantir fechamento do probe em finally, fornecer decoder resolvido
pelo main, compartilhar estado ocupado com Salvar cópia/Nova captura/Editar e
expor progresso/cancel apenas ao dono. Não importar shell do editor. Botão GIF
permanece ausente até integrar isso e opções/aviso/estimativa/progresso na UI.

### 02M — integração main/preload, ainda sem botão

`registerSavedRecordingGifHandlers` agora ativo no main, com fonte aprovada e
janela main atual. Apenas frame principal; papel resultado e URL file/dev na
origem configurada, não páginas HTTP arbitrárias. Probe real fecha em finally;
decoder compartilhado precisa estar disponível antes de abrir probe/dialog.
Destino GIF vem do diálogo nativo da mesma janela, nunca do renderer.
Export/cancel via preload tipado; progresso privado ao dono leva UUID main-owned,
frames/total e evento inicial0. Usar UUID para ignorar eventos de outro job;
progresso100% não autoriza anunciar arquivo salvo antes da resposta final.

Estado ocupado mútuo com cópia; Nova captura e rotas UI editor/HUD/start também
recusam transição durante derivados. Não é lock global do bridge/MCP legado:
uma troca externa de sessão invalida a publicação. Proteção do exportador legado
não foi ampliada. Encerramento completo do processo/recuperação de órfãos ainda
precisam de avaliação; teste de owner fechado com processo vivo não os homologa.

QA programática em Electron real com preload compilado, IPC real, compositor e
decoder: gerou GIF validado; recusou outra janela e estado busy; recebeu progresso
com UUID consistente. Picker foi destino sintético pré-selecionado pelo harness:
NÃO é passe do diálogo nativo/main completo, cliques OS ou fluxo captura→resultado.
Primeiro harness tentou devolver função unsubscribe por executeJavaScript e
falhou clone; corrigido retorno void, sem alterar API por causa desse erro.
Interface principal continua sem botão GIF; opções/aviso/estimativa/progresso,
teste manual OS e shutdown/recuperação permanecem próximos incrementos.

### 02N — encerramento coordenado dos derivados

Cópia/GIF congelam novas operações e aguardam cancelamento, writer/decoder e
limpeza própria antes da reentrada em app.quit. Publicação já iniciada é
aguardada, não desfeita. Se uma janela vetar o fechamento, admissão de novos
derivados é restaurada; outra tentativa de quit drena novamente. Não forçar
saída por timeout nem limpar temporários por prefixo. Crash/app.exit e falhas de
limpeza podem deixar órfãos; recuperação continua pendente. STT legado após veto
de quit não foi redesenhado/homologado por este incremento.

Teste isolado real de lifecycle/compositor passou duas tentativas, com veto
programático entre elas, original intacto e sem staging final. Não equivale a
input OS, diálogo real ou ASR. App do usuário e pacote em uso não tocados.

### 02O — veto da edição preserva o STT

Preparação reversível fica no before-quit (derivados e flush); encerramento
terminal de Whisper passa ao will-quit, após todas as janelas aceitarem close.
Assim Cancelar saída mantém o gerente/helper e IPC existentes, sem resetar
guardas de shutdown. Novo flush inclui escrita ocorrida durante salvar/confirmar.
Ambas as fases aguardam suas operações; repetir quit não contorna a espera.

QA programática isolada real com preload/IPC e Whisper CPU processou silêncio
sintético antes/depois de veto, mesmo gerente, um shutdown final e exit0.
Não mede precisão da fala, transcrição longa em andamento nem diálogo OS real.
Pacote/app em uso não tocados; a limitação de STT descrita em 02N é histórica.

Integração mapeada (agora implementada em 02M): reutilizar
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
