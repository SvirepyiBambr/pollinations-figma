"use strict";
(() => {
  // code.ts
  var BASE = "https://gen.pollinations.ai";
  figma.showUI(__html__, { width: 320, height: 420 });
  figma.ui.onmessage = async (msg) => {
    var _a, _b;
    if (msg.type === "edit") {
      try {
        const result = await editSelection(msg.prompt, msg.model, msg.apiKey);
        await fillSelection(result);
        figma.ui.postMessage({ type: "done", message: "Edited image applied" });
      } catch (error) {
        figma.ui.postMessage({
          type: "error",
          message: String((_a = error.message) != null ? _a : error)
        });
      }
    }
    if (msg.type === "generate") {
      try {
        const bytes = await generateImageBytes(msg.prompt, msg.model, msg.size, msg.apiKey);
        await fillSelection(bytes);
        figma.ui.postMessage({ type: "done", message: "Image applied" });
      } catch (error) {
        figma.ui.postMessage({
          type: "error",
          message: String((_b = error.message) != null ? _b : error)
        });
      }
    }
  };
  async function generateImageBytes(prompt, model, size, apiKey) {
    const response = await fetch(`${BASE}/v1/images/generations`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({ model, prompt, size })
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const result = await response.json();
    const item = result.data && result.data[0];
    if (item && item.b64_json) {
      return figma.base64Decode(item.b64_json);
    }
    if (item && item.url) {
      const imageResponse = await fetch(item.url);
      return imageResponseBytes(imageResponse);
    }
    throw new Error("no image in response");
  }
  function imageResponseBytes(response) {
    return response.arrayBuffer().then((buffer) => new Uint8Array(buffer));
  }
  async function editSelection(prompt, model, apiKey) {
    const selection = figma.currentPage.selection;
    if (selection.length === 0) {
      throw new Error("select an image-filled shape first");
    }
    const sourceHash = findImageHash(selection[0]);
    if (!sourceHash) {
      throw new Error("selection has no image fill to edit");
    }
    const image = figma.getImageByHash(sourceHash);
    if (!image) {
      throw new Error("source image is no longer available");
    }
    const sourceBytes = await image.getBytesAsync();
    const boundary = "----Pollinations" + Date.now().toString(16);
    const parts = [];
    const enc = new TextEncoder();
    const field = (name, value) => {
      const head = `--${boundary}\r
Content-Disposition: form-data; name="${name}"\r
\r
${value}\r
`;
      return enc.encode(head);
    };
    parts.push(field("prompt", prompt));
    parts.push(field("model", model));
    const fileHead = enc.encode(
      `--${boundary}\r
Content-Disposition: form-data; name="image"; filename="source.png"\r
Content-Type: image/png\r
\r
`
    );
    const fileTail = enc.encode(`\r
--${boundary}--\r
`);
    const body = concatBytes([...parts, fileHead, sourceBytes, fileTail]);
    const response = await fetch(`${BASE}/v1/images/edits`, {
      method: "POST",
      headers: {
        "Content-Type": `multipart/form-data; boundary=${boundary}`,
        Authorization: `Bearer ${apiKey}`
      },
      body
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const result = await response.json();
    const item = result.data && result.data[0];
    if (item && item.b64_json) {
      return figma.base64Decode(item.b64_json);
    }
    if (item && item.url) {
      const imageResponse = await fetch(item.url);
      return imageResponseBytes(imageResponse);
    }
    throw new Error("no image in response");
  }
  function findImageHash(node) {
    if (!("fills" in node)) return null;
    const fills = node.fills;
    if (figma.mixed === fills) return null;
    for (const paint of fills) {
      if (paint.type === "IMAGE" && paint.imageHash) {
        return paint.imageHash;
      }
    }
    return null;
  }
  function concatBytes(chunks) {
    let total = 0;
    for (const chunk of chunks) total += chunk.length;
    const out = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) {
      out.set(chunk, offset);
      offset += chunk.length;
    }
    return out;
  }
  async function fillSelection(bytes) {
    const image = figma.createImage(bytes);
    const fill = {
      type: "IMAGE",
      scaleMode: "FILL",
      imageHash: image.hash
    };
    const selection = figma.currentPage.selection;
    if (selection.length === 0) {
      const rect = figma.createRectangle();
      rect.resize(512, 512);
      rect.fills = [fill];
      figma.currentPage.appendChild(rect);
      figma.viewport.scrollAndZoomIntoView([rect]);
      return;
    }
    for (const node of selection) {
      if ("fills" in node) {
        node.fills = [fill];
      }
    }
  }
})();
