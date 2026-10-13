# openScreenCopilot

Gravador de tela com transcrição local, construído a partir de
[OpenScreen](https://github.com/getopenscreen/openscreen) e
[meeting-copilot](https://github.com/marquimRcc/meeting-copilot).

**Estado: fundação e arquitetura.** Esta inicialização preserva o código das duas bases,
suas licenças e seus históricos. **Não integra ainda a transcrição ao vivo, a seleção
retangular ou o novo perfil de compressão.** O aplicativo executável continua sendo
o OpenScreen herdado. Não há instalador próprio aprovado para testes neste momento.

## O que vamos construir

- Seleção de monitor, janela ou retângulo, começando pelo Windows 11.
- Áudio do dispositivo de saída escolhido (alto-falantes/fone) e microfone opcional.
- Gravação eficiente com AV1 por hardware quando disponível e fallback explícito.
- Perfil-alvo de até **300 MB decimais em 30 minutos**; qualidade e tamanho serão
  medidos juntos. Não existe garantia universal de qualidade para qualquer conteúdo.
- Transcrição local durante a gravação, independente do vídeo, com TXT, SRT e JSON.
- Compatibilidade posterior com Linux/RegataOS, validada no sistema real.

## Comece aqui

| Documento | Conteúdo |
|---|---|
| [Arquitetura](project/ARCHITECTURE.md) | Componentes, fluxos, responsabilidades e estados |
| [Plano passo a passo](project/ROADMAP.md) | Etapas ordenadas, dependências e critérios de conclusão |
| [Situação atual](project/STATUS.md) | O que existe, o que falta e qual é o próximo passo |
| [Requisitos](project/REQUIREMENTS.md) | Escopo do MVP, limites e decisões de produto |
| [Contratos](project/CONTRACTS.md) | IPC, áudio, relógios, segmentos e recuperação |
| [Windows 11](project/WINDOWS11.md) | Captura, áudio, AV1 e orçamento de tamanho |
| [Testes](project/TESTING.md) | Matriz, medições e critérios de aceite |
| [Decisões técnicas](project/DECISIONS.md) | Alternativas escolhidas e rejeitadas |
| [Origem e manutenção](project/UPSTREAMS.md) | Commits fixados, licenças e atualização das bases |

## Organização

```text
src/                         Interface React do OpenScreen
electron/                    Electron, IPC e auxiliares nativos de captura
crates/compositor/           Compositor herdado
vendor/meeting-copilot/      Segunda base completa, congelada para extração gradual
project/                     Arquitetura proposta e planejamento deste fork
technical-documentation/     Referência do OpenScreen efetivamente implementado
```

As futuras pastas de núcleo ASR e sidecar estão desenhadas na arquitetura, mas não
foram criadas como componentes fictícios. O meeting-copilot não é instalado, iniciado
ou empacotado automaticamente pelo projeto raiz.

## Desenvolvimento e segurança

O projeto raiz usa **Node 22.22.1 e npm 10.9.4**, conforme os manifests herdados.
Consulte [AGENTS.md](AGENTS.md), [CONTRIBUTING.md](CONTRIBUTING.md) e o
[guia de origem](project/UPSTREAMS.md) antes de executar builds.

```powershell
npm ci
npm run docs:check
npm run lint
npx tsc --noEmit
npx tsc -p tsconfig.test.json --noEmit
npm test
```

Ainda não publique instaladores com as identidades, URLs de atualização, certificados
ou feeds de distribuição dos projetos originais. A primeira etapa de implementação
isola esses dados para o fork. Não execute o backend Python arquivado do meeting-copilot.

## Licença e créditos

As duas bases utilizam MIT. As atribuições originais foram preservadas:
[OpenScreen](LICENSE), [meeting-copilot](vendor/meeting-copilot/LICENSE.md) e
[registro das fontes](THIRD_PARTY_SOURCES.md). Bibliotecas e modelos têm licenças próprias:
MIT no aplicativo não transforma todas as suas dependências em MIT.

O [README original](project/upstream/OPENSCREEN-README.md) e o
[roadmap original](project/upstream/OPENSCREEN-ROADMAP.md) estão arquivados como referência
histórica; seus links relativos mantêm o contexto da raiz original e podem não resolver
a partir da pasta de arquivo. Não são promessas de funcionalidades deste fork.
