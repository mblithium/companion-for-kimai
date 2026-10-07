# Arquitetura

## Princípios

- **Sem build**: JS vanilla + CSS puro, carregável direto como extensão
  descompactada. Por isso não usamos ES modules nos content scripts (suporte
  inconsistente entre Chrome e Firefox): os arquivos de `src/content` são
  **scripts clássicos carregados em ordem** (ver `manifest.json`) no mesmo
  isolated world.
- **Um namespace, IIFEs**: cada módulo é uma IIFE que publica sua API em `KE`
  (definido em `namespace.js`). Nada de globais implícitos — o que é
  compartilhado passa por `KE`.
- **Camadas**: dados (`kimai.js` + `api.js`) não conhecem DOM; UI
  (`quicktimer.js`, `combo.js`) orquestra.

## Módulos (`src/content/`, ordem de carga)

| Arquivo | Responsabilidade | Publica |
|---|---|---|
| `namespace.js` | Raiz do namespace | `KE` |
| `i18n.js` | Textos pt/en, idioma da página | `KE.STRINGS`, `KE.T` |
| `utils.js` | Funções puras (datas, DOM, eventos Kimai) | `KE.el`, `KE.norm`, `KE.nowLocal`, `KE.elapsedSince`, `KE.asArray`, `KE.isTimesheetListPage`, `KE.notifyKimaiUpdate`, `KE.sleep` |
| `api.js` | `fetch` mesma-origem + extração de erro do servidor | `KE.api`, `KE.apiGet/Post/Patch` |
| `storage.js` | `browser`/`chrome`.storage com fallback | `KE.storageGet/Set` |
| `combo.js` | Combobox pesquisável reutilizável | `KE.createCombo` |
| `kimai.js` | Estado local + leitura da API + rótulos | `KE.state`, `KE.projectLabel`, `KE.load*`, `KE.apply*`, `KE.fetchActiveTimesheets`, `KE.ensureTags`, `KE.describeProjectRef/ActivityRef` |
| `cache.js` | Cache `storage.local` (TTL 24h catálogo / 1h diários) | `KE.CACHE_TTL`, `KE.get*Cached`, `KE.cacheGet/Set/Fresh` |
| `quicktimer.js` | Barra de timer: UI, start/stop, cascata, montagem, ciclo de vida | (efeito: injeta a seção) |

Estilos: `quicktimer.css`, `combo.css` (sem escopo de página — usado no
content e no popup, sempre com prefixo `ke-`), `src/popup/popup.css`.

## Popup e opções (`src/popup/`, `src/options/`, `src/common/`)

- Reutilizam os módulos de conteúdo (`namespace` → `kimai`, `combo`,
  `theme`) + `common/permissions.js` (compat `browser`/`chrome`, URL base,
  optional host permissions) e `common/format.js` (funções puras: duração,
  hoje, dedupe).
- `quicktimer.js` NÃO é carregado no popup (ele injeta UI na página).
- Origem do Kimai (`keSettings.kimaiBaseUrl`, idioma `keLocale`, usuário
  `keUsername`): detectada pelo content script; idioma/usuário sincronizados
  via `GET /api/users/me` nas opções. Feedback por toast de 5s.
- Sem acesso concedido, o popup mostra como autorizar (só aquele host).
  Chamadas usam base absoluta + `Authorization: Bearer` + `credentials: omit`
  (chave guardada em `storage.local`, fora do sync; sem modo sessão).
- **Cache**: catálogos e diários via `cache.js` (`storage.local`, nunca o
  sync por causa da cota). Popup e barra pintam do cache na hora; a barra
  revalida em fundo e atualiza combos só se mudou; diários e recentes têm
  refresh manual + auto a cada 1h no popup.
- **Popup**: campos do Novo timer com labels (`KE.T`) e cascata
  Cliente→Projeto→Atividade + Tags multi; após iniciar, `reloadKimaiTabs()`
  recarrega as abas da base (`tabs.reload`, sem permissão nova); Recentes via
  `format.recentOthers()` (fora de hoje, com data) e `cache.getRecentCached()`.
- **Temas**: `common/themes/*.css` contém uma paleta por arquivo;
  `common/theme.css` integra as variáveis com o Tabler/Kimai, e `common/theme.js`
  guarda o catálogo e a aplicação. Popup, opções e página do Kimai usam o tema;
  GNOME acompanha a preferência de modo claro/escuro do sistema.
- **Atalhos**: `utils` normaliza/compara (`describeKeyEvent`,
  `shortcutMatches`); `quicktimer` ouve `keydown` (ignora campos e repetição),
  lê `keSettings.shortcuts` e reage a mudanças via `onStorageChanged`;
  `kimai.restartLast()` copia o timer mais recente.

## Fluxos principais

- **Montagem**: `init()` → `findAnchor()` (tabela `.datatable_timesheet`) →
  `mount()` + `loadAll()` (clientes → projetos → atividades, restaurando
  `storage`) + `loadActive()`. Se a tabela ainda não existe, aguarda via
  polling; fallback injeta no `.page-body`.
- **Sobrevivência a reloads**: o Kimai recarrega a listagem via AJAX ao
  iniciar/parar (eventos `kimai.timesheetUpdate` etc.), removendo a seção.
  `startPersistentObserver()` remonta (debounce 400ms) e recarrega os dados.
- **Start**: `flush(true)` nos combos (confirma texto pendente sem cascata) →
  `ensureTags()` (cria faltantes, envia como string `a,b`) →
  `POST /api/timesheets` (só campos preenchidos) → salva seleção →
  `notifyKimaiUpdate()` → `loadActive()`.
- **Edit inline**: `openEdit()` troca a linha por mini-form (combos próprios +
  `ensureTags`) → `PATCH /api/timesheets/{id}` → `loadActive()`; `Esc`/`Cancelar`
  voltam via `renderActive()`.
- **Agrupar**: `format.groupByTask()` (por projeto+atividade) → linhas de grupo
  com expandir + continuar pelo mais recente; preferência `groupTasks` no sync.
- **Agrupar no site** (`content/sitegroup.js`, puro e testável): botão discreto
  acima da tabela; agrupa só iguais **adjacentes** estilo Clockify
  (cliente+projeto+atividade+descrição), avulsos sem cabeçalho; linha de grupo
  espelha as colunas (checkbox do grupo, período, início/fim, duração somada)
  no padrão Kimai; reaplica após cada redesenho via observer com debounce +
  assinatura (sem loop); restaura a ordem ao desligar; totais dos timers
  rodando atualizados a cada 1 min.

## Background worker (`src/background/worker.js`)

- Importa os módulos puros via `importScripts` (sem DOM: sem combo/popup).
- `alarms` a cada 1 min + mensagens `ke-refresh` (content avisa após
  start/stop/edit) → ícone rodando/parado, badge `5m`/`2h`, título detalhado.
- Menu do botão-direito (`contexts: ["action"]`): ⏸ Pausar (para todos) e
  ▶ Continuar (recomeça o mais recente), com visibilidade por estado.
- Usa a mesma config do popup (base + chave); sem config/acesso, some.
- Duas variantes de manifest (`manifest/chrome.json` com service worker,
  `manifest/firefox.json` com event page `scripts` sem `persistent`;
  mesmo worker): a raiz vem com a variante Firefox; troque via
  `npm run manifest:chrome` ou `npm run manifest:firefox`. O `check-pages`
  valida que só diferem em background e Gecko-mínimo.

## Testes

`tests/harness.js` executa os **arquivos reais** (ordem lida do manifest)
num DOM stub + API stub, cobrindo: restore, busca com acento, cascata,
teclado, POST, validação, erro 400 com mensagem do servidor, remontagem após
wipe. Rode com `npm test`; `npm run check` valida sintaxe de todos os JS e
roda `tests/check-pages.js` (toda `KE.*` usada por popup/opções precisa estar
definida nos scripts que a página carrega).

## Build de produção (`scripts/build-zip.js`, `dist/`)

- Fonte da verdade: `manifest/chrome.json` + `manifest/firefox.json` (nunca o
  `manifest.json` da raiz, que é só a variante ativa no dev).
- Cada zip contém `manifest.json` (da variante) + `icons/`, `src/`, `LICENSE`.
- Valida antes: versões sincronizadas (manifests + `package.json`), manifest
  parseável e todos os arquivos referenciados (js/css/html/icons/worker)
  presentes; recusa vazar `tests/`, `docs/`, `scripts/`, `manifest/`.
- `npm run build` = `check` + `test` + zips; `build:chrome`/`build:firefox`
  geram só a variante (sem gates).
