import { Hono } from "hono";
import type { Env } from "./types";
import root from "./routes/root";
import upload from "./routes/upload";
import download from "./routes/download";
import ocr from "./routes/ocr";
import autorag from "./routes/autorag";

const app = new Hono<{ Bindings: Env }>();

app.route("/", root);
app.route("/", upload);
app.route("/", download);
app.route("/", ocr);
app.route("/", autorag);

export default app;
