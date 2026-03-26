// netlify/functions/upload.js
import Busboy from "busboy";
import FormData from "form-data";

export async function handler(event) {
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      body: JSON.stringify({ status: false, message: "Method Not Allowed" }),
    };
  }

  try {
    const headers = event.headers || {};
    const contentType = headers["content-type"] || headers["Content-Type"];

    if (!contentType) {
      return {
        statusCode: 400,
        body: JSON.stringify({ status: false, message: "缺少 Content-Type" }),
      };
    }

    const busboy = Busboy({
      headers: {
        "content-type": contentType,
      },
    });

    const fileData = await new Promise((resolve, reject) => {
      let chunks = [];
      let filename = "upload.jpg";
      let mimeType = "application/octet-stream";
      let found = false;

      busboy.on("file", (fieldname, file, info) => {
        if (fieldname !== "file") {
          file.resume();
          return;
        }

        found = true;
        filename = info.filename;
        mimeType = info.mimeType;

        file.on("data", (chunk) => chunks.push(chunk));
      });

      busboy.on("finish", () => {
        if (!found) {
          reject(new Error("没有接收到字段 file"));
          return;
        }

        resolve({
          buffer: Buffer.concat(chunks),
          filename,
          mimeType,
        });
      });

      busboy.on("error", reject);

      const bodyBuffer = event.isBase64Encoded
        ? Buffer.from(event.body, "base64")
        : Buffer.from(event.body || "", "utf8");

      busboy.end(bodyBuffer);
    });

    const uploadForm = new FormData();
    uploadForm.append("file", fileData.buffer, {
      filename: fileData.filename,
      contentType: fileData.mimeType,
    });

    const response = await fetch("https://picui.cn/api/v1/upload", {
      method: "POST",
      headers: {
        Accept: "application/json",
        // Authorization: "Bearer 你的token",
        ...uploadForm.getHeaders(),
      },
      body: uploadForm,
    });

    const data = await response.json();

    return {
      statusCode: response.status,
      body: JSON.stringify(data),
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({
        status: false,
        message: error.message || "上传失败",
      }),
    };
  }
}