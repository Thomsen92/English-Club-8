// English Club 8 – Selbsttest-Engine. Es wird nichts verschickt; nur "erledigt"-Häkchen bleiben auf dem Gerät.
(function () {
  const Q = window.QUIZ;
  const $ = (s) => document.querySelector(s);
  const menu = $("#menu"), quiz = $("#quiz"), card = $("#card"), bar = $("#bar");
  const KEY = "ec8-" + Q.id;
  const load = () => { try { return JSON.parse(localStorage.getItem(KEY) || "{}"); } catch (e) { return {}; } };
  const save = (o) => { try { localStorage.setItem(KEY, JSON.stringify(o)); } catch (e) {} };
  const norm = (s) => s.toLowerCase().replace(/[’']/g, "'").replace(/[.!?,]/g, "").replace(/\s+/g, " ").trim();
  const shuffle = (a) => { const b = a.slice(); for (let k = b.length - 1; k > 0; k--) { const j = Math.floor(Math.random() * (k + 1)); [b[k], b[j]] = [b[j], b[k]]; } return b; };
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  function renderMenu() {
    const done = load();
    const box = $("#levels"); box.innerHTML = "";
    Q.levels.forEach((lv, n) => {
      if (lv.hidden) return;
      const b = document.createElement("button");
      b.className = "level-btn";
      b.innerHTML = `<span class="stars">${"★".repeat(lv.stars)}${"☆".repeat(3 - lv.stars)}</span>
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

  // Vorlesen mit der eingebauten Stimme des Geräts (läuft offline auf dem iPad, nichts wird verschickt)
  function enVoices() {
    const vs = window.speechSynthesis.getVoices().filter((x) => /^en/i.test(x.lang));
    const pref = (x) => (/en[-_]US/i.test(x.lang) ? 0 : 1) + (/Samantha|Google US|Aria|Jenny/i.test(x.name) ? -1 : 0);
    return vs.sort((a, b) => pref(a) - pref(b));
  }
  // text = "Satz" oder [["A","Satz"],["B","Satz"], …] für Dialoge mit zwei Stimmen
  function speak(text, rate) {
    if (!("speechSynthesis" in window)) { alert0(); return; }
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
  function alert0() { const d = document.createElement("p"); d.className = "hint"; d.textContent = "Dein Gerät kann leider nicht vorlesen."; card.appendChild(d); }
  if ("speechSynthesis" in window) { window.speechSynthesis.getVoices(); window.speechSynthesis.onvoiceschanged = () => window.speechSynthesis.getVoices(); }

  const MAX_TRIES = 3;
  let wrong = 0, tipUsed = false;
  const answerText = (t) => t.type === "choice" ? t.answer : t.type === "type" ? t.answers[0] : t.sentence;

  function nextButton() {
    const n = document.createElement("button"); n.className = "btn";
    n.textContent = pos < list.length - 1 ? "Weiter →" : "Ergebnis";
    n.onclick = () => { pos++; render(); };
    const a = document.createElement("div"); a.className = "actions"; a.appendChild(n); card.appendChild(a);
    n.focus();
  }

  function feedback(ok, task) {
    const old = card.querySelector(".fb:not(.tipbox)"); if (old) old.remove();
    const d = document.createElement("div");
    if (ok) {
      d.className = "fb ok";
      d.innerHTML = `✓ Richtig!<small>${esc(task.why || "")}</small>`;
      card.appendChild(d);
      if (firstTry && !tipUsed) score++;
      nextButton();
      return;
    }
    wrong++;
    if (firstTry) { firstTry = false; retry.push(task); }
    if (wrong >= MAX_TRIES) {
      d.className = "fb reveal";
      d.innerHTML = `Die richtige Antwort ist: <b>${esc(answerText(task))}</b><small>${esc(task.why || "")}</small>`;
      card.appendChild(d);
      card.querySelectorAll(".opt").forEach((b) => { if (b.textContent === task.answer) b.classList.add("right"); });
      card.querySelectorAll(".tipbtn").forEach((b) => b.disabled = true);
      nextButton();
      return;
    }
    d.className = "fb no";
    d.innerHTML = `✗ Noch nicht – Versuch ${wrong} von ${MAX_TRIES}.<small>${wrong === MAX_TRIES - 1 ? "Noch ein Versuch, dann siehst du die Lösung." : "Tipp gefällig? Tippe auf 💡."}</small>`;
    card.appendChild(d);
  }
  const solved = () => !!card.querySelector(".fb.ok, .fb.reveal");

  // Tipp: eigener Hinweis aus der Aufgabe, sonst automatisch erzeugt
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
    }
    const box = document.createElement("div"); box.className = "fb tipbox"; box.innerHTML = `💡 ${esc(text)}`;
    const after = card.querySelector(".fb:not(.tipbox)");
    after ? card.insertBefore(box, after) : card.appendChild(box);
  }
  function tipButton(t) {
    const b = document.createElement("button"); b.className = "btn secondary tipbtn"; b.textContent = "💡 Tipp";
    b.onclick = () => giveTip(t, b); return b;
  }

  function render() {
    bar.style.width = (pos / list.length * 100) + "%";
    if (pos >= list.length) return end();
    const t = list[pos]; firstTry = true; wrong = 0; tipUsed = false; window.__task = t;
    const lv = Q.levels[lvl];
    card.innerHTML = `<div class="qmeta">${"★".repeat(lv.stars)} ${esc(lv.name)} · ${pos + 1} / ${list.length}</div><p class="q">${esc(t.q)}</p>` +
      (t.hint ? `<p class="hint">${esc(t.hint)}</p>` : "");
    if (t.say) {
      const bx = document.createElement("div"); bx.className = "actions"; bx.style.margin = "0 0 14px";
      const b1 = document.createElement("button"); b1.className = "btn listen"; b1.textContent = "🔊 Anhören"; b1.onclick = () => speak(t.say, 0.9);
      const b2 = document.createElement("button"); b2.className = "btn secondary"; b2.textContent = "🐢 Langsam"; b2.onclick = () => speak(t.say, 0.6);
      bx.append(b1, b2); card.appendChild(bx);
      speak(t.say, 0.9);
    }
    if (t.type === "choice") {
      const box = document.createElement("div");
      box.className = "opts" + (t.options.some((o) => o.length > 14) ? " wide" : "");
      (lv.keepOptions ? t.options : shuffle(t.options)).forEach((o) => {
        const b = document.createElement("button"); b.className = "opt"; b.textContent = o;
        b.onclick = () => { if (solved()) return; const ok = o === t.answer; b.classList.add(ok ? "right" : "wrong"); feedback(ok, t); };
        box.appendChild(b);
      });
      const a = document.createElement("div"); a.className = "actions"; a.appendChild(tipButton(t));
      card.append(box, a);
    } else if (t.type === "type") {
      const inp = document.createElement("input");
      Object.assign(inp, { type: "text", autocomplete: "off", spellcheck: false, placeholder: "Deine Antwort …" });
      inp.setAttribute("autocapitalize", "off"); inp.setAttribute("autocorrect", "off");
      const b = document.createElement("button"); b.className = "btn"; b.textContent = "Prüfen";
      const check = () => { if (solved()) return; feedback(t.answers.some((a) => norm(a) === norm(inp.value)), t); };
      b.onclick = check; inp.onkeydown = (e) => { if (e.key === "Enter") check(); };
      const a = document.createElement("div"); a.className = "actions"; a.append(b, tipButton(t));
      card.append(inp, a);
    } else if (t.type === "build") {
      const words = t.sentence.split(" ");
      const line = document.createElement("div"); line.className = "line";
      const pool = document.createElement("div"); pool.className = "tiles";
      shuffle(words).forEach((w) => {
        const tile = document.createElement("button"); tile.className = "tile"; tile.textContent = w;
        tile.onclick = () => { if (solved()) return; (tile.parentNode === pool ? line : pool).appendChild(tile); };
        pool.appendChild(tile);
      });
      const b = document.createElement("button"); b.className = "btn"; b.textContent = "Prüfen";
      b.onclick = () => { if (solved()) return; feedback([...line.children].map((x) => x.textContent).join(" ") === t.sentence, t); };
      const a = document.createElement("div"); a.className = "actions"; a.append(b, tipButton(t));
      card.append(line, pool, a);
    }
  }

  function end() {
    bar.style.width = "100%";
    const n = list.length, r = score / n;
    const stars = r === 1 ? "★★★" : r >= 0.7 ? "★★☆" : "★☆☆";
    const done = load(); done[lvl] = score + "/" + n; save(done);
    card.innerHTML = `<div class="end"><div class="qmeta">${esc(Q.levels[lvl].name)} geschafft!</div>
      <div class="big-stars">${stars}</div>
      <p class="q">${score} von ${n} beim ersten Versuch richtig</p>
      ${retry.length ? `<p class="hint">Diese Aufgaben solltest du dir nochmal anschauen: ${retry.map((t) => esc(t.say && !Array.isArray(t.say) ? "🎧 " + t.say : t.type === "build" ? t.sentence : t.q)).join(" · ")}</p>` : ""}
      <div class="actions" style="justify-content:center">
        <button class="btn" id="again">Nochmal</button>
        <button class="btn secondary" id="back">Zur Auswahl</button>
      </div></div>`;
    $("#again").onclick = () => start(lvl);
    $("#back").onclick = renderMenu;
  }

  $("#stop").onclick = renderMenu;
  window.QUIZ_START = (name) => { const n = Q.levels.findIndex((l) => l.name === name); if (n >= 0) start(n); };
  renderMenu();
})();
