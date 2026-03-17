export async function handleGithubSync({ method, body, env }) {
    const token = env.GITHUB_TOKEN;
    const owner = env.GITHUB_OWNER;
    const repo = env.GITHUB_REPO;
    const path = env.GITHUB_PATH;
  
    if (!token) {
      return {
        status: 500,
        body: { error: "Missing GITHUB_TOKEN in server environment" },
      };
    }
  
    if (!owner || !repo || !path) {
      return {
        status: 500,
        body: {
          error: "Missing GITHUB_OWNER / GITHUB_REPO / GITHUB_PATH in server environment",
        },
      };
    }
  
    const url = `https://api.github.com/repos/${owner}/${repo}/contents/${path}`;
  
    try {
      if (method === "GET") {
        const response = await fetch(url, {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/vnd.github+json",
          },
        });
  
        const data = await response.json();
  
        if (response.status === 404) {
          return {
            status: 404,
            body: {
              error: "GitHub file not found",
              details: `No file found at path: ${path}`,
            },
          };
        }
  
        if (!response.ok) {
          return {
            status: response.status,
            body: {
              error: "Failed to fetch file from GitHub",
              details: data,
            },
          };
        }
  
        if (Array.isArray(data)) {
          return {
            status: 400,
            body: {
              error: "GITHUB_PATH points to a directory, not a file",
              details: { path },
            },
          };
        }
  
        if (!data.content) {
          return {
            status: 400,
            body: {
              error: "GitHub response does not contain file content",
              details: {
                path,
                type: data.type,
                name: data.name,
              },
            },
          };
        }
  
        const decoded = Buffer.from(data.content.replace(/\n/g, ""), "base64").toString("utf8");
        const content = JSON.parse(decoded);
  
        return {
          status: 200,
          body: content,
        };
      }
  
      if (method === "POST") {
        const { config, cardData } = body || {};
  
        const fullPayload = {
          config,
          cardData,
          lastUpdated: new Date().toISOString(),
        };
  
        let sha = "";
  
        const getFileRes = await fetch(url, {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/vnd.github+json",
          },
        });
  
        if (getFileRes.ok) {
          const fileData = await getFileRes.json();
  
          if (!Array.isArray(fileData) && fileData.sha) {
            sha = fileData.sha;
          } else if (Array.isArray(fileData)) {
            return {
              status: 400,
              body: {
                error: "GITHUB_PATH points to a directory, not a file",
                details: { path },
              },
            };
          }
        }
  
        const contentBase64 = Buffer.from(
          JSON.stringify(fullPayload, null, 2),
          "utf8"
        ).toString("base64");
  
        const putResponse = await fetch(url, {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/vnd.github+json",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            message: `Update love-card data: ${new Date().toLocaleString("zh-CN")}`,
            content: contentBase64,
            ...(sha ? { sha } : {}),
          }),
        });
  
        const putData = await putResponse.json();
  
        if (!putResponse.ok) {
          return {
            status: putResponse.status,
            body: {
              error: "Failed to sync file to GitHub",
              details: putData,
            },
          };
        }
  
        return {
          status: 200,
          body: {
            success: true,
            message: "Synced to GitHub successfully",
          },
        };
      }
  
      return {
        status: 405,
        body: { error: "Method not allowed" },
      };
    } catch (error) {
      return {
        status: 500,
        body: {
          error: "Server error",
          details: error.message,
        },
      };
    }
  }