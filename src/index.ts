import { Hono } from "hono";
import type { Env } from "./types";
import root from "./routes/root";
import upload from "./routes/upload";
import download from "./routes/download";
import ocr from "./routes/ocr";
import autorag from "./routes/autorag";

const app = new Hono<{ Bindings: Env }>();

// Instead of app.route, use app.get, app.post, etc. directly
// Root
app.get("/", root);

// Upload
app.post("/upload/:key", upload);

// Download
app.get("/download/:key", download);

// OCR
app.post("/ocr/:key", ocr);

// Autorag
app.post("/autorag", autorag);

export default app;
