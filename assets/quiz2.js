// English Club 8 – Selbsttest-Engine, Version 2 (ab Woche 19.10.).
// Kann alles wie quiz.js (choice, type, build, say) und zusätzlich:
//   multi  – eine Aufgabe mit mehreren Teilfragen (Eintippen, Auswählen, Satz bauen), alle werden zusammen geprüft
//   order  – Dialogzeilen in die richtige Reihenfolge bringen (mit ▲ ▼, gut für Touch)
//   record – Sprechen: anhören, sich selbst aufnehmen, anhören, mit Musterantwort vergleichen, selbst einschätzen
// Es wird nichts verschickt. Aufnahmen bleiben nur im Arbeitsspeicher und sind beim nächsten Schritt gelöscht.
// Auf dem Gerät bleibt nur das "erledigt"-Häkchen (localStorage).
(function () {
  const Q = window.QUIZ;
  const $ = (s) => document.querySelector(s);
  const menu = $("#menu"), quiz = $("#quiz"), card = $("#card"), bar = $("#bar");
  const KEY = "ec8-" + Q.id;
  const load = () => { try { return JSON.parse(localStorage.getItem(KEY) || "{}"); } catch (e) { return {}; } };
  const save = (o) => { try { localStorage.setItem(KEY, JSON.stringify(o)); } catch (e) {} };
  const norm = (s) => String(s).toLowerCase().replace(/[’‘`´']/g, "'").replace(/[.!?,;:]/g, "").replace(/\$\s+/g, "$").replace(/\s+/g, " ").trim();
  const shuffle = (a) => { const b = a.slice(); for (let k = b.length - 1; k > 0; k--) { const j = Math.floor(Math.random() * (k + 1)); [b[k], b[j]] = [b[j], b[k]]; } return b; };
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };

  function renderMenu() {
    stopRecording();
    const done = load();
    const box = $("#levels"); box.innerHTML = "";
    Q.levels.forEach((lv, n) => {
      if (lv.hidden) return;
      const b = el("button", "level-btn" + (lv.stars > 3 ? " mega" : ""));
      b.innerHTML = `<span class="stars">${"★".repeat(lv.stars)}${"☆".repeat(Math.max(0, 3 - lv.stars))}</span>
        <span><b>${esc(lv.name)}</b><small>${esc(lv.desc)} · ${lv.tasks.length} Aufgaben</small></span>
        ${done[n] ? `<span class="done">✓ ${done[n]}</span>` : ""}`;
      b.onclick = () => start(n);
      box.appendChild(b);
    });
    menu.hidden = false; quiz.hidden = true;
  }

  let lvl, list, pos, score, firstTry, retry;
  function start(n) {
    lvl = n; list = Q.levels[n].ordered ? Q.levels[n].tasks.slice() : shuffle(Q.levels[n].tasks); pos = 0; score = 0; retry = [];
    menu.hidden = true; quiz.hidden = false; window.scrollTo(0, 0); render();
  }

  // ---------- Vorlesen (eingebaute Stimme des Geräts, offline) ----------
  function enVoices() {
    const vs = window.speechSynthesis.getVoices().filter((x) => /^en/i.test(x.lang));
    const pref = (x) => (/en[-_]US/i.test(x.lang) ? 0 : 1) + (/Samantha|Google US|Aria|Jenny/i.test(x.name) ? -1 : 0);
    return vs.sort((a, b) => pref(a) - pref(b));
  }
  // text = "Satz" oder [["A","Satz"],["B","Satz"], …] für Dialoge mit zwei Stimmen
  function speak(text, rate) {
    if (!("speechSynthesis" in window)) { cantSpeak(); return; }
    const synth = window.speechSynthesis; synth.cancel();
    const vs = enVoices();
    const parts = Array.isArray(text) ? text : [["A", text]];
    parts.forEach(([who, line]) => {
      const u = new SpeechSynthesisUtterance(line);
      const v = who === "B" ? (vs.find((x) => vs[0] && x.name !== vs[0].name && /en[-_]US/i.test(x.lang)) || vs[1] || vs[0]) : vs[0];
      if (v) { u.voice = v; u.lang = v.lang; } else u.lang = "en-US";
      u.rate = rate || 0.9;
      u.pitch = who === "B" && (!v || !vs[0] || v.name === vs[0].name) ? 1.35 : 1;
      synth.speak(u);
    });
  }
  function cantSpeak() { if (card.querySelector(".nospeak")) return; card.appendChild(el("p", "hint nospeak", "Dein Gerät kann leider nicht vorlesen.")); }
  if ("speechSynthesis" in window) { window.speechSynthesis.getVoices(); window.speechSynthesis.onvoiceschanged = () => window.speechSynthesis.getVoices(); }
  function listenButtons(say, autoplay) {
    const bx = el("div", "actions"); bx.style.margin = "0 0 14px";
    const b1 = el("button", "btn listen", "🔊 Anhören"); b1.onclick = () => speak(say, 0.9);
    const b2 = el("button", "btn secondary", "🐢 Langsam"); b2.onclick = () => speak(say, 0.6);
    bx.append(b1, b2);
    if (autoplay) speak(say, 0.9);
    return bx;
  }

  const MAX_TRIES = 3;
  let wrong = 0, tipUsed = false;

  // ---------- Antwort-Text für "Die richtige Antwort ist …" ----------
  const itemAnswer = (it) => it.kind === "choice" ? it.answer : it.kind === "build" ? it.sentence : (it.show || it.answers[0]);
  const answerText = (t) => {
    if (t.type === "choice") return t.answer;
    if (t.type === "type") return t.answers[0];
    if (t.type === "build") return t.sentence;
    if (t.type === "order") return t.lines.map((l) => (l.who ? l.who + ": " : "") + l.text).join(" / ");
    if (t.type === "multi") return t.items.map(itemAnswer).join(" · ");
    return "";
  };

  function nextButton() {
    const n = el("button", "btn", pos < list.length - 1 ? "Weiter →" : "Ergebnis");
    n.onclick = () => { stopRecording(); pos++; render(); };
    const a = el("div", "actions"); a.appendChild(n); card.appendChild(a);
    n.focus();
  }

  function feedback(ok, task, opts = {}) {
    const old = card.querySelector(".fb:not(.tipbox)"); if (old) old.remove();
    const d = el("div");
    if (ok) {
      d.className = "fb ok";
      d.innerHTML = `✓ Richtig!<small>${esc(task.why || "")}</small>`;
      card.appendChild(d);
      if (firstTry && !tipUsed) score++;
      if (opts.after) opts.after();
      nextButton();
      return;
    }
    wrong++;
    if (firstTry) { firstTry = false; retry.push(task); }
    if (wrong >= MAX_TRIES) {
      d.className = "fb reveal";
      d.innerHTML = task.type === "multi" || task.type === "order"
        ? `Die richtigen Lösungen stehen jetzt bei jeder Teilaufgabe. Lies sie dir genau durch.<small>${esc(task.why || "")}</small>`
        : `Die richtige Antwort ist: <b>${esc(answerText(task))}</b><small>${esc(task.why || "")}</small>`;
      card.appendChild(d);
      card.querySelectorAll(".opts:not(.item-opts) .opt").forEach((b) => { if (b.textContent === task.answer) b.classList.add("right"); });
      card.querySelectorAll(".tipbtn, .checkbtn").forEach((b) => (b.disabled = true));
      if (opts.reveal) opts.reveal();
      if (opts.after) opts.after();
      nextButton();
      return;
    }
    d.className = "fb no";
    const msg = opts.partial || "";
    d.innerHTML = `✗ Noch nicht – Versuch ${wrong} von ${MAX_TRIES}.<small>${esc(msg)}${msg ? " " : ""}${wrong === MAX_TRIES - 1 ? "Noch ein Versuch, dann siehst du die Lösung." : "Tipp gefällig? Tippe auf 💡."}</small>`;
    card.appendChild(d);
  }
  const solved = () => !!card.querySelector(".fb.ok, .fb.reveal");

  // ---------- Tipp ----------
  function giveTip(t, btn) {
    if (solved() || tipUsed) return;
    tipUsed = true; btn.disabled = true;
    let text = t.tip ? t.tip : "";
    if (t.type === "type") {
      const a = t.answers[0], letters = a.replace(/[^A-Za-z]/g, "").length;
      text = (text ? text + " · " : "") + (/\s/.test(a) ? `Die Antwort beginnt mit „${a[0]}“ und hat ${a.split(" ").length} Wörter.` : `Das Wort beginnt mit „${a[0]}“ und hat ${letters} Buchstaben.`);
    } else if (t.type === "choice") {
      const wrongBtns = [...card.querySelectorAll(".opt")].filter((b) => b.textContent !== t.answer && !b.classList.contains("wrong") && !b.disabled);
      if (wrongBtns.length > 1) { const w = wrongBtns[0]; w.disabled = true; w.classList.add("struck"); text = (text ? text + " · " : "") + "Eine falsche Antwort ist durchgestrichen."; }
      else if (!text) text = Q.choiceTip || "Lies den Satz noch einmal genau.";
    } else if (t.type === "build") {
      const w = t.sentence.split(" ");
      text = (text ? text + " · " : "") + `Der Satz beginnt mit „${w.slice(0, 2).join(" ")} …“.`;
    } else if (t.type === "order") {
      text = (text ? text + " · " : "") + `Die erste Zeile ist: „${t.lines[0].text}“`;
    } else if (t.type === "multi") {
      // Tipp zu den Teilfragen, die noch nicht stimmen
      const open = [...card.querySelectorAll(".item:not(.ok)")].map((n) => n.__tip).filter(Boolean);
      text = (text ? text + " · " : "") + (open.length ? open.join(" · ") : "");
      if (!text) text = "Lies jeden Satz noch einmal genau.";
    }
    const box = el("div", "fb tipbox"); box.innerHTML = `💡 ${esc(text)}`;
    const after = card.querySelector(".fb:not(.tipbox)");
    after ? card.insertBefore(box, after) : card.appendChild(box);
  }
  function tipButton(t) {
    const b = el("button", "btn secondary tipbtn", "💡 Tipp");
    b.onclick = () => giveTip(t, b); return b;
  }

  // ---------- Bausteine für Teilfragen ----------
  // Prüft eine getippte Antwort: exakte Liste (answers) oder Regeln (rules = Liste von Wortgruppen, jede Gruppe muss vorkommen)
  function typedOk(spec, value) {
    const v = norm(value);
    if (!v) return false;
    if (spec.answers && spec.answers.some((a) => norm(a) === v)) return true;
    if (spec.rules) return spec.rules.every((group) => group.some((g) => v.includes(norm(g))));
    return false;
  }
  function makeTyped(spec) {
    const inp = el("input");
    Object.assign(inp, { type: "text", autocomplete: "off", spellcheck: false, placeholder: spec.placeholder || "Deine Antwort …" });
    inp.setAttribute("autocapitalize", "off"); inp.setAttribute("autocorrect", "off");
    return { node: inp, value: () => inp.value, lock: () => (inp.readOnly = true), show: (txt) => { inp.value = txt; inp.readOnly = true; } };
  }
  function makeChoice(spec, keep) {
    const box = el("div", "opts item-opts" + (spec.options.some((o) => o.length > 14) ? " wide" : ""));
    let picked = null;
    (keep ? spec.options : shuffle(spec.options)).forEach((o) => {
      const b = el("button", "opt", o);
      b.onclick = () => { if (box.dataset.locked) return; box.querySelectorAll(".opt").forEach((x) => x.classList.remove("picked", "wrong")); b.classList.add("picked"); picked = o; };
      box.appendChild(b);
    });
    return {
      node: box, value: () => picked,
      lock: () => (box.dataset.locked = "1"),
      mark: (ok) => box.querySelectorAll(".opt.picked").forEach((b) => b.classList.add(ok ? "right" : "wrong")),
      show: (txt) => { box.dataset.locked = "1"; box.querySelectorAll(".opt").forEach((b) => { b.classList.remove("picked", "wrong"); if (b.textContent === txt) b.classList.add("right"); }); },
    };
  }
  function makeBuild(spec) {
    const wrap = el("div", "buildbox");
    const line = el("div", "line"), pool = el("div", "tiles");
    shuffle(spec.sentence.split(" ")).forEach((w) => {
      const tile = el("button", "tile", w);
      tile.onclick = () => { if (wrap.dataset.locked) return; (tile.parentNode === pool ? line : pool).appendChild(tile); };
      pool.appendChild(tile);
    });
    wrap.append(line, pool);
    return {
      node: wrap, value: () => [...line.children].map((x) => x.textContent).join(" "),
      lock: () => (wrap.dataset.locked = "1"),
      show: (txt) => { wrap.dataset.locked = "1"; line.innerHTML = ""; pool.innerHTML = ""; txt.split(" ").forEach((w) => line.appendChild(el("span", "tile done-tile", w))); },
    };
  }

  // ---------- Aufgabe: multi ----------
  function renderMulti(t) {
    const lv = Q.levels[lvl];
    const listBox = el("div", "items");
    const parts = t.items.map((it, i) => {
      const row = el("div", "item");
      row.__tip = it.tip || "";
      const head = el("div", "item-head");
      head.appendChild(el("span", "item-no", String(i + 1)));
      const lab = el("span", "item-label"); lab.textContent = it.label || ""; head.appendChild(lab);
      row.appendChild(head);
      if (it.say) row.appendChild(listenButtons(it.say, false));
      const ctl = it.kind === "choice" ? makeChoice(it, lv.keepOptions || it.keep) : it.kind === "build" ? makeBuild(it) : makeTyped(it);
      row.appendChild(ctl.node);
      const note = el("div", "item-note"); note.hidden = true; row.appendChild(note);
      listBox.appendChild(row);
      const check = () => it.kind === "choice" ? ctl.value() === it.answer : it.kind === "build" ? ctl.value() === it.sentence : typedOk(it, ctl.value());
      return { it, row, ctl, note, check, done: false };
    });
    const b = el("button", "btn checkbtn", "Prüfen");
    b.onclick = () => {
      if (solved()) return;
      let allOk = true, missing = 0, wrongN = 0;
      parts.forEach((p) => {
        if (p.done) return;
        const empty = !p.ctl.value();
        const ok = !empty && p.check();
        p.row.classList.remove("bad");
        if (ok) {
          p.done = true; p.row.classList.add("ok"); p.ctl.lock(); if (p.ctl.mark) p.ctl.mark(true);
          if (p.it.why) { p.note.hidden = false; p.note.className = "item-note good"; p.note.textContent = "✓ " + p.it.why; }
        } else {
          allOk = false; if (empty) missing++; else wrongN++;
          p.row.classList.add("bad"); if (p.ctl.mark && !empty) p.ctl.mark(false);
          if (!empty && p.it.hint) { p.note.hidden = false; p.note.className = "item-note badnote"; p.note.textContent = "✗ " + p.it.hint; }
          else p.note.hidden = true;
        }
      });
      const partial = allOk ? "" : `${parts.filter((p) => p.done).length} von ${parts.length} richtig.` + (missing ? ` ${missing} noch leer.` : "");
      feedback(allOk, t, {
        partial,
        reveal: () => parts.forEach((p) => {
          if (p.done) return;
          p.ctl.show(itemAnswer(p.it)); p.row.classList.remove("bad"); p.row.classList.add("shown");
          p.note.hidden = false; p.note.className = "item-note good"; p.note.textContent = "→ " + itemAnswer(p.it) + (p.it.why ? " · " + p.it.why : "");
        }),
      });
    };
    const a = el("div", "actions"); a.append(b, tipButton(t));
    card.append(listBox, a);
  }

  // ---------- Aufgabe: order ----------
  function renderOrder(t) {
    const box = el("ol", "order");
    let rows = shuffle(t.lines.map((l, i) => ({ ...l, i })));
    if (rows.every((r, k) => r.i === k)) rows = rows.reverse(); // nie schon gelöst anzeigen
    const draw = () => {
      box.innerHTML = "";
      rows.forEach((r, k) => {
        const li = el("li", "ord-row" + (r.who === "B" ? " who-b" : ""));
        const txt = el("span", "ord-text");
        if (r.who) txt.appendChild(el("b", "who", r.who === "A" ? (t.names ? t.names[0] : "A") : (t.names ? t.names[1] : "B")));
        txt.appendChild(document.createTextNode(r.text));
        const up = el("button", "ord-btn", "▲"); up.setAttribute("aria-label", "nach oben"); up.disabled = k === 0;
        const dn = el("button", "ord-btn", "▼"); dn.setAttribute("aria-label", "nach unten"); dn.disabled = k === rows.length - 1;
        up.onclick = () => { if (box.dataset.locked) return; [rows[k - 1], rows[k]] = [rows[k], rows[k - 1]]; draw(); };
        dn.onclick = () => { if (box.dataset.locked) return; [rows[k + 1], rows[k]] = [rows[k], rows[k + 1]]; draw(); };
        const btns = el("span", "ord-btns"); btns.append(up, dn);
        li.append(txt, btns); box.appendChild(li);
      });
    };
    draw();
    const after = () => {
      box.dataset.locked = "1"; box.querySelectorAll(".ord-btn").forEach((b) => (b.disabled = true));
      if (t.say !== false) {
        const say = t.lines.map((l) => [l.who || "A", l.text]);
        const bx = el("div", "actions");
        const b1 = el("button", "btn listen", "🔊 Dialog anhören"); b1.onclick = () => speak(say, 0.9);
        bx.appendChild(b1); card.appendChild(bx);
      }
    };
    const b = el("button", "btn checkbtn", "Prüfen");
    b.onclick = () => {
      if (solved()) return;
      const okN = rows.filter((r, k) => r.i === k).length;
      const ok = okN === rows.length;
      box.querySelectorAll(".ord-row").forEach((li, k) => { li.classList.toggle("ok", rows[k].i === k); li.classList.toggle("bad", rows[k].i !== k); });
      feedback(ok, t, {
        partial: ok ? "" : `${okN} von ${rows.length} Zeilen stehen schon richtig (grün).`,
        reveal: () => { rows = t.lines.map((l, i) => ({ ...l, i })); draw(); box.querySelectorAll(".ord-row").forEach((li) => li.classList.add("ok")); },
        after,
      });
    };
    const a = el("div", "actions"); a.append(b, tipButton(t));
    card.append(box, a);
  }

  // ---------- Aufgabe: record (Sprechen) ----------
  let rec = null, recStream = null, recUrl = null;
  function stopRecording() {
    try { if (rec && rec.state !== "inactive") rec.stop(); } catch (e) {}
    if (recStream) recStream.getTracks().forEach((tr) => tr.stop());
    if (recUrl) URL.revokeObjectURL(recUrl);
    rec = null; recStream = null; recUrl = null;
  }
  function renderRecord(t) {
    const steps = el("ol", "steps");
    (t.steps || []).forEach((s) => steps.appendChild(el("li", null, s)));
    if (t.steps) card.appendChild(steps);
    if (t.say) card.appendChild(listenButtons(t.say, false));

    const canRec = !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia && window.MediaRecorder);
    const recBox = el("div", "recbox");
    const status = el("p", "hint rec-status", canRec ? "Tippe auf ● und sprich deine Antwort. Tippe auf ■, wenn du fertig bist." : "Aufnehmen geht auf diesem Gerät nicht. Sprich deine Antwort einfach laut.");
    const recBtn = el("button", "btn rec", "● Aufnehmen");
    const playBtn = el("button", "btn secondary", "▶ Meine Aufnahme"); playBtn.disabled = true;
    const audio = el("audio"); audio.hidden = true;
    if (canRec) {
      recBtn.onclick = async () => {
        if (rec && rec.state === "recording") { rec.stop(); return; }
        stopRecording();
        try {
          recStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        } catch (e) { status.textContent = "Das Mikrofon ist nicht erlaubt. Sprich deine Antwort einfach laut."; return; }
        const chunks = [];
        rec = new MediaRecorder(recStream);
        rec.ondataavailable = (e) => { if (e.data && e.data.size) chunks.push(e.data); };
        rec.onstop = () => {
          if (recStream) recStream.getTracks().forEach((tr) => tr.stop());
          recStream = null;
          if (recUrl) URL.revokeObjectURL(recUrl);
          recUrl = URL.createObjectURL(new Blob(chunks, { type: rec && rec.mimeType ? rec.mimeType : "audio/mp4" }));
          audio.src = recUrl; playBtn.disabled = false;
          recBtn.textContent = "● Nochmal aufnehmen"; recBtn.classList.remove("on");
          status.textContent = "Hör dir deine Aufnahme an und vergleiche mit der Musterantwort.";
          modelBtn.disabled = false;
        };
        rec.start();
        recBtn.textContent = "■ Stopp"; recBtn.classList.add("on");
        status.textContent = "Aufnahme läuft … sprich jetzt!";
      };
      playBtn.onclick = () => { audio.currentTime = 0; audio.play(); };
      recBox.append(status, el("div", "actions"));
      recBox.lastChild.append(recBtn, playBtn);
      recBox.appendChild(audio);
    } else {
      recBox.appendChild(status);
    }
    card.appendChild(recBox);

    // Musterantwort
    const modelWrap = el("div", "model"); modelWrap.hidden = true;
    modelWrap.appendChild(el("div", "label", "Musterantwort"));
    modelWrap.appendChild(el("p", "model-text", t.model));
    if (t.modelAlt) modelWrap.appendChild(el("p", "hint", t.modelAlt));
    const mb = el("button", "btn listen", "🔊 Musterantwort anhören"); mb.onclick = () => speak(t.modelSay || [["B", t.model]], 0.9);
    const ma = el("div", "actions"); ma.style.marginTop = "8px"; ma.appendChild(mb); modelWrap.appendChild(ma);
    const modelBtn = el("button", "btn secondary", "👀 Musterantwort zeigen");
    modelBtn.disabled = canRec; // erst sprechen, dann vergleichen
    modelBtn.onclick = () => { modelWrap.hidden = false; modelBtn.hidden = true; selfBox.hidden = false; };
    const mbWrap = el("div", "actions"); mbWrap.appendChild(modelBtn);
    if (canRec) { const skip = el("button", "linkbtn", "Ohne Aufnahme weiter"); skip.onclick = () => { modelBtn.disabled = false; skip.remove(); }; mbWrap.appendChild(skip); }
    card.append(mbWrap, modelWrap);

    // Selbsteinschätzung (zählt als erledigt, nicht als Punkt-Abzug)
    const selfBox = el("div", "selfcheck"); selfBox.hidden = true;
    selfBox.appendChild(el("p", "q small-q", "Wie gut hat es geklappt?"));
    const opts = el("div", "opts");
    [["☺", "Gut! Ich habe alles gesagt."], ["😐", "Geht so. Ich übe noch einmal."], ["☹", "Schwierig. Ich höre mir die Musterantwort noch zweimal an."]].forEach(([face, txt]) => {
      const b = el("button", "opt face", face); b.setAttribute("aria-label", txt);
      b.onclick = () => {
        if (solved()) return;
        opts.querySelectorAll(".opt").forEach((x) => (x.disabled = true)); b.classList.add("right");
        const d = el("div", "fb ok"); d.innerHTML = `${esc(txt)}<small>${esc(t.why || "")}</small>`;
        card.appendChild(d); score++; stopRecording(); nextButton();
      };
      opts.appendChild(b);
    });
    selfBox.appendChild(opts);
    card.appendChild(selfBox);
  }

  // ---------- Hauptdarstellung ----------
  function render() {
    bar.style.width = (pos / list.length * 100) + "%";
    if (pos >= list.length) return end();
    const t = list[pos]; firstTry = true; wrong = 0; tipUsed = false; window.__task = t;
    const lv = Q.levels[lvl];
    card.innerHTML = `<div class="qmeta">${"★".repeat(lv.stars)} ${esc(lv.name)} · ${pos + 1} / ${list.length}${t.tag ? ` · <span class="qtag">${esc(t.tag)}</span>` : ""}</div><p class="q">${esc(t.q)}</p>` +
      (t.hint ? `<p class="hint">${esc(t.hint)}</p>` : "") + (t.info ? `<div class="info">${t.info}</div>` : "");
    if (t.say && t.type !== "record") card.appendChild(listenButtons(t.say, true));
    if (t.type === "choice") {
      const box = el("div", "opts" + (t.options.some((o) => o.length > 14) ? " wide" : ""));
      (lv.keepOptions ? t.options : shuffle(t.options)).forEach((o) => {
        const b = el("button", "opt", o);
        b.onclick = () => { if (solved()) return; const ok = o === t.answer; b.classList.add(ok ? "right" : "wrong"); feedback(ok, t); };
        box.appendChild(b);
      });
      const a = el("div", "actions"); a.appendChild(tipButton(t));
      card.append(box, a);
    } else if (t.type === "type") {
      const c = makeTyped(t);
      const b = el("button", "btn checkbtn", "Prüfen");
      const check = () => { if (solved()) return; feedback(typedOk(t, c.value()), t); };
      b.onclick = check; c.node.onkeydown = (e) => { if (e.key === "Enter") check(); };
      const a = el("div", "actions"); a.append(b, tipButton(t));
      card.append(c.node, a);
    } else if (t.type === "build") {
      const c = makeBuild(t);
      const b = el("button", "btn checkbtn", "Prüfen");
      b.onclick = () => { if (solved()) return; feedback(c.value() === t.sentence, t); };
      const a = el("div", "actions"); a.append(b, tipButton(t));
      card.append(c.node, a);
    } else if (t.type === "multi") renderMulti(t);
    else if (t.type === "order") renderOrder(t);
    else if (t.type === "record") renderRecord(t);
  }

  function end() {
    stopRecording();
    bar.style.width = "100%";
    const n = list.length, r = score / n;
    const stars = r === 1 ? "★★★" : r >= 0.7 ? "★★☆" : "★☆☆";
    const done = load(); done[lvl] = score + "/" + n; save(done);
    card.innerHTML = `<div class="end"><div class="qmeta">${esc(Q.levels[lvl].name)} geschafft!</div>
      <div class="big-stars">${stars}</div>
      <p class="q">${score} von ${n} Aufgaben beim ersten Versuch richtig</p>
      ${retry.length ? `<p class="hint">Diese Aufgaben solltest du dir nochmal anschauen: ${retry.map((t) => esc(t.title || t.q)).join(" · ")}</p>` : ""}
      <div class="actions" style="justify-content:center">
        <button class="btn" id="again">Nochmal</button>
        <button class="btn secondary" id="back">Zur Auswahl</button>
      </div></div>`;
    $("#again").onclick = () => start(lvl);
    $("#back").onclick = renderMenu;
  }

  $("#stop").onclick = () => { stopRecording(); renderMenu(); };
  window.QUIZ_START = (name) => { const n = Q.levels.findIndex((l) => l.name === name); if (n >= 0) start(n); };
  renderMenu();
})();
