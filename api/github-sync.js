import { handleGithubSync } from "../lib/github-sync-core.js";

export default async function handler(request) {
  const method = request.method;

  let body = null;
  if (method === "POST") {
    body = await request.json();
  }

  const result = await handleGithubSync({
    method,
    body,
    env: process.env,
  });

  return new Response(JSON.stringify(result.body), {
    status: result.status,
    headers: {
      "Content-Type": "application/json",
    },
  });
}