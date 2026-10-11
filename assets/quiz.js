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
    lvl = n; list = shuffle(Q.levels[n].tasks); pos = 0; score = 0; retry = [];
    menu.hidden = true; quiz.hidden = false; window.scrollTo(0, 0); render();
  }

  function feedback(ok, task) {
    const old = card.querySelector(".fb"); if (old) old.remove();
    const d = document.createElement("div");
    d.className = "fb " + (ok ? "ok" : "no");
    d.innerHTML = ok ? `✓ Richtig!<small>${esc(task.why || "")}</small>` : `✗ Noch nicht – versuch es nochmal.${task.tip ? `<small>Tipp: ${esc(task.tip)}</small>` : ""}`;
    card.appendChild(d);
    if (!ok && firstTry) { firstTry = false; retry.push(task); }
    if (ok) {
      if (firstTry) score++;
      const n = document.createElement("button"); n.className = "btn";
      n.textContent = pos < list.length - 1 ? "Weiter →" : "Ergebnis";
      n.onclick = () => { pos++; render(); };
      const a = document.createElement("div"); a.className = "actions"; a.appendChild(n); card.appendChild(a);
    }
  }
  const solved = () => !!card.querySelector(".fb.ok");

  function render() {
    bar.style.width = (pos / list.length * 100) + "%";
    if (pos >= list.length) return end();
    const t = list[pos]; firstTry = true;
    const lv = Q.levels[lvl];
    card.innerHTML = `<div class="qmeta">${"★".repeat(lv.stars)} ${esc(lv.name)} · ${pos + 1} / ${list.length}</div><p class="q">${esc(t.q)}</p>` +
      (t.hint ? `<p class="hint">${esc(t.hint)}</p>` : "");
    if (t.type === "choice") {
      const box = document.createElement("div");
      box.className = "opts" + (t.options.some((o) => o.length > 14) ? " wide" : "");
      shuffle(t.options).forEach((o) => {
        const b = document.createElement("button"); b.className = "opt"; b.textContent = o;
        b.onclick = () => { if (solved()) return; const ok = o === t.answer; b.classList.add(ok ? "right" : "wrong"); feedback(ok, t); };
        box.appendChild(b);
      });
      card.appendChild(box);
    } else if (t.type === "type") {
      const inp = document.createElement("input");
      Object.assign(inp, { type: "text", autocomplete: "off", spellcheck: false, placeholder: "Deine Antwort …" });
      inp.setAttribute("autocapitalize", "off"); inp.setAttribute("autocorrect", "off");
      const b = document.createElement("button"); b.className = "btn"; b.textContent = "Prüfen";
      const check = () => { if (solved()) return; feedback(t.answers.some((a) => norm(a) === norm(inp.value)), t); };
      b.onclick = check; inp.onkeydown = (e) => { if (e.key === "Enter") check(); };
      const a = document.createElement("div"); a.className = "actions"; a.appendChild(b);
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
      const a = document.createElement("div"); a.className = "actions"; a.appendChild(b);
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
      ${retry.length ? `<p class="hint">Diese Aufgaben solltest du dir nochmal anschauen: ${retry.map((t) => esc(t.q)).join(" · ")}</p>` : ""}
      <div class="actions" style="justify-content:center">
        <button class="btn" id="again">Nochmal</button>
        <button class="btn secondary" id="back">Zur Auswahl</button>
      </div></div>`;
    $("#again").onclick = () => start(lvl);
    $("#back").onclick = renderMenu;
  }

  $("#stop").onclick = renderMenu;
  renderMenu();
})();
