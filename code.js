"use strict";
(() => {
  // code.ts
  var BASE = "https://gen.pollinations.ai";
  figma.showUI(__html__, { width: 320, height: 420 });
  figma.ui.onmessage = async (msg) => {
    var _a;
    if (msg.type === "generate") {
      try {
        const bytes = await generateImageBytes(msg.prompt, msg.model, msg.size, msg.apiKey);
        await fillSelection(bytes);
        figma.ui.postMessage({ type: "done", message: "Image applied" });
      } catch (error) {
        figma.ui.postMessage({
          type: "error",
          message: String((_a = error.message) != null ? _a : error)
        });
      }
    }
  };
  async function generateImageBytes(prompt, model, size, apiKey) {
    const response = await fetch(`${BASE}/v1/images/generations`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ***}`
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
