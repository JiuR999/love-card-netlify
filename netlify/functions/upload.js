import Busboy from "busboy";

export async function handler(event) {
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      body: JSON.stringify({
        status: false,
        message: "Method Not Allowed",
      }),
    };
  }

  try {
    const contentType =
      event.headers["content-type"] || event.headers["Content-Type"];

    if (!contentType) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          status: false,
          message: "缺少 Content-Type",
        }),
      };
    }

    console.log("content-type:", contentType);
    console.log("isBase64Encoded:", event.isBase64Encoded);

    const fileData = await new Promise((resolve, reject) => {
      const busboy = Busboy({
        headers: {
          "content-type": contentType,
        },
      });

      let chunks = [];
      let filename = "upload.jpg";
      let mimeType = "application/octet-stream";
      let found = false;

      busboy.on("file", (fieldname, file, info) => {
        console.log("file field:", fieldname);
        console.log("file info:", info);

        if (fieldname !== "file") {
          file.resume();
          return;
        }

        found = true;
        filename = info?.filename || "upload.jpg";
        mimeType = info?.mimeType || "application/octet-stream";

        file.on("data", (chunk) => {
          chunks.push(chunk);
        });

        file.on("end", () => {
          console.log("file stream end");
        });
      });

      busboy.on("finish", () => {
        console.log("busboy finish, found:", found, "chunks:", chunks.length);

        if (!found || chunks.length === 0) {
          reject(new Error("没有解析到字段 file 或文件内容为空"));
          return;
        }

        resolve({
          buffer: Buffer.concat(chunks),
          filename,
          mimeType,
        });
      });

      busboy.on("error", (err) => {
        console.error("busboy error:", err);
        reject(err);
      });

      const bodyBuffer = event.isBase64Encoded
        ? Buffer.from(event.body || "", "base64")
        : Buffer.from(event.body || "", "binary");

      busboy.end(bodyBuffer);
    });

    console.log("parsed file:", {
      filename: fileData.filename,
      mimeType: fileData.mimeType,
      size: fileData.buffer.length,
    });

    const uploadForm = new FormData();
    const blob = new Blob([fileData.buffer], { type: fileData.mimeType });

    uploadForm.append("file", blob, fileData.filename);

    const response = await fetch("https://picui.cn/api/v1/upload", {
      method: "POST",
      headers: {
        Accept: "application/json",
      },
      body: uploadForm,
    });

    const text = await response.text();
    console.log("picui response:", text);

    return {
      statusCode: response.status,
      headers: {
        "Content-Type": "application/json",
      },
      body: text,
    };
  } catch (error) {
    console.error("upload function error:", error);

    return {
      statusCode: 500,
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        status: false,
        message: error.message || "服务端上传失败",
      }),
    };
  }
}