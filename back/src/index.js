const express = require("express");
const { Pool } = require("pg");

const app = express();
app.use(express.json());

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function initDb(retries = 10) {
  for (let i = 1; i <= retries; i++) {
    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS todos (
          id SERIAL PRIMARY KEY,
          title TEXT NOT NULL,
          done BOOLEAN NOT NULL DEFAULT false
        )`);
      console.log("Database ready");
      return;
    } catch (err) {
      console.log(`DB not ready (${i}/${retries}): ${err.message}`);
      await new Promise((r) => setTimeout(r, 2000));
    }
  }
  throw new Error("Could not connect to the database");
}

app.get("/api/health", (_req, res) => res.json({ status: "ok" }));

app.get("/api/todos", async (_req, res) => {
  const { rows } = await pool.query("SELECT * FROM todos ORDER BY id");
  res.json(rows);
});

app.post("/api/todos", async (req, res) => {
  const title = (req.body.title || "").trim();
  if (!title) return res.status(400).json({ error: "title is required" });
  const { rows } = await pool.query(
    "INSERT INTO todos (title) VALUES ($1) RETURNING *",
    [title]
  );
  res.status(201).json(rows[0]);
});

app.patch("/api/todos/:id", async (req, res) => {
  const { rows } = await pool.query(
    "UPDATE todos SET done = NOT done WHERE id = $1 RETURNING *",
    [req.params.id]
  );
  rows[0] ? res.json(rows[0]) : res.sendStatus(404);
});

app.delete("/api/todos/:id", async (req, res) => {
  await pool.query("DELETE FROM todos WHERE id = $1", [req.params.id]);
  res.sendStatus(204);
});

const PORT = process.env.PORT || 3000;

initDb()
  .then(() => app.listen(PORT, "0.0.0.0", () => console.log(`API on :${PORT}`)))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });

