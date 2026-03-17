import { handleGithubSync } from "../../lib/github-sync-core.js";

export async function handler(event) {
  const method = event.httpMethod;

  let body = null;
  if (method === "POST") {
    body = JSON.parse(event.body || "{}");
  }

  const result = await handleGithubSync({
    method,
    body,
    env: process.env,
  });

  return {
    statusCode: result.status,
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(result.body),
  };
}