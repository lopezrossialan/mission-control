require("dotenv").config();
const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const os = require("os");
const OpenAI = require("openai").default;
const mammoth = require("mammoth");
const WordExtractor = require("word-extractor");
const multer = require("multer");
const { inspectUrl } = require("./playwright-inspector/inspector");

const upload = multer({
    dest: os.tmpdir(),
    limits: { fileSize: 50 * 1024 * 1024 }, // 50 MB max
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
app.use(express.static(path.join(__dirname, "panel"), { etag: false, lastModified: false, setHeaders: (res) => { res.setHeader("Cache-Control", "no-store"); } }));

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

// Importar agente desde archivos enviados por el browser (Opción A: webkitdirectory)
app.post("/api/agents/import-files", (req, res) => {
    const { agentContent, promptContent, skillsContent, folderName } = req.body;
    if (!agentContent || !folderName) {
        return res.status(400).json({ error: "agentContent y folderName son requeridos" });
    }

    // Extraer el agentId desde el frontmatter del .agent.md
    const idMatch = agentContent.match(/^---[\r\n]+[\s\S]*?^id:\s*(.+)$/m);
    const agentId = idMatch ? idMatch[1].trim() : folderName.replace(/[^a-zA-Z0-9\-_]/g, "-");

    const localAgentsDir = path.join(__dirname, "agents");
    const targetDir = path.join(localAgentsDir, agentId);

    try {
        if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true });

        // Guardar .agent.md
        fs.writeFileSync(path.join(targetDir, `${agentId}.agent.md`), agentContent, "utf8");

        // Guardar .prompt.md si viene
        if (promptContent) {
            fs.writeFileSync(path.join(targetDir, `${agentId}.prompt.md`), promptContent, "utf8");
        }

        // Guardar skills
        if (skillsContent && skillsContent.length > 0) {
            const skillsDir = path.join(targetDir, "skills");
            if (!fs.existsSync(skillsDir)) fs.mkdirSync(skillsDir);
            for (const skill of skillsContent) {
                const safeName = path.basename(skill.name).replace(/[^a-zA-Z0-9\-_.]/g, "_");
                fs.writeFileSync(path.join(skillsDir, safeName), skill.content, "utf8");
            }
        } else {
            const skillsDir = path.join(targetDir, "skills");
            if (!fs.existsSync(skillsDir)) fs.mkdirSync(skillsDir);
        }

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

    const model = ALLOWED_MODELS.has(requestedModel) ? requestedModel : "openai/gpt-4o";

    // Límites de tokens por modelo (aprox. 4 chars = 1 token)
    const RESTRICTED_MODELS = new Set([
        "deepseek/deepseek-r1", "deepseek/deepseek-r1-0528", "microsoft/mai-ds-r1",
        "xai/grok-3", "xai/grok-3-mini",
        "openai/o3-mini", "openai/o4-mini",
        "DeepSeek-R1", "o3-mini"
    ]);
    // Modelos con contexto grande (128k+)
    const LARGE_CONTEXT_MODELS = new Set([
        "openai/gpt-4.1", "openai/gpt-4.1-mini", "openai/gpt-4.1-nano",
        "openai/gpt-4o", "openai/gpt-4o-mini",
        "meta/llama-4-maverick-17b-128e-instruct-fp8", "meta/llama-4-scout-17b-16e-instruct",
        "meta/meta-llama-3.1-405b-instruct",
        "gpt-4o", "gpt-4o-mini"
    ]);

    let tokenLimit;
    if (RESTRICTED_MODELS.has(model)) {
        tokenLimit = 3000;
    } else if (LARGE_CONTEXT_MODELS.has(model)) {
        tokenLimit = 60000; // ~240k chars, conservador para 128k ctx
    } else {
        tokenLimit = 15000; // default para modelos estándar
    }
    const MAX_HISTORY_CHARS = tokenLimit * 4;

    // Recortar cada mensaje individual al límite para evitar que un documento gigante rompa la request
    const MAX_SINGLE_MSG_CHARS = (tokenLimit - 1000) * 4;
    let trimmedMessages = messages.map(m => {
        if (m.content && m.content.length > MAX_SINGLE_MSG_CHARS) {
            return { ...m, content: m.content.substring(0, MAX_SINGLE_MSG_CHARS) + "\n\n[... documento truncado por límite del modelo ...]" };
        }
        return m;
    });

    // Recortar historial desde el inicio hasta entrar en el límite total
    while (trimmedMessages.length > 1) {
        const totalChars = trimmedMessages.reduce((sum, m) => sum + (m.content || "").length, 0)
            + systemPrompt.length;
        if (totalChars <= MAX_HISTORY_CHARS) break;
        trimmedMessages.shift();
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
app.post("/api/upload", (req, res) => {
    upload.single("file")(req, res, async (err) => {
        if (err) {
            if (err.code === "LIMIT_FILE_SIZE") {
                return res.status(400).json({ error: "El archivo supera el límite de 10 MB" });
            }
            return res.status(400).json({ error: err.message });
        }
        if (!req.file) {
            return res.status(400).json({ error: "No se recibió ningún archivo" });
        }
        try {
            let text = "";
            if (req.file.originalname.match(/\.docx$/i)) {
                const result = await mammoth.extractRawText({ path: req.file.path });
                text = result.value.trim();
            } else if (req.file.originalname.match(/\.doc$/i)) {
                const extractor = new WordExtractor();
                const doc = await extractor.extract(req.file.path);
                text = doc.getBody().trim();
            } else {
                fs.unlinkSync(req.file.path);
                return res.status(422).json({ error: "Solo se admiten archivos .doc y .docx" });
            }
            fs.unlinkSync(req.file.path);
            if (!text) {
                return res.status(422).json({ error: "No se pudo extraer texto del documento" });
            }
            res.json({ text, filename: req.file.originalname });
        } catch (e) {
            try { fs.unlinkSync(req.file.path); } catch (_) { }
            res.status(500).json({ error: `Error al procesar el archivo: ${e.message}` });
        }
    });
});

// Cuota real de GitHub Models (vía headers de la API)
app.get("/api/quota", async (req, res) => {
    const model = req.query.model || "openai/gpt-4o-mini";
    if (!ALLOWED_MODELS.has(model)) return res.status(400).json({ error: "Modelo no permitido" });
    try {
        const response = await fetch("https://models.github.ai/inference/chat/completions", {
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
        // Loguear todos los headers de rate limit para debug
        const allHeaders = {};
        h.forEach((v, k) => { if (k.startsWith("x-ratelimit") || k.startsWith("x-ms")) allHeaders[k] = v; });
        const remaining_tokens = h.get("x-ratelimit-remaining-tokens");
        const limit_tokens = h.get("x-ratelimit-limit-tokens");
        const remaining_requests = h.get("x-ratelimit-remaining-requests");
        const limit_requests = h.get("x-ratelimit-limit-requests");
        res.json({
            model,
            status: response.status,
            remaining_tokens: remaining_tokens !== null ? parseInt(remaining_tokens) : null,
            limit_tokens: limit_tokens !== null ? parseInt(limit_tokens) : null,
            remaining_requests: remaining_requests !== null ? parseInt(remaining_requests) : null,
            limit_requests: limit_requests !== null ? parseInt(limit_requests) : null,
            region: h.get("x-ms-region") || "",
            headers_found: allHeaders,
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

// Listar outputs (resumen)
app.get("/api/outputs", (req, res) => {
    const outputsDir = path.join(__dirname, "outputs");
    try {
        const files = fs.readdirSync(outputsDir)
            .filter(f => f.endsWith(".md") || f.endsWith(".json"))
            .map(f => {
                const stat = fs.statSync(path.join(outputsDir, f));
                return { name: f, size: stat.size, modified: stat.mtime.toISOString() };
            })
            .sort((a, b) => new Date(b.modified) - new Date(a.modified));
        res.json({ files });
    } catch {
        res.json({ files: [] });
    }
});

// Obtener contenido de un output
app.get("/api/outputs/:filename", (req, res) => {
    const safe = path.basename(req.params.filename).replace(/[^a-zA-Z0-9\-_\.]/g, "_");
    const filePath = path.join(__dirname, "outputs", safe);
    if (!filePath.startsWith(path.join(__dirname, "outputs"))) return res.status(403).json({ error: "No permitido" });
    if (!fs.existsSync(filePath)) return res.status(404).json({ error: "Archivo no encontrado" });
    res.json({ content: fs.readFileSync(filePath, "utf8"), filename: safe });
});

// Eliminar un output
app.delete("/api/outputs/:filename", (req, res) => {
    const safe = path.basename(req.params.filename).replace(/[^a-zA-Z0-9\-_\.]/g, "_");
    const filePath = path.join(__dirname, "outputs", safe);
    if (!filePath.startsWith(path.join(__dirname, "outputs"))) return res.status(403).json({ error: "No permitido" });
    if (!fs.existsSync(filePath)) return res.status(404).json({ error: "No encontrado" });
    fs.unlinkSync(filePath);
    res.json({ ok: true });
});

// ─── CONFIG / SETUP WIZARD ──────────────────────────────────────────────────

const ENV_PATH = path.join(__dirname, ".env");
const CONFIG_KEYS = ["GITHUB_TOKEN", "OPENAI_API_KEY", "ANTHROPIC_API_KEY", "JIRA_BASE_URL", "JIRA_EMAIL", "JIRA_TOKEN"];

function readEnvFile() {
    if (!fs.existsSync(ENV_PATH)) return {};
    const lines = fs.readFileSync(ENV_PATH, "utf8").split(/\r?\n/);
    const result = {};
    for (const line of lines) {
        const match = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
        if (match) result[match[1]] = match[2].trim().replace(/^["']|["']$/g, "");
    }
    return result;
}

function writeEnvFile(configObj) {
    const existing = readEnvFile();
    const merged = { ...existing, ...configObj };
    for (const k of Object.keys(merged)) {
        if (merged[k] === "") delete merged[k];
    }
    const lines = Object.entries(merged).map(([k, v]) => `${k}=${v}`);
    fs.writeFileSync(ENV_PATH, lines.join("\n") + "\n", "utf8");
}

app.get("/api/config", (req, res) => {
    const env = readEnvFile();
    const masked = {};
    for (const key of CONFIG_KEYS) {
        const val = env[key] || "";
        masked[key] = val ? "***" + val.slice(-4) : "";
    }
    res.json({ config: masked, isConfigured: !!(env.GITHUB_TOKEN) });
});

app.post("/api/config", (req, res) => {
    const { config } = req.body;
    if (!config || typeof config !== "object") return res.status(400).json({ error: "config requerido" });
    const sanitized = {};
    for (const key of CONFIG_KEYS) {
        if (config[key] !== undefined && !String(config[key]).includes("***")) {
            sanitized[key] = String(config[key]).trim();
        }
    }
    try {
        writeEnvFile(sanitized);
        for (const [k, v] of Object.entries(sanitized)) {
            if (v) process.env[k] = v;
        }
        if (sanitized.GITHUB_TOKEN) client.apiKey = sanitized.GITHUB_TOKEN;
        res.json({ ok: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ─── MCP MANAGEMENT ─────────────────────────────────────────────────────────

const MCP_FILE = path.join(__dirname, ".vscode", "mcp.json");

function readMcpFile() {
    try {
        if (fs.existsSync(MCP_FILE)) return JSON.parse(fs.readFileSync(MCP_FILE, "utf8"));
    } catch (_) { }
    return { servers: {} };
}

function writeMcpFile(data) {
    const dir = path.dirname(MCP_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(MCP_FILE, JSON.stringify(data, null, 2), "utf8");
}

app.get("/api/mcp", (req, res) => { res.json(readMcpFile()); });

app.post("/api/mcp", (req, res) => {
    const { name, command, args, env: envVars } = req.body;
    if (!name || !command) return res.status(400).json({ error: "name y command requeridos" });
    const safeName = name.replace(/[^a-zA-Z0-9\-_]/g, "-");
    const data = readMcpFile();
    if (!data.servers) data.servers = {};
    data.servers[safeName] = { command, args: Array.isArray(args) ? args : [], env: envVars || {} };
    writeMcpFile(data);
    res.json({ ok: true, servers: data.servers });
});

app.delete("/api/mcp/:name", (req, res) => {
    const data = readMcpFile();
    if (data.servers) delete data.servers[req.params.name];
    writeMcpFile(data);
    res.json({ ok: true, servers: data.servers || {} });
});

// ─── AGENT CRUD ──────────────────────────────────────────────────────────────

app.post("/api/agents/create", (req, res) => {
    const { id, name, description, icon, flow, hint, prompt, skills } = req.body;
    if (!id || !name) return res.status(400).json({ error: "id y name son requeridos" });
    const safeId = id.replace(/[^a-zA-Z0-9\-_]/g, "-").toLowerCase();
    const agentDir = path.join(__dirname, "agents", safeId);
    if (fs.existsSync(agentDir)) return res.status(409).json({ error: `Ya existe un agente con ID "${safeId}"` });
    const skillsList = Array.isArray(skills) ? skills : [];
    const skillsBlock = skillsList.length > 0 ? skillsList.map(s => `  - ${s}`).join("\n") : "  []";
    const agentContent = `---\nname: ${name}\nid: ${safeId}\nversion: 1.0.0\ndescription: ${description || ""}\nicon: ${icon || "🤖"}\nflow: ${flow || ""}\nhint: ${hint || "Pegá el contenido del documento aquí."}\nskills:\n${skillsBlock}\n---\n\n${prompt || ""}\n`;
    const promptContent = `---\nagent: ${safeId}\nversion: 1.0.0\n---\n${prompt || ""}\n`;
    try {
        fs.mkdirSync(agentDir, { recursive: true });
        fs.mkdirSync(path.join(agentDir, "skills"), { recursive: true });
        fs.writeFileSync(path.join(agentDir, `${safeId}.agent.md`), agentContent, "utf8");
        fs.writeFileSync(path.join(agentDir, `${safeId}.prompt.md`), promptContent, "utf8");
        res.json({ ok: true, agentId: safeId });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put("/api/agents/:id", (req, res) => {
    const safeId = path.basename(req.params.id).replace(/[^a-zA-Z0-9\-_]/g, "-");
    const { name, description, icon, flow, hint, prompt, skills } = req.body;
    const agentDir = path.join(__dirname, "agents", safeId);
    if (!fs.existsSync(agentDir)) return res.status(404).json({ error: "Agente no encontrado" });
    const skillsList = Array.isArray(skills) ? skills : [];
    const skillsBlock = skillsList.length > 0 ? skillsList.map(s => `  - ${s}`).join("\n") : "  []";
    const agentContent = `---\nname: ${name}\nid: ${safeId}\nversion: 1.0.0\ndescription: ${description || ""}\nicon: ${icon || "🤖"}\nflow: ${flow || ""}\nhint: ${hint || "Pegá el contenido del documento aquí."}\nskills:\n${skillsBlock}\n---\n\n${prompt || ""}\n`;
    const promptContent = `---\nagent: ${safeId}\nversion: 1.0.0\n---\n${prompt || ""}\n`;
    try {
        fs.writeFileSync(path.join(agentDir, `${safeId}.agent.md`), agentContent, "utf8");
        fs.writeFileSync(path.join(agentDir, `${safeId}.prompt.md`), promptContent, "utf8");
        res.json({ ok: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete("/api/agents/:id", (req, res) => {
    const safeId = path.basename(req.params.id).replace(/[^a-zA-Z0-9\-_]/g, "-");
    const defaultAgents = new Set(["doc-interpreter", "testcase-general", "testcase-gherkin", "playwright-agent"]);
    if (defaultAgents.has(safeId)) return res.status(403).json({ error: "No se pueden eliminar los agentes predeterminados" });
    const agentDir = path.join(__dirname, "agents", safeId);
    if (!fs.existsSync(agentDir)) return res.status(404).json({ error: "Agente no encontrado" });
    try {
        fs.rmSync(agentDir, { recursive: true, force: true });
        res.json({ ok: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── IMPORT FROM GITHUB ──────────────────────────────────────────────────────

app.post("/api/agents/import-github", async (req, res) => {
    const { repoUrl, token } = req.body;
    if (!repoUrl) return res.status(400).json({ error: "repoUrl requerido" });
    const urlMatch = repoUrl.trim().match(/github\.com\/([^\/]+)\/([^\/\?#]+)(?:\/tree\/([^\/]+)\/?(.*))?/);
    if (!urlMatch) return res.status(400).json({ error: "URL de GitHub inválida. Formato: https://github.com/owner/repo o https://github.com/owner/repo/tree/main/carpeta" });
    const owner = urlMatch[1];
    const repo = urlMatch[2].replace(/\.git$/, "");
    const branch = urlMatch[3] || "main";
    const subdir = (urlMatch[4] || "").replace(/\/$/, "");
    const headers = { "Accept": "application/vnd.github.v3+json", "User-Agent": "MissionControl/2.0" };
    if (token) headers["Authorization"] = `Bearer ${token}`;
    try {
        const apiPath = subdir ? `${subdir}/` : "";
        const dirRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${apiPath}?ref=${branch}`, { headers });
        if (!dirRes.ok) {
            if (dirRes.status === 404) return res.status(404).json({ error: "Repo o ruta no encontrada. ¿Es público? ¿Existe la rama/carpeta?" });
            if (dirRes.status === 401 || dirRes.status === 403) return res.status(403).json({ error: "Token inválido o sin permisos sobre este repositorio." });
            return res.status(dirRes.status).json({ error: `GitHub API error: ${dirRes.status}` });
        }
        const files = await dirRes.json();
        if (!Array.isArray(files)) return res.status(400).json({ error: "La URL no apunta a una carpeta con archivos de agente." });
        const agentFile = files.find(f => f.name.endsWith(".agent.md") && f.type === "file");
        if (!agentFile) return res.status(400).json({ error: "No se encontró ningún .agent.md en la ruta especificada." });
        const agentContent = await (await fetch(agentFile.download_url, { headers })).text();
        const idMatch = agentContent.match(/^id:\s*(.+)$/m);
        const agentId = (idMatch ? idMatch[1].trim() : agentFile.name.replace(/\.agent\.md$/, "")).replace(/[^a-zA-Z0-9\-_]/g, "-");
        const localAgentDir = path.join(__dirname, "agents", agentId);
        if (fs.existsSync(localAgentDir)) return res.status(409).json({ error: `Ya existe un agente con ID "${agentId}". Eliminalo primero.` });
        fs.mkdirSync(localAgentDir, { recursive: true });
        fs.mkdirSync(path.join(localAgentDir, "skills"), { recursive: true });
        fs.writeFileSync(path.join(localAgentDir, `${agentId}.agent.md`), agentContent, "utf8");
        const promptFile = files.find(f => f.name.endsWith(".prompt.md") && f.type === "file");
        if (promptFile) {
            const txt = await (await fetch(promptFile.download_url, { headers })).text();
            fs.writeFileSync(path.join(localAgentDir, `${agentId}.prompt.md`), txt, "utf8");
        }
        const skillsDirEntry = files.find(f => f.name === "skills" && f.type === "dir");
        if (skillsDirEntry) {
            const skillsRes = await fetch(skillsDirEntry.url, { headers });
            if (skillsRes.ok) {
                const skillFiles = await skillsRes.json();
                for (const sf of (skillFiles || []).filter(f => f.name.endsWith(".skill.md"))) {
                    const txt = await (await fetch(sf.download_url, { headers })).text();
                    fs.writeFileSync(path.join(localAgentDir, "skills", sf.name.replace(/[^a-zA-Z0-9\-_.]/g, "_")), txt, "utf8");
                }
            }
        }
        res.json({ ok: true, agentId, message: `Agente "${agentId}" importado exitosamente desde GitHub.` });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── JIRA INTEGRATION ────────────────────────────────────────────────────────

function getJiraHeaders() {
    const email = process.env.JIRA_EMAIL;
    const token = process.env.JIRA_TOKEN;
    if (!email || !token) return null;
    const auth = Buffer.from(`${email}:${token}`).toString("base64");
    return { "Authorization": `Basic ${auth}`, "Content-Type": "application/json", "Accept": "application/json" };
}

app.get("/api/jira/test", async (req, res) => {
    const baseUrl = (process.env.JIRA_BASE_URL || "").replace(/\/$/, "");
    const headers = getJiraHeaders();
    if (!baseUrl || !headers) return res.status(400).json({ error: "Jira no configurado. Completá JIRA_BASE_URL, JIRA_EMAIL y JIRA_TOKEN en ⚙️ Configuración." });
    try {
        const r = await fetch(`${baseUrl}/rest/api/3/myself`, { headers });
        if (!r.ok) return res.status(r.status).json({ error: `Jira respondió ${r.status}. Verificá las credenciales.` });
        const user = await r.json();
        res.json({ ok: true, displayName: user.displayName, email: user.emailAddress });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get("/api/jira/projects", async (req, res) => {
    const baseUrl = (process.env.JIRA_BASE_URL || "").replace(/\/$/, "");
    const headers = getJiraHeaders();
    if (!baseUrl || !headers) return res.status(400).json({ error: "Jira no configurado" });
    try {
        const r = await fetch(`${baseUrl}/rest/api/3/project/search?maxResults=50`, { headers });
        if (!r.ok) return res.status(r.status).json({ error: `Jira respondió ${r.status}` });
        const data = await r.json();
        res.json({ projects: (data.values || []).map(p => ({ id: p.id, key: p.key, name: p.name })) });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get("/api/jira/issues", async (req, res) => {
    const baseUrl = (process.env.JIRA_BASE_URL || "").replace(/\/$/, "");
    const headers = getJiraHeaders();
    if (!baseUrl || !headers) return res.status(400).json({ error: "Jira no configurado" });
    const jql = req.query.jql || "assignee = currentUser() ORDER BY updated DESC";
    const maxResults = Math.min(parseInt(req.query.maxResults) || 20, 50);
    try {
        const body = JSON.stringify({ jql, maxResults, fields: ["summary", "status", "assignee", "issuetype", "priority", "description"] });
        const r = await fetch(`${baseUrl}/rest/api/3/search`, { method: "POST", headers, body });
        if (!r.ok) return res.status(r.status).json({ error: `Jira respondió ${r.status}` });
        const data = await r.json();
        const issues = (data.issues || []).map(i => ({
            key: i.key, summary: i.fields.summary,
            status: i.fields.status?.name, type: i.fields.issuetype?.name,
            priority: i.fields.priority?.name,
            description: i.fields.description?.content?.[0]?.content?.[0]?.text || "",
        }));
        res.json({ issues, total: data.total });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post("/api/jira/comment", async (req, res) => {
    const { issueKey, comment } = req.body;
    const baseUrl = (process.env.JIRA_BASE_URL || "").replace(/\/$/, "");
    const headers = getJiraHeaders();
    if (!baseUrl || !headers) return res.status(400).json({ error: "Jira no configurado" });
    if (!issueKey || !comment) return res.status(400).json({ error: "issueKey y comment requeridos" });
    try {
        const body = JSON.stringify({ body: { type: "doc", version: 1, content: [{ type: "paragraph", content: [{ type: "text", text: comment }] }] } });
        const r = await fetch(`${baseUrl}/rest/api/3/issue/${issueKey}/comment`, { method: "POST", headers, body });
        if (!r.ok) return res.status(r.status).json({ error: `Jira respondió ${r.status}` });
        res.json({ ok: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post("/api/jira/bug", async (req, res) => {
    const { projectKey, summary, description } = req.body;
    const baseUrl = (process.env.JIRA_BASE_URL || "").replace(/\/$/, "");
    const headers = getJiraHeaders();
    if (!baseUrl || !headers) return res.status(400).json({ error: "Jira no configurado" });
    if (!projectKey || !summary) return res.status(400).json({ error: "projectKey y summary requeridos" });
    try {
        const body = JSON.stringify({
            fields: {
                project: { key: projectKey }, summary,
                description: { type: "doc", version: 1, content: [{ type: "paragraph", content: [{ type: "text", text: description || "" }] }] },
                issuetype: { name: "Bug" },
            }
        });
        const r = await fetch(`${baseUrl}/rest/api/3/issue`, { method: "POST", headers, body });
        if (!r.ok) {
            const errText = await r.text();
            return res.status(r.status).json({ error: `Jira error ${r.status}: ${errText.slice(0, 200)}` });
        }
        const data = await r.json();
        res.json({ ok: true, key: data.key, url: `${baseUrl}/browse/${data.key}` });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

const PORT = 3000;
app.listen(PORT, () => {
    console.log(`\n🛸 Mission Control server corriendo en http://localhost:${PORT}`);
    console.log(`   Panel: http://localhost:${PORT}/index.html\n`);
});
