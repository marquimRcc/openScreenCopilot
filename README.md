# openScreenCopilot

Gravador de tela com transcrição local, construído a partir de
[OpenScreen](https://github.com/getopenscreen/openscreen) e
[meeting-copilot](https://github.com/marquimRcc/meeting-copilot).

**Estado: etapa 01 em validação no Windows.** As duas bases, licenças e históricos
foram preservados. O aplicativo tem identidade própria e um pacote local experimental,
mas **não integra ainda transcrição ao vivo, seleção retangular ou novo encoder**.
Não há instalador ou release homologado. Há uma pendência de timestamps no encoder
Intel herdado; veja a [baseline Windows](project/WINDOWS11-BASELINE.md).

## O que vamos construir

- Seleção de monitor, janela ou retângulo, começando pelo Windows 11.
- Áudio do dispositivo de saída escolhido (alto-falantes/fone) e microfone opcional.
- Gravação eficiente com AV1 por hardware quando disponível e fallback explícito.
- Qualidade primeiro: preservar texto legível e áudio claro, reduzindo o tamanho
  por comparação com a baseline. **Sem teto obrigatório de 300 MB/30 minutos.**
  Não existe garantia universal de qualidade sem perdas para qualquer conteúdo.
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
| [Baseline Windows](project/WINDOWS11-BASELINE.md) | Ambiente real, build de teste e limitações da etapa 01 |
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

Não publique instaladores com identidades, certificados ou feeds dos projetos originais.
O fork usa perfil próprio, desativa auto-update e bloqueia o comando de Store; isso não
substitui a homologação de distribuição. Não execute o backend Python arquivado do vendor.

## Licença e créditos

As duas bases utilizam MIT. As atribuições originais foram preservadas:
[OpenScreen](LICENSE), [meeting-copilot](vendor/meeting-copilot/LICENSE.md) e
[registro das fontes](THIRD_PARTY_SOURCES.md). Bibliotecas e modelos têm licenças próprias:
MIT no aplicativo não transforma todas as suas dependências em MIT.

O [README original](project/upstream/OPENSCREEN-README.md) e o
[roadmap original](project/upstream/OPENSCREEN-ROADMAP.md) estão arquivados como referência
histórica; seus links relativos mantêm o contexto da raiz original e podem não resolver
a partir da pasta de arquivo. Não são promessas de funcionalidades deste fork.
