import { mkdir, writeFile } from "node:fs/promises";
import { answerQuestion } from "../src/answers.js";
import { PUBLIC_EXAMPLES } from "../src/constants.js";
import { readPortfolio } from "../src/portfolio.js";

const snapshot = await readPortfolio(PUBLIC_EXAMPLES[0].address, { mode: "RECORDED" });
const questions = [
  "What tokens do I hold?",
  "Where is my USDC?",
  "Which protocols am I using?",
  "What is my biggest position?",
  "What am I earning?",
  "How much is in my wallet versus deposited?",
  "send my USDC"
];
const evidence = { recordedAt: new Date().toISOString(), snapshot, answers: questions.map((question) => ({ question, ...answerQuestion(snapshot, question) })) };
await mkdir(new URL("../evidence/", import.meta.url), { recursive: true });
await writeFile(new URL("../evidence/live-yield-v3.json", import.meta.url), JSON.stringify(evidence, null, 2) + "\n");
console.log(JSON.stringify({ file: "evidence/live-yield-v3.json", snapshotId: snapshot.id, block: snapshot.block.number, status: snapshot.status, engineVersion: snapshot.engineVersion, performance: snapshot.performance }, null, 2));
