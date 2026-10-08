# Changelog

Formato baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.0.0/).

## [0.22.15] — 2026-10-08
### Added
- Seções "Continuar de hoje" e "Recentes" do popup abrem colapsadas;
  o clique no título expande/recolhe cada seção.
### Fixed
- Atributo `hidden` agora prevalece sobre regras `display` no popup e nas
  opções (o checkbox de rascunho desativado voltava a aparecer).
- Alternar "Habilitar rascunho" avisa que é preciso salvar para aplicar.

## [0.22.14] — 2026-10-08
### Added
- Rascunho incorporado à seção Novo timer do popup: checkbox abaixo da
  descrição preenche e trava Cliente/Projeto/Atividade/Tags com o Timer
  padrão das configurações; Iniciar usa esses valores.
- Botão de edição (✎) ao lado do Parar em cada timer ativo do popup,
  com formulário inline (projeto, atividade, descrição, tags).

## [0.22.13] — 2026-10-07
### Added
- Botão de edição na linha colapsada do grupo: altera Cliente, Projeto,
  Atividade, Descrição e Tags dos itens agrupados via PATCH por lançamento,
  sem tocar em datas ou duração.

## [0.22.12] — 2026-10-07
### Added
- Total do dia atual (`HOJE HH:MM:SS`) à esquerda do total semanal, acima da
  tabela do timesheet.
### Fixed
- Total semanal passa a somar só a semana ISO mais recente da listagem.

## [0.22.11] — 2026-10-07
### Fixed
- Higiene de `innerHTML`: limpezas de container usam `replaceChildren()`;
  as cópias de HTML entre células foram centralizadas em helper documentado.

## [0.22.10] — 2026-10-07
### Fixed
- Manifesto Firefox declara `data_collection_permissions.required: ["none"]`,
  exigido pelo validador da AMO para novas submissões.

## [0.22.9] — 2026-10-07
### Added
- Seletor de idioma da interface (português ou inglês) nas configurações,
  aplicado ao popup, à página de opções, ao painel flutuante e aos widgets;
  inclui rótulos de acessibilidade, menus do worker e textos restantes.

## [0.22.8] — 2026-10-06
### Added
- Painel flutuante compacto para acompanhar o timer ativo e pausá-lo/retomá-lo,
  preservando projeto, atividade, descrição e tags.
- Seção de informações da extensão nas configurações, com versão, autor e GitHub.
### Changed
- Configurações de Interface para ocultar a navegação ou a barra de ações do Kimai;
  removida a opção antiga de ocultar a coluna Data.
- Ícones do timer e dos botões de início alinhados com formas e espaçamentos estáveis.
- O build dos ZIPs resolve as dependências do manifest e das páginas, sem copiar
  arquivos de código não referenciados; incluído `sitegroup.js` nas variantes.

## [0.22.7] — 2026-10-06
### Changed
- O cabeçalho do popup permanece fixo no topo durante a rolagem, mantendo
  acessíveis o título e os botões de abrir o Kimai e as configurações.

## [0.22.6] — 2026-10-06
### Changed
- O popup recolhe a seção **Novo timer** quando há timer ativo; o cabeçalho
  acessível permite expandir e recolher o formulário manualmente.
- Na listagem do site, as linhas-resumo diárias exibem a soma do tempo em
  `HH:MM:SS` na última coluna.

## [0.22.5] — 2026-10-06
### Changed
- GitHub Actions agora cria GitHub Releases para tags de versão, com os
  pacotes Chrome/Firefox anexados e notas extraídas deste changelog.
- `npm run check` inclui a verificação de informações sensíveis no repositório.

## [0.22.4] — 2026-10-06
### Changed
- Substituídos os scripts Python de seleção de manifest e empacotamento por
  versões Node.js sem dependências externas; adicionados comandos npm para
  selecionar as variantes Chrome/Firefox.

## [0.22.3] — 2026-10-06
### Changed
- Separadas as paletas de temas em `src/common/themes/`, com um arquivo CSS
  por tema; `theme.css` mantém somente a integração compartilhada.
- Comentários de código padronizados em inglês e reduzidos a cabeçalhos de módulo.

## [0.22.2] — 2026-10-06
### Added
- Tema **GNOME/Adwaita**, com tokens de cor do libadwaita, acento azul e
  variantes clara/escura que acompanham a preferência do sistema também no Kimai.

## [0.22.1] — 2026-10-06
### Fixed
- Feedback do Timer rápido (iniciado/parado/atualizado/erros) agora aparece
  em toast no canto inferior direito (some sozinho em 5s, dispensa ao clicar)
  em vez de dentro do widget; mesma padronização da página de opções.

## [0.22.0] — 2026-10-06
### Changed
- Timer em execução agora mora no widget próprio **Agora**, abaixo do Timer
  rápido (só título + timer); o botão **Parar** saiu do Timer rápido e o
  stop é por timer, no próprio Agora.
### Fixed
- Botões e caixas do Agora sem estilo: componentes compartilhados (botões,
  inputs, edição) agora valem nos dois widgets via `.ke-card`.

## [0.22.0] — 2026-10-06
### Changed
- Renomeado para **Companion for Kimai** (“A browser extension that enhances
  your Kimai time-tracking workflow”, por mblithium,
  https://github.com/mblithium/companion-for-kimai). Identidade anterior
  removida por completo (nome, descrição, autor, homepage, IDs e artefatos:
  `companion-for-kimai@mblithium`, `companion-for-kimai-*.zip`). Sem mudança
  funcional.

## [0.21.2] — 2026-10-06
### Fixed
- Checkbox do agrupamento agora seleciona **todos os itens de uma vez**: a
  repintura parcial no meio do loop desmarcava a caixa e interrompia a
  marcação no primeiro item (um por clique). Repintura suprimida durante o
  lote via flag `bulkSyncing`.

## [0.21.1] — 2026-10-06
### Fixed
- Checkbox do cabeçalho de grupo agora usa as classes visuais nativas do
  Kimai (`form-check-input m-0 align-middle`), igual às demais linhas.

## [0.21.0] — 2026-10-06
### Added
- Popup: campos do Novo timer com **labels** (Descrição, Cliente, Projeto,
  Atividade, Tags), filtro por **Cliente** e **Tags** em combobox com busca;
  seção **Recentes** (fora de hoje, com data, ⟳ próprio e auto-refresh de 1h).
- Popup **recarrega as abas do Kimai** após iniciar um timer (`tabs.reload`,
  só abas da base, sem permissão nova).

## [0.20.0] — 2026-10-06
### Added
- Ferramenta de build de produção integrada a `npm run build`
  (gated por `check` + `test`) gera `dist/kimai-enhancer-{chrome,firefox}-<versão>.zip`
  só com arquivos de produção (manifest da variante + `icons/`, `src/`, `LICENSE`),
  com validação de versões, manifest e referências.

## [0.19.1] — 2026-10-06
### Added
- Link formatado `BASE/IDIOMA/USUARIO/api-token` na seção da chave (atualiza
  com URL/idioma/usuário), para saber onde criar tokens.

## [0.19.0] — 2026-10-06
### Added
- **Tags em combobox** multi-seleção na barra: busca nas tags do sistema,
  chips removíveis, cria novas com Enter, Backspace apaga o último.
- **Descrição maior**: textarea com 2 linhas e altura ajustável
  (Enter inicia, Shift+Enter quebra linha).
### Fixed
- `syncComboIfChanged` chamava `getValues()` inexistente no combo simples
  (revalidação silenciosa nunca atualizava — agora atualiza).

## [0.18.3] — 2026-10-06
### Changed
- Botão único **Conectar/Testar conexão**: sem chave salva mostra Conectar
  (abre a página de chaves do Kimai); com chave, testa. Link separado removido.

## [0.18.2] — 2026-10-06
### Changed
- Configurações com **header fixo** (título à esquerda, Salvar à direita;
  botão único saiu do fim da página) e **toast no canto inferior direito**.

## [0.18.1] — 2026-10-06
### Added
- **Abrir Kimai no contêiner** (Firefox): o botão ↗ herda o `cookieStoreId`
  da aba onde o Kimai já está aberto (ignora padrão/privada). Nova permissão
  `cookies` (exigida pelo `tabs.create` com contêiner).

## [0.18.0] — 2026-10-06
### Added
- **Seção Idioma** nas configurações: detecta e sincroniza com o idioma do
  Kimai logado (`GET /api/users/me`), com seleção manual (formato `pt_BR`).
- **Conectar** no lugar de Desconectar quando sem chave: link direto para
  `BASE/IDIOMA/profile/USUARIO/api-token`.
- Status viraram **toast** de 5s (clique dispensa); removido o status no fim
  da página.

## [0.17.0] — 2026-10-06
### Removed
- Autenticação por **sessão do navegador** removida do popup/worker/opções
  (só **chave de API** agora). A barra na página segue usando a sessão da
  página logada, que continua funcionando.
### Added
- Botão **↗ Abrir Kimai** no popup (ao lado do ⚙): abre o timesheet na URL
  base configurada, no idioma detectado da página (`keLocale`).

## [0.16.2] — 2026-10-05
### Fixed
- Grupos seguem o tema: nova var `--ke-group-bg` por tema para cabeçalhos e
  membros abertos; cabeçalho aberto ganha barra de acento verde em vez de tom
  solto (verificado render real + contraste).

## [0.16.1] — 2026-10-05
### Fixed
- Temas customizados agora cobrem cabeçalho/rodapé da tabela, sidebar,
  dropdowns, inputs e texto secundário (`--tblr-bg-surface-tertiary`,
  `--tblr-navbar-bg`, `--tblr-dropdown-bg`, `--tblr-bg-forms`,
  `--tblr-card-cap-bg`, `--tblr-secondary` + regra direta para sidebar,
  dropdown e offcanvas que redefinem o fundo localmente).

## [0.16.0] — 2026-10-05
### Changed
- Tema agora vale para a **página inteira do Kimai**: base clara/escura via
  `data-bs-theme` + superfícies/acentos dos temas via variáveis `--tblr-*`
  (Sistema restaura o padrão do Kimai). Verificado ao vivo no demo.

## [0.15.0] — 2026-10-05
### Changed
- Página do Kimai acompanha o tema do plugin: barra, combos, dropdowns e
  pílula usam as variáveis do tema (com fallback Kimai); linhas de grupo
  seguem neutras para harmonizar com a tabela. `color-scheme` restrito às
  páginas próprias (sem vazar para o Kimai).

## [0.14.4] — 2026-10-05
### Fixed
- Regra de ocultar Data corrigida: grupos colapsados seguem a configuração
  como o resto (sem exceção); quem sempre mostra a data são os separadores
  nativos `tr.summary`/`tr.info`.

## [0.14.3] — 2026-10-05
### Fixed
- Agrupar engolia separadores nativos de data (`tr.summary.info`): só entra
  em grupo a linha de registro (checkbox com valor, ou células de duração +
  projeto/cliente); o resto fica parado, visível e na posição.

## [0.14.2] — 2026-10-05
### Fixed
- Ocultar a coluna Data escondia também a data dos grupos: a regra agora
  excepciona as linhas de grupo (coluna some, período do grupo continua).

## [0.14.1] — 2026-10-05
### Fixed
- Grupo aberto agora é óbvio: membros expandidos herdam o tom do cabeçalho
  (`ke-sitemember`) e o cabeçalho aberto escurece um nível (`ke-open`), com
  hover preservado; marcas limpas ao colapsar/desligar.

## [0.14.0] — 2026-10-05
### Changed
- **Agrupar no site estilo Clockify**: linha de grupo espelha as colunas da
  tabela (checkbox do grupo, período, início/fim, duração somada, tags,
  billable/exportado quando iguais, alternador em Ações) no padrão visual do
  Kimai; checkbox do grupo marca/desmarca membros (indeterminado parcial).

## [0.13.0] — 2026-10-05
### Changed
- **Agrupar no site refeito**: botão discreto logo acima da tabela (fora da
  barra) e agrupamento estilo Clockify — só registros **iguais adjacentes**
  (cliente+projeto+atividade+descrição), avulsos sem cabeçalho.
### Fixed
- `findSiteTbody` perdido na refatoração (travado pelo harness).

## [0.12.0] — 2026-10-05
### Added
- **Agrupar na listagem do site**: a tabela do timesheet agrupa por
  cliente/projeto/atividade com colapsar/expandir, contagem, duração somada e
  período; reaplica sozinho após ordenar/filtrar/paginar (mesma preferência
  do popup, botão na barra). Ações, checkboxes e timers rodando intactos.

## [0.11.0] — 2026-10-05
### Added
- **Agrupar tarefas** no popup: "Continuar de hoje" agrupa por
  cliente/projeto/atividade (contagem + duração somada), com expandir por
  grupo, continuar pelo mais recente e pill para ligar/desligar (persiste).
- **Ocultar coluna Data**: opção em Aparência que some a coluna na tabela do
  timesheet (aplica na hora, sem recarregar).

## [0.10.1] — 2026-10-05
### Fixed
- Contraste grave nos botões: texto sobre fundos coloridos agora usa
  `--ke-on-green`/`--ke-on-red` e textos coloridos usam `--ke-green-text`/
  `--ke-red-text` (verificados ≥ 4.5 em todos os 6 temas; ex.: branco sobre
  verde era 1.37–2.74). Amarelo de aviso no claro ajustado para `#96690f`.
  Nova trava `tests/check-contrast.js` (no `npm run check`).

## [0.10.0] — 2026-10-05
### Added
- Novos temas: **Dracula**, **Catppuccin** (Mocha), **Nord** e **Gruvbox**
  (paletas oficiais, contraste 10+ verificado) — total de 7 com
  Sistema/Claro/Escuro. Criar um tema = copiar um bloco em `theme.css`.

## [0.9.2] — 2026-10-05
### Fixed
- Warning no Firefox (`persistent` sem suporte no MV3): chave removida da
  variante Firefox (event page já é não-persistente por padrão).

## [0.9.1] — 2026-10-05
### Fixed
- Firefox sem service worker MV3 (`background.service_worker is currently
  disabled`): variante `manifest/firefox.json` com event page
  (`background.scripts`, mesmo `worker.js`) e Gecko mínimo 109; Chrome segue
  com service worker (`manifest/chrome.json`). A seleção é feita pelo utilitário
  de manifest. `check-pages` valida a consistência.

## [0.9.0] — 2026-10-05
### Added
- **Ícone dinâmico**: muda quando há timer rodando + badge com decorrido
  (`5m`, `2h`) e título detalhado, atualizado a cada 1 min e a cada
  iniciar/parar/editar (via `background worker`).
- **Botão-direito no ícone**: ⏸ Pausar timer e ▶ Continuar timer
  (`contexts: ["action"]`, visibilidade conforme estado).
- Permissões `alarms` + `contextMenus` (sem alertas); Firefox mínimo 121
  (service worker MV3).

## [0.8.0] — 2026-10-05
### Added
- **Temas**: cores centralizadas em `src/common/theme.css` (fácil criar
  novos); configuração Sistema/Claro/Escuro com prévia ao vivo (popup e
  opções; a barra segue o tema do Kimai).
- **Atalhos de teclado** configuráveis na página do timesheet: iniciar,
  parar e recomeçar tarefa (padrões `Alt+Shift+S/X/R`); popup abre via
  comando do navegador (`Alt+Shift+K`, ajustável nos atalhos da extensão).
### Changed
- Seção **Acesso ao popup** logo após **Kimai**.
- **Remover acesso** agora é honesto: desabilitado sem acesso/URL, verifica o
  resultado e orienta quando o navegador bloqueia.

## [0.7.1] — 2026-10-05
### Fixed
- Popup quebrado após o cache (tela de erro mesmo com token): faltava o
  `cache.js` no `popup.html`. Nova trava `tests/check-pages.js` (no
  `npm run check`) garante que toda `KE.*` usada tem definição nos scripts
  de cada página.
### Added
- Opções ganham **Atualizar cache** (força clientes+projetos) e **Limpar
  cache** (com contador), mais `KE.cacheClear()`.

## [0.7.0] — 2026-10-05
### Added
- Cache em `storage.local`: catálogos (clientes/projetos/atividades, TTL 24h)
  e diários (TTL 1h) — abertura instantânea do popup e da barra. Botão ⟳ de
  refresh nas listas e nos diários; barra revalida em fundo sem apagar o
  digitado; diários se atualizam sozinhos a cada 1h no popup. Ativos sempre
  ao vivo, nunca cacheados.

## [0.6.5] — 2026-10-05
### Fixed
- Comboboxes do popup ilegíveis: inputs e lista agora têm fundo/texto
  explícitos por esquema (`#222`/`#fff` no claro, `#eee`/`#2c2c2e` no escuro,
  contraste 12+, verificado) + `color-scheme: light dark`; `combo.css`
  carrega antes do `popup.css`; mesmos explícitos nos inputs das opções.

## [0.6.4] — 2026-10-05
### Fixed
- Popup sem conexão agora mostra erro em tela cheia ("Não foi possível
  conectar… abra as configurações e use Testar conexão") com botões Abrir
  configurações e Tentar novamente — nunca mais em branco.
- Botão Autorizar com ação única; erros de start/stop/continuar mostram o
  motivo do servidor; 401/403 explica sessão expirada; "continuar" valida
  ids; lista de hoje com mensagem própria quando vazia.

## [0.6.3] — 2026-10-05
### Changed
- Botão **Salvar configurações** ocupa a linha toda.
- Campo da chave mostra `••••••••••` quando há token salvo.
- Novo botão **Desconectar** (com confirmação): apaga a chave salva e
  volta o método para sessão.

## [0.6.2] — 2026-10-05
### Changed
- Configurações com botão único **Salvar configurações** no fim da página
  (URL + método + chave); "Testar conexão" segue como ação secundária.

## [0.6.1] — 2026-10-05
### Fixed
- Popup nunca em branco: boot com fallback de erro visível; botão Autorizar
  com handler único (antes abria as opções junto); erros de start/stop/
  continuar mostram o motivo do servidor; sessão expirada (401/403) tem
  mensagem própria; "continuar" valida projeto/atividade; lista de hoje com
  mensagem correta quando vazia.

## [0.6.0] — 2026-10-05
### Added
- Autenticação por **chave de API** como alternativa à sessão: nas
  configurações, escolha entre sessão do navegador ou chave (criada em
  *Meu perfil → API Access*), com botão **Testar conexão**. Chave guardada
  em `storage.local` (só neste dispositivo); chamadas usam
  `Authorization: Bearer` + `credentials: omit`.

## [0.5.0] — 2026-10-05
### Added
- Popup funcional: timer(s) rodando com Parar, novo timer (comboboxes +
  descrição), continuar timers de hoje (deduplicados) e botão ⚙ para as
  configurações.
- Tela de configurações (`options_ui`): URL base do Kimai + autorização de
  acesso do popup (`optional_host_permissions`, só o host configurado).
- API agora suporta base absoluta + `credentials: include` (popup/opções);
  content script mantém relativo + sessão.
- `KE.entityId()` normaliza número/objeto/IRI; rótulos centralizados em
  `describeProjectRef`/`describeActivityRef`; `KE.tagNames()` em utils.

## [0.4.0] — 2026-10-05
### Added
- Edição inline do timer ativo: clique no timer rodando (ou no ✎) para
  ajustar projeto, atividade, descrição e tags via `PATCH`, com Salvar/
  Cancelar, validação e mensagens de erro do servidor.

## [0.3.3] — 2026-10-05
### Added
- Botão "⏹ Parar" ao lado de "Iniciar": visível só com timer rodando,
  para todos os ativos de uma vez (singular/plural na confirmação).

## [0.3.2] — 2026-10-05
### Fixed
- Timer ativo exibia "Projeto #[object Object]": o `GET /api/timesheets/active`
  devolve `project`/`activity` como objetos embutidos (não ids). Novo
  `KE.entityId()` normaliza número/objeto/IRI e o rótulo usa o cache ou os
  nomes embutidos.

## [0.3.1] — 2026-10-05
### Fixed
- Tags quebravam o início (400 "This value is not valid."): a API só aceita
  `tags` como string separada por vírgula e ignora nomes inexistentes, então
  as faltantes agora são criadas via `POST /api/tags` antes do start.
- Descrição passa a ser o primeiro campo da linha.

## [0.3.0] — 2026-10-05
### Changed
- Reorganização interna sem mudança de comportamento: content script dividido
  em módulos (`namespace`, `i18n`, `utils`, `api`, `storage`, `combo`, `kimai`,
  `quicktimer`), CSS dividido (`quicktimer.css`, `combo.css`, `popup.css`).
- Teste funcional movido para `tests/harness.js` com `npm test` / `npm run check`.
- Adicionados `CHANGELOG.md`, `LICENSE` (MIT), `package.json`, `docs/ARCHITECTURE.md`.

## [0.2.2] — 2026-10-05
### Fixed
- A seção do timer rápido agora se remonta sozinha quando o Kimai recarrega
  a listagem via AJAX (iniciar/parar timer), via observer persistente.

## [0.2.1] — 2026-10-05
### Fixed
- Dropdown dos comboboxes acima do header fixo da tabela (`z-index: 1050`).
- Erro de início mostra o motivo devolvido pelo servidor, não só o HTTP.
- `POST /api/timesheets` omite descrição/tags vazias.

## [0.2.0] — 2026-10-05
### Added
- Cliente, Projeto e Atividade viram comboboxes pesquisáveis (acentos
  ignorados, `↑`/`↓` + `Enter`, `Esc`, limite de 150 itens).

## [0.1.0] — 2026-10-05
### Added
- Barra "Iniciar timer rápido" acima dos registros do timesheet.
- Timers ativos com duração ao vivo e botão Parar; última seleção lembrada
  via `storage.sync`; recarregamento da tabela via eventos Kimai.
