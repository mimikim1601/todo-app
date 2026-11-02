// Created: 2026-11-02 15:14

const STORAGE_KEY = "todo-app:v1";
const MAX_LENGTH = 100;
const MAX_CATEGORIES = 5;
const CATEGORY_NAME_MAX = 10;

// 카테고리 자리(slot) = 색 + 아이콘 한 쌍. 색은 style.css의 --color-<slot> 변수, 아이콘은 images/의 PNG.
const CATEGORY_SLOTS = {
  work: "images/hare.png",
  personal: "images/chiikawa.png",
  study: "images/usagi.png",
  extra1: "images/shisha.png",
  extra2: "images/me.png",
};
// 새 카테고리는 이 순서로 빈 자리를 받는다 (시사 → 메 → 지운 기본 카테고리 자리)
const NEW_SLOT_ORDER = ["extra1", "extra2", "work", "personal", "study"];
const DEFAULT_CATEGORIES = [
  { id: "work", name: "업무", slot: "work" },
  { id: "personal", name: "개인", slot: "personal" },
  { id: "study", name: "공부", slot: "study" },
];
const TITLE_ICON = "images/ha.png"; // "오늘의 할 일" 옆
const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];
const UNDO_TOAST_MS = 5000;

const IS_MAC = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
const MOD_LABEL = IS_MAC ? "Cmd" : "Ctrl";

// ---------- 키보드 단축키 대응표 ----------
// 키를 바꾸려면 keys만 고치면 된다. 도움말 표도 이 객체로 만든다(순서 = 표 순서).
// - keys: KeyboardEvent.key 값. 영문자는 소문자로 적는다(Shift·한글 자판이어도 같은 키로 인식).
// - scope: "page"(기본, 입력창 밖) | "input"(할 일 입력창 안)
// - withModifier: true면 Ctrl(Mac은 Cmd)과 함께 눌러야 한다.
// - native: true면 브라우저/폼 기본 동작에 맡기고 도움말에만 표시한다.
const SHORTCUTS = {
  focusInput: { keys: ["n", "/"], label: "할 일 입력창으로 이동" },
  submitInput: { keys: ["Enter"], scope: "input", native: true, label: "할 일 추가" },
  leaveInput: { keys: ["Escape"], scope: "input", label: "입력창에서 빠져나오기" },
  moveUp: { keys: ["ArrowUp", "k"], label: "선택 항목 위로" },
  moveDown: { keys: ["ArrowDown", "j"], label: "선택 항목 아래로" },
  toggleSelected: { keys: [" ", "x"], label: "선택 항목 완료/미완료 전환" },
  editSelected: { keys: ["e", "Enter"], label: "선택 항목 수정 (수정 중 Enter 저장, Esc 취소)" },
  deleteSelected: { keys: ["Delete", "Backspace"], label: "선택 항목 삭제" },
  undoDelete: { keys: ["z"], withModifier: true, label: "마지막으로 삭제한 항목 복구" },
  filterAll: { keys: ["1"], label: "필터: 전체" },
  filterCategory: { keys: ["2", "3", "4", "5", "6"], label: "필터: 카테고리 (편집 화면의 순서대로)" },
  toggleTheme: { keys: ["d"], label: "낮/밤 모드 전환" },
  toggleHelp: { keys: ["?"], label: "단축키 도움말 열기/닫기" },
};

// 도움말에 보여 줄 키 이름
const KEY_LABELS = {
  " ": "Space",
  ArrowUp: "↑",
  ArrowDown: "↓",
  Escape: "Esc",
};

// 상태
let todos = [];
let categories = DEFAULT_CATEGORIES.map((category) => ({ ...category }));
let settings = { filter: "all", lastCategory: "work", theme: "day" };

// 화면 전용 상태 (저장하지 않음)
let editingId = null; // 편집 중인 항목 id. 한 번에 하나만.
let selectedId = null; // 키보드로 다루는 선택 항목 id. 정렬이 바뀌어도 같은 항목을 가리킨다.
let lastDeleted = null; // 되돌리기용 { todo, index } (마지막 1개만)
let isRendering = false; // render 중 DOM 교체로 생기는 focusout 무시용
let toastTimer = null;
let undoTimer = null;
let helpReturnFocus = null; // 도움말을 닫으면 돌아갈 요소
let categoryReturnFocus = null; // 카테고리 편집을 닫으면 돌아갈 요소
let categorySignature = ""; // 카테고리 구성이 바뀌었을 때만 필터 탭·선택 상자를 다시 만든다

// DOM
const bannerEl = document.getElementById("storage-banner");
const toastEl = document.getElementById("toast");
const undoToastEl = document.getElementById("undo-toast");
const undoButtonEl = document.getElementById("undo-button");
const todayEl = document.getElementById("today");
const progressTextEl = document.getElementById("progress-text");
const progressBarEl = document.querySelector(".bar-total");
const formEl = document.getElementById("todo-form");
const inputEl = document.getElementById("todo-input");
const categoryEl = document.getElementById("todo-category");
const filterEl = document.querySelector(".filters");
const listEl = document.getElementById("todo-list");
const themeSwitchEl = document.getElementById("theme-switch");
const helpDialogEl = document.getElementById("help-dialog");
const helpRowsEl = document.getElementById("shortcut-rows");
const helpOpenEl = document.getElementById("help-open");
const helpCloseEl = document.getElementById("help-close");
const titleIconEl = document.getElementById("title-icon");
const categoryProgressEl = document.querySelector(".category-progress");
const categoryOpenEl = document.getElementById("category-open");
const categoryDialogEl = document.getElementById("category-dialog");
const categoryCloseEl = document.getElementById("category-close");
const categoryListEl = document.getElementById("category-list");
const categoryAddFormEl = document.getElementById("category-add-form");
const categoryAddInputEl = document.getElementById("category-add-input");
const categoryAddButtonEl = document.getElementById("category-add-button");
const categoryNoteEl = document.getElementById("category-note");
const categoryErrorEl = document.getElementById("category-error");

// ---------- 저장 / 불러오기 ----------

// localStorage에 접근할 수 없으면 null (메모리로만 동작)
const storage = getStorage();

function getStorage() {
  try {
    const store = window.localStorage;
    store.getItem(STORAGE_KEY);
    return store;
  } catch (err) {
    console.warn("localStorage를 사용할 수 없어 메모리로만 동작합니다:", err);
    return null;
  }
}

// 현재 todos, settings, categories를 localStorage에 저장한다. 실패하면 안내만 띄운다.
function save() {
  if (!storage) return;
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify({ todos, settings, categories }));
  } catch (err) {
    // 용량 초과 등. 화면 상태(메모리)는 그대로 둔다.
    console.warn("저장 실패:", err);
    showToast("저장에 실패했습니다");
  }
}

function isValidCategory(value) {
  return categories.some((category) => category.id === value);
}

function getCategory(id) {
  return categories.find((category) => category.id === id);
}

function categoryColor(category) {
  return `var(--color-${category.slot})`;
}

// 저장된 카테고리 목록을 검사해 쓸 수 있는 것만 돌려준다. 하나도 없으면 null(기본값 사용).
function parseCategories(raw) {
  if (!Array.isArray(raw)) return null;
  const ids = new Set();
  const slots = new Set();
  const list = [];
  for (const item of raw) {
    if (!item || typeof item !== "object" || typeof item.id !== "string" || typeof item.name !== "string") continue;
    const name = item.name.trim().slice(0, CATEGORY_NAME_MAX);
    if (name === "" || ids.has(item.id) || !Object.hasOwn(CATEGORY_SLOTS, item.slot) || slots.has(item.slot)) continue;
    ids.add(item.id);
    slots.add(item.slot);
    list.push({ id: item.id, name, slot: item.slot });
    if (list.length === MAX_CATEGORIES) break;
  }
  return list.length > 0 ? list : null;
}

function isValidFilter(value) {
  return value === "all" || isValidCategory(value);
}

function isValidTheme(value) {
  return value === "day" || value === "night";
}

function isValidTodo(item) {
  return (
    item !== null &&
    typeof item === "object" &&
    typeof item.id === "string" &&
    typeof item.text === "string" &&
    item.text.trim() !== "" &&
    typeof item.category === "string" &&
    typeof item.completed === "boolean" &&
    typeof item.createdAt === "number"
  );
}

// localStorage에서 상태를 복원한다. 손상된 데이터는 버리고 빈 목록으로 시작한다.
function load() {
  if (!storage) return;

  let data;
  try {
    data = JSON.parse(storage.getItem(STORAGE_KEY));
  } catch (err) {
    // 데이터 손상 또는 읽기 실패 → 빈 목록으로 시작
    console.warn("저장된 데이터를 읽지 못해 빈 목록으로 시작합니다:", err);
    return;
  }
  if (!data || typeof data !== "object") return;

  // 예전 데이터에는 categories가 없으므로 그때는 기본 3개(업무·개인·공부)를 쓴다.
  categories = parseCategories(data.categories) ?? categories;

  if (Array.isArray(data.todos)) {
    todos = data.todos.filter(isValidTodo).map((item) => ({
      id: item.id,
      text: item.text.slice(0, MAX_LENGTH),
      // 없는 카테고리를 가리키면 첫 번째 카테고리로 옮긴다(할 일은 잃지 않는다).
      category: isValidCategory(item.category) ? item.category : categories[0].id,
      completed: item.completed,
      createdAt: item.createdAt,
    }));
  }

  if (data.settings && typeof data.settings === "object") {
    const { filter, lastCategory, theme } = data.settings;
    if (isValidFilter(filter)) settings.filter = filter;
    if (isValidCategory(lastCategory)) settings.lastCategory = lastCategory;
    // 예전 데이터에는 theme이 없으므로 그때는 기본값 "day"를 유지한다.
    if (isValidTheme(theme)) settings.theme = theme;
  }
}

// ---------- 상태 변경 ----------

function createId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

// 새 할 일을 목록 끝에 넣고 마지막 카테고리로 기억한다.
function addTodo(text, category) {
  todos.push({
    id: createId(),
    text,
    category,
    completed: false,
    createdAt: Date.now(),
  });
  settings.lastCategory = category;
}

// id에 해당하는 할 일을 제거하고, 되돌리기용으로 원래 위치와 함께 기억한다.
function deleteTodo(id) {
  const index = todos.findIndex((todo) => todo.id === id);
  if (index === -1) return;
  lastDeleted = { todo: todos[index], index };
  todos.splice(index, 1);
}

// 마지막으로 삭제한 할 일을 원래 위치에 되돌려 넣는다. 되돌린 할 일(없으면 null)을 돌려준다.
function restoreTodo() {
  if (!lastDeleted) return null;
  const { todo, index } = lastDeleted;
  lastDeleted = null;
  if (todos.some((item) => item.id === todo.id)) return null;
  todos.splice(Math.min(index, todos.length), 0, todo);
  return todo;
}

// 할 일의 완료 여부를 체크박스 상태(completed)로 맞춘다.
function toggleTodo(id, completed) {
  const todo = todos.find((item) => item.id === id);
  if (todo) todo.completed = completed;
}

// 할 일의 내용과 카테고리를 바꾼다.
function updateTodo(id, text, category) {
  const todo = todos.find((item) => item.id === id);
  if (!todo) return;
  todo.text = text;
  todo.category = category;
}

// 편집 중인 항목의 입력값을 상태에 반영하고 편집 모드를 끝낸다.
// 공백만 남았거나 값이 잘못됐으면 반영하지 않는다(원래 값 유지).
// 반드시 render() 전에, 편집 DOM이 남아 있을 때 호출해야 한다.
function commitEdit() {
  const li = listEl.querySelector(".todo-item.is-editing");
  const id = editingId;
  editingId = null;
  if (!li) return;

  const text = li.querySelector(".todo-edit-input").value.trim().slice(0, MAX_LENGTH);
  const category = li.querySelector(".todo-edit-select").value;
  if (text === "" || !isValidCategory(category)) return;

  updateTodo(id, text, category);
}

function cancelEdit() {
  editingId = null;
}

// 카테고리 이름 검사. 문제가 있으면 안내 문구를, 괜찮으면 null을 돌려준다.
function validateCategoryName(name, exceptId = null) {
  if (name === "") return "카테고리 이름을 입력해 주세요";
  const duplicate = categories.some(
    (category) => category.id !== exceptId && category.name.toLowerCase() === name.toLowerCase()
  );
  return duplicate ? "같은 이름의 카테고리가 이미 있어요" : null;
}

// 새 카테고리를 빈 자리(색·아이콘)에 추가한다.
function addCategory(name) {
  const used = new Set(categories.map((category) => category.slot));
  const slot = NEW_SLOT_ORDER.find((candidate) => !used.has(candidate));
  if (!slot || categories.length >= MAX_CATEGORIES) return null;
  const category = { id: createId(), name, slot };
  categories.push(category);
  return category;
}

// 카테고리 이름을 바꾼다.
function renameCategory(id, name) {
  const category = getCategory(id);
  if (category) category.name = name;
}

// 카테고리와 그 카테고리의 할 일을 함께 지운다. 필터·마지막 카테고리·되돌리기도 정리한다.
function deleteCategory(id) {
  categories = categories.filter((category) => category.id !== id);
  todos = todos.filter((todo) => todo.category !== id);
  if (settings.filter === id) settings.filter = "all";
  if (settings.lastCategory === id) settings.lastCategory = categories[0].id;
  if (lastDeleted?.todo.category === id) {
    lastDeleted = null;
    hideUndoToast();
  }
}

// ---------- 렌더링 ----------

function sortTodos(list) {
  // 미완료가 위, 완료가 아래. 같은 그룹 안에서는 createdAt 오름차순.
  return [...list].sort((a, b) => {
    if (a.completed !== b.completed) return a.completed ? 1 : -1;
    return a.createdAt - b.createdAt;
  });
}

function getVisibleTodos() {
  if (settings.filter === "all") return todos;
  return todos.filter((todo) => todo.category === settings.filter);
}

// 화면에 보이는 순서대로의 id 목록
function getVisibleIds() {
  return sortTodos(getVisibleTodos()).map((todo) => todo.id);
}

// 삭제될 항목의 바로 아래(없으면 위) 항목 id
function getNeighborId(id) {
  const ids = getVisibleIds();
  const index = ids.indexOf(id);
  if (index === -1) return null;
  return ids[index + 1] ?? ids[index - 1] ?? null;
}

function createButton(className, text, ariaLabel) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = `btn btn-ghost ${className}`;
  button.textContent = text;
  button.setAttribute("aria-label", ariaLabel);
  return button;
}

function createCategorySelect(selected) {
  const select = document.createElement("select");
  select.className = "todo-edit-select";
  select.setAttribute("aria-label", "카테고리 수정");
  categories.forEach((category) => {
    const option = document.createElement("option");
    option.value = category.id;
    option.textContent = category.name;
    select.append(option);
  });
  select.value = selected;
  return select;
}

function createTodoItem(todo) {
  const li = document.createElement("li");
  li.className = "todo-item";
  li.classList.toggle("is-done", todo.completed);
  li.dataset.id = todo.id;

  const checkboxId = `todo-${todo.id}`;

  const checkbox = document.createElement("input");
  checkbox.type = "checkbox";
  checkbox.id = checkboxId;
  checkbox.className = "todo-check";
  checkbox.checked = todo.completed;

  // 체크박스용 label은 화면에서 숨긴다.
  // 내용 텍스트를 label로 쓰면 더블클릭(수정)할 때 체크가 두 번 토글되기 때문.
  const checkLabel = document.createElement("label");
  checkLabel.htmlFor = checkboxId;
  checkLabel.className = "visually-hidden";
  checkLabel.textContent = `${todo.text} 완료`;

  const text = document.createElement("span");
  text.className = "todo-text";
  text.textContent = todo.text;
  text.title = "더블클릭하여 수정";

  const badge = document.createElement("span");
  badge.className = "badge";
  const category = getCategory(todo.category);
  badge.dataset.category = todo.category;
  badge.style.setProperty("--cat-color", categoryColor(category));
  badge.textContent = category.name;
  badge.prepend(makeCategoryIcon(category, 20));

  const actions = document.createElement("div");
  actions.className = "todo-actions";
  actions.append(
    createButton("btn-edit", "수정", `${todo.text} 수정`),
    createButton("btn-delete", "삭제", `${todo.text} 삭제`)
  );

  li.append(checkbox, checkLabel, text, badge, actions);
  return li;
}

function createEditItem(todo) {
  const li = document.createElement("li");
  li.className = "todo-item is-editing";
  li.dataset.id = todo.id;

  const input = document.createElement("input");
  input.type = "text";
  input.className = "todo-edit-input";
  input.maxLength = MAX_LENGTH;
  input.value = todo.text;
  input.setAttribute("aria-label", "할 일 내용 수정");

  li.append(input, createCategorySelect(todo.category));
  return li;
}

function createEmptyItem() {
  const li = document.createElement("li");
  li.className = "todo-empty";
  li.textContent = todos.length === 0 ? "할 일을 추가해 보세요" : "이 카테고리에 할 일이 없습니다";
  return li;
}

// ---------- 아이콘 (images/ 폴더의 PNG) ----------

// 장식용 아이콘 <img>. 글자(카테고리 이름)가 옆에 있으므로 스크린 리더에는 읽히지 않게 한다.
function makeIcon(src, size, key) {
  const img = document.createElement("img");
  img.src = src;
  img.width = size;
  img.height = size;
  img.alt = "";
  img.className = "icon";
  img.dataset.icon = key;
  img.draggable = false;
  img.setAttribute("aria-hidden", "true");
  return img;
}

function makeCategoryIcon(category, size) {
  return makeIcon(CATEGORY_SLOTS[category.slot], size, category.id);
}

// 헤더 제목 옆 아이콘을 한 번 배치한다. (카테고리 아이콘은 render 때 그린다)
function placeIcons() {
  titleIconEl.append(makeIcon(TITLE_ICON, 56, "title"));
}

// 0.4초 통통 튀기 (연속으로 불러도 처음부터 다시 튄다)
function bounceIcon(img) {
  img.classList.remove("is-bouncing");
  void img.getBoundingClientRect(); // 애니메이션을 다시 시작하게 한다
  img.classList.add("is-bouncing");
  img.addEventListener("animationend", () => img.classList.remove("is-bouncing"), { once: true });
}

// 할 일을 완료하면 그 카테고리 아이콘(진행률·필터 탭·완료한 항목 배지)이 통통 튄다.
function celebrate(todo) {
  const selector = `.icon[data-icon="${todo.category}"]`;
  const targets = [
    ...document.querySelectorAll(`.category-progress ${selector}, .filters ${selector}`),
    ...(findItemEl(todo.id)?.querySelectorAll(selector) ?? []),
  ];
  targets.forEach(bounceIcon);
}

// 진행률은 저장하지 않고 매번 todos 전체(필터 무관)에서 계산한다.
function getProgress(list) {
  const total = list.length;
  const done = list.filter((todo) => todo.completed).length;
  const percent = total === 0 ? 0 : Math.round((done / total) * 100);
  return { done, total, percent };
}

function updateProgressBar(barEl, textEl, { done, total, percent }) {
  textEl.textContent = `${done} / ${total} (${percent}%)`;
  barEl.setAttribute("aria-valuenow", String(percent));
  barEl.setAttribute("aria-valuetext", `${total}개 중 ${done}개 완료, ${percent}%`);
  barEl.querySelector(".bar-fill").style.width = `${percent}%`;
}

function createCategoryProgressItem(category) {
  const li = document.createElement("li");
  li.className = "cat-item";
  li.dataset.category = category.id;
  li.style.setProperty("--cat-color", categoryColor(category));

  const label = document.createElement("div");
  label.className = "cat-label";
  const name = document.createElement("span");
  name.className = "cat-name";
  name.textContent = category.name;
  name.prepend(makeCategoryIcon(category, 24));
  const count = document.createElement("span");
  count.className = "cat-count";
  label.append(name, count);

  const bar = document.createElement("div");
  bar.className = "bar bar-small";
  bar.setAttribute("role", "progressbar");
  bar.setAttribute("aria-label", `${category.name} 진행률`);
  bar.setAttribute("aria-valuemin", "0");
  bar.setAttribute("aria-valuemax", "100");
  const fill = document.createElement("div");
  fill.className = "bar-fill";
  bar.append(fill);

  li.append(label, bar);
  updateProgressBar(bar, count, getProgress(todos.filter((todo) => todo.category === category.id)));
  return li;
}

function renderProgress() {
  updateProgressBar(progressBarEl, progressTextEl, getProgress(todos));
  categoryProgressEl.replaceChildren(...categories.map(createCategoryProgressItem));
}

// 테마를 html의 data-theme과 스위치 상태(aria-checked)에 반영한다.
function renderTheme() {
  const isNight = settings.theme === "night";
  if (isNight) document.documentElement.dataset.theme = "night";
  else delete document.documentElement.dataset.theme;
  themeSwitchEl.setAttribute("aria-checked", String(isNight));
}

function createFilterButton(category) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "filter-btn";
  button.dataset.filter = category.id;
  button.style.setProperty("--cat-color", categoryColor(category));
  button.append(makeCategoryIcon(category, 20), category.name);
  return button;
}

function renderCategoryControls() {
  const signature = JSON.stringify(categories);
  if (signature === categorySignature) return;
  categorySignature = signature;

  filterEl.querySelectorAll('.filter-btn:not([data-filter="all"])').forEach((button) => button.remove());
  categories.forEach((category) => filterEl.insertBefore(createFilterButton(category), categoryOpenEl));

  categoryEl.replaceChildren(
    ...categories.map((category) => {
      const option = document.createElement("option");
      option.value = category.id;
      option.textContent = category.name;
      return option;
    })
  );
}

function renderFilters() {
  renderCategoryControls();
  filterEl.querySelectorAll("[data-filter]").forEach((button) => {
    const isActive = button.dataset.filter === settings.filter;
    button.classList.toggle("is-active", isActive);
    button.setAttribute("aria-pressed", String(isActive));
  });
}

// 선택 표시만 다시 그린다. 목록을 새로 만들지 않으므로 포커스가 그대로 유지된다.
function renderSelection() {
  listEl.querySelectorAll(".todo-item").forEach((li) => {
    const isSelected = li.dataset.id === selectedId;
    li.classList.toggle("is-selected", isSelected);
    if (isSelected) li.setAttribute("aria-current", "true");
    else li.removeAttribute("aria-current");
  });
}

// 상태(todos, categories, settings, editingId, selectedId)를 기준으로 목록·필터·진행률을 다시 그린다.
function render() {
  if (!isValidFilter(settings.filter)) settings.filter = "all";
  if (!isValidCategory(settings.lastCategory)) settings.lastCategory = categories[0].id;

  const visible = sortTodos(getVisibleTodos());
  if (!visible.some((todo) => todo.id === editingId)) editingId = null;
  if (!visible.some((todo) => todo.id === selectedId)) selectedId = null;

  const fragment = document.createDocumentFragment();
  visible.forEach((todo) => {
    fragment.append(todo.id === editingId ? createEditItem(todo) : createTodoItem(todo));
  });
  if (visible.length === 0) fragment.append(createEmptyItem());

  isRendering = true;
  listEl.replaceChildren(fragment);
  isRendering = false;

  renderSelection();
  renderTheme();
  renderFilters();
  renderProgress();
  categoryEl.value = settings.lastCategory;
}

// 카테고리 편집 화면(목록·추가 칸)을 다시 그린다. 이름 입력 중에는 부르지 않는다(포커스 유지).
function renderCategoryEditor() {
  categoryListEl.replaceChildren(
    ...categories.map((category) => {
      const li = document.createElement("li");
      li.className = "category-row";
      li.dataset.categoryId = category.id;
      li.style.setProperty("--cat-color", categoryColor(category));

      const input = document.createElement("input");
      input.type = "text";
      input.className = "category-name-input";
      input.maxLength = CATEGORY_NAME_MAX;
      input.value = category.name;
      input.setAttribute("aria-label", "카테고리 이름");

      const count = document.createElement("span");
      count.className = "category-count";
      count.textContent = `할 일 ${todos.filter((todo) => todo.category === category.id).length}개`;

      const remove = createButton("category-delete", "삭제", `${category.name} 카테고리 삭제`);

      li.append(makeCategoryIcon(category, 32), input, count, remove);
      return li;
    })
  );

  const isFull = categories.length >= MAX_CATEGORIES;
  categoryAddInputEl.disabled = isFull;
  categoryAddButtonEl.disabled = isFull;
  categoryNoteEl.textContent = isFull
    ? `카테고리는 최대 ${MAX_CATEGORIES}개까지예요. 새로 만들려면 하나를 지워 주세요.`
    : `카테고리는 최대 ${MAX_CATEGORIES}개까지 만들 수 있어요 (${categories.length}/${MAX_CATEGORIES}).`;
}

function showCategoryError(message) {
  categoryErrorEl.textContent = message ?? "";
  categoryErrorEl.hidden = !message;
}

function showToast(message) {
  toastEl.textContent = message;
  toastEl.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toastEl.hidden = true;
  }, 2500);
}

function showUndoToast() {
  undoToastEl.hidden = false;
  clearTimeout(undoTimer);
  undoTimer = setTimeout(hideUndoToast, UNDO_TOAST_MS);
}

function hideUndoToast() {
  clearTimeout(undoTimer);
  undoToastEl.hidden = true;
}

function setInputInvalid(invalid) {
  inputEl.classList.toggle("is-invalid", invalid);
  if (invalid) inputEl.setAttribute("aria-invalid", "true");
  else inputEl.removeAttribute("aria-invalid");
}

function renderToday() {
  const now = new Date();
  const month = now.getMonth() + 1;
  const date = now.getDate();
  todayEl.textContent = `${month}월 ${date}일 (${WEEKDAYS[now.getDay()]})`;
  todayEl.dateTime = `${now.getFullYear()}-${String(month).padStart(2, "0")}-${String(date).padStart(2, "0")}`;
}

function formatKey(key, withModifier) {
  const name = KEY_LABELS[key] ?? (key.length === 1 ? key.toUpperCase() : key);
  return withModifier ? `${MOD_LABEL}+${name}` : name;
}

// SHORTCUTS 객체로 도움말 표를 만든다.
function renderShortcutHelp() {
  const fragment = document.createDocumentFragment();
  Object.values(SHORTCUTS).forEach((shortcut) => {
    const row = document.createElement("tr");
    const keyCell = document.createElement("td");
    shortcut.keys.forEach((key, i) => {
      if (i > 0) keyCell.append(" / ");
      const kbd = document.createElement("kbd");
      kbd.textContent = formatKey(key, shortcut.withModifier);
      keyCell.append(kbd);
    });
    if (shortcut.scope === "input") {
      const note = document.createElement("span");
      note.className = "key-note";
      note.textContent = " (입력창)";
      keyCell.append(note);
    }
    const labelCell = document.createElement("td");
    labelCell.textContent = shortcut.label;
    row.append(keyCell, labelCell);
    fragment.append(row);
  });
  helpRowsEl.replaceChildren(fragment);
}

// ---------- 포커스 도우미 ----------

function focusEditInput() {
  const input = listEl.querySelector(".todo-edit-input");
  if (!input) return;
  input.focus();
  input.setSelectionRange(input.value.length, input.value.length);
}

function findItemEl(id) {
  return [...listEl.querySelectorAll(".todo-item")].find((item) => item.dataset.id === id);
}

// render()가 목록을 새로 그리면 포커스가 사라지므로, 키보드 사용자를 위해 같은 항목의 컨트롤로 되돌린다.
function focusInItem(id, selector) {
  findItemEl(id)?.querySelector(selector)?.focus();
}

// 선택 항목의 체크박스로, 선택 항목이 없으면(목록이 비면) 입력창으로 보낸다.
function focusSelectedOrInput() {
  const checkbox = findItemEl(selectedId)?.querySelector(".todo-check");
  if (checkbox) checkbox.focus();
  else inputEl.focus();
}

function scrollSelectedIntoView() {
  findItemEl(selectedId)?.scrollIntoView({ block: "nearest" });
}

function isFocusInList() {
  return listEl.contains(document.activeElement);
}

// ---------- 공통 동작 (마우스와 단축키가 함께 쓴다) ----------

function setFilter(filter) {
  if (!isValidFilter(filter)) return false;
  if (editingId !== null) commitEdit();
  settings.filter = filter;
  save();
  render();
  return true;
}

// 테마는 목록과 무관하므로 render() 대신 renderTheme()만 호출한다.
// (render()는 목록을 새로 만들기 때문에, 새 항목은 0.6초 색 전환 없이 바로 바뀌어 버린다.)
function toggleTheme() {
  settings.theme = settings.theme === "night" ? "day" : "night";
  save();
  renderTheme();
  return true;
}

// 삭제하고, 선택 항목이었다면 바로 아래(없으면 위) 항목으로 선택을 옮긴 뒤 되돌리기 안내를 띄운다.
function deleteWithUndo(id) {
  const neighborId = getNeighborId(id);
  deleteTodo(id);
  if (selectedId === id) selectedId = neighborId;
  save();
  render();
  showUndoToast();
}

function undoDelete() {
  const todo = restoreTodo();
  if (!todo) return false;
  selectedId = todo.id;
  hideUndoToast();
  save();
  render();
  scrollSelectedIntoView();
  return true;
}

function moveSelection(step) {
  const ids = getVisibleIds();
  if (ids.length === 0) return false;
  const current = ids.indexOf(selectedId);
  const next =
    current === -1
      ? step > 0 ? 0 : ids.length - 1
      : Math.min(Math.max(current + step, 0), ids.length - 1);

  selectedId = ids[next];
  renderSelection();
  // 목록 안에 포커스가 있었다면 포커스도 함께 옮겨, Space 등이 선택 항목에 작동하게 한다.
  if (isFocusInList()) focusInItem(selectedId, ".todo-check");
  scrollSelectedIntoView();
  return true;
}

function openCategoryEditor() {
  if (editingId !== null) {
    commitEdit();
    save();
    render();
  }
  categoryReturnFocus = document.activeElement;
  showCategoryError(null);
  renderCategoryEditor();
  categoryDialogEl.showModal();
}

// 이름 칸의 값을 확인하고 반영한다. 잘못된 값이면 원래 이름으로 되돌린다.
function commitCategoryName(input) {
  const id = input.closest(".category-row")?.dataset.categoryId;
  const category = getCategory(id);
  if (!category) return;
  const name = input.value.trim().slice(0, CATEGORY_NAME_MAX);
  if (name === category.name) {
    input.value = name;
    return;
  }
  const error = validateCategoryName(name, id);
  if (error) {
    showCategoryError(error);
    input.value = category.name;
    return;
  }
  showCategoryError(null);
  renameCategory(id, name);
  input.value = name;
  input.closest(".category-row").querySelector(".category-delete").setAttribute("aria-label", `${name} 카테고리 삭제`);
  save();
  render();
}

function openHelp() {
  helpReturnFocus = document.activeElement;
  helpDialogEl.showModal();
}

function closeHelp() {
  helpDialogEl.close();
}

// 단축키 이름 → 실제 동작. 처리했으면 true를 돌려준다(그때만 브라우저 기본 동작을 막는다).
const shortcutActions = {
  focusInput() {
    inputEl.focus();
    return true;
  },
  leaveInput() {
    document.activeElement.blur();
    return true;
  },
  moveUp: () => moveSelection(-1),
  moveDown: () => moveSelection(1),
  toggleSelected() {
    const todo = todos.find((item) => item.id === selectedId);
    if (!todo) return false;
    const hadFocus = isFocusInList();
    if (editingId !== null) commitEdit();
    toggleTodo(todo.id, !todo.completed);
    save();
    render();
    if (todo.completed) celebrate(todo);
    if (hadFocus) focusInItem(todo.id, ".todo-check");
    scrollSelectedIntoView();
    return true;
  },
  editSelected() {
    if (selectedId === null) return false;
    if (editingId !== null) commitEdit();
    editingId = selectedId;
    save();
    render();
    focusEditInput();
    return true;
  },
  deleteSelected() {
    if (selectedId === null) return false;
    const hadFocus = isFocusInList();
    deleteWithUndo(selectedId);
    if (hadFocus) focusSelectedOrInput();
    scrollSelectedIntoView();
    return true;
  },
  undoDelete() {
    const hadFocus = isFocusInList();
    if (!undoDelete()) return false;
    if (hadFocus) focusSelectedOrInput();
    return true;
  },
  filterAll: () => setFilter("all"),
  // 2 → 첫 번째 카테고리, 3 → 두 번째 … (없는 번호면 무시)
  filterCategory(event) {
    const category = categories[Number(event.key) - 2];
    return category ? setFilter(category.id) : false;
  },
  toggleTheme,
  toggleHelp() {
    if (helpDialogEl.open) closeHelp();
    else openHelp();
    return true;
  },
};

// ---------- 키보드 단축키 ----------

// 글자를 입력하는 요소인지 (여기서는 단축키가 글자 입력을 방해하면 안 된다)
function isTypingTarget(el) {
  return (
    el instanceof Element &&
    el.matches(
      'input:not([type="checkbox"]):not([type="radio"]):not([type="button"]):not([type="submit"]), textarea, select, [contenteditable=""], [contenteditable="true"]'
    )
  );
}

// 이 키(Space/Enter)로 스스로 동작하는 요소인지. 그런 요소는 기본 동작에 맡긴다.
// (체크박스는 Space로만 바뀌므로 Enter는 단축키(수정)로 쓴다)
function hasNativeKeyAction(el, key) {
  if (!(el instanceof Element)) return false;
  if (key === "Enter") return el.matches("button, a[href], summary");
  if (key === " ") return el.matches('button, input[type="checkbox"], input[type="radio"], summary');
  return false;
}

// 눌린 키에 맞는 단축키 이름을 찾는다.
function findShortcut(event, scope) {
  const hasModifier = event.ctrlKey || event.metaKey || event.altKey;
  const hasUndoModifier = (IS_MAC ? event.metaKey : event.ctrlKey) && !event.altKey && !event.shiftKey;
  const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
  // 한글 자판이면 event.key가 "ㅜ"처럼 오므로, 물리 키(event.code)로 영문자를 구한다.
  const isAsciiKey = key.length === 1 && key.charCodeAt(0) < 128;
  const codeLetter = !isAsciiKey && /^Key[A-Z]$/.test(event.code) ? event.code.slice(3).toLowerCase() : null;

  return Object.keys(SHORTCUTS).find((name) => {
    const shortcut = SHORTCUTS[name];
    if ((shortcut.scope ?? "page") !== scope) return false;
    if (shortcut.withModifier ? !hasUndoModifier : hasModifier) return false;
    return shortcut.keys.includes(key) || (codeLetter !== null && shortcut.keys.includes(codeLetter));
  });
}

// 모든 단축키를 여기서 처리한다 (document에 리스너 하나).
function handleShortcut(event) {
  // 다른 곳(수정 중 Enter/Esc 등)에서 이미 처리했거나 한글 조합 중이면 건드리지 않는다.
  if (event.defaultPrevented || event.isComposing || event.keyCode === 229) return;

  // 카테고리 편집 중에는 단축키를 쓰지 않는다. (Esc는 dialog 기본 동작으로 닫힌다)
  if (categoryDialogEl.open) return;

  // 도움말이 열려 있을 때는 ?로 닫기만 한다. (Esc는 dialog 기본 동작으로 닫힌다)
  if (helpDialogEl.open) {
    if (findShortcut(event, "page") === "toggleHelp") {
      event.preventDefault();
      closeHelp();
    }
    return;
  }

  const target = event.target;
  const isTyping = isTypingTarget(target);
  // 수정 중인 입력창은 목록의 keydown 리스너가 Enter/Esc를 처리한다.
  if (isTyping && target.closest(".is-editing")) return;

  const name = findShortcut(event, isTyping ? "input" : "page");
  if (!name || SHORTCUTS[name].native) return;

  // 버튼·체크박스에 포커스가 있으면 Space/Enter는 그 요소가 직접 처리한다.
  if (hasNativeKeyAction(target, event.key)) return;

  if (shortcutActions[name](event)) event.preventDefault();
}

// ---------- 이벤트 ----------

// Enter 키와 추가 버튼 모두 form submit으로 처리
formEl.addEventListener("submit", (event) => {
  event.preventDefault();
  const text = inputEl.value.trim().slice(0, MAX_LENGTH);
  if (text === "") {
    inputEl.value = "";
    setInputInvalid(true);
    inputEl.focus();
    return;
  }
  const category = isValidCategory(categoryEl.value) ? categoryEl.value : categories[0].id;

  // 현재 필터와 다른 카테고리여도 저장한다(목록에만 안 보일 뿐).
  addTodo(text, category);
  save();
  render();

  inputEl.value = "";
  inputEl.focus();
});

// 다시 입력하면 빈 값 강조 해제
inputEl.addEventListener("input", () => {
  if (inputEl.classList.contains("is-invalid")) setInputInvalid(false);
});

// 입력 영역 카테고리를 바꾸면 마지막 선택으로 기억
categoryEl.addEventListener("change", () => {
  if (!isValidCategory(categoryEl.value)) return;
  settings.lastCategory = categoryEl.value;
  save();
  render();
});

// 낮/밤 스위치
themeSwitchEl.addEventListener("click", toggleTheme);

// 필터 탭 (이벤트 위임)
filterEl.addEventListener("click", (event) => {
  const button = event.target.closest("[data-filter]");
  if (button) setFilter(button.dataset.filter);
});

// 되돌리기 버튼 (안내 안)
undoButtonEl.addEventListener("click", () => {
  const hadFocus = document.activeElement === undoButtonEl;
  if (undoDelete() && hadFocus) focusSelectedOrInput();
});

// 단축키 도움말
helpOpenEl.addEventListener("click", openHelp);
helpCloseEl.addEventListener("click", closeHelp);
helpDialogEl.addEventListener("close", () => {
  if (helpReturnFocus?.isConnected) helpReturnFocus.focus();
  helpReturnFocus = null;
});

// 카테고리 편집
categoryOpenEl.addEventListener("click", openCategoryEditor);
categoryCloseEl.addEventListener("click", () => categoryDialogEl.close());
categoryDialogEl.addEventListener("close", () => {
  showCategoryError(null);
  categoryAddInputEl.value = "";
  if (categoryReturnFocus?.isConnected) categoryReturnFocus.focus();
  categoryReturnFocus = null;
});

categoryAddFormEl.addEventListener("submit", (event) => {
  event.preventDefault();
  const name = categoryAddInputEl.value.trim().slice(0, CATEGORY_NAME_MAX);
  const error = validateCategoryName(name);
  if (error) {
    showCategoryError(error);
    categoryAddInputEl.focus();
    return;
  }
  if (!addCategory(name)) {
    showCategoryError(`카테고리는 최대 ${MAX_CATEGORIES}개까지예요`);
    return;
  }
  showCategoryError(null);
  categoryAddInputEl.value = "";
  save();
  render();
  renderCategoryEditor();
  if (categoryAddInputEl.disabled) categoryCloseEl.focus();
  else categoryAddInputEl.focus();
});

categoryAddInputEl.addEventListener("input", () => showCategoryError(null));

// 이름 칸: 포커스를 잃거나(change) Enter를 누르면 반영
categoryListEl.addEventListener("change", (event) => {
  if (event.target.matches(".category-name-input")) commitCategoryName(event.target);
});

categoryListEl.addEventListener("keydown", (event) => {
  if (!event.target.matches(".category-name-input") || event.isComposing || event.keyCode === 229) return;
  if (event.key === "Enter") {
    event.preventDefault();
    commitCategoryName(event.target);
  }
});

categoryListEl.addEventListener("input", () => showCategoryError(null));

// 삭제: 할 일이 있으면 함께 지워지므로 한 번 확인한다. 카테고리는 최소 1개 남긴다.
categoryListEl.addEventListener("click", (event) => {
  const button = event.target.closest(".category-delete");
  if (!button) return;
  const row = button.closest(".category-row");
  const category = getCategory(row.dataset.categoryId);
  if (!category) return;

  if (categories.length <= 1) {
    showCategoryError("카테고리는 최소 1개가 있어야 해요");
    return;
  }
  const count = todos.filter((todo) => todo.category === category.id).length;
  if (count > 0 && !window.confirm(`'${category.name}' 카테고리와 그 안의 할 일 ${count}개를 삭제할까요?`)) return;

  const index = categories.indexOf(category);
  deleteCategory(category.id);
  showCategoryError(null);
  save();
  render();
  renderCategoryEditor();
  // 같은 자리(없으면 위) 카테고리의 삭제 버튼으로 포커스를 옮긴다.
  const rows = categoryListEl.querySelectorAll(".category-delete");
  (rows[Math.min(index, rows.length - 1)] ?? categoryAddInputEl).focus();
});

document.addEventListener("keydown", handleShortcut);

// --- 목록 이벤트 위임 (모두 ul에 연결) ---

// 편집 중에 다른 항목을 누르면 입력창이 먼저 blur되어 목록이 다시 그려지고,
// 누른 버튼이 사라져 클릭이 씹힌다. 포커스 이동을 막고 click에서 순서대로 처리한다.
listEl.addEventListener("mousedown", (event) => {
  if (editingId === null) return;
  if (event.target.closest(".is-editing")) return;
  if (event.target.closest(".todo-item")) event.preventDefault();
});

// 항목 클릭(선택) · 체크박스 · 수정 · 삭제 버튼
listEl.addEventListener("click", (event) => {
  const li = event.target.closest(".todo-item");
  if (!li || li.classList.contains("is-editing")) return;
  const id = li.dataset.id;

  // 항목 어디를 눌러도 그 항목이 선택된다
  if (selectedId !== id) {
    selectedId = id;
    renderSelection();
  }

  const isCheck = event.target.matches(".todo-check");
  const isEdit = Boolean(event.target.closest(".btn-edit"));
  const isDelete = Boolean(event.target.closest(".btn-delete"));
  if (!isCheck && !isEdit && !isDelete) return;

  if (editingId !== null) commitEdit();

  if (isDelete) {
    deleteWithUndo(id);
    focusSelectedOrInput();
    return;
  }

  if (isCheck) toggleTodo(id, event.target.checked);
  else editingId = id;

  save();
  render();
  if (isCheck) {
    const todo = todos.find((item) => item.id === id);
    if (todo?.completed) celebrate(todo);
    focusInItem(id, ".todo-check");
  } else {
    focusEditInput();
  }
});

// Tab으로 항목 안 컨트롤에 들어오면 그 항목을 선택
listEl.addEventListener("focusin", (event) => {
  const li = event.target.closest(".todo-item");
  if (!li || li.classList.contains("is-editing") || li.dataset.id === selectedId) return;
  selectedId = li.dataset.id;
  renderSelection();
});

// 내용 더블클릭 → 편집 모드
listEl.addEventListener("dblclick", (event) => {
  if (!event.target.closest(".todo-text")) return;
  const li = event.target.closest(".todo-item");
  if (!li) return;

  if (editingId !== null) commitEdit();
  editingId = li.dataset.id;

  save();
  render();
  focusEditInput();
});

// 편집 중 Enter = 저장, Esc = 취소
listEl.addEventListener("keydown", (event) => {
  if (!event.target.closest(".is-editing")) return;
  // 한글 조합 중 Enter는 글자 확정용이므로 무시
  if (event.isComposing || event.keyCode === 229) return;
  if (event.key !== "Enter" && event.key !== "Escape") return;

  event.preventDefault();
  const id = editingId;
  if (event.key === "Enter") commitEdit();
  else cancelEdit();

  save();
  render();
  focusInItem(id, ".btn-edit");
});

// 편집 항목 밖으로 포커스가 나가면 저장 (입력창 ↔ select 이동은 제외)
listEl.addEventListener("focusout", (event) => {
  if (isRendering) return;
  const li = event.target.closest(".is-editing");
  if (!li || li.contains(event.relatedTarget)) return;

  commitEdit();
  save();
  render();
});

// ---------- 시작 ----------

bannerEl.hidden = storage !== null;
undoButtonEl.textContent = `되돌리기 (${MOD_LABEL}+Z)`;
load();
renderToday();
renderShortcutHelp();
placeIcons();
render();
