const express = require("express");
const sqlite3 = require("sqlite3").verbose();
const cors = require("cors");

const app = express();
const PORT = 3000;

// Middleware per permetre peticions JSON i CORS
app.use(express.json());
app.use(cors());

// Connexió a la base de dades SQLite
const db = new sqlite3.Database("./tasks.db", (err) => {
    if (err) console.error(err.message);
    else console.log("✅ Connexió a SQLite establerta.");
});

// Crear la taula de tasques si no existeix
db.run(
    `CREATE TABLE IF NOT EXISTS tasks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        text TEXT NOT NULL,
        completed BOOLEAN NOT NULL DEFAULT false
    )`
);

// OBTENIR TOTES LES TASQUES (GET /tasks)
app.get("/tasks", (req, res) => {
    db.all("SELECT * FROM tasks", [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// AFEGIR UNA NOVA TASCA (POST /tasks)
app.post("/tasks", (req, res) => {
    const { text } = req.body;
    if (!text) return res.status(400).json({ error: "El text de la tasca és obligatori." });

    db.run("INSERT INTO tasks (text, completed) VALUES (?, ?)", [text, 0], function (err) {
        if (err) return res.status(500).json({ error: err.message });

        res.json({ id: this.lastID, text, completed: false });
    });
});

// ACTUALITZAR UNA TASCA (PUT /tasks/:id)
app.put("/tasks/:id", (req, res) => {
    const { id } = req.params;
    const { text, completed } = req.body;

    db.run("UPDATE tasks SET text = ?, completed = ? WHERE id = ?", [text, completed, id], function (err) {
        if (err) return res.status(500).json({ error: err.message });

        res.json({ message: "Tasca actualitzada correctament." });
    });
});

// ELIMINAR UNA TASCA (DELETE /tasks/:id)
app.delete("/tasks/:id", (req, res) => {
    const { id } = req.params;

    db.run("DELETE FROM tasks WHERE id = ?", [id], function (err) {
        if (err) return res.status(500).json({ error: err.message });

        res.json({ message: "Tasca eliminada correctament." });
    });
});

// Posar el servidor en marxa
app.listen(PORT, () => {
    console.log(`🚀 Servidor escoltant a http://localhost:${PORT}`);
});
