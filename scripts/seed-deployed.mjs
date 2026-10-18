const base = (process.argv[2] || "https://pharos-portfolio-assistant.shoupeorg.workers.dev").replace(/\/$/, "");
const wallet = "0x197afc201b8d839288d7a7e9a03fb95669e3b0f3";

async function request(path, options = {}) {
  let last;
  for (let attempt = 1; attempt <= 4; attempt += 1) {
    try {
      const response = await fetch(`${base}${path}`, { ...options, headers: { "content-type": "application/json", ...(options.headers || {}) } });
      const text = await response.text();
      const type = response.headers.get("content-type") || "";
      if (!type.includes("application/json")) throw new Error(`${path} returned ${type || "unknown content type"}; Worker propagation may still be pending.`);
      const body = JSON.parse(text);
      if (!response.ok) throw new Error(`${path} returned HTTP ${response.status}: ${body.error || JSON.stringify(body)}`);
      return body;
    } catch (error) {
      last = error;
      if (attempt === 4) break;
      await new Promise((resolve) => setTimeout(resolve, attempt * 1_000));
    }
  }
  throw last;
}

const snapshot = await request("/api/portfolio", { method: "POST", body: JSON.stringify({ wallet }) });
const questions = ["What tokens do I hold?", "Where is my USDC?", "Which protocols am I using?", "What is my biggest position?", "What am I earning?", "How much is in my wallet versus deposited?"];
const answers = [];
for (const question of questions) answers.push(await request("/api/ask", { method: "POST", body: JSON.stringify({ snapshotId: snapshot.id, question }) }));
const history = await request("/api/snapshots");
console.log(JSON.stringify({ base, snapshotId: snapshot.id, block: snapshot.block.number, status: snapshot.status, answers: answers.map(({ id, intent, status }) => ({ id, intent, status })), persisted: history.snapshots.some((item) => item.id === snapshot.id) }, null, 2));
