// Memory: window.MEMORY = [["englisch","deutsch"], …] → Karten in #memory
(function () {
  const P = window.MEMORY, root = document.getElementById("memory");
  if (!P || !root) return;
  const shuffle = (a) => { const b = a.slice(); for (let k = b.length - 1; k > 0; k--) { const j = Math.floor(Math.random() * (k + 1)); [b[k], b[j]] = [b[j], b[k]]; } return b; };
  const info = document.createElement("p"); info.className = "hint"; info.style.margin = "10px 0 0";
  const grid = document.createElement("div"); grid.className = "mem-grid";
  const again = document.createElement("button"); again.className = "btn secondary"; again.textContent = "Neu mischen";
  const act = document.createElement("div"); act.className = "actions"; act.appendChild(again);
  root.append(grid, info, act);
  let open = [], moves = 0, found = 0, busy = false;
  function deal() {
    grid.innerHTML = ""; open = []; moves = 0; found = 0; busy = false; status();
    const cards = shuffle(P.flatMap(([en, de], i) => [{ i, t: en, en: true }, { i, t: de, en: false }]));
    cards.forEach((c) => {
      const b = document.createElement("button"); b.className = "mem-card" + (c.en ? " en" : " de");
      b.innerHTML = `<span class="back">?</span><span class="face"></span>`;
      b.querySelector(".face").textContent = c.t;
      b.setAttribute("aria-label", "Karte");
      b.onclick = () => flip(b, c);
      grid.appendChild(b);
    });
  }
  function status() {
    info.textContent = found === P.length ? `🎉 Geschafft! Alle ${P.length} Paare in ${moves} Zügen gefunden. Schaffst du es mit weniger?` : `Finde die Paare: englisches Wort 🇬🇧 + deutsche Bedeutung 🇩🇪 · Züge: ${moves} · Paare: ${found} / ${P.length}`;
  }
  function flip(b, c) {
    if (busy || b.classList.contains("up")) return;
    b.classList.add("up"); open.push([b, c]);
    if (open.length < 2) return;
    moves++;
    const [[b1, c1], [b2, c2]] = open; open = [];
    if (c1.i === c2.i && c1.en !== c2.en) { b1.classList.add("match"); b2.classList.add("match"); found++; status(); return; }
    busy = true; status();
    setTimeout(() => { b1.classList.remove("up"); b2.classList.remove("up"); busy = false; }, 1100);
  }
  again.onclick = deal; deal();
})();
