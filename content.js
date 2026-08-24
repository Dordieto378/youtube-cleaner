const HOME_PATH = "/";
const SUBSCRIPTIONS_PATH = "/feed/subscriptions";
const SUBSCRIPTIONS_URL = `${location.origin}${SUBSCRIPTIONS_PATH}`;
const SHORTS_PATH_PREFIX = "/shorts/";
const SIDEBAR_ENTRY_SELECTOR =
  "ytd-guide-entry-renderer, ytd-mini-guide-entry-renderer";

const SHORTS_ITEM_CONTAINERS = [
  "ytd-rich-item-renderer",
  "ytd-video-renderer",
  "ytd-grid-video-renderer",
  "ytd-compact-video-renderer",
  "ytd-playlist-panel-video-renderer",
  "ytd-reel-item-renderer",
  "ytd-notification-renderer",
  "ytd-compact-radio-renderer",
  "ytd-menu-service-item-renderer",
  "tp-yt-paper-item",
  "yt-lockup-view-model",
  "ytm-shorts-lockup-view-model",
].join(", ");

const SHORTS_SECTION_CONTAINERS = [
  "ytd-reel-shelf-renderer",
  "ytd-rich-shelf-renderer",
  "ytd-rich-section-renderer",
  "ytd-shelf-renderer",
  "ytd-horizontal-card-list-renderer",
  "ytd-horizontal-video-list-renderer",
  "yt-horizontal-list-renderer",
  "yt-horizontal-tile-list-renderer",
  "yt-lockup-view-model",
  "ytd-item-section-renderer",
].join(", ");

const SHORTS_SHELF_CONTAINERS = [
  "ytd-reel-shelf-renderer",
  "ytd-rich-shelf-renderer",
  "ytd-rich-section-renderer",
  "ytd-shelf-renderer",
  "ytd-horizontal-card-list-renderer",
  "ytd-horizontal-video-list-renderer",
  "yt-horizontal-list-renderer",
  "yt-horizontal-tile-list-renderer",
  "yt-lockup-view-model",
  "ytm-shorts-lockup-view-model",
].join(", ");

const OUTER_SHORTS_SHELF_CONTAINERS = [
  "ytd-reel-shelf-renderer",
  "ytd-rich-shelf-renderer",
  "ytd-rich-section-renderer",
  "ytd-shelf-renderer",
  "ytd-horizontal-card-list-renderer",
  "ytd-horizontal-video-list-renderer",
  "yt-horizontal-list-renderer",
  "yt-horizontal-tile-list-renderer",
].join(", ");

const SEARCH_RESULT_CONTAINERS = [
  "ytd-video-renderer",
  "ytd-channel-renderer",
  "ytd-playlist-renderer",
  "ytd-radio-renderer",
  "ytd-promoted-video-renderer",
].join(", ");

const SEARCH_REFINEMENT_CONTAINERS = [
  "ytd-search-refinement-card-renderer",
  "yt-search-refinement-card-view-model",
  "yt-chip-cloud-chip-renderer",
  "yt-chip-cloud-chip-view-model",
  "yt-chip-cloud-chip",
  "yt-search-query-correction-view-model",
  "ytd-search-query-correction-renderer",
].join(", ");

const GENERIC_SEARCH_REFINEMENT_CONTAINERS = [
  "yt-lockup-view-model",
  "yt-list-item-view-model",
].join(", ");

const SEARCH_REFINEMENT_SECTION_CONTAINERS = [
  "ytd-item-section-renderer",
  "ytd-search-refinement-card-renderer",
  "yt-search-refinement-card-view-model",
  "yt-chip-cloud-chip-renderer",
  "yt-chip-cloud-chip-view-model",
  "yt-chip-cloud-chip",
  "grid-shelf-view-model",
].join(", ");

const SEARCH_REFINEMENT_ROW_CANDIDATES = [
  "yt-lockup-view-model",
  "yt-list-item-view-model",
  "ytd-search-refinement-card-renderer",
  "yt-search-refinement-card-view-model",
  "yt-chip-cloud-chip-renderer",
  "yt-chip-cloud-chip-view-model",
  "yt-chip-cloud-chip",
  "grid-shelf-view-model",
  "a[href]",
  "button",
  "[role='button']",
  "[role='link']",
  "[role='listitem']",
  "[class*='lockup' i]",
  "[class*='chip' i]",
].join(", ");

const WATCH_PLAYLIST_PANEL_SELECTOR = [
  "ytd-playlist-panel-renderer",
  "yt-playlist-panel-renderer",
  "ytd-engagement-panel-section-list-renderer[target-id='engagement-panel-playlist']",
].join(", ");

const SUBSCRIPTIONS_STYLE_ID = "youtube-cleaner-subscriptions-style";
const SHORTS_STYLE_ID = "youtube-cleaner-shorts-style";
const WATCH_STYLE_ID = "youtube-cleaner-watch-style";
const THEATER_STYLE_ID = "youtube-cleaner-theater-style";
const SIDEBAR_SEPARATOR_STYLE_ID = "youtube-cleaner-sidebar-separator-style";
const FULLSCREEN_STYLE_ID = "youtube-cleaner-fullscreen-style";
const REDIRECT_GUARD_KEY = "youtube-cleaner-last-redirect";
const REDIRECT_GUARD_WINDOW_MS = 5000;
const CLEANER_DEBOUNCE_MS = 50;

let lastUrl = location.href;
let bodyObserverStarted = false;
let historyPatched = false;
let redirectInFlight = false;
let cleanerTimeoutId = 0;

function normalizeText(value) {
  return (value || "").replace(/\s+/g, " ").trim().toLowerCase();
}

function getUrlFromValue(value) {
  if (!value) {
    return null;
  }

  try {
    return new URL(value, location.origin);
  } catch (error) {
    return null;
  }
}

function getPathFromUrl(value) {
  return getUrlFromValue(value)?.pathname || "";
}

function isHomePath(pathname) {
  return pathname === HOME_PATH || pathname === "";
}

function isSubscriptionsPath(pathname) {
  return pathname === SUBSCRIPTIONS_PATH;
}

function isShortsPath(pathname) {
  return pathname === "/shorts" || pathname.startsWith(SHORTS_PATH_PREFIX);
}

function isSearchRoute(pathname = location.pathname, search = location.search) {
  return pathname === "/results" || new URLSearchParams(search).has("search_query");
}

function getRedirectRouteKey(pathname) {
  if (isHomePath(pathname)) {
    return "home";
  }

  if (isShortsPath(pathname)) {
    return "shorts";
  }

  return "";
}

function isPlainLeftClick(event) {
  return (
    event.button === 0 &&
    !event.defaultPrevented &&
    !event.metaKey &&
    !event.ctrlKey &&
    !event.shiftKey &&
    !event.altKey
  );
}

function shouldThrottleRedirect(pathname) {
  const routeKey = getRedirectRouteKey(pathname);
  if (!routeKey) {
    return false;
  }

  const now = Date.now();
  const currentKey = `${routeKey}:${pathname}`;

  if (redirectInFlight) {
    return true;
  }

  try {
    const rawValue = sessionStorage.getItem(REDIRECT_GUARD_KEY);
    if (!rawValue) {
      return false;
    }

    const parsed = JSON.parse(rawValue);
    if (
      parsed &&
      parsed.key === currentKey &&
      typeof parsed.time === "number" &&
      now - parsed.time < REDIRECT_GUARD_WINDOW_MS
    ) {
      return true;
    }
  } catch (error) {
    return false;
  }

  return false;
}

function markRedirect(pathname) {
  const routeKey = getRedirectRouteKey(pathname);
  if (!routeKey) {
    return;
  }

  redirectInFlight = true;

  try {
    sessionStorage.setItem(
      REDIRECT_GUARD_KEY,
      JSON.stringify({
        key: `${routeKey}:${pathname}`,
        time: Date.now(),
      })
    );
  } catch (error) {
    // Ignore storage failures and still perform the redirect.
  }
}

function hideElement(element) {
  if (!element) {
    return;
  }

  element.dataset.youtubeCleanerHidden = "true";
  element.hidden = true;
  element.style.setProperty("display", "none", "important");
}

function showElement(element) {
  if (!element) {
    return;
  }

  delete element.dataset.youtubeCleanerHidden;
  element.hidden = false;
  element.style.removeProperty("display");
}

function collapseSeparatorStyles(element) {
  if (!element) {
    return;
  }

  element.dataset.youtubeCleanerNoSeparator = "true";
  element.style.setProperty("border-top", "none", "important");
  element.style.setProperty("border-bottom", "none", "important");
  element.style.setProperty("box-shadow", "none", "important");
  element.style.setProperty("margin-top", "0", "important");
  element.style.setProperty("padding-top", "0", "important");
}

function ensureSidebarSeparatorStyle() {
  if (document.getElementById(SIDEBAR_SEPARATOR_STYLE_ID)) {
    return;
  }

  const style = document.createElement("style");
  style.id = SIDEBAR_SEPARATOR_STYLE_ID;
  style.textContent = `
    [data-youtube-cleaner-no-separator="true"] {
      border-top: none !important;
      border-bottom: none !important;
      box-shadow: none !important;
      margin-top: 0 !important;
      padding-top: 0 !important;
    }

    [data-youtube-cleaner-no-separator="true"]::before,
    [data-youtube-cleaner-no-separator="true"]::after {
      display: none !important;
      border: 0 !important;
      box-shadow: none !important;
    }

    [data-youtube-cleaner-no-separator="true"] hr,
    [data-youtube-cleaner-no-separator="true"] tp-yt-paper-divider,
    [data-youtube-cleaner-no-separator="true"] #separator,
    [data-youtube-cleaner-no-separator="true"] #divider {
      display: none !important;
    }
  `;

  document.head.appendChild(style);
}

function getElementLabel(element) {
  if (!element) {
    return "";
  }

  const label = [
    element.getAttribute("title"),
    element.getAttribute("aria-label"),
    element.querySelector("#label")?.textContent,
    element.querySelector("#title")?.textContent,
    element.querySelector("#guide-section-title")?.textContent,
    element.textContent,
  ]
    .filter(Boolean)
    .join(" ");

  return normalizeText(label);
}

function redirectIfNeeded() {
  if (isSearchRoute()) {
    redirectInFlight = false;
    return false;
  }

  if (isSubscriptionsPath(location.pathname)) {
    redirectInFlight = false;
    return false;
  }

  if (isHomePath(location.pathname) || isShortsPath(location.pathname)) {
    if (shouldThrottleRedirect(location.pathname)) {
      return true;
    }

    markRedirect(location.pathname);
    location.replace(SUBSCRIPTIONS_URL);
    return true;
  }

  redirectInFlight = false;
  return false;
}

// Hide Shorts, Subscriptions, Explore, and "More from YouTube" in the sidebar.
function cleanSidebar() {
  document.querySelectorAll(SIDEBAR_ENTRY_SELECTOR).forEach((entry) => {
    const link = entry.querySelector("a[href]");
    const path = getPathFromUrl(link?.getAttribute("href") || link?.href);
    const label = getElementLabel(entry);

    if (isShortsPath(path) || label === "shorts") {
      hideElement(entry);
      return;
    }

    if (isSubscriptionsPath(path) || label === "subscriptions") {
      hideElement(entry);
      return;
    }

    if (path === "/feed/you" || label === "you") {
      hideElement(entry);
      return;
    }

    if (path === "/feed/explore" || label === "explore") {
      hideElement(entry);
      return;
    }

    if (path === "/reporthistory" || label === "report history") {
      hideElement(entry);
    }
  });

  document.querySelectorAll("ytd-guide-section-renderer").forEach((section) => {
    const title = normalizeText(
      section.querySelector("#guide-section-title")?.textContent
    );

    if (title.includes("explore")) {
      hideElement(section);
      return;
    }

    if (title.includes("more from youtube")) {
      hideElement(section);
    }
  });

  cleanSidebarFooterSeparator();
}

function cleanSidebarFooterSeparator() {
  const dividerSelectors = "hr, tp-yt-paper-divider, #separator, #divider";
  const footerTextHints = ["about", "press", "copyright", "contact us", "developers"];

  ensureSidebarSeparatorStyle();

  document
    .querySelectorAll(
      "ytd-guide-renderer ytd-guide-section-renderer, ytd-mini-guide-renderer ytd-guide-section-renderer, ytd-guide-renderer #footer, ytd-mini-guide-renderer #footer"
    )
    .forEach((section) => {
      const sectionText = normalizeText(section.textContent);
      const looksLikeFooterSection = footerTextHints.some((hint) =>
        sectionText.includes(hint)
      );

      if (!looksLikeFooterSection) {
        return;
      }

      hideElement(section);
      collapseSeparatorStyles(section.parentElement);
      collapseSeparatorStyles(
        section.closest("#sections, #guide-inner-content, #guide-content")
      );

      section.querySelectorAll(dividerSelectors).forEach(hideElement);

      let previous = section.previousElementSibling;
      while (previous) {
        if (previous.matches(dividerSelectors)) {
          hideElement(previous);
          break;
        }

        if (
          previous.matches("ytd-guide-section-renderer, ytd-guide-entry-renderer, tp-yt-paper-item")
        ) {
          collapseSeparatorStyles(previous);
          collapseSeparatorStyles(previous.parentElement);
          collapseSeparatorStyles(
            previous.closest("#sections, #guide-inner-content, #guide-content")
          );
          break;
        }

        previous = previous.previousElementSibling;
      }
    });
}

function hideShortsContainerFromLink(link) {
  const shelfContainer = link.closest(OUTER_SHORTS_SHELF_CONTAINERS);
  if (shelfContainer && !hasRegularVideoLink(shelfContainer)) {
    hideElement(shelfContainer);
    return;
  }

  const itemContainer = link.closest(SHORTS_ITEM_CONTAINERS);
  if (itemContainer) {
    hideElement(itemContainer);
    return;
  }

  const sectionContainer = link.closest(SHORTS_SECTION_CONTAINERS);
  if (sectionContainer && !hasRegularVideoLink(sectionContainer)) {
    hideElement(sectionContainer);
    return;
  }

  hideElement(link);
}

function isShortsTitle(text) {
  return text === "shorts" || text.startsWith("shorts ");
}

function hasShortsPathLink(element) {
  return Array.from(element.querySelectorAll('a[href*="shorts"]')).some((link) =>
    isShortsPath(getPathFromUrl(link.getAttribute("href") || link.href))
  );
}

function getElementAndDescendantLinks(element) {
  const links = Array.from(element.querySelectorAll("a[href]"));

  if (element.matches("a[href]")) {
    links.unshift(element);
  }

  return links;
}

function hasPathLink(element, predicate) {
  return getElementAndDescendantLinks(element).some((link) => {
    const href = link.getAttribute("href") || link.href;
    return predicate(getPathFromUrl(href), href);
  });
}

function hasSearchQueryLink(element) {
  return hasPathLink(element, (path, href) => {
    const url = getUrlFromValue(href);
    return path === "/results" && Boolean(url?.searchParams.has("search_query"));
  });
}

function isCleanerHidden(element) {
  return Boolean(element.closest('[data-youtube-cleaner-hidden="true"], [hidden]'));
}

function hasRealSearchResultLink(element) {
  return hasPathLink(element, (path) => {
    return (
      path === "/watch" ||
      path === "/playlist" ||
      path === "/channel" ||
      path.startsWith("/@")
    );
  });
}

function hasRegularVideoLink(element) {
  return hasPathLink(element, (path) => path === "/watch");
}

function hasShortsHeaderSignal(element) {
  return (
    normalizeText(element.textContent).includes("\u2728") ||
    Boolean(
      element.querySelector(
        '[icon*="shorts" i], [aria-label*="shorts" i], [title*="shorts" i], [src*="shorts" i], [href*="shorts" i], [d*="M10 14.65" i]'
      )
    )
  );
}

function hasVisibleSearchResult(section) {
  if (Array.from(section.querySelectorAll(SEARCH_RESULT_CONTAINERS)).some(
    (result) => !isCleanerHidden(result)
  )) {
    return true;
  }

  return Array.from(
    section.querySelectorAll("yt-lockup-view-model, yt-list-item-view-model")
  ).some((result) => {
    return !isCleanerHidden(result) && hasPathLink(result, (path) => path === "/watch");
  });
}

function findSmallestNonVideoContainer(element) {
  let current = element;
  let fallback = element;

  while (current && current !== document.body) {
    if (
      current instanceof Element &&
      current.matches(
        "ytd-video-renderer, ytd-compact-video-renderer, ytd-rich-item-renderer, ytd-item-section-renderer"
      )
    ) {
      return fallback;
    }

    if (
      current instanceof Element &&
      current.matches(SEARCH_REFINEMENT_ROW_CANDIDATES) &&
      !hasRealSearchResultLink(current)
    ) {
      fallback = current;
    }

    if (
      current instanceof Element &&
      normalizeText(current.textContent).length <= 180 &&
      hasShortsHeaderSignal(current) &&
      !hasRealSearchResultLink(current)
    ) {
      fallback = current;
    }

    current = current.parentElement;
  }

  return fallback;
}

function getSearchRefinementTarget(element) {
  const explicitTarget = element.closest(SEARCH_REFINEMENT_CONTAINERS);
  if (explicitTarget) {
    return explicitTarget;
  }

  const genericTarget = element.closest(GENERIC_SEARCH_REFINEMENT_CONTAINERS);
  if (genericTarget && !hasRealSearchResultLink(genericTarget)) {
    return genericTarget;
  }

  return element.closest("a[href]") || element;
}

function isShortsOnlyItemSection(section) {
  const title = normalizeText(
    section.querySelector("#title, #heading")?.textContent
  );

  if (isShortsTitle(title)) {
    return true;
  }

  const hasShortsShelf = Boolean(
    section.querySelector(SHORTS_SHELF_CONTAINERS)
  );

  return (hasShortsShelf || hasShortsPathLink(section)) && !hasVisibleSearchResult(section);
}

function cleanShortsOnlyItemSections() {
  if (location.pathname !== "/results") {
    return;
  }

  document.querySelectorAll("ytd-item-section-renderer").forEach((section) => {
    if (isShortsOnlyItemSection(section)) {
      hideElement(section);
    }
  });
}

function restoreChannelRegularVideoSections() {
  if (location.pathname === "/results") {
    return;
  }

  document
    .querySelectorAll(
      [
        "grid-shelf-view-model",
        "ytd-item-section-renderer",
        "ytd-rich-shelf-renderer",
        "ytd-shelf-renderer",
        "yt-lockup-view-model",
        "yt-list-item-view-model",
      ].join(", ")
    )
    .forEach((element) => {
      if (
        element.dataset.youtubeCleanerHidden === "true" &&
        hasRegularVideoLink(element) &&
        !isShortsTitle(
          normalizeText(element.querySelector("#title, #heading")?.textContent)
        )
      ) {
        showElement(element);
      }
    });
}

function cleanSearchRefinementRows() {
  if (location.pathname !== "/results") {
    return;
  }

  const forcedRefinementSelectors =
    "ytd-search-refinement-card-renderer, yt-search-refinement-card-view-model";

  document
    .querySelectorAll(forcedRefinementSelectors)
    .forEach((element) => {
      hideElement(element);
    });

  document
    .querySelectorAll(`${SEARCH_REFINEMENT_CONTAINERS}, a[href*="search_query="]`)
    .forEach((element) => {
      if (element.matches(forcedRefinementSelectors)) {
        return;
      }

      const target = getSearchRefinementTarget(element);
      const hasRealResultLink = hasRealSearchResultLink(target);
      const hasShortsSignal = hasShortsHeaderSignal(target);

      if (!hasRealResultLink && (hasSearchQueryLink(target) || hasShortsSignal)) {
        hideElement(target);
      }
    });

  document
    .querySelectorAll(SEARCH_REFINEMENT_SECTION_CONTAINERS)
    .forEach((element) => {
      const hasRealResultLink = hasRealSearchResultLink(element);
      const hasShortsSignal = hasShortsHeaderSignal(element);

      if (!hasRealResultLink && hasShortsSignal) {
        hideElement(element);
      }
    });

  document
    .querySelectorAll("yt-formatted-string, span, a[href], button, [role='button']")
    .forEach((element) => {
      if (!hasShortsHeaderSignal(element)) {
        return;
      }

      const target = findSmallestNonVideoContainer(element);

      if (!hasRealSearchResultLink(target)) {
        hideElement(target);
      }

      hideElement(element);
    });

  document.querySelectorAll("ytd-item-section-renderer").forEach((section) => {
    if (
      section.querySelector('[data-youtube-cleaner-hidden="true"]') &&
      !hasVisibleSearchResult(section)
    ) {
      hideElement(section);
    }
  });
}

function ensureShortsStyle() {
  if (!document.head || document.getElementById(SHORTS_STYLE_ID)) {
    return;
  }

  const style = document.createElement("style");
  style.id = SHORTS_STYLE_ID;
  style.textContent = `
    ytd-reel-shelf-renderer,
    ytm-shorts-lockup-view-model,
    ytd-search ytd-rich-shelf-renderer:has(a[href*="/shorts/"]),
    ytd-search ytd-rich-section-renderer:has(a[href*="/shorts/"]),
    ytd-search ytd-shelf-renderer:has(a[href*="/shorts/"]),
    ytd-search ytd-horizontal-card-list-renderer:has(a[href*="/shorts/"]),
    ytd-search ytd-horizontal-video-list-renderer:has(a[href*="/shorts/"]),
    ytd-search yt-horizontal-list-renderer:has(a[href*="/shorts/"]),
    ytd-search yt-horizontal-tile-list-renderer:has(a[href*="/shorts/"]),
    ytd-search grid-shelf-view-model:has(a[href*="/shorts/"]),
    ytd-search grid-shelf-view-model:has(yt-section-header-view-model[data-youtube-cleaner-hidden="true"]),
    ytd-search yt-lockup-view-model:has(a[href*="/shorts/"]),
    ytd-search ytd-search-refinement-card-renderer,
    ytd-search yt-search-refinement-card-view-model {
      display: none !important;
    }
  `;

  document.head.appendChild(style);
}

// Hide the Shorts tab and related shelf links on creator/channel pages.
function cleanChannelPageShorts() {
  document.querySelectorAll("tp-yt-paper-tab, yt-tab-shape, a[href]").forEach((element) => {
    const link = element.matches("a[href]")
      ? element
      : element.querySelector("a[href]");

    const path = getPathFromUrl(link?.getAttribute("href") || link?.href);
    const text = normalizeText(element.textContent);

    if (isShortsPath(path) || text === "shorts") {
      hideElement(element);
    }
  });

  document
    .querySelectorAll("ytd-rich-shelf-renderer, ytd-shelf-renderer")
    .forEach((section) => {
      const title = normalizeText(
        section.querySelector("#title, #heading")?.textContent
      );

      if (isShortsTitle(title) && !hasRegularVideoLink(section)) {
        hideElement(section);
      }
    });
}

// Hide Shorts shelves and sections that YouTube injects into feeds, search, and channel pages.
function cleanShortsShelves() {
  document
    .querySelectorAll("ytd-reel-shelf-renderer, ytm-shorts-lockup-view-model")
    .forEach(hideElement);

  document
    .querySelectorAll(SHORTS_SHELF_CONTAINERS)
    .forEach((section) => {
      const title = normalizeText(
        section.querySelector("#title, #heading")?.textContent
      );
      if (
        isShortsTitle(title) ||
        (hasShortsPathLink(section) && !hasRegularVideoLink(section))
      ) {
        hideElement(section);
      }
    });

  cleanShortsOnlyItemSections();
}

// Hide direct Shorts cards and links anywhere on the page.
function cleanShortsLinks() {
  document.querySelectorAll('a[href*="shorts"]').forEach((link) => {
    const path = getPathFromUrl(link.getAttribute("href") || link.href);

    if (isShortsPath(path)) {
      hideShortsContainerFromLink(link);
    }
  });

  cleanShortsOnlyItemSections();
}

// Keep the watch page itself, but remove the related/recommended videos column.
function isPlaylistWatchPage() {
  if (location.pathname !== "/watch") {
    return false;
  }

  const playlistId = new URLSearchParams(location.search).get("list")?.trim();

  if (!playlistId) {
    return false;
  }

  return !["nan", "null", "undefined"].includes(playlistId.toLowerCase());
}

function syncWatchPlaylistState() {
  if (!isPlaylistWatchPage()) {
    delete document.documentElement.dataset.youtubeCleanerPlaylistWatch;
    return false;
  }

  document.documentElement.dataset.youtubeCleanerPlaylistWatch = "true";
  return true;
}

function restoreWatchPlaylistPanel() {
  document.querySelectorAll(WATCH_PLAYLIST_PANEL_SELECTOR).forEach((panel) => {
    let current = panel;

    while (current && current !== document.body) {
      if (
        current.matches(
          [
            WATCH_PLAYLIST_PANEL_SELECTOR,
            "ytd-watch-flexy #secondary",
            "ytd-watch-flexy #secondary-inner",
            "ytd-watch-flexy #panels",
            "ytd-watch-flexy #playlist",
            "ytd-watch-flexy ytd-watch-next-secondary-results-renderer",
          ].join(", ")
        )
      ) {
        showElement(current);
      }

      current = current.parentElement;
    }
  });
}

function cleanWatchPage() {
  if (location.pathname !== "/watch") {
    delete document.documentElement.dataset.youtubeCleanerFullscreen;
    delete document.documentElement.dataset.youtubeCleanerPlaylistWatch;
    return;
  }

  ensureWatchLayoutStyle();
  ensureFullscreenStyle();
  enforceTheaterMode();
  syncFullscreenState();

  const hasPlaylistPanel = syncWatchPlaylistState();
  if (hasPlaylistPanel) {
    restoreWatchPlaylistPanel();
  }

  document
    .querySelectorAll(
      "#related, ytd-watch-next-secondary-results-renderer"
    )
    .forEach((element) => {
      if (hasPlaylistPanel && element.querySelector(WATCH_PLAYLIST_PANEL_SELECTOR)) {
        return;
      }

      hideElement(element);
    });
}

function ensureTheaterModeStyle() {
  if (document.getElementById(THEATER_STYLE_ID)) {
    return;
  }

  const style = document.createElement("style");
  style.id = THEATER_STYLE_ID;
  style.textContent = `
    .ytp-size-button {
      display: none !important;
    }
  `;

  document.head.appendChild(style);
}

function setTheaterPreferenceCookie() {
  document.cookie = "wide=1; path=/; SameSite=Lax";
  document.cookie = "wide=1; path=/; domain=.youtube.com; SameSite=Lax";
}

function isTheaterModeActive() {
  const watchFlexy = document.querySelector("ytd-watch-flexy");
  if (watchFlexy) {
    if (
      watchFlexy.hasAttribute("theater") ||
      watchFlexy.hasAttribute("theater-requested_")
    ) {
      return true;
    }
  }

  const sizeButton = document.querySelector(".ytp-size-button");
  const buttonText = normalizeText(
    sizeButton?.getAttribute("title") || sizeButton?.getAttribute("aria-label")
  );

  if (buttonText === "default view") {
    return true;
  }

  if (buttonText === "theater mode") {
    return false;
  }

  return false;
}

// Force watch pages into theater mode and remove the size toggle.
function enforceTheaterMode() {
  ensureTheaterModeStyle();
  setTheaterPreferenceCookie();

  if (isTheaterModeActive()) {
    return;
  }

  const sizeButton = document.querySelector(".ytp-size-button");
  if (sizeButton instanceof HTMLButtonElement) {
    sizeButton.click();
  }
}

function ensureWatchLayoutStyle() {
  if (document.getElementById(WATCH_STYLE_ID)) {
    return;
  }

  const style = document.createElement("style");
  style.id = WATCH_STYLE_ID;
  style.textContent = `
    html:not([data-youtube-cleaner-playlist-watch="true"]) ytd-watch-flexy #secondary,
    html:not([data-youtube-cleaner-playlist-watch="true"]) ytd-watch-flexy #secondary-inner,
    ytd-watch-flexy #related,
    html:not([data-youtube-cleaner-playlist-watch="true"]) ytd-watch-flexy ytd-watch-next-secondary-results-renderer,
    html[data-youtube-cleaner-playlist-watch="true"] ytd-watch-flexy ytd-watch-next-secondary-results-renderer:not(:has(${WATCH_PLAYLIST_PANEL_SELECTOR})) {
      display: none !important;
      width: 0 !important;
      min-width: 0 !important;
      margin: 0 !important;
      padding: 0 !important;
    }

    html:not([data-youtube-cleaner-playlist-watch="true"]) ytd-watch-flexy[is-two-columns_] #columns {
      display: block !important;
      max-width: 1280px !important;
      margin: 0 auto !important;
    }

    html:not([data-youtube-cleaner-playlist-watch="true"]) ytd-watch-flexy[is-two-columns_] #primary,
    html:not([data-youtube-cleaner-playlist-watch="true"]) ytd-watch-flexy[is-two-columns_] #primary-inner {
      max-width: 1280px !important;
      width: 100% !important;
      margin: 0 auto !important;
      padding-right: 0 !important;
      box-sizing: border-box !important;
    }

    html:not([data-youtube-cleaner-playlist-watch="true"]) ytd-watch-flexy[flexy][is-two-columns_] #player,
    html:not([data-youtube-cleaner-playlist-watch="true"]) ytd-watch-flexy[flexy][is-two-columns_] #full-bleed-container {
      max-width: 100% !important;
      width: 100% !important;
    }

    /* Let YouTube's native fullscreen layout take over completely. */
    #movie_player:fullscreen,
    #movie_player:-moz-full-screen,
    .html5-video-player:fullscreen,
    .html5-video-player:-moz-full-screen,
    video:fullscreen,
    video:-moz-full-screen {
      width: 100vw !important;
      height: 100vh !important;
      max-width: none !important;
      max-height: none !important;
      inset: 0 !important;
      margin: 0 !important;
      transform: none !important;
    }

    ytd-watch-flexy:has(#movie_player:fullscreen) #primary,
    ytd-watch-flexy:has(#movie_player:-moz-full-screen) #primary,
    ytd-watch-flexy:has(.html5-video-player:fullscreen) #primary,
    ytd-watch-flexy:has(.html5-video-player:-moz-full-screen) #primary,
    ytd-watch-flexy:has(video:fullscreen) #primary,
    ytd-watch-flexy:has(video:-moz-full-screen) #primary,
    ytd-watch-flexy:has(#movie_player:fullscreen) #primary-inner,
    ytd-watch-flexy:has(#movie_player:-moz-full-screen) #primary-inner,
    ytd-watch-flexy:has(.html5-video-player:fullscreen) #primary-inner,
    ytd-watch-flexy:has(.html5-video-player:-moz-full-screen) #primary-inner,
    ytd-watch-flexy:has(video:fullscreen) #primary-inner,
    ytd-watch-flexy:has(video:-moz-full-screen) #primary-inner,
    ytd-watch-flexy:has(#movie_player:fullscreen) #player,
    ytd-watch-flexy:has(#movie_player:-moz-full-screen) #player,
    ytd-watch-flexy:has(.html5-video-player:fullscreen) #player,
    ytd-watch-flexy:has(.html5-video-player:-moz-full-screen) #player,
    ytd-watch-flexy:has(video:fullscreen) #player,
    ytd-watch-flexy:has(video:-moz-full-screen) #player {
      max-width: none !important;
      width: auto !important;
      margin: 0 !important;
      padding: 0 !important;
    }
  `;

  document.head.appendChild(style);
}

function ensureFullscreenStyle() {
  if (document.getElementById(FULLSCREEN_STYLE_ID)) {
    return;
  }

  const style = document.createElement("style");
  style.id = FULLSCREEN_STYLE_ID;
  style.textContent = `
    html[data-youtube-cleaner-fullscreen="true"],
    html[data-youtube-cleaner-fullscreen="true"] body {
      overflow: hidden !important;
    }

    html[data-youtube-cleaner-fullscreen="true"] ytd-watch-flexy #below,
    html[data-youtube-cleaner-fullscreen="true"] ytd-watch-flexy #below-the-fold,
    html[data-youtube-cleaner-fullscreen="true"] ytd-watch-flexy #comments,
    html[data-youtube-cleaner-fullscreen="true"] ytd-watch-flexy #meta,
    html[data-youtube-cleaner-fullscreen="true"] ytd-watch-flexy #secondary,
    html[data-youtube-cleaner-fullscreen="true"] ytd-watch-flexy #secondary-inner {
      display: none !important;
    }

    html[data-youtube-cleaner-fullscreen="true"] ytd-watch-flexy #columns,
    html[data-youtube-cleaner-fullscreen="true"] ytd-watch-flexy #primary,
    html[data-youtube-cleaner-fullscreen="true"] ytd-watch-flexy #primary-inner,
    html[data-youtube-cleaner-fullscreen="true"] ytd-watch-flexy #player,
    html[data-youtube-cleaner-fullscreen="true"] ytd-watch-flexy #full-bleed-container {
      max-width: none !important;
      width: 100% !important;
      margin: 0 !important;
      padding: 0 !important;
    }
  `;

  document.head.appendChild(style);
}

function isFullscreenActive() {
  return Boolean(document.fullscreenElement);
}

function syncFullscreenState() {
  if (!isFullscreenActive()) {
    delete document.documentElement.dataset.youtubeCleanerFullscreen;
    return;
  }

  document.documentElement.dataset.youtubeCleanerFullscreen = "true";
  window.scrollTo(0, 0);
}

function getControlText(element) {
  return normalizeText(
    element?.getAttribute("title") ||
      element?.getAttribute("aria-label") ||
      element?.textContent
  );
}

function hideClosestIfFound(element, selector) {
  const target = element?.closest(selector);
  if (target) {
    hideElement(target);
    return true;
  }

  return false;
}

function hideNearbySeparators(element) {
  if (!element?.parentElement) {
    return;
  }

  const separatorSelector = "hr, tp-yt-paper-divider, #separator, #divider";

  element.querySelectorAll?.(separatorSelector).forEach(hideElement);
  element.previousElementSibling?.matches(separatorSelector) &&
    hideElement(element.previousElementSibling);
  element.nextElementSibling?.matches(separatorSelector) &&
    hideElement(element.nextElementSibling);
}

function hideSubscriptionsHeaderText(element) {
  if (!element) {
    return;
  }

  let target = element;

  for (let index = 0; index < 3; index += 1) {
    const parent = target.parentElement;
    if (!parent) {
      break;
    }

    const parentText = normalizeText(parent.textContent);
    const hasFeedItems =
      parent.querySelector(
        "ytd-rich-item-renderer, ytd-video-renderer, ytd-grid-video-renderer, ytd-rich-grid-row"
      ) !== null;
    const hasInteractiveChildren =
      parent.querySelector(
        "a[href], button, ytd-button-renderer, ytd-toggle-button-renderer"
      ) !== null;

    if (!hasFeedItems && !hasInteractiveChildren && parentText === getControlText(element)) {
      target = parent;
      continue;
    }

    break;
  }

  hideElement(target);
}

function ensureSubscriptionsLayoutStyle() {
  if (!isSubscriptionsPath(location.pathname) || document.getElementById(SUBSCRIPTIONS_STYLE_ID)) {
    return;
  }

  const style = document.createElement("style");
  style.id = SUBSCRIPTIONS_STYLE_ID;
  style.textContent = `
    ytd-browse[page-subtype="subscriptions"] #header,
    ytd-browse[page-subtype="subscriptions"] #header-container,
    ytd-browse[page-subtype="subscriptions"] #chips-wrapper,
    ytd-browse[page-subtype="subscriptions"] ytd-feed-filter-chip-bar-renderer,
    ytd-browse[page-subtype="subscriptions"] ytd-subscriptions-header-renderer,
    ytd-browse[page-subtype="subscriptions"] ytd-subscriptions-page-header-renderer {
      display: none !important;
      margin: 0 !important;
      padding: 0 !important;
      min-height: 0 !important;
      height: 0 !important;
    }

    ytd-browse[page-subtype="subscriptions"] ytd-two-column-browse-results-renderer,
    ytd-browse[page-subtype="subscriptions"] #primary,
    ytd-browse[page-subtype="subscriptions"] ytd-rich-grid-renderer,
    ytd-browse[page-subtype="subscriptions"] #contents {
      margin-top: 0 !important;
      padding-top: 0 !important;
    }
  `;

  document.head.appendChild(style);
}

function cleanSubscriptionsTextNodes() {
  const root =
    document.querySelector("ytd-browse[page-subtype='subscriptions']") ||
    document.body;

  if (!root) {
    return;
  }

  const walker = document.createTreeWalker(
    root,
    NodeFilter.SHOW_TEXT,
    {
      acceptNode(node) {
        const text = normalizeText(node.textContent);

        if (
          text === "latest" ||
          text === "most relevant" ||
          text === "all subscriptions"
        ) {
          return NodeFilter.FILTER_ACCEPT;
        }

        return NodeFilter.FILTER_SKIP;
      },
    }
  );

  let currentNode = walker.nextNode();
  while (currentNode) {
    if (currentNode.parentElement) {
      hideSubscriptionsHeaderText(currentNode.parentElement);
    }

    currentNode = walker.nextNode();
  }
}

function cleanSubscriptionsExpandableSuggestions() {
  if (!isSubscriptionsPath(location.pathname)) {
    return;
  }

  const root =
    document.querySelector(
      "ytd-browse[page-subtype='subscriptions'] ytd-two-column-browse-results-renderer #primary"
    ) ||
    document.querySelector("ytd-browse[page-subtype='subscriptions'] #primary") ||
    document.querySelector("ytd-browse[page-subtype='subscriptions']");

  if (!root) {
    return;
  }

  const sectionSelector =
    "ytd-item-section-renderer, ytd-rich-section-renderer, ytd-rich-grid-row, ytd-continuation-item-renderer";

  root
    .querySelectorAll(
      [
        "button",
        "yt-button-shape",
        "ytd-button-renderer",
        "tp-yt-paper-button",
        "yt-formatted-string",
        "span",
      ].join(", ")
    )
    .forEach((element) => {
      const text = getControlText(element);

      if (text !== "show more" && text !== "show less") {
        return;
      }

      if (element.closest("ytd-guide-renderer, ytd-guide-section-renderer")) {
        return;
      }

      let section = element.closest(sectionSelector);

      while (section?.parentElement) {
        const parentSection = section.parentElement.closest(sectionSelector);
        if (!parentSection) {
          break;
        }

        const hasVideoItems =
          parentSection.querySelectorAll(
            "ytd-rich-item-renderer, ytd-video-renderer, ytd-grid-video-renderer"
          ).length > 0;

        if (!hasVideoItems) {
          break;
        }

        section = parentSection;
      }

      if (section) {
        hideElement(section);
        hideNearbySeparators(section);
        return;
      }

      if (
        hideClosestIfFound(
          element,
          "ytd-button-renderer, tp-yt-paper-button, yt-button-shape, button"
        )
      ) {
        return;
      }

      hideElement(element);
    });
}

// Hide the header/filter chrome at the top of the Subscriptions page.
function cleanSubscriptionsPageControls() {
  if (!isSubscriptionsPath(location.pathname)) {
    return;
  }

  ensureSubscriptionsLayoutStyle();

  document
    .querySelectorAll(
      [
        "ytd-feed-filter-chip-bar-renderer",
        "yt-chip-cloud-renderer",
        "#chips-wrapper",
        "ytd-subscriptions-header-renderer",
        "ytd-subscriptions-page-header-renderer",
        "ytd-browse[page-subtype='subscriptions'] #header",
        "ytd-browse[page-subtype='subscriptions'] #header-container",
      ].join(", ")
    )
    .forEach(hideElement);

  document
    .querySelectorAll("a[href], ytd-button-renderer, yt-button-shape, button")
    .forEach((element) => {
      const link =
        element.matches("a[href]") ? element : element.querySelector("a[href]");
      const path = getPathFromUrl(link?.getAttribute("href") || link?.href);

      if (path === "/feed/channels") {
        hideClosestIfFound(
          element,
          "ytd-button-renderer, yt-button-shape, tp-yt-paper-button, button, a[href]"
        );
      }
    });

  document
    .querySelectorAll(
      [
        "ytd-feed-filter-chip-bar-renderer",
        "yt-chip-cloud-renderer",
        "ytd-toggle-button-renderer",
        "ytd-button-renderer",
        "yt-button-shape",
        "yt-formatted-string",
        "#title",
        "#text",
        "span",
        "button",
        "a[href]",
      ].join(", ")
    )
    .forEach((element) => {
      const text = getControlText(element);

      if (
        text === "latest" ||
        text === "most relevant" ||
        text === "all subscriptions"
      ) {
        if (
          hideClosestIfFound(
            element,
            "ytd-button-renderer, ytd-toggle-button-renderer, yt-button-shape, tp-yt-paper-button, button"
          )
        ) {
          return;
        }

        hideSubscriptionsHeaderText(element);
      }
    });

  cleanSubscriptionsTextNodes();
  cleanSubscriptionsExpandableSuggestions();
}

function runCleaner() {
  if (redirectIfNeeded()) {
    return;
  }

  ensureShortsStyle();
  restoreChannelRegularVideoSections();
  cleanSidebar();
  cleanShortsLinks();
  cleanShortsShelves();
  cleanSearchRefinementRows();
  cleanChannelPageShorts();
  cleanSubscriptionsPageControls();
  cleanWatchPage();
}

function scheduleCleaner() {
  if (cleanerTimeoutId) {
    return;
  }

  cleanerTimeoutId = window.setTimeout(() => {
    cleanerTimeoutId = 0;

    requestAnimationFrame(() => {
      if (location.href !== lastUrl) {
        lastUrl = location.href;

        if (!isHomePath(location.pathname) && !isShortsPath(location.pathname)) {
          redirectInFlight = false;
        }
      }

      runCleaner();
    });
  }, CLEANER_DEBOUNCE_MS);
}

function getEventPath(event) {
  if (typeof event.composedPath === "function") {
    return event.composedPath();
  }

  return [];
}

function getLinkFromEvent(event) {
  const path = getEventPath(event);

  for (const node of path) {
    if (node instanceof Element && node.matches("a[href]")) {
      return node;
    }
  }

  if (event.target instanceof Element) {
    return event.target.closest("a[href]");
  }

  return null;
}

// Intercept Home and Shorts links so they route to Subscriptions.
function handleDocumentClick(event) {
  if (!isPlainLeftClick(event)) {
    return;
  }

  const link = getLinkFromEvent(event);
  if (!link) {
    return;
  }

  const targetUrl = getUrlFromValue(link.getAttribute("href") || link.href);
  if (!targetUrl || targetUrl.origin !== location.origin) {
    return;
  }

  if (isSearchRoute(targetUrl.pathname, targetUrl.search)) {
    return;
  }

  const path = targetUrl.pathname;
  if (!isHomePath(path) && !isShortsPath(path)) {
    return;
  }

  if (isSubscriptionsPath(location.pathname) || shouldThrottleRedirect(path)) {
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    return;
  }

  event.preventDefault();
  event.stopPropagation();
  event.stopImmediatePropagation();
  markRedirect(path);
  location.assign(SUBSCRIPTIONS_URL);
}

// Watch YouTube SPA navigation so the cleaner reruns after in-app route changes.
function patchHistoryMethods() {
  if (historyPatched) {
    return;
  }

  historyPatched = true;

  const originalPushState = history.pushState;
  const originalReplaceState = history.replaceState;

  history.pushState = function pushState() {
    const result = originalPushState.apply(this, arguments);
    scheduleCleaner();
    return result;
  };

  history.replaceState = function replaceState() {
    const result = originalReplaceState.apply(this, arguments);
    scheduleCleaner();
    return result;
  };
}

function startBodyObserver() {
  if (bodyObserverStarted || !document.body) {
    return;
  }

  bodyObserverStarted = true;

  const observer = new MutationObserver((mutations) => {
    const hasElementChanges = mutations.some((mutation) => {
      return (
        Array.from(mutation.addedNodes).some((node) => node.nodeType === Node.ELEMENT_NODE) ||
        Array.from(mutation.removedNodes).some((node) => node.nodeType === Node.ELEMENT_NODE)
      );
    });

    if (location.href !== lastUrl || hasElementChanges) {
      scheduleCleaner();
    }
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
  });
}

function waitForBody() {
  if (document.body) {
    startBodyObserver();
    scheduleCleaner();
    return;
  }

  const observer = new MutationObserver(() => {
    if (!document.body) {
      return;
    }

    observer.disconnect();
    startBodyObserver();
    scheduleCleaner();
  });

  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
  });
}

function init() {
  if (redirectIfNeeded()) {
    return;
  }

  patchHistoryMethods();
  document.addEventListener("click", handleDocumentClick, true);
  window.addEventListener("yt-navigate-finish", scheduleCleaner);
  window.addEventListener("popstate", scheduleCleaner);
  document.addEventListener("fullscreenchange", syncFullscreenState);

  waitForBody();
}

init();
