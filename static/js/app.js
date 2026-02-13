// ─── State ───────────────────────────────────────────────────────
let boardData = [];
let currentCard = null;

const API = '';

// ─── Init ────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    loadBoard();
    setupModalEvents();
    setupHeaderEvents();
});

async function loadBoard() {
    const res = await fetch(`${API}/api/board`);
    boardData = await res.json();
    renderBoard();
}

// ─── Render Board ────────────────────────────────────────────────
function renderBoard() {
    const board = document.getElementById('board');
    board.innerHTML = '';

    boardData.forEach(col => {
        board.appendChild(createColumnElement(col));
    });

    // Initialize SortableJS for column reordering
    new Sortable(board, {
        animation: 200,
        handle: '.column-header',
        draggable: '.column',
        ghostClass: 'dragging-column',
        chosenClass: 'chosen-column',
        dragClass: 'drag-column',
        direction: 'horizontal',
        onEnd: function (evt) {
            const newOrder = [...board.querySelectorAll('.column')].map(
                c => parseInt(c.dataset.columnId)
            );
            fetch(`${API}/api/columns/reorder`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ column_ids: newOrder })
            }).then(() => loadBoard());
        }
    });

    // Initialize SortableJS for card sorting within and between columns
    document.querySelectorAll('.card-list').forEach(cardList => {
        new Sortable(cardList, {
            group: 'cards',
            animation: 200,
            draggable: '.card',
            ghostClass: 'card-ghost',
            chosenClass: 'card-chosen',
            dragClass: 'card-drag',
            fallbackOnBody: true,
            swapThreshold: 0.65,
            onEnd: function (evt) {
                const cardId = parseInt(evt.item.dataset.cardId);
                const newColumnId = parseInt(evt.to.dataset.columnId);

                // Collect full card order for both source and target columns
                const cardUpdates = [];

                // Target column card order
                evt.to.querySelectorAll('.card').forEach((c, i) => {
                    cardUpdates.push({
                        id: parseInt(c.dataset.cardId),
                        column_id: newColumnId,
                        position: i
                    });
                });

                // Source column card order (if different from target)
                if (evt.from !== evt.to) {
                    const srcColumnId = parseInt(evt.from.dataset.columnId);
                    evt.from.querySelectorAll('.card').forEach((c, i) => {
                        cardUpdates.push({
                            id: parseInt(c.dataset.cardId),
                            column_id: srcColumnId,
                            position: i
                        });
                    });
                }

                fetch(`${API}/api/cards/reorder`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ cards: cardUpdates })
                }).then(() => loadBoard());
            }
        });
    });
}

function createColumnElement(col) {
    const el = document.createElement('div');
    el.className = 'column';
    el.dataset.columnId = col.id;

    // Column header
    const headerWrap = document.createElement('div');
    headerWrap.className = 'column-header-wrap';

    const header = document.createElement('div');
    header.className = 'column-header';

    const title = document.createElement('span');
    title.className = 'column-title';
    title.textContent = col.title;
    title.addEventListener('click', () => openRenameModal(col));

    const count = document.createElement('span');
    count.className = 'column-count';
    count.textContent = (col.cards || []).length;

    const menuBtn = document.createElement('button');
    menuBtn.className = 'column-menu-btn';
    menuBtn.innerHTML = '&#8943;';
    menuBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        closeAllMenus();
        const menu = headerWrap.querySelector('.column-menu');
        menu.classList.toggle('show');
    });

    header.appendChild(title);
    header.appendChild(count);
    header.appendChild(menuBtn);
    headerWrap.appendChild(header);

    // Dropdown menu
    const menu = document.createElement('div');
    menu.className = 'column-menu';

    const renameItem = document.createElement('button');
    renameItem.className = 'column-menu-item';
    renameItem.textContent = 'Rename List';
    renameItem.addEventListener('click', () => {
        closeAllMenus();
        openRenameModal(col);
    });

    const deleteItem = document.createElement('button');
    deleteItem.className = 'column-menu-item danger';
    deleteItem.textContent = 'Delete List';
    deleteItem.addEventListener('click', () => {
        closeAllMenus();
        if (confirm(`Delete "${col.title}" and all its cards?`)) {
            deleteColumn(col.id);
        }
    });

    menu.appendChild(renameItem);
    menu.appendChild(deleteItem);
    headerWrap.appendChild(menu);
    el.appendChild(headerWrap);

    // Card list
    const cardList = document.createElement('div');
    cardList.className = 'card-list';
    cardList.dataset.columnId = col.id;

    (col.cards || []).forEach(card => {
        cardList.appendChild(createCardElement(card));
    });

    el.appendChild(cardList);

    // Add card area
    const addArea = document.createElement('div');
    addArea.className = 'add-card-area';

    const addBtn = document.createElement('button');
    addBtn.className = 'btn-add-card';
    addBtn.innerHTML = `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
        </svg>
        Add a card
    `;

    const addForm = document.createElement('div');
    addForm.className = 'add-card-form';

    const addInput = document.createElement('textarea');
    addInput.className = 'add-card-input';
    addInput.placeholder = 'Enter a title for this card...';

    const addActions = document.createElement('div');
    addActions.className = 'add-card-actions';

    const submitBtn = document.createElement('button');
    submitBtn.className = 'btn-add-card-submit';
    submitBtn.textContent = 'Add Card';

    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'btn-add-card-cancel';
    cancelBtn.innerHTML = '&times;';

    addActions.appendChild(submitBtn);
    addActions.appendChild(cancelBtn);
    addForm.appendChild(addInput);
    addForm.appendChild(addActions);

    addBtn.addEventListener('click', () => {
        addBtn.style.display = 'none';
        addForm.classList.add('active');
        addInput.focus();
    });

    cancelBtn.addEventListener('click', () => {
        addForm.classList.remove('active');
        addBtn.style.display = 'flex';
        addInput.value = '';
    });

    submitBtn.addEventListener('click', () => {
        const title = addInput.value.trim();
        if (title) {
            createCard(col.id, title);
            addInput.value = '';
            addInput.focus();
        }
    });

    addInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            submitBtn.click();
        }
        if (e.key === 'Escape') {
            cancelBtn.click();
        }
    });

    addArea.appendChild(addBtn);
    addArea.appendChild(addForm);
    el.appendChild(addArea);

    return el;
}

function createCardElement(card) {
    const el = document.createElement('div');
    el.className = 'card';
    el.dataset.cardId = card.id;

    // Labels
    let labels = [];
    try {
        labels = JSON.parse(card.labels || '[]');
    } catch (e) {
        labels = [];
    }
    if (labels.length > 0) {
        const labelsDiv = document.createElement('div');
        labelsDiv.className = 'card-labels';
        labels.forEach(color => {
            const chip = document.createElement('span');
            chip.className = 'card-label';
            chip.style.background = color;
            labelsDiv.appendChild(chip);
        });
        el.appendChild(labelsDiv);
    }

    // Title
    const title = document.createElement('div');
    title.className = 'card-title';
    title.textContent = card.title;
    el.appendChild(title);

    // Description indicator
    if (card.description && card.description.trim()) {
        const indicator = document.createElement('div');
        indicator.className = 'card-desc-indicator';
        indicator.innerHTML = `
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14">
                <line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="15" y2="12"/><line x1="3" y1="18" x2="18" y2="18"/>
            </svg>
        `;
        el.appendChild(indicator);
    }

    // Click to open detail — only if not dragging
    el.addEventListener('mousedown', () => {
        el._wasDragged = false;
    });
    el.addEventListener('mousemove', () => {
        el._wasDragged = true;
    });
    el.addEventListener('click', () => {
        if (!el._wasDragged) {
            openCardModal(card);
        }
    });

    return el;
}

// ─── Close menus on outside click ────────────────────────────────
document.addEventListener('click', () => closeAllMenus());

function closeAllMenus() {
    document.querySelectorAll('.column-menu.show').forEach(m => m.classList.remove('show'));
}

// ─── API Calls ───────────────────────────────────────────────────
async function createCard(columnId, title) {
    await fetch(`${API}/api/cards`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ column_id: columnId, title })
    });
    loadBoard();
}

async function deleteColumn(colId) {
    await fetch(`${API}/api/columns/${colId}`, { method: 'DELETE' });
    loadBoard();
}

async function renameColumn(colId, newTitle) {
    await fetch(`${API}/api/columns/${colId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: newTitle })
    });
    loadBoard();
}

async function addColumn(title) {
    await fetch(`${API}/api/columns`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title })
    });
    loadBoard();
}

// ─── Card Modal ──────────────────────────────────────────────────
function openCardModal(card) {
    currentCard = card;
    const overlay = document.getElementById('modalOverlay');
    const titleInput = document.getElementById('modalTitle');
    const descArea = document.getElementById('modalDescription');
    const colSpan = document.getElementById('modalColumn');
    const createdSpan = document.getElementById('modalCreated');
    const moveSelect = document.getElementById('modalMoveSelect');

    titleInput.value = card.title;
    descArea.value = card.description || '';

    // Column info
    const col = boardData.find(c => c.id === card.column_id);
    colSpan.textContent = `in list "${col ? col.title : ''}"`;
    createdSpan.textContent = `Created: ${new Date(card.created_at).toLocaleDateString()}`;

    // Move-to dropdown
    moveSelect.innerHTML = '';
    boardData.forEach(c => {
        const opt = document.createElement('option');
        opt.value = c.id;
        opt.textContent = c.title;
        if (c.id === card.column_id) opt.selected = true;
        moveSelect.appendChild(opt);
    });

    // Labels
    let labels = [];
    try { labels = JSON.parse(card.labels || '[]'); } catch (e) { labels = []; }
    renderLabelChips(labels);

    // Reset to edit mode
    showEditMode();
    updatePreview();

    overlay.classList.add('show');
}

function renderLabelChips(labels) {
    const container = document.getElementById('labelChips');
    container.innerHTML = '';
    labels.forEach((color, idx) => {
        const chip = document.createElement('div');
        chip.className = 'label-chip';
        chip.style.background = color;
        chip.title = 'Click to remove';
        chip.addEventListener('click', () => {
            labels.splice(idx, 1);
            renderLabelChips(labels);
        });
        container.appendChild(chip);
    });
}

function showEditMode() {
    document.getElementById('modalDescription').style.display = 'block';
    document.getElementById('modalPreview').style.display = 'none';
    document.getElementById('btnEdit').classList.add('active');
    document.getElementById('btnPreview').classList.remove('active');
}

function showPreviewMode() {
    updatePreview();
    document.getElementById('modalDescription').style.display = 'none';
    document.getElementById('modalPreview').style.display = 'block';
    document.getElementById('btnPreview').classList.add('active');
    document.getElementById('btnEdit').classList.remove('active');
}

function updatePreview() {
    const desc = document.getElementById('modalDescription').value;
    const preview = document.getElementById('modalPreview');
    if (typeof marked !== 'undefined') {
        preview.innerHTML = marked.parse(desc || '*No description yet*');
    } else {
        preview.textContent = desc;
    }
}

function setupModalEvents() {
    // ── Card Detail Modal ──
    const overlay = document.getElementById('modalOverlay');
    const closeBtn = document.getElementById('modalClose');
    const saveBtn = document.getElementById('modalSave');
    const deleteBtn = document.getElementById('modalDelete');
    const editBtn = document.getElementById('btnEdit');
    const previewBtn = document.getElementById('btnPreview');
    const addLabelBtn = document.getElementById('addLabelBtn');
    const labelPicker = document.getElementById('labelPicker');

    closeBtn.addEventListener('click', () => {
        overlay.classList.remove('show');
        currentCard = null;
    });

    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
            overlay.classList.remove('show');
            currentCard = null;
        }
    });

    editBtn.addEventListener('click', showEditMode);
    previewBtn.addEventListener('click', showPreviewMode);

    // Label picker
    addLabelBtn.addEventListener('click', () => {
        labelPicker.style.display = labelPicker.style.display === 'none' ? 'flex' : 'none';
    });

    labelPicker.querySelectorAll('.label-color').forEach(colorEl => {
        colorEl.addEventListener('click', () => {
            const color = colorEl.dataset.color;
            const labels = getCurrentLabels();
            if (!labels.includes(color)) {
                labels.push(color);
                renderLabelChips(labels);
            }
            labelPicker.style.display = 'none';
        });
    });

    // Save card
    saveBtn.addEventListener('click', async () => {
        if (!currentCard) return;
        const title = document.getElementById('modalTitle').value.trim();
        const description = document.getElementById('modalDescription').value;
        const column_id = parseInt(document.getElementById('modalMoveSelect').value);
        const labels = JSON.stringify(getCurrentLabels());

        await fetch(`${API}/api/cards/${currentCard.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title, description, column_id, labels })
        });

        overlay.classList.remove('show');
        currentCard = null;
        loadBoard();
    });

    // Delete card
    deleteBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        if (!currentCard) return;
        if (confirm('Delete this card?')) {
            await fetch(`${API}/api/cards/${currentCard.id}`, { method: 'DELETE' });
            overlay.classList.remove('show');
            currentCard = null;
            loadBoard();
        }
    });

    // Escape to close
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            if (overlay.classList.contains('show')) {
                overlay.classList.remove('show');
                currentCard = null;
            }
            const addColOverlay = document.getElementById('addColumnOverlay');
            if (addColOverlay.style.display === 'flex') {
                addColOverlay.style.display = 'none';
            }
            const renameOvl = document.getElementById('renameOverlay');
            if (renameOvl.style.display === 'flex') {
                renameOvl.style.display = 'none';
            }
        }
    });

    // ── Rename Column Modal ──
    const renameOverlay = document.getElementById('renameOverlay');
    document.getElementById('renameClose').addEventListener('click', () => {
        renameOverlay.style.display = 'none';
    });
    renameOverlay.addEventListener('click', (e) => {
        if (e.target === renameOverlay) renameOverlay.style.display = 'none';
    });

    // ── Add Column Modal ──
    const addColOverlay = document.getElementById('addColumnOverlay');
    const addColInput = document.getElementById('addColumnInput');
    const addColSave = document.getElementById('addColumnSave');
    const addColCancel = document.getElementById('addColumnCancel');
    const addColClose = document.getElementById('addColumnClose');

    addColClose.addEventListener('click', () => {
        addColOverlay.style.display = 'none';
    });

    addColCancel.addEventListener('click', () => {
        addColOverlay.style.display = 'none';
    });

    addColOverlay.addEventListener('click', (e) => {
        if (e.target === addColOverlay) addColOverlay.style.display = 'none';
    });

    addColSave.addEventListener('click', () => {
        const title = addColInput.value.trim();
        if (title) {
            addColumn(title);
            addColInput.value = '';
            addColOverlay.style.display = 'none';
        }
    });

    addColInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            addColSave.click();
        }
        if (e.key === 'Escape') {
            addColOverlay.style.display = 'none';
        }
    });
}

function getCurrentLabels() {
    const chips = document.getElementById('labelChips').querySelectorAll('.label-chip');
    return [...chips].map(c => {
        const bg = c.style.background || c.style.backgroundColor;
        return rgbToHex(bg);
    });
}

function rgbToHex(color) {
    if (color.startsWith('#')) return color;
    const match = color.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
    if (match) {
        return '#' + [match[1], match[2], match[3]].map(x => {
            const hex = parseInt(x).toString(16);
            return hex.length === 1 ? '0' + hex : hex;
        }).join('');
    }
    return color;
}

// ─── Rename Column Modal ─────────────────────────────────────────
let renameColumnId = null;

function openRenameModal(col) {
    renameColumnId = col.id;
    const overlay = document.getElementById('renameOverlay');
    const input = document.getElementById('renameInput');
    input.value = col.title;
    overlay.style.display = 'flex';
    setTimeout(() => input.focus(), 100);

    const saveBtn = document.getElementById('renameSave');
    const newSave = saveBtn.cloneNode(true);
    saveBtn.parentNode.replaceChild(newSave, saveBtn);
    newSave.addEventListener('click', () => {
        const newTitle = input.value.trim();
        if (newTitle && renameColumnId) {
            renameColumn(renameColumnId, newTitle);
        }
        overlay.style.display = 'none';
    });

    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            newSave.click();
        }
        if (e.key === 'Escape') {
            overlay.style.display = 'none';
        }
    });
}

// ─── Header Events ───────────────────────────────────────────────
function setupHeaderEvents() {
    document.getElementById('addColumnBtn').addEventListener('click', () => {
        const overlay = document.getElementById('addColumnOverlay');
        const input = document.getElementById('addColumnInput');
        input.value = '';
        overlay.style.display = 'flex';
        setTimeout(() => input.focus(), 100);
    });
}
