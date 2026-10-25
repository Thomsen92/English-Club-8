// Interaktives Kreuzworträtsel: window.XWORD = {h, w, cells:{"r,c":"A"}, nums:{"r,c":1}, across:[[n,clue,word]], down:[...]}
(function () {
  const X = window.XWORD, root = document.getElementById("xw");
  if (!X || !root) return;
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  let dir = "A";
  const grid = document.createElement("div");
  grid.className = "xw-grid";
  grid.style.gridTemplateColumns = `repeat(${X.w}, var(--cs))`;
  const inputs = {};
  for (let r = 0; r < X.h; r++) for (let c = 0; c < X.w; c++) {
    const k = r + "," + c, cell = document.createElement("div");
    if (X.cells[k]) {
      cell.className = "xw-cell";
      if (X.nums[k]) { const n = document.createElement("span"); n.className = "xw-num"; n.textContent = X.nums[k]; cell.appendChild(n); }
      const i = document.createElement("input");
      Object.assign(i, { maxLength: 1, autocomplete: "off", spellcheck: false });
      i.setAttribute("autocapitalize", "characters"); i.setAttribute("autocorrect", "off"); i.setAttribute("aria-label", "Feld " + k);
      i.dataset.r = r; i.dataset.c = c;
      i.addEventListener("input", () => {
        i.value = i.value.slice(-1).toUpperCase(); i.parentNode.classList.remove("ok", "bad");
        if (i.value) move(r, c, 1);
      });
      i.addEventListener("keydown", (e) => {
        if (e.key === "Backspace" && !i.value) { move(r, c, -1, true); }
        if (e.key === "ArrowRight") { dir = "A"; move(r, c, 1); } if (e.key === "ArrowLeft") { dir = "A"; move(r, c, -1); }
        if (e.key === "ArrowDown") { dir = "D"; move(r, c, 1); } if (e.key === "ArrowUp") { dir = "D"; move(r, c, -1); }
      });
      i.addEventListener("focus", () => {
        const h = !!X.cells[r + "," + (c + 1)] || !!X.cells[r + "," + (c - 1)], v = !!X.cells[(r + 1) + "," + c] || !!X.cells[(r - 1) + "," + c];
        if (h && !v) dir = "A"; else if (v && !h) dir = "D";
      });
      inputs[k] = i; cell.appendChild(i);
    } else cell.className = "xw-cell empty";
    grid.appendChild(cell);
  }
  function move(r, c, step, clear) {
    const k = dir === "A" ? r + "," + (c + step) : (r + step) + "," + c;
    const t = inputs[k]; if (t) { t.focus(); if (clear) t.value = ""; }
  }
  const clues = (title, arr) => `<div><b>${title}</b>${arr.map(([n, cl]) => `<div class="xw-clue">${n} &nbsp;${esc(cl)}</div>`).join("")}</div>`;
  const box = document.createElement("div"); box.className = "xw-clues";
  box.innerHTML = clues("→ Across (waagerecht)", X.across) + clues("↓ Down (senkrecht)", X.down);
  const msg = document.createElement("p"); msg.className = "hint"; msg.style.marginTop = "10px";
  const bCheck = document.createElement("button"); bCheck.className = "btn"; bCheck.textContent = "Prüfen";
  const bShow = document.createElement("button"); bShow.className = "btn secondary"; bShow.textContent = "Lösung zeigen";
  bCheck.onclick = () => {
    let ok = 0, all = 0, empty = 0;
    for (const k in inputs) { all++; const i = inputs[k]; i.parentNode.classList.remove("ok", "bad");
      if (!i.value) { empty++; continue; }
      if (i.value === X.cells[k]) { ok++; i.parentNode.classList.add("ok"); } else i.parentNode.classList.add("bad"); }
    msg.textContent = ok === all ? "🎉 Super, alles richtig!" : `${ok} von ${all} Buchstaben richtig${empty ? `, ${empty} noch leer` : ""}. Rote Felder kannst du verbessern.`;
  };
  bShow.onclick = () => { for (const k in inputs) { inputs[k].value = X.cells[k]; inputs[k].parentNode.classList.remove("bad"); inputs[k].parentNode.classList.add("ok"); } msg.textContent = "Hier ist die Lösung."; };
  const act = document.createElement("div"); act.className = "actions"; act.append(bCheck, bShow);
  const wrap = document.createElement("div"); wrap.className = "xw-wrap"; wrap.appendChild(grid);
  root.append(wrap, box, act, msg);
})();
