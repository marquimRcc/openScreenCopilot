# Decisões de arquitetura

Status das decisões abaixo: aceitas para orientar os spikes; contratos e números
de desempenho continuam sujeitos a teste. Registrar mudanças com motivo e evidência.

| ADR | Decisão | Alternativa e motivo |
|---|---|---|
| 001 | Um app Electron baseado no OpenScreen | Dois apps (Electron + Tauri) duplicam UI, captura e ciclo de sessão |
| 002 | Uma única captura de áudio por sessão | Capturar duas vezes gera drift, duplicatas e disputa por dispositivos |
| 003 | speech-core Rust independente + sidecar local | Embutir Tauri/AppHandle acopla runtime; addon nativo direto aumenta fragilidade/ABI |
| 004 | PCM separado por fonte antes do mix | Extrair áudio do MP4 crescente dificulta latência, fontes e recuperação |
| 005 | Fila limitada + cache persistente com retenção | Fila infinita estoura memória; descarte silencioso falsifica a transcrição |
| 006 | Relógio monotônico + contadores + mapa de pausas | Horário civil muda; relógios independentes causam drift |
| 007 | AV1 hardware por capacidade, com fallback visível | Forçar AV1 universalmente exclui GPUs; CRF não garante 300 MB |
| 008 | Whisper inicial; Parakeet opcional avaliado | Compatibilidade pt-BR e aceleração devem ser medidas, não inferidas do nome do modelo |
| 009 | Windows primeiro, adaptadores Linux depois | Portar tudo antes de validar o fluxo aumenta variáveis sem prova de qualidade |
| 010 | MP4, texto e manifest separados | Texto embutido no vídeo impede uso independente e encarece reprocessamento |
| 011 | Backend FastAPI legado fora da integração | O meeting-copilot moderno processa no desktop; reativar backend arquivado amplia escopo |
| 012 | Fork OpenScreen + importação da outra base com histórico | GitHub associa um fork a um único projeto de origem; preservar a segunda genealogia via merge |
| 013 | Sem runtime vendor automaticamente | Não instalar dependências nem executar pipelines de publicação da base importada |
| 014 | Identidade própria antes de distribuir | Colidir appId/userData/feeds pode afetar a instalação original e usuários do upstream |

## Reutilização, não fusão cega

A transcrição pós-gravação existente em `electron/stt/` permanece disponível como
baseline. Decidir como compartilhar providers/model cache após o spike do core;
não iniciar dois servidores Whisper disputando a GPU para a mesma sessão.
O editor herdado pode consumir o JSON final por adaptador explícito.

A UI NextJS/Tauri do meeting-copilot não será portada inteira. Reaproveitar contratos
e comportamentos úteis, respeitando seu contexto de licenças. Recursos de assistente,
resumos ou busca entram só depois de gravação e ASR estabilizados.

## Licenças e privacidade

MIT permite modificar e redistribuir com avisos preservados, mas não confere direitos
sobre marca, certificados, serviços ou todos os modelos. Antes de distribuir, auditar
npm/crates, FFmpeg e modelos por versão, origem, hash, licença e avisos exigidos.
Usar "local por padrão" como comportamento verificável, não como promessa de que
um modelo nunca precisará ser baixado. Downloads exigem informação e verificação.

Não criar gravação escondida nem enviar conteúdo a LLMs por padrão. Avisos de
consentimento e regras aplicáveis à gravação devem ser tratados no produto sem
substituir a decisão do usuário ou inventar permissões de terceiros.
