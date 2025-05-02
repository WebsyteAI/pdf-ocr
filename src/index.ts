import { Hono } from "hono";
import type { Env } from "./types";
import home from "./routes/home";
import upload from "./routes/upload";
import download from "./routes/download";
import ocr from "./routes/ocr";
import autorag from "./routes/autorag";

const app = new Hono<{ Bindings: Env }>();

// Home
app.get("/", home);

// Upload
app.post("/upload/:key", upload);

// Download
app.get("/download/:key", download);

// OCR
app.post("/ocr/:key", ocr);

// Autorag
app.post("/autorag", autorag);

export default app;
