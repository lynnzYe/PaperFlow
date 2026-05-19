import "dotenv/config";
import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import pg from "pg";

const { Pool } = pg;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// DB Config
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: parseInt(process.env.DB_PORT || "5432"),
});

// Initialize Tables
async function initDB() {
  if (!process.env.DATABASE_URL && !process.env.DB_HOST) {
    console.warn("⚠️ No PostgreSQL configuration found. Backend features will fail.");
    return;
  }

  try {
    const client = await pool.connect();
    console.log("Connected to PostgreSQL");
    await client.query(`
      CREATE TABLE IF NOT EXISTS folders (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        parent_id INTEGER REFERENCES folders(id),
        created_at BIGINT DEFAULT extract(epoch from now()) * 1000
      );

      CREATE TABLE IF NOT EXISTS papers (
        id SERIAL PRIMARY KEY,
        title TEXT NOT NULL,
        authors TEXT[] NOT NULL,
        conference TEXT,
        year INTEGER,
        abstract TEXT,
        url TEXT,
        folder_id INTEGER REFERENCES folders(id),
        is_starred BOOLEAN DEFAULT FALSE,
        is_trashed BOOLEAN DEFAULT FALSE,
        created_at BIGINT DEFAULT extract(epoch from now()) * 1000,
        updated_at BIGINT DEFAULT extract(epoch from now()) * 1000,
        notes TEXT,
        doi TEXT,
        bibtex TEXT,
        citation_key TEXT,
        tags TEXT[] DEFAULT '{}'
      );

      CREATE TABLE IF NOT EXISTS paper_folders (
        paper_id INTEGER REFERENCES papers(id) ON DELETE CASCADE,
        folder_id INTEGER REFERENCES folders(id) ON DELETE CASCADE,
        PRIMARY KEY (paper_id, folder_id)
      );
    `);
    console.log("Database tables checked/initialized");

    // Migration: Move folder_id to paper_folders if column exists and paper_folders is empty
    const checkCount = await client.query("SELECT COUNT(*) FROM paper_folders");
    if (parseInt(checkCount.rows[0].count) === 0) {
      console.log("Performing migration to paper_folders...");
      await client.query(`
        INSERT INTO paper_folders (paper_id, folder_id)
        SELECT id, folder_id FROM papers WHERE folder_id IS NOT NULL
        ON CONFLICT DO NOTHING
      `);
    }

    // Ensure columns exist (simple migration)
    const columns = [
      { name: 'citation_key', type: 'TEXT' },
      { name: 'tags', type: "TEXT[] DEFAULT '{}'" },
      { name: 'notes', type: 'TEXT' },
      { name: 'doi', type: 'TEXT' },
      { name: 'bibtex', type: 'TEXT' }
    ];

    for (const col of columns) {
      try {
        await client.query(`ALTER TABLE papers ADD COLUMN IF NOT EXISTS ${col.name} ${col.type}`);
      } catch (e) {
        // Ignore if column already exists
      }
    }

    client.release();
  } catch (err) {
    console.error("Failed to initialize DB:", err);
  }
}

async function startServer() {
  await initDB();
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // --- API Endpoints ---

  // Folders
  app.get("/api/folders", async (req, res) => {
    try {
      const result = await pool.query("SELECT * FROM folders ORDER BY name ASC");
      res.json(result.rows);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/folders", async (req, res) => {
    const { name, parentId } = req.body;
    try {
      const result = await pool.query(
        "INSERT INTO folders (name, parent_id) VALUES ($1, $2) RETURNING *",
        [name, parentId]
      );
      res.json(result.rows[0]);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.patch("/api/folders/:id", async (req, res) => {
    const id = parseInt(req.params.id);
    const { name } = req.body;
    console.log(`PATCH /api/folders/${id}`, { name });
    try {
      const result = await pool.query(
        "UPDATE folders SET name = $1 WHERE id = $2 RETURNING *",
        [name, id]
      );
      if (result.rows.length === 0) {
        console.warn(`Folder ${id} not found for update`);
        return res.status(404).json({ error: "Folder not found" });
      }
      res.json(result.rows[0]);
    } catch (err: any) {
      console.error("PATCH Folder Error:", err);
      res.status(500).json({ error: err.message });
    }
  });

  app.delete("/api/folders/:id", async (req, res) => {
    const id = parseInt(req.params.id);
    console.log(`DELETE /api/folders/${id}`);
    try {
      // First moving papers to root or handling them
      await pool.query("UPDATE papers SET folder_id = NULL WHERE folder_id = $1", [id]);
      const result = await pool.query("DELETE FROM folders WHERE id = $1 RETURNING *", [id]);
      if (result.rows.length === 0) {
        console.warn(`Folder ${id} not found for deletion`);
        return res.status(404).json({ error: "Folder not found" });
      }
      res.json({ success: true });
    } catch (err: any) {
      console.error("DELETE Folder Error:", err);
      res.status(500).json({ error: err.message });
    }
  });

  // Papers
  app.get("/api/papers", async (req, res) => {
    try {
      const result = await pool.query(`
        SELECT p.*, COALESCE(array_agg(pf.folder_id) FILTER (WHERE pf.folder_id IS NOT NULL), '{}') as folder_ids
        FROM papers p
        LEFT JOIN paper_folders pf ON p.id = pf.paper_id
        GROUP BY p.id
        ORDER BY p.created_at DESC
      `);
      // Map names to camelCase for the frontend
      const papers = result.rows.map(r => ({
        id: r.id,
        title: r.title,
        authors: r.authors,
        conference: r.conference,
        year: r.year,
        abstract: r.abstract,
        url: r.url,
        folderIds: r.folder_ids || [],
        isStarred: r.is_starred,
        isTrashed: r.is_trashed,
        createdAt: parseInt(r.created_at),
        updatedAt: parseInt(r.updated_at),
        notes: r.notes,
        doi: r.doi,
        bibtex: r.bibtex,
        citationKey: r.citation_key,
        tags: r.tags || []
      }));
      res.json(papers);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/papers", async (req, res) => {
    const p = req.body;
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const result = await client.query(
        `INSERT INTO papers (title, authors, conference, year, abstract, url, is_starred, is_trashed, doi, bibtex, citation_key, tags)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING *`,
        [p.title, p.authors, p.conference, p.year, p.abstract, p.url, p.isStarred || false, p.isTrashed || false, p.doi, p.bibtex, p.citationKey, p.tags || []]
      );

      const paperId = result.rows[0].id;
      if (p.folderIds && p.folderIds.length > 0) {
        for (const folderId of p.folderIds) {
          await client.query("INSERT INTO paper_folders (paper_id, folder_id) VALUES ($1, $2)", [paperId, folderId]);
        }
      }

      await client.query('COMMIT');
      res.json({ ...result.rows[0], folderIds: p.folderIds || [] });
    } catch (err: any) {
      await client.query('ROLLBACK');
      res.status(500).json({ error: err.message });
    } finally {
      client.release();
    }
  });

  app.patch("/api/papers/:id", async (req, res) => {
    const { id } = req.params;
    const updates = req.body;

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      if (updates.folderIds !== undefined) {
        await client.query("DELETE FROM paper_folders WHERE paper_id = $1", [id]);
        if (updates.folderIds && Array.isArray(updates.folderIds)) {
          for (const folderId of updates.folderIds) {
            await client.query("INSERT INTO paper_folders (paper_id, folder_id) VALUES ($1, $2)", [id, folderId]);
          }
        }
        delete updates.folderIds;
      }

      // Crude dynamic query builder
      const entries = Object.entries(updates)
        .filter(([k]) => k !== 'id' && k !== 'updatedAt' && k !== 'createdAt')
        .map(([k, v], i) => {
          const mapping: any = {
            isStarred: 'is_starred',
            isTrashed: 'is_trashed',
            citationKey: 'citation_key'
          };
          return { field: mapping[k] || k, value: v, placeholder: `$${i + 1}` };
        });

      let updatedRow = null;
      if (entries.length > 0) {
        const fields = entries.map(e => `${e.field} = ${e.placeholder}`);
        const values = entries.map(e => e.value);
        const result = await client.query(
          `UPDATE papers SET ${fields.join(', ')}, updated_at = extract(epoch from now()) * 1000 WHERE id = $${entries.length + 1} RETURNING *`,
          [...values, id]
        );
        updatedRow = result.rows[0];
      } else {
        const result = await client.query("SELECT * FROM papers WHERE id = $1", [id]);
        updatedRow = result.rows[0];
      }

      await client.query('COMMIT');
      if (!updatedRow) return res.status(404).json({ error: "Paper not found" });
      res.json(updatedRow);
    } catch (err: any) {
      await client.query('ROLLBACK');
      console.error("PATCH Error:", err);
      res.status(500).json({ error: err.message });
    } finally {
      client.release();
    }
  });

  app.delete("/api/papers/:id", async (req, res) => {
    const { id } = req.params;
    try {
      await pool.query("DELETE FROM papers WHERE id = $1", [id]);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/fetch-url", async (req, res) => {
    const { url } = req.body;
    if (!url) {
      return res.status(400).json({ error: "URL is required" });
    }

    try {
      const response = await fetch(url, {
        redirect: 'follow',
        headers: {
          "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36",
          "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
          "Accept-Language": "en-US,en;q=0.9",
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch (${response.status}): ${response.statusText}`);
      }

      const html = await response.text();
      // Return first 50k characters of HTML to avoid token limits but get enough metadata
      res.json({ html: html.substring(0, 50000) });
    } catch (error: any) {
      console.error("Error fetching URL:", error);
      res.status(500).json({ error: error.message });
    }
  });

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
