export type TraceEntry = {
  at: number;
  event: string;
  detail: string;
  state: string;
  screenshot: string | null;
};

function escapeScriptJson(value: unknown): string {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}

export function renderTraceHtml(sessionId: string, entries: TraceEntry[]): string {
  const data = escapeScriptJson({ sessionId, entries });
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Session ${sessionId}</title>
  <style>
    body { margin: 0; font-family: ui-sans-serif, system-ui, sans-serif; color: #0f172a; background: #f8fafc; }
    header { display: flex; gap: 12px; align-items: center; padding: 12px 16px; background: #0f172a; color: white; }
    header button, header label { font: inherit; }
    main { display: grid; grid-template-columns: 280px 1fr 1fr; height: calc(100vh - 52px); }
    ol { margin: 0; padding: 8px; overflow: auto; list-style: none; background: white; border-right: 1px solid #e2e8f0; }
    li { padding: 8px; border-radius: 8px; cursor: pointer; font-size: 12px; }
    li.selected { background: #ccfbf1; }
    figure { margin: 0; padding: 16px; overflow: auto; }
    img { width: 100%; border: 1px solid #e2e8f0; background: #020617; }
    pre { margin: 0; padding: 16px; overflow: auto; white-space: pre-wrap; font-size: 12px; line-height: 1.45; background: white; }
  </style>
</head>
<body>
  <header>
    <strong>Session log</strong>
    <span id="meta"></span>
    <button id="play" type="button">Play</button>
    <label><input id="frames" type="checkbox" /> Show frame samples</label>
  </header>
  <main>
    <ol id="list"></ol>
    <figure><img id="shot" alt="Screen at this step" /></figure>
    <pre id="state"></pre>
  </main>
  <script id="trace" type="application/json">${data}</script>
  <script>
    const payload = JSON.parse(document.getElementById("trace").textContent);
    const list = document.getElementById("list");
    const shot = document.getElementById("shot");
    const state = document.getElementById("state");
    const meta = document.getElementById("meta");
    const frames = document.getElementById("frames");
    let selected = 0;
    let timer = null;
    meta.textContent = payload.sessionId + " · " + payload.entries.length + " states";
    function visible() {
      return payload.entries
        .map((entry, index) => ({ entry, index }))
        .filter((item) => frames.checked || item.entry.event !== "FRAME_SAMPLED");
    }
    function screenshotFor(index) {
      for (let cursor = index; cursor >= 0; cursor -= 1) {
        if (payload.entries[cursor].screenshot) return payload.entries[cursor].screenshot;
      }
      return "";
    }
    function render() {
      const items = visible();
      list.innerHTML = "";
      for (const item of items) {
        const row = document.createElement("li");
        const time = new Date(item.entry.at).toLocaleTimeString();
        row.textContent = time + "  " + item.entry.event + (item.entry.detail ? "  " + item.entry.detail : "");
        if (item.index === selected) row.className = "selected";
        row.onclick = () => { selected = item.index; render(); };
        list.appendChild(row);
      }
      const entry = payload.entries[selected];
      if (!entry) return;
      shot.src = screenshotFor(selected);
      state.textContent = entry.event + "\\n" + entry.detail + "\\n\\n" + entry.state;
    }
    document.getElementById("play").onclick = () => {
      if (timer) { clearInterval(timer); timer = null; return; }
      const items = visible();
      let cursor = Math.max(0, items.findIndex((item) => item.index >= selected));
      timer = setInterval(() => {
        if (cursor >= items.length) { clearInterval(timer); timer = null; return; }
        selected = items[cursor].index;
        cursor += 1;
        render();
      }, 700);
    };
    frames.onchange = render;
    render();
  </script>
</body>
</html>
`;
}
