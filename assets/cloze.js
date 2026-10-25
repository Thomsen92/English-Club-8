// English Club 8 – Einsetzübung im Stil von englisch-hilfen.de:
// Sätze mit Lücken, alles ausfüllen, einmal auswerten, Ergebnis + Lösungen ansehen.
// Konfiguration im HTML:
//   window.CLOZE = { mount: "#cloze", items: [ { before, after, answers, show, why } ] }
// Es wird nichts verschickt und nichts gespeichert.
(function () {
  const C = window.CLOZE;
  if (!C || !Array.isArray(C.items) || !C.items.length) return;
  const mount = document.querySelector(C.mount || "#cloze");
  if (!mount) return;

  const norm = (s) => String(s).toLowerCase().replace(/[’‘`´']/g, "'").replace(/[.!?,;:]/g, "").replace(/\s+/g, " ").trim();
  const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
  const solve = (it) => it.show || (it.answers && it.answers[0]) || "";
  const isOk = (it, value) => {
    const v = norm(value);
    return v !== "" && (it.answers || [solve(it)]).some((a) => norm(a) === v);
  };

  const grid = el("div", "cloze");
  const rows = [];
  C.items.forEach((it, i) => {
    const row = el("div", "cl-item");
    row.appendChild(el("span", "cl-n", String(i + 1)));
    const text = el("span", "cl-text");
    if (it.before) text.appendChild(document.createTextNode(it.before + " "));
    const inp = el("input");
    inp.type = "text";
    inp.autocomplete = "off";
    inp.spellcheck = false;
    inp.setAttribute("aria-label", "Lücke " + (i + 1));
    inp.style.width = Math.max(5, solve(it).length + 2) + "ch";
    inp.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); evaluate(); } });
    text.appendChild(inp);
    if (it.after) text.appendChild(document.createTextNode(" " + it.after));
    row.appendChild(text);
    const sol = el("span", "cl-sol", "→ " + solve(it));
    sol.hidden = true;
    row.appendChild(sol);
    grid.appendChild(row);
    rows.push({ it, row, inp, sol });
  });

  const res = el("div", "cl-res");
  res.hidden = true;
  res.setAttribute("role", "status");
  res.setAttribute("aria-live", "polite");

  const actions = el("div", "actions");
  const checkBtn = el("button", "btn", "Auswerten");
  const againBtn = el("button", "btn secondary", "Nochmal üben");
  againBtn.hidden = true;
  actions.append(checkBtn, againBtn);
  mount.append(grid, actions, res);

  let done = false;

  function evaluate() {
    if (done) return;
    done = true;
    let okN = 0;
    const wrong = [];
    rows.forEach(({ it, row, inp, sol }, i) => {
      const ok = isOk(it, inp.value);
      row.classList.toggle("ok", ok);
      row.classList.toggle("bad", !ok);
      inp.readOnly = true;
      sol.hidden = ok;
      if (ok) okN++; else wrong.push({ n: i + 1, it });
    });

    res.hidden = false;
    res.className = "cl-res" + (okN === rows.length ? " ok" : "");
    res.innerHTML = "";
    res.appendChild(el("p", null, okN === rows.length
      ? "Alles richtig – " + okN + " von " + rows.length + "! 🎉"
      : okN + " von " + rows.length + " richtig."));
    if (wrong.length) {
      res.appendChild(el("p", "hint", wrong.length === 1
        ? "Diese Lücke stimmt noch nicht – die Lösung steht in Rot dahinter:"
        : "Diese Lücken stimmen noch nicht – die Lösung steht in Rot dahinter:"));
      const ul = el("ul");
      wrong.forEach(({ n, it }) => {
        const li = el("li");
        li.appendChild(el("b", null, n + ": "));
        li.appendChild(document.createTextNode(solve(it)));
        if (it.why) li.appendChild(document.createTextNode(" · " + it.why));
        ul.appendChild(li);
      });
      res.appendChild(ul);
    } else {
      res.appendChild(el("p", "hint", "Perfekt. Du kannst die Übung noch einmal machen oder oben mit einer Selbsttest-Stufe weitermachen."));
    }

    checkBtn.disabled = true;
    againBtn.hidden = false;
    againBtn.focus();
  }

  function reset() {
    done = false;
    res.hidden = true;
    res.innerHTML = "";
    rows.forEach(({ row, inp, sol }) => {
      row.classList.remove("ok", "bad");
      inp.readOnly = false;
      inp.value = "";
      sol.hidden = true;
    });
    checkBtn.disabled = false;
    againBtn.hidden = true;
    rows[0].inp.focus();
  }

  checkBtn.addEventListener("click", evaluate);
  againBtn.addEventListener("click", reset);
})();
