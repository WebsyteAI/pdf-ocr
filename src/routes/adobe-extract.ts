import type { Env } from "../types";

// Handler for POST /adobe-extract/:key
export default async (c: any) => {
  const key = c.req.param("key");
  const object = await c.env.MY_BUCKET.get(key);
  if (!object) return c.text("File not found in R2.", 404);

  // Step 1: Get Adobe access token
  const clientId = c.env.PDF_SERVICES_CLIENT_ID;
  const clientSecret = c.env.PDF_SERVICES_CLIENT_SECRET;
  const tokenResp = await fetch("https://pdf-services.adobe.io/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
    }),
  });
  if (!tokenResp.ok) {
    const err = await tokenResp.text();
    return c.json({ step: "token", error: err, status: tokenResp.status }, 502);
  }
  const { access_token } = await tokenResp.json();

  // Step 2: Get upload pre-signed URI
  const assetResp = await fetch("https://pdf-services.adobe.io/assets", {
    method: "POST",
    headers: {
      "X-API-Key": clientId,
      Authorization: `Bearer ${access_token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ mediaType: "application/pdf" }),
  });
  const assetRespText = await assetResp.text();
  let uploadUri, assetID;
  try {
    const assetJson = JSON.parse(assetRespText);
    uploadUri = assetJson.uploadUri;
    assetID = assetJson.assetID;
  } catch (e) {
    return c.json({ step: "asset", error: assetRespText, status: assetResp.status }, 502);
  }
  if (!assetResp.ok) {
    return c.json({ step: "asset", error: assetRespText, status: assetResp.status }, 502);
  }

  // Step 3: Upload PDF to Adobe's S3
  const putResp = await fetch(uploadUri, {
    method: "PUT",
    headers: { "Content-Type": "application/pdf" },
    body: object.body,
  });
  const putRespText = await putResp.text();
  if (!putResp.ok) {
    return c.json({ step: "upload", error: putRespText, status: putResp.status, uploadUri }, 502);
  }

  // Step 3.5: Wait for asset to be available
  await new Promise((r) => setTimeout(r, 2000)); // 2 second delay

  // Step 4: Create extract job
  const jobResp = await fetch("https://pdf-services.adobe.io/operation/extractpdf/jobs", {
    method: "POST",
    headers: {
      "X-API-Key": clientId,
      Authorization: `Bearer ${access_token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      assetID,
      options: {
        elementsToExtract: ["text", "tables", "images"],
        includeStyling: true,
      },
    }),
  });
  const jobRespText = await jobResp.text();
  if (!jobResp.ok) {
    return c.json({ step: "job", error: jobRespText, status: jobResp.status, assetID, uploadUri, putRespText }, 502);
  }
  // The job location is in the Location header
  const jobLocation = jobResp.headers.get("location");
  if (!jobLocation) return c.json({ step: "job", error: "No job location returned from Adobe.", jobRespText }, 502);

  // Step 5: Poll for job completion
  let status = "in progress";
  let pollResp, pollData;
  for (let i = 0; i < 20 && status === "in progress"; i++) {
    await new Promise((r) => setTimeout(r, 2000));
    pollResp = await fetch(jobLocation, {
      headers: {
        Authorization: `Bearer ${access_token}`,
        "X-API-Key": clientId,
      },
    });
    pollData = await pollResp.json();
    status = pollData.status;
    if (status === "done" || status === "failed") break;
  }
  if (status !== "done") {
    return c.json({ step: "poll", error: "Adobe extract job did not complete", status, pollData }, 502);
  }

  // Step 6: Download the result (usually a zip)
  const downloadUri = pollData.downloadUri;
  if (!downloadUri) return c.json({ step: "download", error: "No downloadUri in Adobe response.", pollData }, 502);
  const resultResp = await fetch(downloadUri);
  const resultRespText = await resultResp.text();
  if (!resultResp.ok) {
    return c.json({ step: "result", error: resultRespText, status: resultResp.status, downloadUri }, 502);
  }
  const resultBuffer = new Uint8Array(await (await fetch(downloadUri)).arrayBuffer());
  const resultKey = `${key}.adobe-extract.zip`;
  await c.env.MY_BUCKET.put(resultKey, resultBuffer, {
    httpMetadata: { contentType: "application/zip" },
  });

  // Return a JSON response with the R2 key
  return c.json({
    message: "Adobe extract complete and uploaded to R2",
    r2Key: resultKey,
    size: resultBuffer.byteLength,
  });
};
