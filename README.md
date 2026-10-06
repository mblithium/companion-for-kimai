# Companion for Kimai

Esta extensão não é oficial.

Extensão de navegador (Chrome + Firefox) que melhora a página de **timesheet do Kimai**,
começando pelo recurso mais pedido: **uma barra “Iniciar timer rápido” logo acima dos registros**,
para não precisar clicar no play do topo.

Funciona em qualquer instalação do Kimai (ex.: `https://kimai.example.com/pt_BR/timesheet/`).

## Instalar (desenvolvimento)

### Google Chrome
1. Na pasta do projeto, rode **`npm run manifest:chrome`** (o `manifest.json` da raiz vem pronto para Firefox).
2. Acesse `chrome://extensions`.
3. Ative **Modo do desenvolvedor**.
4. **Carregar sem compactação** → selecione esta pasta (`companion-for-kimai`).
5. Abra `https://kimai.example.com/pt_BR/timesheet/` e use a barra acima dos registros.

### Firefox
1. O `manifest.json` da raiz já é a variante Firefox (event page) — sem passo extra.
2. Acesse `about:debugging#/runtime/this-firefox`.
3. **Carregar extensão temporária** → selecione o `manifest.json`.
4. Abra a página do timesheet. (Para distribuição final é preciso assinar na AMO.)

> Por que duas variantes? O Chrome MV3 exige `background.service_worker` e o
> Firefox sem suporte a isso exige `background.scripts` — o `worker.js` é o
> mesmo nos dois. O `check-pages` garante que as variantes só diferem nisso
> (+ versão mínima do Gecko).

## Instalar (produção — zip)

```bash
npm run build            # checks + tests + Chrome and Firefox archives in dist/
npm run build:chrome     # Chrome archive only (without checks)
npm run build:firefox    # Firefox archive only (without checks)
npm run manifest:chrome  # seleciona o manifest do Chrome para desenvolvimento
npm run manifest:firefox # seleciona o manifest do Firefox para desenvolvimento
```

Isso gera `dist/companion-for-kimai-chrome-<versão>.zip` e
`dist/companion-for-kimai-firefox-<versão>.zip`, cada um com o `manifest.json`
da sua variante + apenas `icons/`, `src/` e `LICENSE` (sem testes, docs ou
scripts). O build falha se versões divergirem ou faltar algum arquivo
referenciado no manifest.

- **Chrome**: `chrome://extensions` → modo do desenvolvedor → arraste o zip
  da variante chrome (ou envie à Chrome Web Store).
- **Firefox**: `about:debugging#/runtime/this-firefox` → Load Temporary Add-on
  com o zip da variante firefox (ou envie à AMO para assinar).

## Como usar

1. Preencha **Descrição** (área maior, `Enter` inicia, `Shift+Enter` quebra linha),
   **Cliente / Projeto / Atividade** (digite para buscar; `Enter` confirma,
   `Esc` reverte). **Tags**: combobox com busca nas tags do sistema (Enter
   adiciona, Backspace remove a última) — as que não existirem são criadas.
2. Clique em **▶ Iniciar** (ou `Enter` na descrição). O timer aparece no topo
   da barra com cronômetro ao vivo.
3. Com timer rodando: ele aparece no widget **Agora**, logo abaixo do Timer
   rápido, com cronômetro ao vivo — pare por lá, no **Parar** de cada timer;
   clique no timer (ou no **✎**) para **editar** projeto, atividade, descrição
   e tags sem parar. A tabela recarrega sozinha.

## Popup e configurações

- O botão da toolbar abre o popup: **timer(s) rodando** (com Parar), **novo
  timer** (descrição, cliente, projeto, atividade e tags, todos com label) e
  **continuar de hoje** (▶ reinicia um timer do dia com os mesmos dados, ⟳
  atualiza, **Agrupar** junta por tarefa com expandir) + **Recentes** (fora
  de hoje, com data e ⟳ próprio). Iniciar pelo popup **recarrega as abas do
  Kimai** para não exibir página desatualizada. **↗** abre o Kimai (no
  contêiner do Firefox, se houver); **⚙** abre as configurações.
- Configurações: **URL base do Kimai** (detectada sozinha ao abrir o
  timesheet), **idioma** (sincroniza com o Kimai logado, editável),
  **chave de API** (só token agora, com teste de conexão, Conectar/
  Desconectar e toast de 5s), **temas** (Sistema, Claro, Escuro, Dracula, Catppuccin,
  Nord, Gruvbox e GNOME/Adwaita (modo claro/escuro acompanha o sistema),
  **atalhos de teclado**
  (iniciar/parar/recomeçar) e **autorização de acesso** do popup — pedida só para
  aquele host (`optional_host_permissions`), sem acesso amplo a todos os sites.

## Compatibilidade

- `manifest_version: 3`, sem background worker (só content script) — superfície mínima de API,
  igual no Chrome e no Firefox.
- `browser_specific_settings.gecko.id` incluído (exigido pela AMO).
- Permissões enxutas: `storage` + `alarms` + `contextMenus` (sem alertas) e
  `optional_host_permissions` pedida só para o host do seu Kimai. O content
  script usa `fetch` mesma-origem; popup/worker usam a origem configurada.
- Ícone muda com timer rodando (badge com decorrido); botão-direito no ícone
  tem Pausar/Continuar. Requer Firefox 121+ (service worker MV3).
- Testado contra o demo oficial (`demo.kimai.org`, Kimai 2.68.0) com login de sessão.

## Desenvolvimento

Sem build: edite `src/*` e recarregue a extensão. Convenções em
`docs/ARCHITECTURE.md` (módulos como IIFE publicando em `KE`, paletas em
`src/common/themes/`, camadas dados × UI). Registre mudanças em `CHANGELOG.md`.

```bash
npm test          # functional tests
npm run check     # syntax, page integration, and contrast checks
npm run build     # checks + tests + production archives in dist/
```

## Problemas conhecidos

- Se o Kimai recusar o início (ex.: projeto com período bloqueado, atividade
  inválida), a barra agora mostra o **motivo devolvido pelo servidor** após
  "Não foi possível iniciar o timer.", em vez de só o código HTTP. O detalhe
  completo vai para o console do navegador (`[Companion] start failed`).

## Roadmap (próximos recursos)

- Favoritos / últimos timers (restart em 1 clique).
- Duração padrão / hora de início editável.
- Página de opções (projeto padrão, tags padrão).
- Atalho de teclado configurável.

## Licença

MIT.
