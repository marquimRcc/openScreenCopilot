# Entrega do preview Windows 0.1.0-alpha.1

Estado em 31/10/2026: **candidato de entrega pronto, ainda não homologado pelo
operador**. A homologação física foi explicitamente adiada para depois da entrega e
não bloqueia este handoff.

## Artefato a entregar

- Plataforma: Windows x64.
- Instalador: `release/0.1.0-alpha.1/openScreenCopilot.Setup.0.1.0-alpha.1-x64.exe`.
- Tamanho: 192.095.211 bytes.
- SHA-256: `731FD9D9AA248E9336BD6EF91DA63D0AC0FD77735F2C6977EA141A4CE85FF96A`.
- Código do pacote: branch `feat/windows-region-foundation`, commit
  `61676d1f80cee80a08cb4d6fbec4a10d19d2420b`.
- Assinatura Authenticode: ausente (`NotSigned`). O Windows pode exibir SmartScreen
  e “editor desconhecido”.
- Atualização automática: desabilitada; `publish: []`; nenhum feed do upstream.
- Publicação/instalação nesta preparação: não realizadas.

Os hashes completos do instalador, blockmap, executável unpacked, `app.asar` e helper
WGC ficam em `release/0.1.0-alpha.1/DELIVERY-MANIFEST.json` e
`release/0.1.0-alpha.1/SHA256SUMS.txt`. Regerar/verificar o manifesto local com:

```powershell
npm run delivery:win
```

## Escopo entregue

- seleção e gravação de tela, janela e região;
- áudio do sistema e microfone configuráveis;
- pausa, retomada, parada e cancelamento;
- borda protegida com estado `REC` e `PAUSADO/PAUSED`, fora do vídeo;
- resultado salvo, reprodução, abertura no editor e exportação;
- identidade e perfil próprios do fork;
- pacote Windows local reproduzível, licenças e binários nativos incluídos.

## Aceites adiados para o operador

Estes itens não bloqueiam a entrega do preview, mas bloqueiam chamá-lo de release
homologado:

- fala humana/microfone audível e sincronizado;
- DPI misto e múltiplos monitores;
- troca/desconexão física de dispositivos;
- confirmação visual da borda e dos selos protegidos no desktop real;
- instalação e execução pelo fluxo escolhido pelo operador.

## Handoff

1. Copiar o instalador e este documento para o destino de entrega escolhido.
2. Conferir o SHA-256 antes de executar.
3. Instalar somente quando o operador decidir; não contornar avisos de segurança de
   forma automática.
4. Tratar a versão como preview/teste até os aceites adiados serem concluídos.
5. Registrar qualquer bloqueador reproduzível antes de promover ou publicar release.

Não é necessário distribuir `latest.yml` ou o blockmap enquanto não houver canal de
atualização. Eles permanecem apenas como saída verificável do empacotador.
