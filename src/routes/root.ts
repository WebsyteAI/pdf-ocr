import { Hono } from "hono";

const root = new Hono();
root.get("/", (c) => c.text("Hello from Worker with R2!"));
export default root;
