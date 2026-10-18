#!/usr/bin/env node
import { answerQuestion } from "./answers.js";
import { PUBLIC_EXAMPLES } from "./constants.js";
import { readPortfolio } from "./portfolio.js";

const [wallet = PUBLIC_EXAMPLES[0].address, ...questionParts] = process.argv.slice(2);
const question = questionParts.join(" ") || "Where is my USDC?";
try {
  const snapshot = await readPortfolio(wallet);
  const answer = answerQuestion(snapshot, question);
  console.log(JSON.stringify({ snapshot, question, answer }, null, 2));
} catch (error) {
  console.error(JSON.stringify({ status: "ERROR", error: error.message }, null, 2));
  process.exitCode = 1;
}
