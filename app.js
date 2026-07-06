(function () {
  'use strict';

  const { CATEGORY, TAG, classifyLog } = window.VoiceLogClassifier;

  const STORAGE_KEY = 'voiceLogOrganizer.entries.v1';

  const CATEGORY_LABELS = {
    [CATEGORY.DIARY]: 'Diary log',
    [CATEGORY.REMINDER]: 'Reminder',
    [CATEGORY.OTHER]: 'Other/organizing'
  };
  const TAG_LABELS = { [TAG.WORK]: 'Work', [TAG.PERSONAL]: 'Personal' };

  // ---------- storage ----------

  function loadEntries() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (err) {
      console.error('Failed to load logs from localStorage', err);
      return [];
    }
  }

  function saveEntries(entries) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  }

  let entries = loadEntries();

  function addEntry(text) {
    const result = classifyLog(text);
    const entry = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      text: text.trim(),
      createdAt: new Date().toISOString(),
      category: result.category,
      tag: result.tag,
      reminderDateTime: result.dateTimeText,
      autoCategory: result.category,
      autoTag: result.tag
    };
    entries.unshift(entry);
    saveEntries(entries);
    return entry;
  }

  function updateEntry(id, patch) {
    const entry = entries.find((e) => e.id === id);
    if (!entry) return;
    Object.assign(entry, patch);
    saveEntries(entries);
  }

  function deleteEntry(id) {
    entries = entries.filter((e) => e.id !== id);
    saveEntries(entries);
  }

  // ---------- view switching ----------

  const viewTabs = document.querySelectorAll('.view-tab');
  const captureView = document.getElementById('capture-view');
  const browseView = document.getElementById('browse-view');

  viewTabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      viewTabs.forEach((t) => {
        t.classList.toggle('active', t === tab);
        t.setAttribute('aria-selected', String(t === tab));
      });
      const isCapture = tab.dataset.view === 'capture';
      captureView.hidden = !isCapture;
      browseView.hidden = isCapture;
      if (!isCapture) renderEntryList();
    });
  });

  // ---------- capture: text + live classification preview ----------

  const logTextEl = document.getElementById('log-text');
  const previewCategoryEl = document.getElementById('preview-category');
  const previewTagEl = document.getElementById('preview-tag');
  const previewDateTimeEl = document.getElementById('preview-datetime');
  const saveBtn = document.getElementById('save-btn');
  const saveStatusEl = document.getElementById('save-status');

  function updatePreview() {
    const text = logTextEl.value.trim();
    if (!text) {
      previewCategoryEl.textContent = CATEGORY_LABELS[CATEGORY.OTHER];
      previewCategoryEl.className = 'badge category-badge category-other';
      previewTagEl.textContent = TAG_LABELS[TAG.PERSONAL];
      previewTagEl.className = 'badge tag-badge tag-personal';
      previewDateTimeEl.textContent = '';
      saveBtn.disabled = true;
      return;
    }
    saveBtn.disabled = false;
    const result = classifyLog(text);
    previewCategoryEl.textContent = CATEGORY_LABELS[result.category];
    previewCategoryEl.className = `badge category-badge category-${result.category}`;
    previewTagEl.textContent = TAG_LABELS[result.tag];
    previewTagEl.className = `badge tag-badge tag-${result.tag}`;
    previewDateTimeEl.textContent = result.dateTimeText ? `📅 ${result.dateTimeText}` : '';
  }

  logTextEl.addEventListener('input', updatePreview);

  saveBtn.addEventListener('click', () => {
    const text = logTextEl.value.trim();
    if (!text) return;
    const entry = addEntry(text);
    logTextEl.value = '';
    updatePreview();
    saveStatusEl.textContent =
      `Saved as ${CATEGORY_LABELS[entry.category]} · ${TAG_LABELS[entry.tag]}.`;
    setTimeout(() => { saveStatusEl.textContent = ''; }, 4000);
  });

  updatePreview();

  // ---------- capture: speech recognition ----------

  const micBtn = document.getElementById('mic-btn');
  const micStatusEl = document.getElementById('mic-status');
  const supportHintEl = document.getElementById('speech-support-hint');

  const SpeechRecognitionImpl = window.SpeechRecognition || window.webkitSpeechRecognition;
  let recognition = null;
  let isRecording = false;
  let baseTextBeforeRecording = '';

  if (!SpeechRecognitionImpl) {
    micBtn.disabled = true;
    micBtn.textContent = '🎤 Voice input not supported';
    supportHintEl.textContent =
      'Your browser does not support the Web Speech API (this is common outside Chrome/Edge). Type or paste your log below instead.';
  } else {
    supportHintEl.textContent =
      'Voice input uses your browser\'s built-in speech recognition (Chrome/Edge work best). It needs microphone permission and, outside localhost, an HTTPS page.';

    recognition = new SpeechRecognitionImpl();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.addEventListener('result', (event) => {
      let interim = '';
      let final = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) final += transcript;
        else interim += transcript;
      }
      const base = baseTextBeforeRecording ? `${baseTextBeforeRecording} ` : '';
      logTextEl.value = (base + final + interim).trim();
      if (final) baseTextBeforeRecording = logTextEl.value;
      updatePreview();
    });

    recognition.addEventListener('error', (event) => {
      micStatusEl.textContent = `Mic error: ${event.error}`;
      stopRecording();
    });

    recognition.addEventListener('end', () => {
      if (isRecording) {
        // Some browsers stop automatically after a pause; restart if the
        // user hasn't explicitly clicked "stop" yet.
        try { recognition.start(); } catch (err) { stopRecording(); }
      }
    });
  }

  function startRecording() {
    if (!recognition) return;
    baseTextBeforeRecording = logTextEl.value.trim();
    try {
      recognition.start();
    } catch (err) {
      micStatusEl.textContent = 'Could not start microphone.';
      return;
    }
    isRecording = true;
    micBtn.textContent = '⏹ Stop recording';
    micBtn.classList.add('recording');
    micStatusEl.textContent = 'Listening…';
  }

  function stopRecording() {
    isRecording = false;
    if (recognition) {
      try { recognition.stop(); } catch (err) { /* already stopped */ }
    }
    micBtn.textContent = '🎤 Start recording';
    micBtn.classList.remove('recording');
    micStatusEl.textContent = '';
  }

  if (recognition) {
    micBtn.addEventListener('click', () => {
      if (isRecording) stopRecording();
      else startRecording();
    });
  }

  // ---------- browse: filters + rendering ----------

  const tagTabs = document.querySelectorAll('.tag-tab');
  const catFilters = document.querySelectorAll('.cat-filter');
  const reminderSortControls = document.getElementById('reminder-sort-controls');
  const reminderSortSelect = document.getElementById('reminder-sort');
  const entryListEl = document.getElementById('entry-list');
  const emptyStateEl = document.getElementById('empty-state');

  let activeTag = 'work';
  let activeCategory = 'all';

  tagTabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      activeTag = tab.dataset.tag;
      tagTabs.forEach((t) => t.classList.toggle('active', t === tab));
      renderEntryList();
    });
  });

  catFilters.forEach((btn) => {
    btn.addEventListener('click', () => {
      activeCategory = btn.dataset.category;
      catFilters.forEach((b) => b.classList.toggle('active', b === btn));
      renderEntryList();
    });
  });

  reminderSortSelect.addEventListener('change', renderEntryList);

  function parseReminderTimestamp(entry) {
    if (!entry.reminderDateTime) return Infinity;
    const parsed = Date.parse(`${entry.reminderDateTime} ${new Date().getFullYear()}`);
    return Number.isNaN(parsed) ? Infinity : parsed;
  }

  function renderEntryList() {
    const showingReminders = activeCategory === CATEGORY.REMINDER;
    reminderSortControls.hidden = !showingReminders;

    let filtered = entries.filter((e) => e.tag === activeTag);
    if (activeCategory !== 'all') {
      filtered = filtered.filter((e) => e.category === activeCategory);
    }

    if (showingReminders && reminderSortSelect.value === 'upcoming') {
      filtered = filtered.slice().sort((a, b) => parseReminderTimestamp(a) - parseReminderTimestamp(b));
    } else {
      filtered = filtered.slice().sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    }

    entryListEl.innerHTML = '';
    emptyStateEl.hidden = filtered.length > 0;

    filtered.forEach((entry) => {
      entryListEl.appendChild(renderEntryCard(entry));
    });
  }

  function renderEntryCard(entry) {
    const card = document.createElement('div');
    card.className = `entry-card category-${entry.category}`;

    const top = document.createElement('div');
    top.className = 'entry-top';

    const catBadge = document.createElement('span');
    catBadge.className = `badge category-badge category-${entry.category}`;
    catBadge.textContent = CATEGORY_LABELS[entry.category];
    top.appendChild(catBadge);

    const tagBadge = document.createElement('span');
    tagBadge.className = `badge tag-badge tag-${entry.tag}`;
    tagBadge.textContent = TAG_LABELS[entry.tag];
    top.appendChild(tagBadge);

    const meta = document.createElement('span');
    meta.className = 'entry-meta';
    meta.textContent = new Date(entry.createdAt).toLocaleString();
    top.appendChild(meta);

    card.appendChild(top);

    if (entry.category === CATEGORY.REMINDER && entry.reminderDateTime) {
      const time = document.createElement('div');
      time.className = 'entry-reminder-time';
      time.textContent = `⏰ ${entry.reminderDateTime}`;
      card.appendChild(time);
    }

    const text = document.createElement('p');
    text.className = 'entry-text';
    text.textContent = entry.text;
    card.appendChild(text);

    const controls = document.createElement('div');
    controls.className = 'entry-controls';

    const catLabel = document.createElement('label');
    catLabel.textContent = 'Category: ';
    const catSelect = document.createElement('select');
    Object.values(CATEGORY).forEach((cat) => {
      const opt = document.createElement('option');
      opt.value = cat;
      opt.textContent = CATEGORY_LABELS[cat];
      if (cat === entry.category) opt.selected = true;
      catSelect.appendChild(opt);
    });
    catSelect.addEventListener('change', () => {
      updateEntry(entry.id, { category: catSelect.value });
      renderEntryList();
    });
    catLabel.appendChild(catSelect);
    controls.appendChild(catLabel);

    const tagLabel = document.createElement('label');
    tagLabel.textContent = 'Tag: ';
    const tagSelect = document.createElement('select');
    Object.values(TAG).forEach((tag) => {
      const opt = document.createElement('option');
      opt.value = tag;
      opt.textContent = TAG_LABELS[tag];
      if (tag === entry.tag) opt.selected = true;
      tagSelect.appendChild(opt);
    });
    tagSelect.addEventListener('change', () => {
      updateEntry(entry.id, { tag: tagSelect.value });
      renderEntryList();
    });
    tagLabel.appendChild(tagSelect);
    controls.appendChild(tagLabel);

    const deleteBtn = document.createElement('button');
    deleteBtn.type = 'button';
    deleteBtn.className = 'delete-btn';
    deleteBtn.textContent = 'Delete';
    deleteBtn.addEventListener('click', () => {
      deleteEntry(entry.id);
      renderEntryList();
    });
    controls.appendChild(deleteBtn);

    card.appendChild(controls);
    return card;
  }

  renderEntryList();

  // ---------- PWA service worker (best-effort; safe to ignore if unsupported) ----------

  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('sw.js').catch(() => {});
    });
  }
})();
