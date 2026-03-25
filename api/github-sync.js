// console.log("GITHUB_TOKEN:", process.env.GITHUB_TOKEN);
// console.log("GITHUB_REPO:", process.env.GITHUB_REPO);
export default async function handler(req, res) {
    const token = process.env.GITHUB_TOKEN;

    if (!token) {
        return res.status(500).json({ error: "Missing GITHUB_TOKEN in server environment" });
    }

    const owner = process.env.GITHUB_OWNER;
    const repo = process.env.GITHUB_REPO;
    const path = process.env.GITHUB_PATH;

    if (!owner || !repo || !path) {
        return res.status(500).json({
            error: "Missing GITHUB_OWNER / GITHUB_REPO / GITHUB_PATH in server environment",
        });
    }

    const url = `https://api.github.com/repos/${owner}/${repo}/contents/${path}`;

    try {
        if (req.method === "GET") {
            const response = await fetch(url, {
                headers: {
                    Authorization: `Bearer ${token}`,
                    Accept: "application/vnd.github+json",
                },
            });

            if (!response.ok) {
                const text = await response.text();
                return res.status(response.status).json({
                    error: "Failed to fetch file from GitHub",
                    details: text,
                });
            }

            const data = await response.json();

            // 2. 核心逻辑：判断如何获取内容
            let finalContent;

            if (data.download_url) {
                // 针对大文件（或常规文件）：直接请求 raw 下载地址
                // 注意：如果是私有库，请求 download_url 依然需要带上 Authorization 头
                const rawResponse = await fetch(data.download_url, {
                    headers: {
                        "Authorization": `Bearer ${token}`,
                    },
                });

                if (!rawResponse.ok) throw new Error("无法通过 download_url 获取原始数据");

                // 直接解析为 JSON 对象
                finalContent = await rawResponse.json();

            } else if (data.content) {
                // 备选方案：如果 content 字段存在（小于 1MB 的情况）
                const decoded = Buffer.from(data.content, "base64").toString("utf8");
                finalContent = JSON.parse(decoded);
            } else {
                return res.status(500).json({ error: "响应中既没有内容也没有下载链接" });
            }

            // 3. 返回最终解析后的 JSON 数据
            return res.status(200).json(finalContent);
        }

        if (req.method === "POST") {
            const { config, cardData } = req.body || {};

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
                sha = fileData.sha;
            }

            const contentBase64 = Buffer.from(
                JSON.stringify(fullPayload, null, 2),
                "utf8"
            ).toString("base64");

            // 检查体积：如果 Base64 后的字符串超过了 20MB，可能会非常不稳定
            console.log("Payload size (MB):", contentBase64.length / 1024 / 1024);

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


            if (!putResponse.ok) {
                const text = await putResponse.text();
                return res.status(putResponse.status).json({
                    error: "Failed to sync file to GitHub",
                    details: text,
                });
            }

            const result = await putResponse.json();

            return res.status(200).json({
                success: true,
                message: "Synced to GitHub successfully",
                result,
            });
        }

        res.setHeader("Allow", ["GET", "POST"]);
        return res.status(405).json({ error: "Method not allowed" });
    } catch (error) {
        return res.status(500).json({
            error: "Server error",
            details: error.message,
        });
    }
}