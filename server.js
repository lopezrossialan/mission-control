require("dotenv").config();
const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const os = require("os");
const OpenAI = require("openai").default;
const mammoth = require("mammoth");
const multer = require("multer");
const { inspectUrl } = require("./playwright-inspector/inspector");

const upload = multer({
    dest: os.tmpdir(),
    limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB max
    fileFilter: (req, file, cb) => {
        const allowed = [
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            "application/msword",
        ];
        if (allowed.includes(file.mimetype) || file.originalname.match(/\.(doc|docx)$/i)) {
            cb(null, true);
        } else {
            cb(new Error("Solo se permiten archivos .doc y .docx"));
        }
    },
});

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "panel")));

const client = new OpenAI({
    baseURL: "https://models.github.ai/inference",
    apiKey: process.env.GITHUB_TOKEN,
});

const AGENT_SYSTEM_PROMPTS = {
    "doc-interpreter": `Eres un analista funcional senior. Tu tarea es analizar documentos funcionales y producir un output estructurado en Markdown con las siguientes secciones:

## Módulos identificados
## Actores y Roles
## Flujos por módulo (principal, alternativo, errores)
## Reglas de negocio
## Precondiciones globales
## Ambigüedades detectadas (marcar con ⚠️)
## Resumen ejecutivo

Restricciones: no inventar funcionalidades, marcar con ⚠️ todo lo ambiguo o incompleto, ser fiel al documento.`,

    "testcase-general": `Eres un QA Engineer senior especializado en diseño de casos de prueba. Tu tarea es generar casos de prueba completos en formato tabla Markdown con las columnas:

| ID | Título | Precondiciones | Pasos | Resultado Esperado | Tipo |

Tipos válidos: Funcional / Regresión / Integración / Borde / Negativo
Agrupá los casos por módulo usando encabezados Markdown.
Al final incluí un resumen con totales por tipo.

Restricciones: IDs correlativos TC-001, TC-002..., pasos atómicos y sin ambigüedad, marcar con [REQUIERE CLARIFICACIÓN] los casos basados en puntos ambiguos.`,

    "testcase-gherkin": `Eres un especialista en BDD y Gherkin. Tu tarea es generar archivos .feature con sintaxis Gherkin válida.

Para cada funcionalidad generá una Feature con narrativa (Como / Quiero / Para).
Escribí Scenarios cubriendo: flujo feliz, alternativos, validaciones y errores.
Usá Scenario Outline + Examples para múltiples datos.
Clasificá con tags: @smoke, @regression, @functional, @negative, @pendiente.

Restricciones: sintaxis Gherkin estrictamente válida, no mezclar idiomas, cada step debe ser atómico.`,

    "playwright-agent": `Eres un automation engineer senior especializado en Playwright con TypeScript. Tu tarea es generar tests end-to-end completos y listos para ejecutar con \`npx playwright test\`.

Seguir estas reglas al generar código:
1. Usar siempre TypeScript
2. Preferir locators semánticos en este orden: getByRole > getByLabel > getByText > getByPlaceholder > getByTestId
3. Estructura Arrange / Act / Assert dentro de cada test con comentarios
4. Agrupar tests por módulo con test.describe()
5. Usar test.beforeEach() para navegación y setup común
6. Cubrir: flujo feliz, flujos alternativos, casos negativos y validaciones de UI
7. Marcar con // TODO: ajustar selector donde el locator dependa de la implementación real
8. Usar test.each() para tests con múltiples conjuntos de datos
9. Para verificar navegación usar: await expect(page).toHaveURL(/patron/)
10. Para verificar visibilidad: await expect(elemento).toBeVisible()

Estructura del archivo generado:
- Imports al inicio
- Constante BASE_URL con placeholder
- test.describe() por módulo
- test.beforeEach() con navegación
- Tests individuales con nombres descriptivos en español
- Comentario final con configuración playwright.config.ts sugerida

Restricciones: no inventar URLs ni selectores específicos, usar placeholders descriptivos, no usar XPath ni CSS selectors directos si hay alternativa semántica.`,
};

const ALLOWED_MODELS = new Set([
    // OpenAI
    "openai/gpt-4.1", "openai/gpt-4.1-mini", "openai/gpt-4.1-nano",
    "openai/gpt-4o", "openai/gpt-4o-mini",
    "openai/o3-mini", "openai/o4-mini",
    // Meta
    "meta/llama-4-maverick-17b-128e-instruct-fp8", "meta/llama-4-scout-17b-16e-instruct",
    "meta/llama-3.3-70b-instruct", "meta/meta-llama-3.1-405b-instruct", "meta/meta-llama-3.1-8b-instruct",
    // DeepSeek
    "deepseek/deepseek-r1", "deepseek/deepseek-r1-0528", "deepseek/deepseek-v3-0324",
    // Mistral
    "mistral-ai/mistral-small-2503", "mistral-ai/mistral-medium-2505", "mistral-ai/codestral-2501",
    // xAI
    "xai/grok-3", "xai/grok-3-mini",
    // Microsoft
    "microsoft/phi-4", "microsoft/phi-4-mini-instruct", "microsoft/phi-4-reasoning", "microsoft/mai-ds-r1",
    // Cohere
    "cohere/cohere-command-a", "cohere/cohere-command-r-plus-08-2024",
    // IDs legacy (backward compat)
    "gpt-4o", "gpt-4o-mini", "DeepSeek-R1", "Phi-4", "Mistral-Large-2411",
    "Meta-Llama-3.3-70B-Instruct", "Meta-Llama-3.1-8B-Instruct", "o3-mini"
]);

// ─── YAML frontmatter parser (sin dependencias externas) ──────────────────
function parseFrontmatter(content) {
    const match = content.match(/^---[\r\n]+([\s\S]*?)[\r\n]+---[\r\n]+([\s\S]*)/);
    if (!match) return { data: {}, body: content };
    const data = {};
    const lines = match[1].split("\n").map(l => l.replace(/\r$/, ""));
    let currentKey = null;
    for (const line of lines) {
        const arrayItem = line.match(/^\s+-\s+(.+)$/);
        const keyValue = line.match(/^([\w-]+):\s*(.*)$/);
        if (arrayItem && currentKey && Array.isArray(data[currentKey])) {
            data[currentKey].push(arrayItem[1].trim());
        } else if (keyValue) {
            currentKey = keyValue[1];
            const val = keyValue[2].trim();
            data[currentKey] = val === "" ? [] : val;
        }
    }
    return { data, body: match[2] };
}

// ─── Rutas de agentes extra ─────────────────────────────────────────────
const EXTRA_DIRS_FILE = path.join(__dirname, "config", "agent-dirs.json");

function readExtraDirs() {
    try {
        if (fs.existsSync(EXTRA_DIRS_FILE)) {
            return JSON.parse(fs.readFileSync(EXTRA_DIRS_FILE, "utf8"));
        }
    } catch (_) { }
    return [];
}

function writeExtraDirs(dirs) {
    const dir = path.dirname(EXTRA_DIRS_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(EXTRA_DIRS_FILE, JSON.stringify(dirs, null, 2), "utf8");
}

function getAllAgentDirs() {
    return [path.join(__dirname, "agents"), ...readExtraDirs()];
}

// Busca el archivo de prompt/system de un agente en todas las rutas (subfolder y plano)
function findAgentPromptFile(agentId) {
    for (const dir of getAllAgentDirs()) {
        // Estructura subfolder: agents/{id}/{id}.prompt.md
        const promptInSubfolder = path.join(dir, agentId, `${agentId}.prompt.md`);
        if (fs.existsSync(promptInSubfolder)) return promptInSubfolder;
        // Subfolder sin .prompt.md: usa el .agent.md
        const agentInSubfolder = path.join(dir, agentId, `${agentId}.agent.md`);
        if (fs.existsSync(agentInSubfolder)) return agentInSubfolder;
        // Estructura plana: agents/{id}.agent.md
        const agentFlat = path.join(dir, `${agentId}.agent.md`);
        if (fs.existsSync(agentFlat)) return agentFlat;
    }
    return null;
}

// Helper: leer agente desde un archivo .agent.md + opcional .prompt.md
function readAgentFromFile(agentFile, promptFile, agentsDir, defaultDir) {
    const { data, body } = parseFrontmatter(fs.readFileSync(agentFile, "utf8"));
    const folder = path.basename(agentFile, ".agent.md");
    const agentId = data.id || folder;
    let promptBody = body.trim();
    if (promptFile && fs.existsSync(promptFile)) {
        const { body: pb } = parseFrontmatter(fs.readFileSync(promptFile, "utf8"));
        promptBody = pb.trim();
    }
    return {
        id: agentId,
        name: data.name || folder,
        version: data.version || "1.0.0",
        description: data.description || "",
        skills: Array.isArray(data.skills) ? data.skills : [],
        icon: data.icon || "\uD83E\uDD16",
        flow: data.flow || "",
        hint: data.hint || "Peg\u00E1 el contenido del documento aqu\u00ED.",
        prompt: promptBody,
        sourceDir: agentsDir,
        isDefault: agentsDir === defaultDir,
        isFlat: true,
        agentFile,
    };
}


app.get("/api/agent-dirs", (req, res) => {
    res.json({ dirs: readExtraDirs() });
});

app.post("/api/agent-dirs", (req, res) => {
    const { dir } = req.body;
    if (!dir || typeof dir !== "string") return res.status(400).json({ error: "dir requerido" });
    const normalized = path.normalize(dir.trim());
    if (!path.isAbsolute(normalized)) return res.status(400).json({ error: "Debe ser una ruta absoluta" });
    if (!fs.existsSync(normalized) || !fs.statSync(normalized).isDirectory()) {
        return res.status(400).json({ error: "La ruta no existe o no es una carpeta" });
    }
    const existing = readExtraDirs();
    if (existing.includes(normalized)) return res.status(400).json({ error: "La ruta ya está registrada" });
    existing.push(normalized);
    writeExtraDirs(existing);
    res.json({ ok: true, dirs: existing });
});

app.delete("/api/agent-dirs", (req, res) => {
    const { dir } = req.body;
    if (!dir) return res.status(400).json({ error: "dir requerido" });
    const normalized = path.normalize(dir.trim());
    const updated = readExtraDirs().filter(d => d !== normalized);
    writeExtraDirs(updated);
    res.json({ ok: true, dirs: updated });
});

// Listar agentes disponibles leyendo todas las rutas configuradas
// Soporta: estructura subfolder ({id}/{id}.agent.md) y estructura plana ({id}.agent.md)
app.get("/api/agents", (req, res) => {
    const defaultDir = path.join(__dirname, "agents");
    const allDirs = getAllAgentDirs();
    const result = [];
    const seenIds = new Set();
    for (const agentsDir of allDirs) {
        if (!fs.existsSync(agentsDir)) continue;
        try {
            const entries = fs.readdirSync(agentsDir, { withFileTypes: true });
            // Estructura subfolder
            for (const entry of entries.filter(e => e.isDirectory())) {
                const folder = entry.name;
                const agentFile = path.join(agentsDir, folder, `${folder}.agent.md`);
                const promptFile = path.join(agentsDir, folder, `${folder}.prompt.md`);
                if (!fs.existsSync(agentFile)) continue;
                const { data, body } = parseFrontmatter(fs.readFileSync(agentFile, "utf8"));
                const agentId = data.id || folder;
                if (seenIds.has(agentId)) continue;
                seenIds.add(agentId);
                let promptBody = body.trim();
                if (fs.existsSync(promptFile)) {
                    const { body: pb } = parseFrontmatter(fs.readFileSync(promptFile, "utf8"));
                    promptBody = pb.trim();
                }
                result.push({
                    id: agentId,
                    name: data.name || folder,
                    version: data.version || "1.0.0",
                    description: data.description || "",
                    skills: Array.isArray(data.skills) ? data.skills : [],
                    icon: data.icon || "\uD83E\uDD16",
                    flow: data.flow || "",
                    hint: data.hint || "Peg\u00E1 el contenido del documento aqu\u00ED.",
                    prompt: promptBody,
                    sourceDir: agentsDir,
                    isDefault: agentsDir === defaultDir,
                    isFlat: false,
                    agentFile: agentFile,
                });
            }
            // Estructura plana: {id}.agent.md directo en la carpeta
            for (const entry of entries.filter(e => e.isFile() && e.name.endsWith(".agent.md"))) {
                const agentFile = path.join(agentsDir, entry.name);
                const { data, body } = parseFrontmatter(fs.readFileSync(agentFile, "utf8"));
                const folder = entry.name.replace(/\.agent\.md$/, "");
                const agentId = data.id || folder;
                if (seenIds.has(agentId)) continue;
                seenIds.add(agentId);
                result.push({
                    id: agentId,
                    name: data.name || folder,
                    version: data.version || "1.0.0",
                    description: data.description || "",
                    skills: Array.isArray(data.skills) ? data.skills : [],
                    icon: data.icon || "\uD83E\uDD16",
                    flow: data.flow || "",
                    hint: data.hint || "Peg\u00E1 el contenido del documento aqu\u00ED.",
                    prompt: body.trim(),
                    sourceDir: agentsDir,
                    isDefault: agentsDir === defaultDir,
                    isFlat: true,
                    agentFile: agentFile,
                });
            }
        } catch (_) { }
    }
    res.json({ agents: result });
});

// Importar agente externo a la carpeta agents/ local (copia los archivos)
app.post("/api/agents/import", (req, res) => {
    const { agentId, agentFile } = req.body;
    if (!agentId || !agentFile) return res.status(400).json({ error: "agentId y agentFile requeridos" });
    // Validar que el archivo origem existe y está en una ruta registrada
    const normalizedFile = path.normalize(agentFile);
    const allowedDirs = getAllAgentDirs().map(d => path.normalize(d));
    const isAllowed = allowedDirs.some(d => normalizedFile.startsWith(d));
    if (!isAllowed || !fs.existsSync(normalizedFile)) {
        return res.status(400).json({ error: "Archivo no permitido o no encontrado" });
    }
    const localAgentsDir = path.join(__dirname, "agents");
    const targetDir = path.join(localAgentsDir, agentId);
    try {
        if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true });
        // Copiar .agent.md
        fs.copyFileSync(normalizedFile, path.join(targetDir, `${agentId}.agent.md`));
        // Copiar .prompt.md si existe junto al .agent.md
        const srcDir = path.dirname(normalizedFile);
        const siblingPrompt = path.join(srcDir, `${agentId}.prompt.md`);
        if (fs.existsSync(siblingPrompt)) {
            fs.copyFileSync(siblingPrompt, path.join(targetDir, `${agentId}.prompt.md`));
        }
        // Crear carpeta skills/ vacía
        const skillsDir = path.join(targetDir, "skills");
        if (!fs.existsSync(skillsDir)) fs.mkdirSync(skillsDir);
        res.json({ ok: true, agentId, targetDir });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});



app.post("/api/chat", async (req, res) => {
    const { agentId, messages, model: requestedModel } = req.body;

    if (!agentId || !messages || !Array.isArray(messages)) {
        return res.status(400).json({ error: "agentId y messages son requeridos" });
    }

    const systemPrompt = AGENT_SYSTEM_PROMPTS[agentId] || (() => {
        const promptFile = findAgentPromptFile(agentId);
        if (promptFile) {
            const { body } = parseFrontmatter(fs.readFileSync(promptFile, "utf8"));
            return body.trim();
        }
        return null;
    })();

    if (!systemPrompt) {
        return res.status(400).json({ error: `Agente desconocido: ${agentId}` });
    }

    const model = ALLOWED_MODELS.has(requestedModel) ? requestedModel : "gpt-4o";

    // Límites de tokens por modelo (aprox. 4 chars = 1 token)
    // Custom/restricted tier: max 4000 in → usamos 3000 con margen
    const RESTRICTED_MODELS = new Set([
        "deepseek/deepseek-r1", "deepseek/deepseek-r1-0528", "microsoft/mai-ds-r1",
        "xai/grok-3", "xai/grok-3-mini",
        "openai/o3-mini", "openai/o4-mini",
        "DeepSeek-R1", "o3-mini" // legacy IDs
    ]);
    const tokenLimit = RESTRICTED_MODELS.has(model) ? 3000 : 7000;
    const MAX_HISTORY_CHARS = tokenLimit * 4;

    // Recortar historial desde el inicio hasta entrar en el límite
    let trimmedMessages = [...messages];
    while (trimmedMessages.length > 1) {
        const totalChars = trimmedMessages.reduce((sum, m) => sum + (m.content || "").length, 0)
            + systemPrompt.length;
        if (totalChars <= MAX_HISTORY_CHARS) break;
        trimmedMessages.shift(); // elimina el mensaje más antiguo
    }

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    try {
        const stream = await client.chat.completions.create({
            model,
            messages: [{ role: "system", content: systemPrompt }, ...trimmedMessages],
            stream: true,
            stream_options: { include_usage: true },
        });

        let fullContent = "";
        let usage = null;

        for await (const chunk of stream) {
            const delta = chunk.choices[0]?.delta?.content || "";
            if (delta) {
                fullContent += delta;
                res.write(`data: ${JSON.stringify({ delta })}\n\n`);
            }
            if (chunk.usage) usage = chunk.usage;
        }

        console.log(`[${agentId}] model=${model} | prompt=${usage?.prompt_tokens} completion=${usage?.completion_tokens} total=${usage?.total_tokens}`);
        res.write(`data: ${JSON.stringify({ done: true, fullContent, usage, model })}\n\n`);
        res.end();
    } catch (err) {
        console.error("Error llamando a GitHub Models:", err.message);
        res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
        res.end();
    }
});

// Guardar output como .md en /outputs/
app.post("/api/save", (req, res) => {
    const { filename, content } = req.body;

    if (!filename || !content) {
        return res.status(400).json({ error: "filename y content son requeridos" });
    }

    // Sanitizar nombre de archivo
    const safeName = filename.replace(/[^a-zA-Z0-9\-_\.]/g, "_").replace(/\.+/g, ".").replace(/^\./, "");
    const finalName = safeName.endsWith(".md") ? safeName : `${safeName}.md`;
    const outputPath = path.join(__dirname, "outputs", finalName);

    try {
        fs.writeFileSync(outputPath, content, "utf8");
        res.json({ success: true, filename: finalName });
    } catch (err) {
        res.status(500).json({ error: `Error al guardar: ${err.message}` });
    }
});

// Upload y extracción de texto de .doc/.docx
app.post("/api/upload", upload.single("file"), async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: "No se recibió ningún archivo" });
    }
    try {
        const result = await mammoth.extractRawText({ path: req.file.path });
        fs.unlinkSync(req.file.path); // eliminar archivo temporal
        const text = result.value.trim();
        if (!text) {
            return res.status(422).json({ error: "No se pudo extraer texto del documento" });
        }
        res.json({ text, filename: req.file.originalname });
    } catch (err) {
        try { fs.unlinkSync(req.file.path); } catch (_) { }
        res.status(500).json({ error: `Error al procesar el archivo: ${err.message}` });
    }
});

// Cuota real de GitHub Models (vía headers de la API)
app.get("/api/quota", async (req, res) => {
    const model = req.query.model || "gpt-4o-mini";
    const allowed = ["gpt-4o", "gpt-4o-mini", "o3-mini", "Meta-Llama-3.3-70B-Instruct",
        "Meta-Llama-3.1-8B-Instruct", "Mistral-Large-2411", "Phi-4", "DeepSeek-R1"];
    if (!allowed.includes(model)) return res.status(400).json({ error: "Modelo no permitido" });
    try {
        const response = await fetch("https://models.inference.ai.azure.com/chat/completions", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${process.env.GITHUB_TOKEN}`,
            },
            body: JSON.stringify({
                model,
                messages: [{ role: "user", content: "hi" }],
                max_tokens: 1,
            }),
        });
        const h = response.headers;
        res.json({
            model,
            status: response.status,
            remaining_tokens: parseInt(h.get("x-ratelimit-remaining-tokens") || "0"),
            limit_tokens: parseInt(h.get("x-ratelimit-limit-tokens") || "0"),
            remaining_requests: parseInt(h.get("x-ratelimit-remaining-requests") || "0"),
            limit_requests: parseInt(h.get("x-ratelimit-limit-requests") || "0"),
            region: h.get("x-ms-region") || "",
            checked_at: new Date().toISOString(),
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Inspeccionar URL con Playwright
app.post("/api/inspect", async (req, res) => {
    const { url } = req.body;
    if (!url) return res.status(400).json({ error: "URL requerida" });
    try {
        const result = await inspectUrl(url);
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Guardar JSON de inspeccion
app.post("/api/save-json", (req, res) => {
    const { filename, data } = req.body;
    if (!filename || !data) return res.status(400).json({ error: "Faltan filename o data" });
    const safe = filename.replace(/[^a-zA-Z0-9_\-\.]/g, "_").replace(/\.json$/i, "") + ".json";
    const outputsDir = path.join(__dirname, "outputs");
    if (!fs.existsSync(outputsDir)) fs.mkdirSync(outputsDir, { recursive: true });
    fs.writeFileSync(path.join(outputsDir, safe), JSON.stringify(data, null, 2), "utf8");
    res.json({ ok: true, filename: safe });
});

// Listar outputs
app.get("/api/outputs", (req, res) => {
    const outputsDir = path.join(__dirname, "outputs");
    try {
        const files = fs.readdirSync(outputsDir).filter(f => f.endsWith(".md"));
        res.json({ files });
    } catch {
        res.json({ files: [] });
    }
});

const PORT = 3000;
app.listen(PORT, () => {
    console.log(`\n🛸 Mission Control server corriendo en http://localhost:${PORT}`);
    console.log(`   Panel: http://localhost:${PORT}/index.html\n`);
});
