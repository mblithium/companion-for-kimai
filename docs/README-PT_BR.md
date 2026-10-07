# Companion for Kimai

Esta extensão não é oficial. [English version](../README.md).

Extensão de navegador (Chrome + Firefox) que melhora a página de **timesheet do Kimai**,
começando pelo recurso mais pedido: **uma barra “Iniciar timer rápido” logo acima dos registros**.

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
npm run build            # checks + tests + Chrome/Firefox ZIPs in dist/
npm run build:chrome     # Chrome ZIP only (without checks)
npm run build:firefox    # Firefox ZIP only (without checks)
npm run manifest:chrome  # select the Chrome manifest for development
npm run manifest:firefox # select the Firefox manifest for development
```

Isso gera `dist/companion-for-kimai-chrome-<versão>.zip` e
`dist/companion-for-kimai-firefox-<versão>.zip`, cada um com o `manifest.json`
da sua variante, o `LICENSE` e somente os arquivos referenciados pelo manifest,
pelas páginas e pelo worker. O build falha se versões divergirem ou faltar um
arquivo necessário.

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

## Compatibilidade

- `manifest_version: 3`; o Chrome usa service worker e o Firefox usa event page
  (`background.scripts`), com o mesmo worker compartilhado.
- `browser_specific_settings.gecko.id` incluído (exigido pela AMO).
- Permissões enxutas: `storage` + `alarms` + `contextMenus` (sem alertas) e
  `optional_host_permissions` pedida só para o host do seu Kimai. O content
  script usa `fetch` mesma-origem; popup/worker usam a origem configurada.
- Ícone muda com timer rodando (badge com decorrido); botão-direito no ícone
  tem Pausar/Continuar. Requer Firefox 121+.
- Testado contra o demo oficial (`demo.kimai.org`, Kimai 2.68.0) com login de sessão.

## Desenvolvimento

Sem build: edite `src/*` e recarregue a extensão. Convenções em
`docs/ARCHITECTURE.md` (módulos como IIFE publicando em `KE`, paletas em
`src/common/themes/`, camadas dados × UI). Registre mudanças em `CHANGELOG.md`.

```bash
npm test          # functional tests
npm run check     # syntax, page integration, and contrast checks
npm run build     # checks + tests + production ZIPs in dist/
```

## CI

O GitHub Actions executa o build das variantes Chrome e Firefox em push para
`main`, pull requests e tags `v*`. As duas zips ficam disponíveis como artifact
por 30 dias; o resumo da execução inclui a seção da versão correspondente em
`CHANGELOG.md`. Ao enviar uma tag `v*` igual à versão de `package.json`, cria
também um GitHub Release com os dois ZIPs anexados e as notas do changelog.

## Licença

MIT.
