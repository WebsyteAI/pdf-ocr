import type { Env } from "../types";
import { isValidBase64, stripDataUrlPrefix } from "../utils/base64";

const R2_PUBLIC_URL = "https://pub-8e8f33484ec948a2bc5d784574d78e6b.r2.dev";

// Handler for POST /ocr/:key
export default async (c: any) => {
  const apiKey = c.env.MISTRAL_OCR_API_KEY;
  const key = c.req.param("key");
  const object = await c.env.MY_BUCKET.get(key);
  if (!object) return c.text("File not found in R2.", 404);

  const downloadUrl = `${R2_PUBLIC_URL}/${encodeURIComponent(key)}`;
  const payload = {
    model: "mistral-ocr-latest",
    document: {
      document_url: downloadUrl,
      document_name: key,
      type: "document_url"
    },
    include_image_base64: true
  };

  const resp = await fetch("https://api.mistral.ai/v1/ocr", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  if (!resp.ok) {
    const err = await resp.text();
    return c.text(`Mistral OCR API error: ${err}`, 502);
  }

  const data = await resp.json();

  if (Array.isArray(data.pages)) {
    for (let i = 0; i < data.pages.length; i++) {
      const page = data.pages[i];
      if (page.markdown) {
        const mdKey = `${key}.page-${i + 1}.md`;
        await c.env.MY_BUCKET.put(mdKey, page.markdown, { httpMetadata: { contentType: "text/markdown" } });
      }
      if (Array.isArray(page.images)) {
        for (let j = 0; j < page.images.length; j++) {
          const img = page.images[j];
          if (img.image_base64) {
            const base64Data = stripDataUrlPrefix(img.image_base64);
            if (isValidBase64(base64Data)) {
              try {
                const imageBuffer = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
                const imgKey = `${key}.page-${i + 1}.image-${j + 1}.jpeg`;
                await c.env.MY_BUCKET.put(imgKey, imageBuffer, { httpMetadata: { contentType: "image/jpeg" } });
              } catch (e) {
                console.error(`Failed to decode base64 image for page ${i + 1}, image ${j + 1}:`, e);
                continue;
              }
            } else {
              console.error(`Invalid base64 image for page ${i + 1}, image ${j + 1}:`, base64Data.slice(0, 32) + '...');
            }
          }
        }
      }
    }
  }

  return c.json(data);
};
