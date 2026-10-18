const base = (process.argv[2] || "https://pharos-portfolio-assistant.shoupeorg.workers.dev").replace(/\/$/, "");
const wallet = "0x197afc201b8d839288d7a7e9a03fb95669e3b0f3";

async function request(path, options = {}) {
  const response = await fetch(`${base}${path}`, { ...options, headers: { "content-type": "application/json", ...(options.headers || {}) } });
  const body = await response.json();
  if (!response.ok) throw new Error(`${path} returned HTTP ${response.status}: ${body.error || JSON.stringify(body)}`);
  return body;
}

const snapshot = await request("/api/portfolio", { method: "POST", body: JSON.stringify({ wallet }) });
const questions = ["What tokens do I hold?", "Where is my USDC?", "Which protocols am I using?", "What is my biggest position?", "What am I earning?", "How much is in my wallet versus deposited?"];
const answers = [];
for (const question of questions) answers.push(await request("/api/ask", { method: "POST", body: JSON.stringify({ snapshotId: snapshot.id, question }) }));
const history = await request("/api/snapshots");
console.log(JSON.stringify({ base, snapshotId: snapshot.id, block: snapshot.block.number, status: snapshot.status, answers: answers.map(({ id, intent, status }) => ({ id, intent, status })), persisted: history.snapshots.some((item) => item.id === snapshot.id) }, null, 2));
