# Snapshot de terceiros

vendor/meeting-copilot é uma base congelada, não parte do workspace npm da raiz.
Não editar/reformatar o snapshot nem executar seus workflows ou backend arquivado
como parte automática do build OpenScreenCopilot.

Para reutilizar código, extrair para componentes próprios com testes e preservar
copyright/licença. Para atualizar a base inteira, seguir project/UPSTREAMS.md e
registrar o novo commit em project/upstreams.lock.json.

As instruções presentes dentro do snapshot permanecem como documentação da origem.
Não executar rotinas de release/publicação upstream como se pertencessem a este fork.
