const $ = (selector) => document.querySelector(selector);
const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);
const storage = {
  get(key) { try { return localStorage.getItem(`llm-music-documentation-v2:${key}`); } catch { return null; } },
  set(key, value) { try { localStorage.setItem(`llm-music-documentation-v2:${key}`, value); } catch { /* Preferences can remain session-only. */ } },
};
const words = {
  zh: { brand: "音乐工作台", docs: "文档", search: "搜索文档", theme: "主题", language: "语言", light: "浅色", dark: "深色", system: "跟随系统", preview: "独立文档预览", isolation: "不会连接 Runtime", tools: "预览搜索状态", toolsNote: "只改变此预览的搜索体验。", loading: "加载中", failed: "加载失败", ready: "正常", outline: "本页内容", copy: "复制", copied: "命令已复制", copyFailed: "无法自动复制，请选择命令后手动复制。", source: "正文来源", version: "源码版本", previous: "上一章", next: "下一章", placeholder: "搜索 Runtime、模型、MIDI…", keywords: "搜索关键词", close: "关闭搜索", searchFooter: "搜索此版本的中文文档", popular: "从这些文档开始", empty: "没有找到对应文档", emptyHint: "试试 Runtime、模型或 MIDI，也可以回到概览。", clear: "清空搜索", searchLoading: "正在加载搜索内容", finishLoading: "完成加载", searchFailed: "搜索内容暂时不可用", searchFailedHint: "当前页面仍可阅读。重试后继续搜索。", retry: "重试", home: "回到概览", unknown: "找不到这个章节", unknownHint: "请从左侧导航选择已存在的文档。", pageLoading: "正在载入文档…", pageFailed: "文档内容未能载入", firstAction: "开始准备", secondAction: "查看转谱指南", firstAudio: "参考音频", firstAudioDetail: "16 秒原创器乐", modelDetail: "本地 GPU 转谱", scoreDetail: "校验完整文件", skip: "跳到正文", navigation: "文档导航" },
  en: { brand: "Music Workbench", docs: "Docs", search: "Search docs", theme: "Theme", language: "Language", light: "Light", dark: "Dark", system: "System", preview: "Isolated docs preview", isolation: "No Runtime connection", tools: "Preview search states", toolsNote: "Changes this preview's search experience only.", loading: "Loading", failed: "Failed", ready: "Ready", outline: "On this page", copy: "Copy", copied: "Command copied", copyFailed: "Automatic copy failed. Select and copy the command manually.", source: "Page source", version: "Source version", previous: "Previous chapter", next: "Next chapter", placeholder: "Search Runtime, models, MIDI…", keywords: "Search keywords", close: "Close search", searchFooter: "Search this version's English docs", popular: "Start with these documents", empty: "No matching documents", emptyHint: "Try Runtime, models, or MIDI. You can also return to the overview.", clear: "Clear search", searchLoading: "Loading search content", finishLoading: "Finish loading", searchFailed: "Search content is unavailable", searchFailedHint: "The current page is still readable. Retry to continue searching.", retry: "Retry", home: "Return to overview", unknown: "This chapter was not found", unknownHint: "Choose an existing document from the navigation.", pageLoading: "Loading documentation…", pageFailed: "Documentation could not be loaded", firstAction: "Start preparation", secondAction: "View transcription guide", firstAudio: "Reference Audio", firstAudioDetail: "16-second original music", modelDetail: "Local GPU transcription", scoreDetail: "Complete file validation", skip: "Skip to content", navigation: "Documentation navigation" },
};
let content;
let locale = storage.get("language") === "en" ? "en" : "zh";
let currentId = "overview";
let searchState = "ready";
let toastTimer;
let loadAttempt = 0;

// Reuse the approved shell. These changes describe the creator's tasks.
Object.assign(words.zh, { copied: "内容已复制", copyFailed: "无法自动复制，请选择内容后手动复制。", source: "当前操作依据", version: "接口基线", placeholder: "搜索风格、歌词、转谱、版本…", emptyHint: "试试风格、歌词、MIDI 或版本。", firstAction: "做出第一段音乐", secondAction: "从参考音频开始" });
Object.assign(words.en, { copied: "Content copied", copyFailed: "Automatic copy failed. Select and copy the content manually.", source: "Current operation guide", version: "API baseline", placeholder: "Search style, lyrics, scores, versions…", emptyHint: "Try style, lyrics, MIDI, or versions.", firstAction: "Make your first music", secondAction: "Start with Reference Audio" });

let selectedRecipe = "baseline";
const recipeWords = {
  zh: {
    baseline: ["回听原配方", "已验证基线", "保持第一章全部输入。先听温暖人声与木吉他、钢琴的组合，再写下下一次想改的一点。"],
    style: ["更轻的钢琴编曲", "灵感建议 · 未试听", "只把 style 改成钢琴主导、克制鼓组。歌词与 seed 保持原样，观察编曲是否更贴近你想要的留白。"],
    lyrics: ["换一句表达", "灵感建议 · 未试听", "只把第一句改为 Morning sunlight finds the window。保留段落、其他句子、风格与 seed，听措辞与咬字是否更合适。"],
    seed: ["换一个随机起点", "灵感建议 · 未试听", "只把 seed 改成 2026192202。风格和完整歌词不变，听另一个结果有没有你更喜欢的旋律或组织方式。"],
    parameters: "查看与复制输入 · JSON", noRun: "只展示输入；不提交任务。", styleLabel: "风格", seedLabel: "Seed", changedLine: "新的第一句", copyInputs: "复制输入"
  },
  en: {
    baseline: ["Hear the original recipe", "Verified baseline", "Keep all first-chapter inputs. Listen to the warm voice with guitar and piano, then note one thing to change next."],
    style: ["A lighter piano arrangement", "Inspiration · not auditioned", "Change only style to piano-led with restrained drums. Keep lyrics and seed, then listen for the space you want in the arrangement."],
    lyrics: ["Try another phrase", "Inspiration · not auditioned", "Change only the first line to Morning sunlight finds the window. Keep sections, other lines, style, and seed. Listen for phrasing and articulation that suit you better."],
    seed: ["Another random starting point", "Inspiration · not auditioned", "Change only seed to 2026192202. Keep style and all lyrics, then hear whether another result has a melody or structure you prefer."],
    parameters: "View and copy inputs · JSON", noRun: "Displays inputs only; submits no Job.", styleLabel: "Style", seedLabel: "Seed", changedLine: "New first line", copyInputs: "Copy inputs"
  }
};

function renderRecipes() {
  const w = recipeWords[locale];
  const sections = content.pages["first-music"][locale].sections;
  const inputs = { style: sections.find((section) => section.id === "style").blocks[0].text, lyrics: sections.find((section) => section.id === "lyrics").blocks[0].text, seed: 2026192201, max_seconds: 35 };
  if (selectedRecipe === "style") inputs.style = "English, gentle folk pop, warm clear voice, soft piano, restrained drums, 96 BPM";
  if (selectedRecipe === "lyrics") inputs.lyrics = inputs.lyrics.replace("Morning gathers on the window", "Morning sunlight finds the window");
  if (selectedRecipe === "seed") inputs.seed = 2026192202;
  const description = w[selectedRecipe];
  return `<div class="recipe-tabs" role="group" aria-label="${locale === "zh" ? "选择输入配方" : "Choose an input recipe"}">${["baseline", "style", "lyrics", "seed"].map((id) => `<button data-recipe="${id}" aria-pressed="${id === selectedRecipe}">${escapeHtml(w[id][0])}</button>`).join("")}</div><div class="recipe-preview" aria-live="polite"><p class="recipe-note">${escapeHtml(description[1])}</p><p>${escapeHtml(description[2])}</p><p><strong>${w.styleLabel}:</strong> ${escapeHtml(inputs.style)}</p><p><strong>${w.seedLabel}:</strong> ${inputs.seed}${selectedRecipe === "lyrics" ? `<br><strong>${w.changedLine}:</strong> Morning sunlight finds the window` : ""}</p><details class="advanced"><summary>${w.parameters}</summary><div class="command"><div class="command-header"><span>${w.noRun}</span><button class="copy-button" data-copy="${escapeHtml(JSON.stringify(inputs, null, 2))}" aria-label="${w.copyInputs}">${words[locale].copy}</button></div><pre><code>${escapeHtml(JSON.stringify(inputs, null, 2))}</code></pre></div></details></div>`;
}

function route(language = locale, page = currentId, section = "") {
  return `#/${language}/${page}${section ? `/${section}` : ""}`;
}

function sourceUrl(path) {
  return `https://github.com/CaiZongyuan/llm-music/blob/${content.sourceCommit}/${path}`;
}

function setTheme(value) {
  const choice = ["light", "dark", "system"].includes(value) ? value : "system";
  const actual = choice === "system" ? (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light") : choice;
  document.documentElement.dataset.theme = actual;
  $("#theme").value = choice;
  storage.set("theme", choice);
}

function updateLabels() {
  const w = words[locale];
  document.documentElement.lang = locale === "zh" ? "zh-Hans" : "en";
  $("#brand-name").textContent = w.brand;
  $("#brand-docs").textContent = w.docs;
  $(".brand").href = route(locale, "overview");
  $(".brand").ariaLabel = `${w.brand} ${w.docs}`;
  $(".skip-link").textContent = w.skip;
  $(".sidebar").ariaLabel = w.navigation;
  $(".page-outline").ariaLabel = w.outline;
  $("#search-label").textContent = w.search;
  $("#search-title").textContent = w.search;
  $("#search-input-label").textContent = w.keywords;
  $("#search-input").placeholder = w.placeholder;
  $("#search-close").ariaLabel = w.close;
  $("#search-footer").textContent = w.searchFooter;
  $("#theme").ariaLabel = w.theme;
  $("#language").ariaLabel = w.language;
  $("label[for=theme]").textContent = w.theme;
  $("label[for=language]").textContent = w.language;
  $("#language").value = locale;
  for (const choice of ["light", "dark", "system"]) $("#theme").querySelector(`[value=${choice}]`).textContent = w[choice];
  for (const [id, word] of [["preview-label", "preview"], ["preview-isolation", "isolation"], ["preview-tools-label", "tools"], ["preview-tools-note", "toolsNote"], ["preview-loading", "loading"], ["preview-failed", "failed"], ["preview-ready", "ready"]]) $(`#${id}`).textContent = w[word];
}

function renderFlow(items) {
  return `<div class="flow">${items.map((item, index) => `${index ? '<span class="flow-arrow" aria-hidden="true">→</span>' : ""}<div class="flow-item">${escapeHtml(item.title)}<small>${escapeHtml(item.detail)}</small></div>`).join("")}</div>`;
}

function renderSection(section) {
  const w = words[locale];
  const cards = section.cards ? `<div class="task-grid">${section.cards.map((card) => `<a class="task-card" href="${route(locale, card.link)}"><span class="card-icon" aria-hidden="true">${escapeHtml(card.icon)}</span><strong>${escapeHtml(card.title)}</strong><p>${escapeHtml(card.text)}</p><span class="card-link">${escapeHtml(card.action)}</span></a>`).join("")}</div>` : "";
  const commands = (section.commands || []).map((command) => `<div class="command"><div class="command-header"><span>PowerShell · ${locale === "zh" ? "仓库根目录" : "repository root"}</span><button class="copy-button" data-copy="${escapeHtml(command)}" aria-label="${w.copy}: ${escapeHtml(section.title)}">${w.copy}</button></div><pre><code>${escapeHtml(command)}</code></pre></div>`).join("");
  const table = section.table ? `<table><thead><tr>${section.table.head.map((heading) => `<th scope="col">${escapeHtml(heading)}</th>`).join("")}</tr></thead><tbody>${section.table.rows.map((row) => `<tr>${row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join("")}</tr>`).join("")}</tbody></table>` : "";
  const links = section.sourceLinks ? `<ul>${section.sourceLinks.map((link) => `<li><a href="${sourceUrl(link.path)}" target="_blank" rel="noreferrer">${escapeHtml(link.label)}</a></li>`).join("")}</ul>` : "";
  const blocks = (section.blocks || []).map((block) => `<div class="command"><div class="command-header"><span>${escapeHtml(block.label)}</span><button class="copy-button" data-copy="${escapeHtml(block.text)}" aria-label="${w.copy}: ${escapeHtml(block.label)}">${w.copy}</button></div><pre><code>${escapeHtml(block.text)}</code></pre></div>`).join("");
  const advanced = section.advanced ? `<details class="advanced"><summary>${escapeHtml(section.advanced.title)}</summary>${section.advanced.html}${(section.advanced.blocks || []).map((block) => `<div class="command"><div class="command-header"><span>${escapeHtml(block.label)}</span><button class="copy-button" data-copy="${escapeHtml(block.text)}" aria-label="${w.copy}: ${escapeHtml(block.label)}">${w.copy}</button></div><pre><code>${escapeHtml(block.text)}</code></pre></div>`).join("")}</details>` : "";
  return `<section id="section-${section.id}"><h2>${escapeHtml(section.title)}</h2>${section.flow ? renderFlow(section.flow) : ""}${section.html || ""}${cards}${commands}${blocks}${table}${section.after || ""}${links}${advanced}${section.recipes ? `<div id="recipe-controls">${renderRecipes()}</div>` : ""}</section>`;
}

function render() {
  if (!content) return;
  const parts = location.hash.slice(2).split("/");
  if (["zh", "en"].includes(parts[0])) locale = parts[0];
  currentId = parts[1] || "overview";
  storage.set("language", locale);
  const w = words[locale];
  updateLabels();
  $("#navigation").innerHTML = content.groups.map((group) => `<div class="nav-group"><h2>${escapeHtml(group.title[locale])}</h2>${group.pages.map((id) => `<a href="${route(locale, id)}"${id === currentId ? ' aria-current="page"' : ""}>${escapeHtml(content.pages[id][locale].navTitle)}</a>`).join("")}</div>`).join("");
  const page = content.pages[currentId];
  if (!page) {
    $("#main").innerHTML = `<div class="page-state"><h1>${w.unknown}</h1><p>${w.unknownHint}</p><a href="${route(locale, "overview")}">${w.home} →</a></div>`;
    $("#outline").innerHTML = "";
    document.title = `${w.unknown} · ${w.brand}`;
    window.scrollTo(0, 0);
    return;
  }
  const text = page[locale];
  const sourcePath = locale === "en" && page.sourceEn ? page.sourceEn : page.source;
  const hero = text.hero ? `<div class="hero-actions"><a class="primary-link" href="${route(locale, "first-music")}">${w.firstAction}<span aria-hidden="true">→</span></a><a class="secondary-link" href="${route(locale, "reference")}">${w.secondAction}</a></div>${renderFlow(text.flow)}` : "";
  const chapters = ["previous", "next"].map((direction) => page[direction] ? `<a class="chapter-link ${direction}" href="${route(locale, page[direction])}"><small>${w[direction]}</small>${direction === "previous" ? "← " : ""}${escapeHtml(content.pages[page[direction]][locale].navTitle)}${direction === "next" ? " →" : ""}</a>` : "<span></span>").join("");
  $("#main").innerHTML = `<article><div class="eyebrow"><span>${escapeHtml(page.type[locale])}</span><span class="pill">${locale === "zh" ? "创作教程预览" : "Creator tutorial preview"}</span></div><h1>${escapeHtml(text.title)}</h1><p class="lead">${escapeHtml(text.summary)}</p>${hero}${text.sections.map(renderSection).join("")}<div class="page-source"><span>${w.version} <a href="https://github.com/CaiZongyuan/llm-music/tree/${content.sourceCommit}" target="_blank" rel="noreferrer"><code>${content.sourceCommit.slice(0, 7)}</code> ↗</a></span><span>${w.source} <a href="${sourceUrl(sourcePath)}" target="_blank" rel="noreferrer">${escapeHtml(sourcePath)} ↗</a></span></div>${page.previous || page.next ? `<nav class="chapter-links" aria-label="${locale === "zh" ? "章节导航" : "Chapter navigation"}">${chapters}</nav>` : ""}</article>`;
  $("#outline").innerHTML = `<h2>${w.outline}</h2>${text.sections.map((section) => `<a href="${route(locale, currentId, section.id)}">${escapeHtml(section.title)}</a>`).join("")}<div class="outline-source">${w.version}<br><a href="https://github.com/CaiZongyuan/llm-music/tree/${content.sourceCommit}" target="_blank" rel="noreferrer">${content.sourceCommit.slice(0, 7)} ↗</a></div>`;
  document.title = `${text.navTitle} · ${w.brand} ${w.docs}`;
  if (parts[2]) document.getElementById(`section-${parts[2]}`)?.scrollIntoView();
  else window.scrollTo(0, 0);
  if ($("#search-dialog").open) runSearch();
}

function searchText(page) {
  const text = page[locale];
  return [text.title, text.navTitle, text.summary, ...text.sections.map((section) => [section.title, section.html, section.after, section.advanced?.html, ...(section.blocks?.map((block) => `${block.label} ${block.text}`) || []), ...(section.advanced?.blocks?.map((block) => `${block.label} ${block.text}`) || []), ...(section.table?.rows.flat() || []), ...(section.cards?.map((card) => card.text) || [])].join(" "))].join(" ").replace(/<[^>]+>/g, " ").toLocaleLowerCase(locale);
}

function runSearch() {
  const w = words[locale];
  const query = $("#search-input").value.trim().toLocaleLowerCase(locale);
  const panel = $("#search-results");
  if (searchState === "loading") {
    panel.innerHTML = `<div class="search-state"><span class="spinner" aria-hidden="true"></span><strong>${w.searchLoading}</strong><button data-search-recover>${w.finishLoading}</button></div>`;
    return;
  }
  if (searchState === "failed" || !content) {
    panel.innerHTML = `<div class="search-state"><strong>${w.searchFailed}</strong><p>${w.searchFailedHint}</p><button data-search-recover>${w.retry}</button></div>`;
    return;
  }
  const matches = query ? Object.entries(content.pages).filter(([, page]) => searchText(page).includes(query)) : ["first-music", "reference", "variations"].map((id) => [id, content.pages[id]]);
  if (!matches.length) {
    panel.innerHTML = `<div class="search-state"><strong>${w.empty}</strong><p>${w.emptyHint}</p><button data-clear-search>${w.clear}</button></div>`;
    return;
  }
  panel.innerHTML = `${query ? "" : `<div class="search-hint">${w.popular}</div>`}${matches.map(([id, page]) => `<a class="search-result" href="${route(locale, id)}"><strong>${escapeHtml(page[locale].navTitle)}</strong><span>${escapeHtml(page[locale].summary)}</span></a>`).join("")}`;
}

function openSearch() {
  if (!$("#search-dialog").open) $("#search-dialog").showModal();
  runSearch();
  $("#search-input").focus();
}

async function loadContent() {
  const attempt = ++loadAttempt;
  $("#main").innerHTML = `<div class="page-state" role="status">${words[locale].pageLoading}</div>`;
  try {
    const response = await fetch("./content.json");
    if (!response.ok) throw new Error("Content request failed");
    const loaded = await response.json();
    if (attempt !== loadAttempt) return;
    content = loaded;
    render();
  } catch {
    if (attempt !== loadAttempt) return;
    const w = words[locale];
    $("#main").innerHTML = `<div class="page-state" role="alert"><h1>${w.pageFailed}</h1><p>${locale === "zh" ? "检查预览服务是否运行，再重试。" : "Check that the preview server is running, then retry."}</p><button data-reload-content>${w.retry}</button></div>`;
  }
}

$("#language").addEventListener("change", (event) => {
  const section = location.hash.slice(2).split("/")[2];
  location.hash = route(event.target.value, currentId, section);
});
$("#theme").addEventListener("change", (event) => setTheme(event.target.value));
matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => { if ($("#theme").value === "system") setTheme("system"); });
$("#search-open").addEventListener("click", openSearch);
$("#search-close").addEventListener("click", () => $("#search-dialog").close());
$("#search-input").addEventListener("input", runSearch);
$("#search-input").addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    const result = $(".search-result");
    if (result) { location.hash = result.hash; $("#search-dialog").close(); }
  }
});
$("#search-dialog").addEventListener("click", (event) => {
  if (event.target.closest(".search-result")) $("#search-dialog").close();
  if (event.target === $("#search-dialog")) {
    const bounds = $("#search-dialog").getBoundingClientRect();
    if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) $("#search-dialog").close();
  }
});
document.addEventListener("keydown", (event) => {
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") { event.preventDefault(); openSearch(); }
});
document.addEventListener("click", async (event) => {
  if (event.target.closest(".skip-link")) { event.preventDefault(); $("#main").focus(); $("#main").scrollIntoView(); }
  const stateButton = event.target.closest("[data-search-state]");
  if (stateButton) { searchState = stateButton.dataset.searchState; openSearch(); }
  if (event.target.closest("[data-search-recover]")) { searchState = "ready"; runSearch(); }
  if (event.target.closest("[data-clear-search]")) { $("#search-input").value = ""; runSearch(); $("#search-input").focus(); }
  if (event.target.closest("[data-reload-content]")) await loadContent();
  const recipe = event.target.closest("[data-recipe]");
  if (recipe) {
    selectedRecipe = recipe.dataset.recipe;
    $("#recipe-controls").innerHTML = renderRecipes();
    $(`[data-recipe="${selectedRecipe}"]`).focus();
  }
  const copy = event.target.closest("[data-copy]");
  if (copy) {
    try { await navigator.clipboard.writeText(copy.dataset.copy); $("#copy-status").textContent = words[locale].copied; }
    catch { $("#copy-status").textContent = words[locale].copyFailed; }
    $("#copy-status").classList.add("visible");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => $("#copy-status").classList.remove("visible"), 2500);
  }
});
window.addEventListener("hashchange", render);
history.scrollRestoration = "manual";
setTheme(storage.get("theme"));
if (!location.hash) history.replaceState(null, "", route(locale, "overview"));
updateLabels();
await loadContent();
