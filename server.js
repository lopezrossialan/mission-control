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
    baseURL: "https://models.inference.ai.azure.com",
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
    "gpt-4o", "gpt-4o-mini", "o3-mini",
    "Meta-Llama-3.3-70B-Instruct", "Meta-Llama-3.1-8B-Instruct",
    "Mistral-Large-2411", "Phi-4", "DeepSeek-R1"
]);

// Chat endpoint — streaming
app.post("/api/chat", async (req, res) => {
    const { agentId, messages, model: requestedModel } = req.body;

    if (!agentId || !messages || !Array.isArray(messages)) {
        return res.status(400).json({ error: "agentId y messages son requeridos" });
    }

    const systemPrompt = AGENT_SYSTEM_PROMPTS[agentId];
    if (!systemPrompt) {
        return res.status(400).json({ error: `Agente desconocido: ${agentId}` });
    }

    const model = ALLOWED_MODELS.has(requestedModel) ? requestedModel : "gpt-4o";

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    try {
        const stream = await client.chat.completions.create({
            model,
            messages: [{ role: "system", content: systemPrompt }, ...messages],
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
