const API_BASE = "http://localhost:3000/api";

// Límites basados en documentación pública de GitHub Models (plan Free/Pro)
// https://docs.github.com/en/github-models/prototyping-with-ai-models#rate-limits
// ctx = context window in tokens (input limit)
const MODELS = [
    // OpenAI
    { id: "openai/gpt-4.1", label: "GPT-4.1", provider: "OpenAI", cost: 2, rpm: 10, tpd: 40_000, ctx: 1_047_576 },
    { id: "openai/gpt-4.1-mini", label: "GPT-4.1 mini", provider: "OpenAI", cost: 1, rpm: 15, tpd: 120_000, ctx: 1_047_576 },
    { id: "openai/gpt-4.1-nano", label: "GPT-4.1 nano", provider: "OpenAI", cost: 1, rpm: 15, tpd: 120_000, ctx: 1_047_576 },
    { id: "openai/gpt-4o", label: "GPT-4o", provider: "OpenAI", cost: 2, rpm: 10, tpd: 40_000, ctx: 128_000 },
    { id: "openai/gpt-4o-mini", label: "GPT-4o mini", provider: "OpenAI", cost: 1, rpm: 15, tpd: 120_000, ctx: 128_000 },
    { id: "openai/o3-mini", label: "o3-mini", provider: "OpenAI", cost: 3, rpm: 2, tpd: 12_000, ctx: 200_000 },
    { id: "openai/o4-mini", label: "o4-mini", provider: "OpenAI", cost: 3, rpm: 2, tpd: 12_000, ctx: 200_000 },
    // Meta
    { id: "meta/llama-4-maverick-17b-128e-instruct-fp8", label: "Llama 4 Maverick", provider: "Meta", cost: 2, rpm: 10, tpd: 40_000, ctx: 1_048_576 },
    { id: "meta/llama-4-scout-17b-16e-instruct", label: "Llama 4 Scout", provider: "Meta", cost: 1, rpm: 15, tpd: 120_000, ctx: 10_000_000 },
    { id: "meta/llama-3.3-70b-instruct", label: "Llama 3.3 70B", provider: "Meta", cost: 2, rpm: 10, tpd: 40_000, ctx: 128_000 },
    { id: "meta/meta-llama-3.1-405b-instruct", label: "Llama 3.1 405B", provider: "Meta", cost: 2, rpm: 10, tpd: 40_000, ctx: 128_000 },
    { id: "meta/meta-llama-3.1-8b-instruct", label: "Llama 3.1 8B", provider: "Meta", cost: 1, rpm: 15, tpd: 120_000, ctx: 128_000 },
    // DeepSeek
    { id: "deepseek/deepseek-r1", label: "DeepSeek R1", provider: "DeepSeek", cost: 3, rpm: 1, tpd: 8_000, ctx: 32_000 },
    { id: "deepseek/deepseek-r1-0528", label: "DeepSeek R1 (0528)", provider: "DeepSeek", cost: 3, rpm: 1, tpd: 8_000, ctx: 32_000 },
    { id: "deepseek/deepseek-v3-0324", label: "DeepSeek V3", provider: "DeepSeek", cost: 2, rpm: 10, tpd: 40_000, ctx: 128_000 },
    // Mistral
    { id: "mistral-ai/mistral-small-2503", label: "Mistral Small 3.1", provider: "Mistral", cost: 1, rpm: 15, tpd: 120_000, ctx: 32_000 },
    { id: "mistral-ai/mistral-medium-2505", label: "Mistral Medium 3", provider: "Mistral", cost: 1, rpm: 15, tpd: 120_000, ctx: 128_000 },
    { id: "mistral-ai/codestral-2501", label: "Codestral 25.01", provider: "Mistral", cost: 1, rpm: 15, tpd: 120_000, ctx: 256_000 },
    // xAI
    { id: "xai/grok-3", label: "Grok 3", provider: "xAI", cost: 3, rpm: 1, tpd: 15_000, ctx: 131_072 },
    { id: "xai/grok-3-mini", label: "Grok 3 Mini", provider: "xAI", cost: 2, rpm: 2, tpd: 30_000, ctx: 131_072 },
    // Microsoft
    { id: "microsoft/phi-4", label: "Phi-4", provider: "Microsoft", cost: 1, rpm: 15, tpd: 120_000, ctx: 16_384 },
    { id: "microsoft/phi-4-mini-instruct", label: "Phi-4 mini", provider: "Microsoft", cost: 1, rpm: 15, tpd: 120_000, ctx: 16_384 },
    { id: "microsoft/phi-4-reasoning", label: "Phi-4 Reasoning", provider: "Microsoft", cost: 1, rpm: 15, tpd: 120_000, ctx: 32_768 },
    { id: "microsoft/mai-ds-r1", label: "MAI-DS-R1", provider: "Microsoft", cost: 3, rpm: 1, tpd: 8_000, ctx: 16_384 },
    // Cohere
    { id: "cohere/cohere-command-a", label: "Command A", provider: "Cohere", cost: 1, rpm: 15, tpd: 120_000, ctx: 256_000 },
    { id: "cohere/cohere-command-r-plus-08-2024", label: "Command R+", provider: "Cohere", cost: 2, rpm: 10, tpd: 40_000, ctx: 128_000 },
];

let activeChatModel = "openai/gpt-4o";
let usageLog = [];
let realQuotaData = null;
let quotaFetching = false;

let AGENTS = [];
let _allAgents = [];
let _extraDirs = [];

// ─── Carga dinámica de agentes ─────────────────────────────────────────────

async function loadAgents() {
    try {
        const res = await fetch(`${API_BASE}/agents`);
        const data = await res.json();
        _allAgents = data.agents || [];

        const validIds = new Set(_allAgents.map(a => a.id));
        const stored = localStorage.getItem("mc-active-agents");
        let activeIds;
        if (stored) {
            // Limpiar IDs que ya no existen en disco
            const cleaned = JSON.parse(stored).filter(id => validIds.has(id));
            activeIds = new Set(cleaned);
            localStorage.setItem("mc-active-agents", JSON.stringify([...activeIds]));
        } else {
            activeIds = new Set(validIds);
            localStorage.setItem("mc-active-agents", JSON.stringify([...activeIds]));
        }

        AGENTS = _allAgents.filter(a => activeIds.has(a.id));
    } catch (err) {
        console.error("No se pudo cargar agentes desde el servidor:", err);
    }
    renderAgents();
    updateHeaderCounts();
}

function updateHeaderCounts() {
    const badge = document.getElementById("nav-badge-agents");
    if (badge) badge.textContent = AGENTS.length > 0 ? AGENTS.length : "";
    renderWorkflow();
}

function renderWorkflow() {
    const el = document.getElementById("workflow-inner");
    if (!el) return;
    if (AGENTS.length === 0) {
        el.innerHTML = `<p style="font-family:var(--mono);font-size:12px;color:var(--text-muted);padding:12px 0">
            ℹ️ Activá agentes desde ⚙️ Gestionar Agentes para ver el flujo.</p>`;
        return;
    }
    const firstAgents = AGENTS.filter(a => (a.flow || "").toUpperCase().includes("PRIMER"));
    const secondAgents = AGENTS.filter(a => !(a.flow || "").toUpperCase().includes("PRIMER"));

    const makeStep = (agent, label) => `
        <div class="workflow-step" onclick="openChat('${agent.id}')" title="Abrir chat" style="cursor:pointer">
            <div class="step-num">${label}</div>
            <div>
                <div class="step-name">${agent.icon} ${agent.name}</div>
                <div class="step-desc">${agent.flow || agent.description.slice(0, 50)}</div>
            </div>
        </div>`;

    let html = "";

    if (firstAgents.length > 0) {
        if (firstAgents.length === 1) {
            html += makeStep(firstAgents[0], "1");
        } else {
            html += `<div class="workflow-branch">${firstAgents.map((a, i) => makeStep(a, `1${String.fromCharCode(65 + i)}`)).join("")}</div>`;
        }
        if (secondAgents.length > 0) html += `<div class="workflow-arrow">→</div>`;
    }

    if (secondAgents.length === 1) {
        html += makeStep(secondAgents[0], firstAgents.length > 0 ? "2" : "1");
    } else if (secondAgents.length > 1) {
        const offset = firstAgents.length > 0 ? 2 : 1;
        html += `<div class="workflow-branch">${secondAgents.map((a, i) => makeStep(a, `${offset}${String.fromCharCode(65 + i)}`)).join("")}</div>`;
    }

    html += `<div class="workflow-arrow">→</div>
        <div class="workflow-step">
            <div class="step-num">${secondAgents.length > 0 ? (firstAgents.length > 0 ? "3" : "2") : "2"}</div>
            <div>
                <div class="step-name">📁 /outputs/</div>
                <div class="step-desc">Guardá los resultados generados</div>
            </div>
        </div>`;

    el.innerHTML = html;
}


// ─── Navegación de vistas ───────────────────────────────────────────────

function switchView(view, btn) {
    document.querySelectorAll(".sidebar-nav-item").forEach(t => t.classList.remove("active"));
    document.querySelectorAll(".view").forEach(v => v.classList.remove("active"));
    const navBtn = btn instanceof Element ? btn : document.querySelector(`[data-view="${view}"]`);
    if (navBtn) navBtn.classList.add("active");
    const viewEl = document.getElementById(`view-${view}`);
    if (viewEl) viewEl.classList.add("active");
    if (view === "modelos") { renderLLMPanel(); if (!realQuotaData) fetchRealQuota(); }
    if (view === "agregar") openManagePanel();
    if (view === "historial") loadHistorial();
    if (view === "mcps") loadMcps();
    if (view === "jira") loadJiraView();
    if (view === "configuracion") loadConfig();
}

// ─── Gestionar Agentes ───────────────────────────────────────────────

// kept: switchSidebarTab ahora delega a switchView
function switchSidebarTab(tab, btn) {
    const map = { agents: "agentes", llm: "modelos", manage: "agregar" };
    switchView(map[tab] || tab, btn);
}

async function openManagePanel() {
    try {
        const res = await fetch(`${API_BASE}/agent-dirs`);
        const data = await res.json();
        _extraDirs = data.dirs || [];
    } catch (_) { _extraDirs = []; }
    renderManageModal();
}

// kept for backward compatibility (por si hay llamadas a openManageModal en otros lugares)
async function openManageModal() { openManagePanel(); }
function closeManageModal() { }

function renderManageModal() {
    const stored = localStorage.getItem("mc-active-agents");
    const activeIds = stored ? new Set(JSON.parse(stored)) : new Set(_allAgents.map(a => a.id));

    const dirsHtml = `
        <div class="manage-section-title">📁 Rutas de búsqueda</div>
        <div class="manage-dir-row">
            <span class="dir-path dir-default">agents/ &nbsp;<em>(carpeta integrada del proyecto)</em></span>
            <span class="dir-badge">integrada</span>
        </div>
        ${_extraDirs.map((d, i) => `
        <div class="manage-dir-row">
            <span class="dir-path" title="${escapeHtml(d)}">${escapeHtml(d)}</span>
            <button class="dir-remove-btn" onclick="removeAgentDirByIndex(${i})" title="Quitar ruta">✕</button>
        </div>`).join("")}
        <div class="manage-dir-add">
            <label class="btn-dir-browse" title="Seleccionar carpeta del agente">
                📂 Seleccionar carpeta
                <input type="file" id="folder-picker" webkitdirectory multiple style="display:none"
                       onchange="handleFolderPick(this)">
            </label>
            <span class="dir-browse-hint">o ingresá la ruta manualmente:</span>
            <input type="text" id="new-dir-input"
                   placeholder="C:\\ruta\\a\\tus\\agentes"
                   autocomplete="off"
                   onkeydown="if(event.key==='Enter') addAgentDir()" />
            <button class="btn-dir-add" onclick="addAgentDir()">➕ Agregar</button>
        </div>
        <div id="dir-add-error" class="dir-add-error" style="display:none"></div>
        <div id="folder-pick-preview" style="display:none"></div>`;

    const agentsHtml = _allAgents.length === 0
        ? `<p class="manage-empty">❌ No se detectaron agentes. ¿Está corriendo el servidor?</p>`
        : _allAgents.map(agent => {
            const sourceName = agent.isDefault ? "integrado" : (agent.sourceDir || "").replace(/\\/g, "/").split("/").pop();
            // Double-escape backslashes so el string JS en onclick sea correcto en Windows
            const safeFile = (agent.agentFile || "").replace(/\\/g, "\\\\").replace(/'/g, "\\'");
            const importBtn = !agent.isDefault
                ? `<button class="btn-agent-import" onclick="importAgent('${agent.id}', '${safeFile}')"
                          title="Copiar a agents/ local para usar sin depender de la ruta externa">
                       ⬇️ Importar
                   </button>`
                : "";
            return `
            <div class="manage-agent-row" id="mar-${agent.id}">
                <div class="mar-info">
                    <span class="mar-icon">${agent.icon}</span>
                    <div class="mar-meta">
                        <div class="mar-name">${agent.name}
                            <span class="mar-source ${agent.isDefault ? "source-default" : "source-external"}">${sourceName}</span>
                        </div>
                        <div class="mar-desc">${agent.description}</div>
                        <div class="mar-id">${agent.id}.agent.md · v${agent.version}</div>
                    </div>
                </div>
                <div class="mar-actions">
                    ${importBtn}
                    <label class="toggle-switch" title="${activeIds.has(agent.id) ? "Desactivar" : "Activar"} agente">
                        <input type="checkbox" ${activeIds.has(agent.id) ? "checked" : ""}
                               onchange="toggleAgentActive('${agent.id}', this.checked)">
                        <span class="toggle-slider"></span>
                    </label>
                </div>
            </div>`;
        }).join("");

    document.getElementById("manage-modal-body").innerHTML = `
        <div class="manage-dirs-section">${dirsHtml}</div>
        <div class="manage-agents-section">
            <div class="manage-section-title" style="margin-top:20px;justify-content:space-between">
                <span>🤖 Agentes detectados <span class="manage-agents-count">${_allAgents.length}</span></span>
                <button class="btn-refresh-agents" onclick="refreshManageAgents()">🔄 Actualizar</button>
            </div>
            <div id="manage-agents-list">${agentsHtml}</div>
        </div>`;
}

async function importAgent(agentId, agentFile) {
    const row = document.getElementById(`mar-${agentId}`);
    const btn = row ? row.querySelector(".btn-agent-import") : null;
    if (btn) { btn.disabled = true; btn.textContent = "⏳ Importando..."; }
    try {
        const res = await fetch(`${API_BASE}/agents/import`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ agentId, agentFile }),
        });
        const data = await res.json();
        if (!res.ok) {
            showToast(`❌ ${data.error}`);
            if (btn) { btn.disabled = false; btn.textContent = "⬇️ Importar"; }
            return;
        }
        showToast(`✅ ${agentId} importado a agents/`);
        await refreshManageAgents();
    } catch {
        showToast("❌ No se pudo conectar con el servidor");
        if (btn) { btn.disabled = false; btn.textContent = "⬇️ Importar"; }
    }
}

async function refreshManageAgents() {
    const btn = document.querySelector(".btn-refresh-agents");
    if (btn) { btn.disabled = true; btn.textContent = "⏳ Actualizando..."; }
    await loadAgents();
    try {
        const res = await fetch(`${API_BASE}/agent-dirs`);
        const data = await res.json();
        _extraDirs = data.dirs || [];
    } catch (_) { }
    renderManageModal();
}

async function handleFolderPick(input) {
    const files = Array.from(input.files);
    if (!files.length) return;

    // Extraer la ruta de la carpeta desde el primer archivo
    // webkitRelativePath = "nombreCarpeta/archivo.md" o "nombreCarpeta/skills/x.md"
    const firstRelative = files[0].webkitRelativePath;
    const folderName = firstRelative.split("/")[0];

    // Detectar archivos relevantes
    const agentFile = files.find(f => f.name.endsWith(".agent.md"));
    const promptFile = files.find(f => f.name.endsWith(".prompt.md"));
    const skillFiles = files.filter(f => f.name.endsWith(".skill.md"));

    // Mostrar preview de lo que se encontró
    const preview = document.getElementById("folder-pick-preview");
    if (preview) {
        const found = [
            agentFile ? `✅ ${agentFile.name}` : "❌ No se encontró .agent.md",
            promptFile ? `✅ ${promptFile.name}` : "⚠️ No se encontró .prompt.md",
            skillFiles.length > 0
                ? `✅ ${skillFiles.length} skill(s): ${skillFiles.map(f => f.name).join(", ")}`
                : "ℹ️ Sin skills",
        ];
        preview.style.display = "block";
        preview.innerHTML = `
            <div class="folder-pick-preview-box">
                <div class="fpp-title">📁 ${escapeHtml(folderName)}</div>
                ${found.map(line => `<div class="fpp-line">${escapeHtml(line)}</div>`).join("")}
                <div class="fpp-actions">
                    <button class="btn-dir-add" onclick="confirmFolderImport()" id="btn-confirm-folder">
                        ✅ Importar esta carpeta
                    </button>
                    <button class="btn-folder-cancel" onclick="cancelFolderPick()">✕ Cancelar</button>
                </div>
            </div>`;

        // Guardar los archivos en memoria para confirmar
        window._pendingFolderFiles = files;
        window._pendingFolderName = folderName;
    }
}

async function confirmFolderImport() {
    const files = window._pendingFolderFiles;
    if (!files || !files.length) return;

    const btn = document.getElementById("btn-confirm-folder");
    if (btn) { btn.disabled = true; btn.textContent = "⏳ Importando..."; }

    const agentFile = files.find(f => f.name.endsWith(".agent.md"));
    const promptFile = files.find(f => f.name.endsWith(".prompt.md"));
    const skillFiles = files.filter(f => f.name.endsWith(".skill.md"));

    if (!agentFile) {
        showToast("❌ No se encontró un archivo .agent.md en la carpeta seleccionada");
        if (btn) { btn.disabled = false; btn.textContent = "✅ Importar esta carpeta"; }
        return;
    }

    // Leer contenidos de los archivos
    const readFile = f => new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = e => resolve(e.target.result);
        reader.onerror = reject;
        reader.readAsText(f);
    });

    try {
        const agentContent = await readFile(agentFile);
        const promptContent = promptFile ? await readFile(promptFile) : null;
        const skillsContent = await Promise.all(skillFiles.map(async f => ({
            name: f.name,
            content: await readFile(f),
        })));

        const res = await fetch(`${API_BASE}/agents/import-files`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                agentContent,
                promptContent,
                skillsContent,
                folderName: window._pendingFolderName,
            }),
        });

        const data = await res.json();
        if (!res.ok) {
            showToast(`❌ ${data.error}`);
            if (btn) { btn.disabled = false; btn.textContent = "✅ Importar esta carpeta"; }
            return;
        }

        showToast(`✅ Agente "${window._pendingFolderName}" importado correctamente`);
        window._pendingFolderFiles = null;
        window._pendingFolderName = null;
        await refreshManageAgents();
    } catch (err) {
        showToast("❌ Error al importar: " + err.message);
        if (btn) { btn.disabled = false; btn.textContent = "✅ Importar esta carpeta"; }
    }
}

function cancelFolderPick() {
    window._pendingFolderFiles = null;
    window._pendingFolderName = null;
    const preview = document.getElementById("folder-pick-preview");
    if (preview) preview.style.display = "none";
    const picker = document.getElementById("folder-picker");
    if (picker) picker.value = "";
}

async function addAgentDir() {
    const input = document.getElementById("new-dir-input");
    const errorEl = document.getElementById("dir-add-error");
    if (!input) return;
    const dir = input.value.trim();
    if (!dir) return;
    errorEl.style.display = "none";
    try {
        const res = await fetch(`${API_BASE}/agent-dirs`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ dir }),
        });
        const data = await res.json();
        if (!res.ok) {
            errorEl.textContent = `❌ ${data.error}`;
            errorEl.style.display = "block";
            return;
        }
        _extraDirs = data.dirs;
        input.value = "";
        await refreshManageAgents();
    } catch {
        errorEl.textContent = "❌ No se pudo conectar con el servidor";
        errorEl.style.display = "block";
    }
}

async function removeAgentDirByIndex(index) {
    const dir = _extraDirs[index];
    if (!dir) return;
    try {
        const res = await fetch(`${API_BASE}/agent-dirs`, {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ dir }),
        });
        const data = await res.json();
        if (res.ok) {
            _extraDirs = data.dirs;
            await refreshManageAgents();
        }
    } catch (_) { }
}

function handleManageOverlayClick(e) { }

function toggleAgentActive(id, active) {
    const stored = localStorage.getItem("mc-active-agents");
    const activeIds = stored ? new Set(JSON.parse(stored)) : new Set(_allAgents.map(a => a.id));
    if (active) activeIds.add(id); else activeIds.delete(id);
    localStorage.setItem("mc-active-agents", JSON.stringify([...activeIds]));
    AGENTS = _allAgents.filter(a => activeIds.has(a.id));
    renderAgents();
    updateHeaderCounts();
}




// ─── Utilidades ─────────────────────────────────────────────────────────────────────

function escapeHtml(text) {
    return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function renderMarkdown(text) {
    // Bloques de código
    text = text.replace(/```[\w]*\n?([\s\S]*?)```/g, (_, code) =>
        `<pre><code>${escapeHtml(code.trim())}</code></pre>`
    );
    // Código inline
    text = text.replace(/`([^`]+)`/g, "<code>$1</code>");
    // Tablas Markdown
    text = text.replace(/(\|.+\|\n)((?:\|[-:| ]+\|\n)+)((?:\|.+\|\n?)*)/g, (match) => {
        const lines = match.trim().split("\n").filter(Boolean);
        const header = lines[0].split("|").filter(c => c.trim()).map(c => `<th>${c.trim()}</th>`).join("");
        const body = lines.slice(2).map(row => {
            const cells = row.split("|").filter(c => c.trim()).map(c => `<td>${c.trim()}</td>`).join("");
            return `<tr>${cells}</tr>`;
        }).join("");
        return `<table><thead><tr>${header}</tr></thead><tbody>${body}</tbody></table>`;
    });
    // Encabezados
    text = text.replace(/^### (.+)$/gm, "<h3>$1</h3>");
    text = text.replace(/^## (.+)$/gm, "<h2>$1</h2>");
    text = text.replace(/^# (.+)$/gm, "<h1>$1</h1>");
    // Negrita e itálica
    text = text.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
    text = text.replace(/\*(.+?)\*/g, "<em>$1</em>");
    // Listas
    text = text.replace(/^[-•] (.+)$/gm, "<li>$1</li>");
    text = text.replace(/^\d+\. (.+)$/gm, "<li>$1</li>");
    // Párrafos
    text = text.replace(/\n\n+/g, "</p><p>");
    return `<p>${text}</p>`;
}

// ─── Estado del chat ───────────────────────────────────────────────────────
let activeChatAgentId = null;
let chatHistory = [];
let lastAssistantContent = "";
let attachedFileText = null;
let attachedFileName = null;

// ─── Manejo de archivo adjunto ────────────────────────────────────────────

async function handleFileAttach(input) {
    const file = input.files[0];
    if (!file) return;

    const sendBtn = document.getElementById("btn-send");
    sendBtn.disabled = true;
    sendBtn.textContent = "⏳ Leyendo archivo...";

    const formData = new FormData();
    formData.append("file", file);

    try {
        const res = await fetch(`${API_BASE}/upload`, { method: "POST", body: formData });
        const data = await res.json();
        if (!res.ok) {
            alert(`❌ ${data.error}`);
            input.value = "";
            return;
        }
        attachedFileText = data.text;
        attachedFileName = data.filename;
        document.getElementById("chat-file-name").textContent = `📄 ${data.filename}`;
        document.getElementById("chat-file-bar").style.display = "flex";
        document.getElementById("chat-input").placeholder = "Agregá un mensaje opcional o enviá directamente ⚡";
        document.getElementById("chat-input").focus();
    } catch {
        alert("❌ No se pudo conectar con el servidor para procesar el archivo.");
        input.value = "";
    } finally {
        sendBtn.disabled = false;
        sendBtn.textContent = "⚡ Enviar";
    }
}

function removeAttachment() {
    attachedFileText = null;
    attachedFileName = null;
    document.getElementById("chat-file-bar").style.display = "none";
    document.getElementById("chat-file-name").textContent = "";
    document.getElementById("file-input").value = "";
    document.getElementById("chat-input").placeholder = "Escribí tu mensaje o pegá el documento aquí...";
}

// ─── Render de tarjetas ───────────────────────────────────────────────────

function renderAgents() {
    const grid = document.getElementById("agents-grid");
    const DEFAULT_AGENTS = new Set(["doc-interpreter", "testcase-general", "testcase-gherkin", "playwright-agent"]);
    grid.innerHTML = AGENTS.map(agent => {
        const isDefault = DEFAULT_AGENTS.has(agent.id);
        const extraActions = !isDefault ? `
          <button class="btn-secondary" onclick="openEditAgentModal('${agent.id}')" title="Editar agente">✏️ Editar</button>
          <button class="btn-secondary" style="color:var(--accent3)" onclick="deleteAgent('${agent.id}')" title="Eliminar agente">🗑️</button>` : "";
        return `
    <div class="agent-card" id="card-${agent.id}">
      <div class="agent-header">
        <span class="agent-icon">${agent.icon}</span>
        <div>
          <div class="agent-name">${agent.name}</div>
          <div class="agent-id">${agent.id}.agent.md${isDefault ? " • integrado" : ""}</div>
        </div>
        <span class="agent-status">READY</span>
      </div>
      <div class="agent-description">${agent.description}</div>
      <div class="agent-flow">${agent.flow}</div>
      <div class="skills-section">
        <div class="skills-label">SKILLS</div>
        <div class="skills-list">
          ${agent.skills.map(s => `<span class="skill-tag">${s}</span>`).join("")}
        </div>
      </div>
      <div class="agent-actions">
        <button class="btn-invoke" onclick="openChat('${agent.id}')">💬 Abrir Chat</button>
        <button class="btn-secondary" onclick="showPrompt('${agent.id}')">👁 Ver Prompt</button>
        ${extraActions}
      </div>
    </div>`;
    }).join("");
}

// ─── Modal prompt ────────────────────────────────────────────────────────

function showPrompt(agentId) {
    const agent = AGENTS.find(a => a.id === agentId);
    document.getElementById("modal-title").textContent = `${agent.icon} ${agent.name} — Prompt`;
    document.getElementById("modal-content").textContent = agent.prompt;
    document.getElementById("modal").style.display = "flex";
}

function closeModal() {
    document.getElementById("modal").style.display = "none";
}

// ─── Chat modal ──────────────────────────────────────────────────────────

const CHAT_STORAGE_PREFIX = "mc-chat-";
const CHAT_STORAGE_MAX_BYTES = 4 * 1024 * 1024; // 4 MB límite de seguridad (localStorage ~5-10 MB)
const CHAT_STORAGE_WARN_BYTES = 3 * 1024 * 1024; // advertencia al 75%

function chatStorageKey(agentId) { return CHAT_STORAGE_PREFIX + agentId; }

function saveChatToStorage(agentId, history, lastContent) {
    try {
        const payload = JSON.stringify({ history, lastContent, savedAt: Date.now() });
        // Protección: no guardar si supera el límite individual
        if (payload.length > CHAT_STORAGE_MAX_BYTES) {
            console.warn("[mc] historial demasiado grande para guardar, se omite.");
            return;
        }
        localStorage.setItem(chatStorageKey(agentId), payload);
        checkLocalStorageUsage();
    } catch (e) {
        // QuotaExceededError
        if (e.name === "QuotaExceededError" || e.code === 22) {
            showLocalStorageFullWarning();
        }
    }
}

function loadChatFromStorage(agentId) {
    try {
        const raw = localStorage.getItem(chatStorageKey(agentId));
        if (!raw) return null;
        return JSON.parse(raw);
    } catch { return null; }
}

function checkLocalStorageUsage() {
    try {
        let total = 0;
        for (const key of Object.keys(localStorage)) {
            total += (localStorage.getItem(key) || "").length * 2; // UTF-16: 2 bytes/char
        }
        const warnEl = document.getElementById("localstorage-warn");
        if (!warnEl) return;
        const totalMB = (total / 1024 / 1024).toFixed(1);
        if (total >= CHAT_STORAGE_WARN_BYTES) {
            warnEl.style.display = "flex";
            warnEl.innerHTML = `<span class="ls-warn-badge" onclick="promptClearStorage()" title="Click para liberar espacio">⚠️ ${totalMB} MB usados — Click para limpiar</span>`;
        } else {
            warnEl.style.display = "none";
        }
    } catch { }
}

function showLocalStorageFullWarning() {
    showToast("⚠️ El almacenamiento local está lleno. Limpiá el historial desde el chat.");
    const warnEl = document.getElementById("localstorage-warn");
    if (warnEl) {
        warnEl.style.display = "flex";
        warnEl.innerHTML = `<span class="ls-warn-badge ls-warn-danger" onclick="promptClearStorage()">🔴 Almacenamiento lleno — Click para liberar</span>`;
    }
}

function promptClearStorage() {
    const keys = Object.keys(localStorage).filter(k => k.startsWith(CHAT_STORAGE_PREFIX));
    const agentCount = keys.length;
    if (agentCount === 0) { showToast("ℹ️ No hay historial guardado."); return; }

    // Calcular tamaño total ocupado por chats
    let totalBytes = 0;
    keys.forEach(k => totalBytes += (localStorage.getItem(k) || "").length * 2);
    const totalMB = (totalBytes / 1024 / 1024).toFixed(2);

    const confirmed = confirm(
        `⚠️ LIMPIAR HISTORIAL DE CHATS\n\n` +
        `Se borrarán las conversaciones guardadas de ${agentCount} agente(s), ` +
        `liberando ~${totalMB} MB de espacio.\n\n` +
        `Esta acción NO se puede deshacer. Los outputs ya guardados en /outputs/ no se ven afectados.\n\n` +
        `¿Confirmar limpieza?`
    );
    if (!confirmed) return;

    keys.forEach(k => localStorage.removeItem(k));

    // Si hay un chat abierto del agente actual, reflejar en pantalla
    if (activeChatAgentId) {
        chatHistory = [];
        lastAssistantContent = "";
        const agent = AGENTS.find(a => a.id === activeChatAgentId);
        if (agent) {
            document.getElementById("chat-messages").innerHTML = `
              <div class="chat-msg assistant">
                <div class="msg-bubble"><p>Historial limpiado. Nueva conversación con <strong>${agent.name}</strong>.</p></div>
              </div>`;
        }
        document.getElementById("btn-save-md").style.display = "none";
    }

    const warnEl = document.getElementById("localstorage-warn");
    if (warnEl) warnEl.style.display = "none";
    showToast(`✅ Historial de ${agentCount} agente(s) eliminado (${totalMB} MB liberados)`);
}

function renderChatHistory(history, agentName, agentHint) {
    const container = document.getElementById("chat-messages");
    container.innerHTML = "";

    // Mensaje de bienvenida
    const welcome = document.createElement("div");
    welcome.className = "chat-msg assistant";
    welcome.innerHTML = `<div class="msg-bubble"><p>Hola! Soy el agente <strong>${agentName}</strong>. ${agentHint} También podés adjuntar un archivo <strong>.doc o .docx</strong> directamente.</p></div>`;
    container.appendChild(welcome);

    // Restaurar mensajes
    for (const msg of history) {
        const div = document.createElement("div");
        if (msg.role === "user") {
            div.className = "chat-msg user";
            div.innerHTML = `<div class="msg-bubble"><p>${escapeHtml(msg.display || msg.content)}</p></div>`;
        } else {
            div.className = "chat-msg assistant";
            div.innerHTML = `<div class="msg-bubble">${renderMarkdown(msg.content)}</div>`;
            // Botón copiar para cada respuesta restaurada
            const btn = document.createElement("button");
            btn.className = "btn-copy-response";
            btn.innerHTML = "📋 Copiar";
            btn.onclick = ((c) => () => {
                navigator.clipboard.writeText(c)
                    .then(() => { btn.textContent = "✅ Copiado"; setTimeout(() => { btn.innerHTML = "📋 Copiar"; }, 2000); })
                    .catch(() => showToast("❌ No se pudo copiar"));
            })(msg.content);
            div.appendChild(btn);
        }
        container.appendChild(div);
    }
    container.scrollTop = container.scrollHeight;
}

function openChat(agentId) {
    const agent = AGENTS.find(a => a.id === agentId);
    activeChatAgentId = agentId;
    removeAttachment();

    document.getElementById("chat-modal-title").textContent = `${agent.icon} ${agent.name} — Chat`;
    document.getElementById("chat-hint").textContent = agent.hint;
    document.getElementById("chat-input").value = "";

    // Restaurar historial desde localStorage
    const saved = loadChatFromStorage(agentId);
    if (saved && Array.isArray(saved.history) && saved.history.length > 0) {
        chatHistory = saved.history;
        lastAssistantContent = saved.lastContent || "";
        renderChatHistory(chatHistory, agent.name, agent.hint);
        document.getElementById("btn-save-md").style.display = lastAssistantContent ? "inline-flex" : "none";
    } else {
        chatHistory = [];
        lastAssistantContent = "";
        document.getElementById("chat-messages").innerHTML = `
          <div class="chat-msg assistant">
            <div class="msg-bubble"><p>Hola! Soy el agente <strong>${agent.name}</strong>. ${agent.hint} También podés adjuntar un archivo <strong>.doc o .docx</strong> directamente.</p></div>
          </div>`;
        document.getElementById("btn-save-md").style.display = "none";
    }

    // Poblar selector de modelo
    const modelSel = document.getElementById("chat-model-select");
    modelSel.innerHTML = buildModelOptions(activeChatModel);

    document.getElementById("chat-modal").style.display = "flex";
    checkLocalStorageUsage();
    updateCompatIndicator();
    setTimeout(() => document.getElementById("chat-input").focus(), 100);
}

function closeChatModal() {
    // Guardar historial antes de cerrar
    if (activeChatAgentId && chatHistory.length > 0) {
        saveChatToStorage(activeChatAgentId, chatHistory, lastAssistantContent);
    }
    document.getElementById("chat-modal").style.display = "none";
    activeChatAgentId = null;
    chatHistory = [];
    lastAssistantContent = "";
    removeAttachment();
}

function newConversation() {
    if (chatHistory.length === 0) return; // ya está vacío
    const confirmed = confirm(
        "¿Empezar una nueva conversación?\n\nEl historial actual se borrará permanentemente.\nLos archivos guardados en /outputs/ no se ven afectados."
    );
    if (!confirmed) return;

    if (activeChatAgentId) {
        localStorage.removeItem(chatStorageKey(activeChatAgentId));
    }
    chatHistory = [];
    lastAssistantContent = "";

    const agent = AGENTS.find(a => a.id === activeChatAgentId);
    document.getElementById("chat-messages").innerHTML = `
      <div class="chat-msg assistant">
        <div class="msg-bubble"><p>Nueva conversación iniciada. Soy <strong>${agent ? agent.name : "el agente"}</strong>. ${agent ? agent.hint : ""}</p></div>
      </div>`;
    document.getElementById("btn-save-md").style.display = "none";
    checkLocalStorageUsage();
    showToast("🗑️ Conversación reiniciada");
}

function appendUserMessage(text) {
    const container = document.getElementById("chat-messages");
    const div = document.createElement("div");
    div.className = "chat-msg user";
    div.innerHTML = `<div class="msg-bubble"><p>${escapeHtml(text)}</p></div>`;
    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
}

function createAssistantBubble() {
    const container = document.getElementById("chat-messages");
    const div = document.createElement("div");
    div.className = "chat-msg assistant";
    div.innerHTML = `<div class="msg-bubble"><span class="typing-cursor">▋</span></div>`;
    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
    return div.querySelector(".msg-bubble");
}

async function sendMessage() {
    const input = document.getElementById("chat-input");
    const typedText = input.value.trim();

    // Necesita al menos texto escrito O un archivo adjunto
    if (!typedText && !attachedFileText) return;
    if (!activeChatAgentId) return;

    // Construir el mensaje combinado
    let messageContent = "";
    if (attachedFileText) {
        const label = typedText ? `${typedText}\n\n` : "";
        messageContent = `${label}Documento: ${attachedFileName}\n\n${attachedFileText}`;
    } else {
        messageContent = typedText;
    }

    const sendBtn = document.getElementById("btn-send");
    sendBtn.disabled = true;
    sendBtn.textContent = "⏳ Procesando...";
    input.value = "";

    // Mostrar en el chat lo que el usuario enviou0301
    const displayText = attachedFileText
        ? (typedText ? `${typedText} [📄 ${attachedFileName}]` : `📄 ${attachedFileName}`)
        : typedText;
    appendUserMessage(displayText);
    removeAttachment();

    chatHistory.push({ role: "user", content: messageContent, display: displayText });

    const bubble = createAssistantBubble();
    let accumulated = "";

    try {
        const response = await fetch(`${API_BASE}/chat`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ agentId: activeChatAgentId, messages: chatHistory, model: activeChatModel }),
        });

        if (!response.ok) {
            const err = await response.json();
            bubble.innerHTML = `<p style="color:var(--accent3)">❌ Error: ${escapeHtml(err.error)}</p>`;
            return;
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            const chunk = decoder.decode(value, { stream: true });
            const lines = chunk.split("\n").filter(l => l.startsWith("data: "));
            for (const line of lines) {
                try {
                    const data = JSON.parse(line.slice(6));
                    if (data.error) {
                        bubble.innerHTML = `<p style="color:var(--accent3)">❌ ${escapeHtml(data.error)}</p>`;
                        return;
                    }
                    if (data.delta) {
                        accumulated += data.delta;
                        bubble.innerHTML = renderMarkdown(accumulated) + '<span class="typing-cursor">▋</span>';
                        document.getElementById("chat-messages").scrollTop = document.getElementById("chat-messages").scrollHeight;
                    }
                    if (data.done) {
                        lastAssistantContent = data.fullContent;
                        bubble.innerHTML = renderMarkdown(data.fullContent);
                        chatHistory.push({ role: "assistant", content: data.fullContent });
                        document.getElementById("btn-save-md").style.display = "inline-flex";
                        appendCopyButton(bubble, data.fullContent);
                        if (data.usage) {
                            appendTokenBadge(bubble, data.usage, data.model || activeChatModel);
                            addUsageRecord(activeChatAgentId, data.model || activeChatModel, data.usage);
                        }
                        // Guardar en localStorage después de cada respuesta completa
                        saveChatToStorage(activeChatAgentId, chatHistory, data.fullContent);
                    }
                } catch (_) { }
            }
        }
    } catch (err) {
        bubble.innerHTML = `<p style="color:var(--accent3)">❌ No se pudo conectar con el servidor. ¿Está corriendo en puerto 3000?</p>`;
    } finally {
        sendBtn.disabled = false;
        sendBtn.textContent = "⚡ Enviar";
        document.getElementById("chat-messages").scrollTop = document.getElementById("chat-messages").scrollHeight;
    }
}

// ─── LLMs & Consumo ──────────────────────────────────────────────────────

function costDots(n) {
    return "●".repeat(n) + "○".repeat(3 - n);
}

function buildModelOptions(selectedId) {
    return MODELS.map(m =>
        `<option value="${m.id}" ${m.id === selectedId ? "selected" : ""}>${m.provider} — ${m.label}  ${costDots(m.cost)}</option>`
    ).join("");
}

function toggleLLMPanel() {
    switchView("modelos", document.querySelector('[data-view="modelos"]'));
}

async function fetchRealQuota() {
    if (quotaFetching) return;
    quotaFetching = true;
    const btn = document.getElementById("btn-refresh-quota");
    if (btn) { btn.disabled = true; btn.textContent = "⏳ Consultando..."; }
    try {
        const res = await fetch(`${API_BASE}/quota?model=${encodeURIComponent(activeChatModel)}`);
        const data = await res.json();
        if (res.ok) {
            realQuotaData = data;
            renderRealQuota();
        } else {
            document.getElementById("real-quota-box").innerHTML =
                `<p class="llm-empty" style="color:var(--accent3)">❌ ${escapeHtml(data.error)}</p>`;
        }
    } catch (err) {
        document.getElementById("real-quota-box").innerHTML =
            `<p class="llm-empty" style="color:var(--accent3)">❌ Sin conexión al servidor</p>`;
    } finally {
        quotaFetching = false;
        if (btn) { btn.disabled = false; btn.textContent = "🔄 Actualizar"; }
    }
}

function renderRealQuota() {
    if (!realQuotaData) return;
    const d = realQuotaData;

    // null significa que la API no devolvió ese header
    const hasTokens = d.limit_tokens !== null && d.limit_tokens > 0;
    const hasRequests = d.limit_requests !== null && d.limit_requests > 0;

    const tokPct = hasTokens ? Math.min(100, Math.round(((d.limit_tokens - d.remaining_tokens) / d.limit_tokens) * 100)) : 0;
    const reqPct = hasRequests ? Math.min(100, Math.round(((d.limit_requests - d.remaining_requests) / d.limit_requests) * 100)) : 0;
    const tokWarn = tokPct >= 80 ? "bar-danger" : tokPct >= 50 ? "bar-warn" : "";
    const reqWarn = reqPct >= 80 ? "bar-danger" : reqPct >= 50 ? "bar-warn" : "";
    const checkedAt = new Date(d.checked_at).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });

    const tokLabel = hasTokens
        ? `${d.remaining_tokens.toLocaleString()} <span class="rq-of">/ ${d.limit_tokens.toLocaleString()}</span>`
        : `<span class="rq-of">No disponible para este modelo</span>`;
    const reqLabel = hasRequests
        ? `${d.remaining_requests.toLocaleString()} <span class="rq-of">/ ${d.limit_requests.toLocaleString()}</span>`
        : `<span class="rq-of">No disponible para este modelo</span>`;

    document.getElementById("real-quota-box").innerHTML = `
        <div class="real-quota-model">${escapeHtml(d.model)} <span class="rq-region">${escapeHtml(d.region)}</span></div>
        <div class="rq-row">
            <div class="rq-label">Tokens restantes</div>
            <div class="rq-value">${tokLabel}</div>
        </div>
        <div class="mlr-bar-wrap"><div class="mlr-bar ${tokWarn}" style="width:${tokPct}%"></div></div>
        <div class="rq-row" style="margin-top:10px">
            <div class="rq-label">Requests restantes</div>
            <div class="rq-value">${reqLabel}</div>
        </div>
        <div class="mlr-bar-wrap"><div class="mlr-bar ${reqWarn}" style="width:${reqPct}%"></div></div>
        <div class="rq-checked">⏱ Consultado a las ${checkedAt} · cuesta 1 request</div>
    `;
}

function renderLLMPanel() {
    document.getElementById("global-model-select").innerHTML = buildModelOptions(activeChatModel);

    const totalReqs = usageLog.length;
    const totalPrompt = usageLog.reduce((s, r) => s + r.prompt, 0);
    const totalCompletion = usageLog.reduce((s, r) => s + r.completion, 0);
    const totalTokens = usageLog.reduce((s, r) => s + r.total, 0);

    document.getElementById("llm-stats").innerHTML = totalReqs === 0
        ? '<p class="llm-empty">Sin actividad</p>'
        : `<div class="llm-stat-grid">
            <div class="llm-stat-item"><div class="lsi-val">${totalReqs}</div><div class="lsi-label">requests</div></div>
            <div class="llm-stat-item"><div class="lsi-val">${totalTokens.toLocaleString()}</div><div class="lsi-label">tokens totales</div></div>
            <div class="llm-stat-item"><div class="lsi-val">${totalPrompt.toLocaleString()}</div><div class="lsi-label">prompt</div></div>
            <div class="llm-stat-item"><div class="lsi-val">${totalCompletion.toLocaleString()}</div><div class="lsi-label">completion</div></div>
           </div>`;

    // Barras de consumo estimado por modelo
    const usageByModel = {};
    for (const r of usageLog) {
        usageByModel[r.model] = (usageByModel[r.model] || 0) + r.total;
    }
    const limitsEl = document.getElementById("llm-limits");
    limitsEl.innerHTML = MODELS.map(m => {
        const used = usageByModel[m.id] || 0;
        const pct = Math.min(100, Math.round((used / m.tpd) * 100));
        const active = m.id === activeChatModel;
        const warnClass = pct >= 80 ? "bar-danger" : pct >= 50 ? "bar-warn" : "";
        return `
        <div class="model-limit-row ${active ? "model-limit-active" : ""}">
            <div class="mlr-header">
                <span class="mlr-name">${active ? "▶ " : ""}${m.label}</span>
                <span class="mlr-provider">${m.provider}</span>
            </div>
            <div class="mlr-meta">
                <span class="mlr-cost" title="Costo relativo">${costDots(m.cost)}</span>
                <span class="mlr-limits">${m.rpm} req/min · ${m.tpd.toLocaleString()} tok/día</span>
            </div>
            <div class="mlr-bar-wrap">
                <div class="mlr-bar ${warnClass}" style="width:${pct}%"></div>
            </div>
            <div class="mlr-bar-label">${used > 0 ? `~${used.toLocaleString()} / ${m.tpd.toLocaleString()} tokens (${pct}%)` : "Sin uso en esta sesión"}</div>
        </div>`;
    }).join("");

    const logEl = document.getElementById("llm-log");
    if (usageLog.length === 0) {
        logEl.innerHTML = '<p class="llm-empty">Sin actividad en esta sesión</p>';
    } else {
        logEl.innerHTML = [...usageLog].reverse().map(r => `
            <div class="llm-log-item">
                <div class="lli-header">
                    <span class="lli-agent">${r.agentIcon} ${r.agentName}</span>
                    <span class="lli-time">${r.time}</span>
                </div>
                <div class="lli-model">${r.model}</div>
                <div class="lli-tokens">
                    <span>${r.prompt.toLocaleString()} prompt</span>
                    <span>+</span>
                    <span>${r.completion.toLocaleString()} completion</span>
                    <span>=</span>
                    <strong>${r.total.toLocaleString()} tokens</strong>
                </div>
            </div>`).join("");
    }
}

function addUsageRecord(agentId, model, usage) {
    const agent = AGENTS.find(a => a.id === agentId);
    const now = new Date();
    usageLog.push({
        agentId,
        agentName: agent ? agent.name : agentId,
        agentIcon: agent ? agent.icon : "🤖",
        model,
        prompt: usage.prompt_tokens || 0,
        completion: usage.completion_tokens || 0,
        total: usage.total_tokens || 0,
        time: now.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
    });
    if (document.getElementById("view-modelos").classList.contains("active")) renderLLMPanel();
}

function appendTokenBadge(bubble, usage, model) {
    const badge = document.createElement("div");
    badge.className = "token-badge";
    badge.innerHTML = `📊 <span class="tb-prompt">${(usage.prompt_tokens || 0).toLocaleString()} prompt</span> + <span class="tb-completion">${(usage.completion_tokens || 0).toLocaleString()} completion</span> = <strong>${(usage.total_tokens || 0).toLocaleString()} tokens</strong> <span class="tb-model">${escapeHtml(model)}</span>`;
    bubble.parentElement.appendChild(badge);
}

function appendCopyButton(bubble, content) {
    const btn = document.createElement("button");
    btn.className = "btn-copy-response";
    btn.innerHTML = "📋 Copiar";
    btn.onclick = () => {
        navigator.clipboard.writeText(content)
            .then(() => { btn.textContent = "✅ Copiado"; setTimeout(() => { btn.innerHTML = "📋 Copiar"; }, 2000); })
            .catch(() => showToast("❌ No se pudo copiar"));
    };
    bubble.parentElement.appendChild(btn);
}

function setGlobalModel(modelId) {
    activeChatModel = modelId;
    realQuotaData = null; // invalidar cuota al cambiar modelo
    const realBox = document.getElementById("real-quota-box");
    if (realBox) realBox.innerHTML = '<p class="llm-empty">Cambió el modelo. Actualizá para ver la cuota real.</p>';
    const chatSel = document.getElementById("chat-model-select");
    if (chatSel && document.getElementById("chat-modal").style.display === "flex") {
        chatSel.value = modelId;
    }
}

function setActiveChatModel(modelId) {
    activeChatModel = modelId;
    const globalSel = document.getElementById("global-model-select");
    if (globalSel) globalSel.value = modelId;
    updateCompatIndicator();
}

// ─── Indicador de compatibilidad de contexto ─────────────────────────────────

function estimateTokens(chars) {
    // Estimación: ~4 caracteres = 1 token (heurística estándar)
    return Math.ceil(chars / 4);
}

function updateCompatIndicator() {
    const el = document.getElementById("model-compat-indicator");
    if (!el) return;

    const model = MODELS.find(m => m.id === activeChatModel);
    if (!model) { el.style.display = "none"; return; }

    // Calcular tokens estimados del texto actual en el chat
    const inputText = document.getElementById("chat-input")?.value || "";
    const historyText = Array.isArray(chatHistory) ? chatHistory.map(m => m.content || "").join(" ") : "";
    const attachedText = attachedFileText || "";
    const totalChars = inputText.length + historyText.length + attachedText.length;
    const estimatedTokens = estimateTokens(totalChars);

    // Reservar ~2k tokens para la respuesta del modelo
    const usableCtx = Math.max(0, (model.ctx || 128_000) - 2_000);
    const pct = estimatedTokens / usableCtx;

    let icon, color, label;
    if (pct < 0.5) {
        icon = "🟢"; color = "var(--accent2)";
        label = `OK — ~${estimatedTokens.toLocaleString()} / ${(usableCtx).toLocaleString()} tokens`;
    } else if (pct < 0.85) {
        icon = "🟡"; color = "var(--warn)";
        label = `Moderado — ~${estimatedTokens.toLocaleString()} / ${(usableCtx).toLocaleString()} tokens`;
    } else {
        icon = "🔴"; color = "var(--accent3)";
        label = `⚠️ Texto muy largo para este modelo (~${estimatedTokens.toLocaleString()} / ${(usableCtx).toLocaleString()} tokens)`;
    }

    el.style.display = "flex";
    el.innerHTML = `<span style="font-size:13px">${icon}</span><span style="color:${color};font-family:var(--mono);font-size:10px;white-space:nowrap">${label}</span>`;
}

// ─── Guardar .md ─────────────────────────────────────────────────────────

async function saveMd() {
    if (!lastAssistantContent) return;
    const timestamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
    const defaultName = `${activeChatAgentId}-${timestamp}`;
    const filename = prompt("Nombre del archivo (sin .md):", defaultName);
    if (!filename) return;

    try {
        const res = await fetch(`${API_BASE}/save`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ filename, content: lastAssistantContent }),
        });
        const data = await res.json();
        if (data.success) {
            alert(`✅ Guardado en /outputs/${data.filename}`);
            loadOutputsCount();
        } else {
            alert(`❌ Error: ${data.error}`);
        }
    } catch {
        alert("❌ No se pudo conectar con el servidor.");
    }
}

// ─── Contador de outputs ─────────────────────────────────────────────────

async function loadOutputsCount() {
    try {
        const res = await fetch(`${API_BASE}/outputs`);
        const data = await res.json();
        const count = (data.files || []).length;
        const badge = document.getElementById("nav-badge-outputs");
        if (badge) badge.textContent = count > 0 ? count : "";
    } catch (_) { }
}

// ─── Playwright Inspector ────────────────────────────────────────────────

let inspectorData = null;

async function runInspector() {
    const url = document.getElementById("inspector-url").value.trim();
    if (!url) { alert("Ingresá una URL para inspeccionar."); return; }

    const loadingEl = document.getElementById("inspector-loading");
    const resultsEl = document.getElementById("inspector-results");
    const errorEl = document.getElementById("inspector-error");
    const btnInspect = document.getElementById("btn-inspect");

    loadingEl.style.display = "flex";
    resultsEl.style.display = "none";
    errorEl.style.display = "none";
    btnInspect.disabled = true;

    try {
        const res = await fetch(`${API_BASE}/inspect`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ url })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Error desconocido");

        inspectorData = data;
        renderInspectorResults(data);
        resultsEl.style.display = "block";
    } catch (err) {
        errorEl.textContent = `❌ Error: ${err.message}`;
        errorEl.style.display = "block";
    } finally {
        loadingEl.style.display = "none";
        btnInspect.disabled = false;
    }
}

function renderInspectorResults(data, filter = "all") {
    const metaEl = document.getElementById("inspector-meta");
    const tbodyEl = document.getElementById("inspector-tbody");
    const screenshotWrap = document.getElementById("inspector-screenshot-wrap");
    const screenshotImg = document.getElementById("inspector-screenshot");

    const total = data.elements.length;
    const filtered = filter === "all" ? data.elements : data.elements.filter(e => e.tag === filter);
    metaEl.innerHTML = `<strong>${data.title || data.url}</strong> — <span>${total} elementos encontrados</span>${filter !== "all" ? ` — mostrando <strong>${filtered.length}</strong> (${filter})` : ""}`;

    if (data.screenshot) {
        screenshotImg.src = data.screenshot;
        screenshotWrap.style.display = "block";
    } else {
        screenshotWrap.style.display = "none";
    }

    tbodyEl.innerHTML = filtered.map((el, i) => `
        <tr data-tag="${el.tag}">
            <td class="col-num">${i + 1}</td>
            <td><span class="tag-badge tag-${el.tag}">${el.tag}${el.type ? `[${el.type}]` : ""}</span></td>
            <td class="col-label" title="${escHtml(el.label)}">${escHtml(el.label) || "<em>—</em>"}</td>
            <td class="col-locator"><code>${escHtml(el.locator)}</code></td>
            <td class="col-xpath"><code title="${escHtml(el.xpath)}">${escHtml(truncate(el.xpath, 60))}</code></td>
        </tr>`).join("");
}

function filterInspector(btn) {
    document.querySelectorAll(".filter-btn").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    if (inspectorData) renderInspectorResults(inspectorData, btn.dataset.filter);
}

function copyInspectorJson() {
    if (!inspectorData) return;
    navigator.clipboard.writeText(JSON.stringify(inspectorData.elements, null, 2))
        .then(() => showToast("JSON copiado al portapapeles"))
        .catch(() => alert("No se pudo copiar al portapapeles"));
}

async function saveInspectorJson() {
    if (!inspectorData) return;
    const hostname = (() => { try { return new URL(inspectorData.url).hostname.replace(/\./g, "-"); } catch { return "inspector"; } })();
    const ts = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
    const filename = `inspector-${hostname}-${ts}`;
    try {
        const res = await fetch(`${API_BASE}/save-json`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ filename, data: inspectorData.elements })
        });
        const d = await res.json();
        if (!res.ok) throw new Error(d.error || "Error");
        showToast(`Guardado: outputs/${d.filename}`);
        loadOutputsCount();
    } catch (err) {
        alert(`Error al guardar: ${err.message}`);
    }
}

function sendToPlaywrightAgent() {
    if (!inspectorData) return;
    const summary = inspectorData.elements.slice(0, 30).map((el, i) =>
        `${i + 1}. [${el.tag}] ${el.label || el.locator} → ${el.locator}`
    ).join("\n");
    const context = `URL inspeccionada: ${inspectorData.url}\nTítulo: ${inspectorData.title || ""}\n\nElementos interactuables:\n${summary}\n\nTotal: ${inspectorData.elements.length} elementos`;
    openChat("playwright-agent");
    setTimeout(() => {
        const input = document.getElementById("chat-input");
        input.value = context + "\n\nGenerá los tests Playwright para esta página.";
        input.focus();
    }, 100);
}

function showToast(msg) {
    let toast = document.getElementById("toast");
    if (!toast) {
        toast = document.createElement("div");
        toast.id = "toast";
        document.body.appendChild(toast);
    }
    toast.textContent = msg;
    toast.classList.add("show");
    setTimeout(() => toast.classList.remove("show"), 3000);
}

function escHtml(str) {
    if (!str) return "";
    return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function truncate(str, n) {
    return str && str.length > n ? str.slice(0, n) + "…" : str || "";
}

// ─── Estado del servidor ─────────────────────────────────────────────────

async function checkServerStatus() {
    const el = document.getElementById("server-status");
    try {
        const res = await fetch(`${API_BASE}/outputs`, { signal: AbortSignal.timeout(2000) });
        if (res.ok) {
            el.textContent = "🟢 SERVIDOR ONLINE";
            el.style.color = "var(--accent2)";
        }
    } catch {
        el.textContent = "🔴 SERVIDOR OFFLINE — ejecutá: npm start";
        el.style.color = "var(--accent3)";
    }
}

// ─── Init ────────────────────────────────────────────────────────────────

document.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
        const chatModal = document.getElementById("chat-modal");
        if (chatModal.style.display === "flex" && document.activeElement.id === "chat-input") {
            e.preventDefault();
            sendMessage();
        }
    }
});

document.addEventListener("DOMContentLoaded", () => {
    loadAgents();
    loadOutputsCount();
    checkServerStatus();
    loadConfig(); // init badge
    document.getElementById("global-model-select").innerHTML = buildModelOptions(activeChatModel);
    renderLLMPanel();
    document.getElementById("inspector-url").addEventListener("keydown", (e) => {
        if (e.key === "Enter") runInspector();
    });
    document.getElementById("chat-input").addEventListener("input", () => {
        updateCompatIndicator();
    });
    document.getElementById("modal").addEventListener("click", function (e) {
        if (e.target === this) closeModal();
    });
    document.getElementById("chat-modal").addEventListener("click", function (e) {
        if (e.target === this) closeChatModal();
    });
    document.getElementById("agent-editor-modal").addEventListener("click", function (e) {
        if (e.target === this) closeAgentEditorModal();
    });
    document.getElementById("github-import-modal").addEventListener("click", function (e) {
        if (e.target === this) closeGithubImportModal();
    });
    document.getElementById("mcp-add-modal").addEventListener("click", function (e) {
        if (e.target === this) closeMcpAddModal();
    });
    document.getElementById("output-viewer-modal").addEventListener("click", function (e) {
        if (e.target === this) closeOutputViewer();
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// HISTORIAL DE OUTPUTS
// ─────────────────────────────────────────────────────────────────────────────

let _currentOutputFile = null;
let _currentOutputContent = null;

async function loadHistorial() {
    const body = document.getElementById("historial-body");
    body.innerHTML = `<p class="llm-empty">Cargando...</p>`;
    try {
        const res = await fetch(`${API_BASE}/outputs`);
        const data = await res.json();
        const files = data.files || [];
        const badge = document.getElementById("nav-badge-outputs");
        if (badge) badge.textContent = files.length > 0 ? files.length : "";
        if (files.length === 0) {
            body.innerHTML = `<p class="llm-empty">No hay outputs guardados aún. Generá un resultado con algún agente y guardalo como .md.</p>`;
            return;
        }
        body.innerHTML = `
            <div class="historial-grid">
                ${files.map(f => {
            const agentId = f.name.split("-")[0] || "output";
            const icon = agentIconFromId(agentId);
            const date = formatIsoDate(f.modified);
            const sizeKb = (f.size / 1024).toFixed(1);
            return `
                    <div class="historial-card" onclick="openOutputViewer('${escapeHtml(f.name)}')">
                        <div class="historial-card-icon">${icon}</div>
                        <div class="historial-card-info">
                            <div class="historial-card-name">${escapeHtml(f.name)}</div>
                            <div class="historial-card-meta">${date} · ${sizeKb} KB</div>
                        </div>
                        <div class="historial-card-actions" onclick="event.stopPropagation()">
                            <button class="btn-inspector-action" onclick="openOutputViewer('${escapeHtml(f.name)}')">👁 Ver</button>
                            <button class="btn-inspector-action" style="color:var(--accent3)" onclick="confirmDeleteOutput('${escapeHtml(f.name)}')">🗑️</button>
                        </div>
                    </div>`;
        }).join("")}
            </div>`;
    } catch {
        body.innerHTML = `<p class="llm-empty" style="color:var(--accent3)">❌ Error cargando historial.</p>`;
    }
}

function agentIconFromId(id) {
    const icons = { "doc-interpreter": "📄", "testcase-general": "🧪", "testcase-gherkin": "🥒", "playwright-agent": "🎭", "inspector": "🔍" };
    return icons[id] || "📁";
}

function formatIsoDate(iso) {
    try {
        return new Date(iso).toLocaleString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
    } catch { return iso; }
}

async function openOutputViewer(filename) {
    _currentOutputFile = filename;
    document.getElementById("output-viewer-title").textContent = filename;
    document.getElementById("output-viewer-content").innerHTML = `<p class="llm-empty">Cargando...</p>`;
    document.getElementById("output-viewer-modal").style.display = "flex";
    try {
        const res = await fetch(`${API_BASE}/outputs/${encodeURIComponent(filename)}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        _currentOutputContent = data.content;
        document.getElementById("output-viewer-content").innerHTML = renderMarkdown(data.content);
    } catch (err) {
        document.getElementById("output-viewer-content").innerHTML = `<p style="color:var(--accent3)">❌ ${escapeHtml(err.message)}</p>`;
    }
}

function closeOutputViewer() {
    document.getElementById("output-viewer-modal").style.display = "none";
    _currentOutputFile = null;
    _currentOutputContent = null;
}

function copyOutputContent() {
    if (!_currentOutputContent) return;
    navigator.clipboard.writeText(_currentOutputContent)
        .then(() => showToast("📋 Contenido copiado"))
        .catch(() => showToast("❌ No se pudo copiar"));
}

async function deleteCurrentOutput() {
    if (!_currentOutputFile) return;
    if (!confirm(`¿Eliminar "${_currentOutputFile}"?`)) return;
    await confirmDeleteOutput(_currentOutputFile);
    closeOutputViewer();
}

async function confirmDeleteOutput(filename) {
    try {
        const res = await fetch(`${API_BASE}/outputs/${encodeURIComponent(filename)}`, { method: "DELETE" });
        const data = await res.json();
        if (res.ok) {
            showToast(`🗑️ Eliminado: ${filename}`);
            loadHistorial();
            loadOutputsCount();
        } else {
            showToast(`❌ ${data.error}`);
        }
    } catch { showToast("❌ Error al eliminar"); }
}

// ─────────────────────────────────────────────────────────────────────────────
// CONFIGURACIÓN / SETUP WIZARD
// ─────────────────────────────────────────────────────────────────────────────

async function loadConfig() {
    try {
        const res = await fetch(`${API_BASE}/config`);
        const data = await res.json();
        const badge = document.getElementById("nav-badge-config");
        if (badge) badge.style.display = !data.isConfigured ? "inline-flex" : "none";
        const body = document.getElementById("config-body");
        if (body) renderConfigView(data);
    } catch { }
}

function renderConfigView(data) {
    const config = data.config || {};
    const field = (key, label, type, placeholder, hint) => {
        const val = config[key] || "";
        const isCfg = val.length > 0;
        return `
        <div class="config-field">
            <label>${label}</label>
            <div class="config-field-row">
                <input type="${type}" id="cfg-${key}" value="${val}" placeholder="${placeholder}" autocomplete="off" />
                <span class="config-status ${isCfg ? "is-configured" : "not-configured"}">${isCfg ? "✅" : "○"}</span>
            </div>
            ${hint ? `<span class="form-hint">${hint}</span>` : ""}
        </div>`;
    };
    document.getElementById("config-body").innerHTML = `
        <div class="config-section">
            <div class="config-section-title">🤖 GitHub Copilot <span class="config-required-badge">Principal</span></div>
            <p class="config-hint">
                Token de GitHub para invocar los modelos LLM (GPT-4.1, Claude, Llama, Phi, etc.) vía
                <strong>GitHub Models API</strong>. También habilita la importación de agentes desde repositorios privados.<br><br>
                Generalo en <a href="https://github.com/settings/tokens" target="_blank" rel="noopener">github.com/settings/tokens</a>
                — scope mínimo requerido: <code>read:user</code>. Si usás GitHub Models necesitás acceso al programa de GitHub Models beta.
            </p>
            ${field("GITHUB_TOKEN", "GITHUB_TOKEN", "password", "ghp_... o github_pat_...", "Se guarda en el archivo .env local. Nunca se envía a terceros.")}
        </div>
        <div class="config-actions">
            <button class="btn-modal-save" onclick="saveConfig()">💾 Guardar configuración</button>
        </div>`;
}

async function saveConfig() {
    const keys = ["GITHUB_TOKEN"];
    const config = {};
    for (const key of keys) {
        const el = document.getElementById(`cfg-${key}`);
        if (el) config[key] = el.value.trim();
    }
    try {
        const res = await fetch(`${API_BASE}/config`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ config }),
        });
        const data = await res.json();
        if (res.ok) { showToast("✅ Configuración guardada"); await loadConfig(); }
        else showToast(`❌ ${data.error}`);
    } catch { showToast("❌ No se pudo conectar con el servidor"); }
}

// ─────────────────────────────────────────────────────────────────────────────
// MCPs
// ─────────────────────────────────────────────────────────────────────────────

async function loadMcps() {
    const body = document.getElementById("mcps-body");
    body.innerHTML = `<p class="llm-empty">Cargando...</p>`;
    try {
        const res = await fetch(`${API_BASE}/mcp`);
        const data = await res.json();
        const servers = data.servers || {};
        const names = Object.keys(servers);
        if (names.length === 0) {
            body.innerHTML = `<p class="llm-empty">No hay servidores MCP configurados. Hacé click en ➕ Agregar servidor para empezar.</p>`;
            return;
        }
        body.innerHTML = `<div class="mcp-list">
            ${names.map(name => {
            const s = servers[name];
            const envKeys = Object.keys(s.env || {});
            return `
                <div class="mcp-card">
                    <div class="mcp-card-header">
                        <div class="mcp-card-name">🔌 ${escapeHtml(name)}</div>
                        <button class="btn-inspector-action" style="color:var(--accent3)" onclick="deleteMcpServer('${escapeHtml(name)}')">🗑️ Eliminar</button>
                    </div>
                    <div class="mcp-card-detail"><code>${escapeHtml(s.command)} ${(s.args || []).map(a => escapeHtml(a)).join(" ")}</code></div>
                    ${envKeys.length > 0 ? `<div class="mcp-card-env">ENV: ${envKeys.map(k => `<span class="skill-tag">${escapeHtml(k)}</span>`).join(" ")}</div>` : ""}
                </div>`;
        }).join("")}
        </div>`;
    } catch {
        body.innerHTML = `<p class="llm-empty" style="color:var(--accent3)">❌ Error cargando MCPs.</p>`;
    }
}

function openAddMcpModal() {
    document.getElementById("mcp-name").value = "";
    document.getElementById("mcp-command").value = "";
    document.getElementById("mcp-args").value = "";
    document.getElementById("mcp-env").value = "";
    document.getElementById("mcp-add-modal").style.display = "flex";
}

function closeMcpAddModal() {
    document.getElementById("mcp-add-modal").style.display = "none";
}

async function saveMcpServer() {
    const name = document.getElementById("mcp-name").value.trim();
    const command = document.getElementById("mcp-command").value.trim();
    const argsRaw = document.getElementById("mcp-args").value.trim();
    const envRaw = document.getElementById("mcp-env").value.trim();
    if (!name || !command) { showToast("❌ Nombre y comando son obligatorios"); return; }
    const args = argsRaw ? argsRaw.split("\n").map(s => s.trim()).filter(Boolean) : [];
    const env = {};
    if (envRaw) {
        for (const line of envRaw.split("\n")) {
            const [k, ...rest] = line.split("=");
            if (k && rest.length > 0) env[k.trim()] = rest.join("=").trim();
        }
    }
    try {
        const res = await fetch(`${API_BASE}/mcp`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name, command, args, env }),
        });
        const data = await res.json();
        if (res.ok) { showToast(`✅ Servidor MCP "${name}" guardado`); closeMcpAddModal(); loadMcps(); }
        else showToast(`❌ ${data.error}`);
    } catch { showToast("❌ Error al guardar MCP"); }
}

async function deleteMcpServer(name) {
    if (!confirm(`¿Eliminar el servidor MCP "${name}"?`)) return;
    try {
        const res = await fetch(`${API_BASE}/mcp/${encodeURIComponent(name)}`, { method: "DELETE" });
        const data = await res.json();
        if (res.ok) { showToast(`✅ MCP "${name}" eliminado`); loadMcps(); }
        else showToast(`❌ ${data.error}`);
    } catch { showToast("❌ Error al eliminar MCP"); }
}

// ─────────────────────────────────────────────────────────────────────────────
// JIRA
// ─────────────────────────────────────────────────────────────────────────────

let _jiraProjects = [];
let _jiraCurrentJql = "assignee = currentUser() ORDER BY updated DESC";

async function loadJiraView() {
    const body = document.getElementById("jira-body");
    body.innerHTML = `<p class="llm-empty">Verificando configuración...</p>`;

    // Chequear si ya están configuradas las credenciales de Jira
    let jiraConfigured = false;
    try {
        const res = await fetch(`${API_BASE}/config`);
        const data = await res.json();
        const cfg = data.config || {};
        // Detectar configurado: el valor enmascarado es no-vacío
        jiraConfigured = !!(cfg.JIRA_BASE_URL && cfg.JIRA_EMAIL && cfg.JIRA_TOKEN);
        // Solo pre-llenar URL (no es secreto); email y token se dejan en blanco por seguridad
        _jiraFormCache = {
            url: cfg.JIRA_BASE_URL && !cfg.JIRA_BASE_URL.startsWith("***") ? cfg.JIRA_BASE_URL : "",
            email: "",
            token: ""
        };
    } catch { }

    // Panel de conexión (siempre visible y colapsable)
    const connPanel = `
        <div class="jira-conn-panel ${jiraConfigured ? "jira-conn-collapsed" : ""}" id="jira-conn-panel">
            <div class="jira-conn-header" onclick="toggleJiraConnPanel()">
                <span>${jiraConfigured ? "✅ Conectado a Jira" : "🔗 Configurar conexión con Jira"}</span>
                <span class="jira-conn-chevron" id="jira-conn-chevron">${jiraConfigured ? "▸" : "▾"}</span>
            </div>
            <div class="jira-conn-body" id="jira-conn-body" style="display:${jiraConfigured ? "none" : "block"}">
                <p class="config-hint" style="margin-bottom:14px">
                    Ingresá las credenciales de tu instancia de Jira. El token de API se genera en
                    <a href="https://id.atlassian.com/manage-profile/security/api-tokens" target="_blank" rel="noopener">atlassian.com → API Tokens</a>.
                </p>
                <div class="jira-conn-fields">
                    <div class="config-field">
                        <label>URL de la instancia</label>
                        <input type="url" id="jira-cfg-url" value="${escapeHtml(_jiraFormCache.url)}" placeholder="https://tu-empresa.atlassian.net" autocomplete="off" />
                    </div>
                    <div class="config-field">
                        <label>Email de usuario</label>
                        <input type="email" id="jira-cfg-email" value="${escapeHtml(_jiraFormCache.email)}" placeholder="tu@empresa.com" autocomplete="off" />
                    </div>
                    <div class="config-field">
                        <label>API Token</label>
                        <input type="password" id="jira-cfg-token" value="${escapeHtml(_jiraFormCache.token)}" placeholder="Token generado en Atlassian" autocomplete="off" />
                    </div>
                </div>
                <div style="display:flex;gap:10px;margin-top:12px">
                    <button class="btn-modal-save" onclick="saveJiraConnection()">💾 Guardar y conectar</button>
                    ${jiraConfigured ? `<button class="btn-modal-cancel" onclick="clearJiraConnection()">🗑️ Desconectar</button>` : ""}
                </div>
                <div id="jira-conn-status" style="margin-top:10px"></div>
            </div>
        </div>`;

    // Panel de tareas (solo si está configurado)
    const tasksPanel = jiraConfigured ? `
        <div class="jira-toolbar">
            <input type="text" id="jira-jql" value="${escapeHtml(_jiraCurrentJql)}" placeholder="JQL: project = MYP ORDER BY updated DESC" class="jira-jql-input" />
            <button class="btn-inspect" onclick="loadJiraIssues()">🔍 Buscar issues</button>
            <button class="btn-view-action secondary" onclick="openCreateBugModal()">🐛 Reportar Bug</button>
        </div>
        <div id="jira-issues-body">
            <p class="llm-empty">Buscá issues con JQL para delegarlos a un agente.</p>
        </div>` : `
        <div id="jira-issues-body">
            <div class="jira-not-configured">
                <p>Configurá la conexión arriba para empezar a trabajar con issues de Jira.</p>
                <p class="form-hint">Una vez conectado, podrás buscar issues y delegarlos a cualquier agente activo para que genere casos de prueba, analice bugs, o cualquier otra tarea.</p>
            </div>
        </div>`;

    body.innerHTML = connPanel + tasksPanel;
}

let _jiraFormCache = { url: "", email: "", token: "" };

function toggleJiraConnPanel() {
    const body = document.getElementById("jira-conn-body");
    const chevron = document.getElementById("jira-conn-chevron");
    if (!body) return;
    const isOpen = body.style.display !== "none";
    body.style.display = isOpen ? "none" : "block";
    if (chevron) chevron.textContent = isOpen ? "▸" : "▾";
}

async function saveJiraConnection() {
    const url = (document.getElementById("jira-cfg-url")?.value || "").trim();
    const email = (document.getElementById("jira-cfg-email")?.value || "").trim();
    const token = (document.getElementById("jira-cfg-token")?.value || "").trim();
    const statusEl = document.getElementById("jira-conn-status");

    if (!url || !email || !token) {
        if (statusEl) statusEl.innerHTML = `<div class="jira-status-error">❌ Completá todos los campos.</div>`;
        return;
    }

    if (statusEl) statusEl.innerHTML = `<p class="llm-empty">Guardando y verificando conexión...</p>`;

    // Guardar en .env via /api/config
    try {
        const res = await fetch(`${API_BASE}/config`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ config: { JIRA_BASE_URL: url, JIRA_EMAIL: email, JIRA_TOKEN: token } }),
        });
        if (!res.ok) {
            if (statusEl) statusEl.innerHTML = `<div class="jira-status-error">❌ No se pudo guardar la configuración.</div>`;
            return;
        }
    } catch {
        if (statusEl) statusEl.innerHTML = `<div class="jira-status-error">❌ Error conectando con el servidor.</div>`;
        return;
    }

    // Probar conexión
    try {
        const res = await fetch(`${API_BASE}/jira/test`);
        const data = await res.json();
        if (res.ok) {
            if (statusEl) statusEl.innerHTML = `<div class="jira-status-ok">✅ Conectado como <strong>${escapeHtml(data.displayName)}</strong> (${escapeHtml(data.email)})</div>`;
            showToast(`✅ Jira conectado: ${data.displayName}`);
            // Recargar vista para mostrar el panel de tareas
            setTimeout(() => loadJiraView(), 1200);
        } else {
            if (statusEl) statusEl.innerHTML = `<div class="jira-status-error">❌ ${escapeHtml(data.error)}</div>`;
        }
    } catch {
        if (statusEl) statusEl.innerHTML = `<div class="jira-status-error">❌ Credenciales guardadas pero no se pudo conectar. Verificá los datos.</div>`;
    }
}

async function clearJiraConnection() {
    if (!confirm("¿Desconectar Jira?\n\nSe borrarán las credenciales del archivo .env local.")) return;
    try {
        await fetch(`${API_BASE}/config`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ config: { JIRA_BASE_URL: "", JIRA_EMAIL: "", JIRA_TOKEN: "" } }),
        });
        showToast("🔌 Jira desconectado");
        loadJiraView();
    } catch { showToast("❌ Error al desconectar"); }
}

async function testJiraConnection() {
    const statusEl = document.getElementById("jira-connection-status");
    if (statusEl) statusEl.innerHTML = `<p class="llm-empty">Probando conexión...</p>`;
    try {
        const res = await fetch(`${API_BASE}/jira/test`);
        const data = await res.json();
        if (res.ok) {
            if (statusEl) statusEl.innerHTML = `<div class="jira-status-ok">✅ Conectado como <strong>${escapeHtml(data.displayName)}</strong> (${escapeHtml(data.email)})</div>`;
            showToast(`✅ Jira conectado: ${data.displayName}`);
            loadJiraProjects();
        } else {
            if (statusEl) statusEl.innerHTML = `<div class="jira-status-error">❌ ${escapeHtml(data.error)}</div>`;
            showToast(`❌ ${data.error}`);
        }
    } catch {
        if (statusEl) statusEl.innerHTML = `<div class="jira-status-error">❌ No se pudo conectar con el servidor.</div>`;
    }
}

async function loadJiraProjects() {
    try {
        const res = await fetch(`${API_BASE}/jira/projects`);
        const data = await res.json();
        if (res.ok) _jiraProjects = data.projects || [];
    } catch { }
}

async function loadJiraIssues() {
    const jqlEl = document.getElementById("jira-jql");
    const jql = jqlEl ? jqlEl.value.trim() : _jiraCurrentJql;
    _jiraCurrentJql = jql;
    const issuesBody = document.getElementById("jira-issues-body");
    if (!issuesBody) return;
    issuesBody.innerHTML = `<p class="llm-empty">Buscando issues...</p>`;
    try {
        const res = await fetch(`${API_BASE}/jira/issues?jql=${encodeURIComponent(jql)}&maxResults=20`);
        const data = await res.json();
        if (!res.ok) { issuesBody.innerHTML = `<p class="llm-empty" style="color:var(--accent3)">❌ ${escapeHtml(data.error)}</p>`; return; }
        const issues = data.issues || [];
        if (issues.length === 0) { issuesBody.innerHTML = `<p class="llm-empty">No se encontraron issues con ese JQL.</p>`; return; }
        issuesBody.innerHTML = `
            <div class="jira-total">Total: ${data.total} issues</div>
            <div class="jira-table-wrap">
                <table class="jira-table">
                    <thead><tr><th>Clave</th><th>Tipo</th><th>Resumen</th><th>Estado</th><th>Prioridad</th><th>Acciones</th></tr></thead>
                    <tbody>
                        ${issues.map(i => `
                        <tr>
                            <td><span class="jira-key">${escapeHtml(i.key)}</span></td>
                            <td><span class="jira-type">${escapeHtml(i.type || "")}</span></td>
                            <td class="jira-summary">${escapeHtml(i.summary)}</td>
                            <td><span class="jira-status">${escapeHtml(i.status || "")}</span></td>
                            <td>${escapeHtml(i.priority || "")}</td>
                            <td class="jira-actions">
                                <button class="btn-inspector-action" onclick="jiraIssueToAgent('${escapeHtml(i.key)}', \`${escapeHtml(i.summary)}\`, \`${escapeHtml(i.description)}\`)">🧪 Test Cases</button>
                                <button class="btn-inspector-action" onclick="openAddCommentModal('${escapeHtml(i.key)}')">💬 Comentar</button>
                            </td>
                        </tr>`).join("")}
                    </tbody>
                </table>
            </div>`;
    } catch { issuesBody.innerHTML = `<p class="llm-empty" style="color:var(--accent3)">❌ Error al cargar issues.</p>`; }
}

function jiraIssueToAgent(key, summary, description) {
    const agent = AGENTS.find(a => a.id === "testcase-general") || AGENTS[0];
    if (!agent) { showToast("❌ No hay agentes activos"); return; }
    openChat(agent.id);
    setTimeout(() => {
        const input = document.getElementById("chat-input");
        input.value = `Issue Jira: ${key}\nResumen: ${summary}\nDescripción: ${description || "(sin descripción)"}\n\nGenerá casos de prueba para esta user story.`;
        input.focus();
    }, 150);
}

function openAddCommentModal(issueKey) {
    const comment = prompt(`Escribí un comentario para ${issueKey}:`);
    if (!comment) return;
    addJiraComment(issueKey, comment);
}

async function addJiraComment(issueKey, comment) {
    try {
        const res = await fetch(`${API_BASE}/jira/comment`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ issueKey, comment }),
        });
        const data = await res.json();
        if (res.ok) showToast(`✅ Comentario agregado a ${issueKey}`);
        else showToast(`❌ ${data.error}`);
    } catch { showToast("❌ Error al agregar comentario"); }
}

function openCreateBugModal() {
    const projectKey = prompt("Clave del proyecto Jira (ej: MYP):");
    if (!projectKey) return;
    const summary = prompt("Resumen del bug:");
    if (!summary) return;
    const description = prompt("Descripción (opcional):", "") || "";
    createJiraBug(projectKey, summary, description);
}

async function createJiraBug(projectKey, summary, description) {
    try {
        const res = await fetch(`${API_BASE}/jira/bug`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ projectKey, summary, description }),
        });
        const data = await res.json();
        if (res.ok) showToast(`✅ Bug creado: ${data.key} — ${data.url}`);
        else showToast(`❌ ${data.error}`);
    } catch { showToast("❌ Error al crear bug en Jira"); }
}

// ─────────────────────────────────────────────────────────────────────────────
// EDITOR VISUAL DE AGENTES
// ─────────────────────────────────────────────────────────────────────────────

let _editingAgentId = null;

function openCreateAgentModal() {
    _editingAgentId = null;
    document.getElementById("agent-editor-title").textContent = "Crear agente";
    document.getElementById("ae-id").value = "";
    document.getElementById("ae-id").disabled = false;
    document.getElementById("ae-icon").value = "🤖";
    document.getElementById("ae-name").value = "";
    document.getElementById("ae-description").value = "";
    document.getElementById("ae-flow").value = "";
    document.getElementById("ae-hint").value = "Pegá el contenido del documento aquí.";
    document.getElementById("ae-skills").value = "";
    document.getElementById("ae-prompt").value = "";
    document.getElementById("agent-editor-modal").style.display = "flex";
}

function openEditAgentModal(agentId) {
    const agent = _allAgents.find(a => a.id === agentId);
    if (!agent) return;
    _editingAgentId = agentId;
    document.getElementById("agent-editor-title").textContent = `Editar: ${agent.name}`;
    document.getElementById("ae-id").value = agent.id;
    document.getElementById("ae-id").disabled = true;
    document.getElementById("ae-icon").value = agent.icon;
    document.getElementById("ae-name").value = agent.name;
    document.getElementById("ae-description").value = agent.description;
    document.getElementById("ae-flow").value = agent.flow;
    document.getElementById("ae-hint").value = agent.hint;
    document.getElementById("ae-skills").value = (agent.skills || []).join("\n");
    document.getElementById("ae-prompt").value = agent.prompt;
    document.getElementById("agent-editor-modal").style.display = "flex";
}

function closeAgentEditorModal() {
    document.getElementById("agent-editor-modal").style.display = "none";
    _editingAgentId = null;
}

async function saveAgentFromEditor() {
    const getId = id => document.getElementById(id).value.trim();
    const id = getId("ae-id");
    const name = getId("ae-name");
    if (!id || !name) { showToast("❌ ID y Nombre son obligatorios"); return; }
    const body = {
        id, name,
        description: getId("ae-description"),
        icon: getId("ae-icon") || "🤖",
        flow: getId("ae-flow"),
        hint: getId("ae-hint") || "Pegá el contenido del documento aquí.",
        prompt: document.getElementById("ae-prompt").value.trim(),
        skills: document.getElementById("ae-skills").value.split("\n").map(s => s.trim()).filter(Boolean),
    };
    const isEdit = !!_editingAgentId;
    const url = isEdit ? `${API_BASE}/agents/${_editingAgentId}` : `${API_BASE}/agents/create`;
    const method = isEdit ? "PUT" : "POST";
    try {
        const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
        const data = await res.json();
        if (res.ok) {
            showToast(`✅ Agente "${name}" ${isEdit ? "actualizado" : "creado"}`);
            closeAgentEditorModal();
            await loadAgents();
        } else showToast(`❌ ${data.error}`);
    } catch { showToast("❌ Error al guardar el agente"); }
}

async function deleteAgent(agentId) {
    const agent = _allAgents.find(a => a.id === agentId);
    if (!confirm(`¿Eliminar el agente "${agent ? agent.name : agentId}"? Esta acción no se puede deshacer.`)) return;
    try {
        const res = await fetch(`${API_BASE}/agents/${agentId}`, { method: "DELETE" });
        const data = await res.json();
        if (res.ok) { showToast(`✅ Agente "${agentId}" eliminado`); await loadAgents(); }
        else showToast(`❌ ${data.error}`);
    } catch { showToast("❌ Error al eliminar el agente"); }
}

// ─────────────────────────────────────────────────────────────────────────────
// IMPORTAR DESDE GITHUB
// ─────────────────────────────────────────────────────────────────────────────

function openImportGithubModal() {
    document.getElementById("github-import-url").value = "";
    document.getElementById("github-import-token").value = "";
    document.getElementById("github-import-status").innerHTML = "";
    document.getElementById("btn-do-github-import").disabled = false;
    document.getElementById("btn-do-github-import").textContent = "⬇️ Importar";
    document.getElementById("github-import-modal").style.display = "flex";
}

function closeGithubImportModal() {
    document.getElementById("github-import-modal").style.display = "none";
}

async function doGithubImport() {
    const repoUrl = document.getElementById("github-import-url").value.trim();
    const token = document.getElementById("github-import-token").value.trim();
    const statusEl = document.getElementById("github-import-status");
    const btn = document.getElementById("btn-do-github-import");
    if (!repoUrl) { showToast("❌ Ingresá una URL"); return; }
    btn.disabled = true;
    btn.textContent = "⏳ Importando...";
    statusEl.innerHTML = `<p class="llm-empty">Descargando archivos desde GitHub...</p>`;
    try {
        const res = await fetch(`${API_BASE}/agents/import-github`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ repoUrl, token: token || undefined }),
        });
        const data = await res.json();
        if (res.ok) {
            statusEl.innerHTML = `<div class="jira-status-ok">✅ ${escapeHtml(data.message)}</div>`;
            showToast(`✅ ${data.message}`);
            await loadAgents();
            setTimeout(closeGithubImportModal, 2000);
        } else {
            statusEl.innerHTML = `<div class="jira-status-error">❌ ${escapeHtml(data.error)}</div>`;
            btn.disabled = false;
            btn.textContent = "⬇️ Importar";
        }
    } catch {
        statusEl.innerHTML = `<div class="jira-status-error">❌ No se pudo conectar con el servidor.</div>`;
        btn.disabled = false;
        btn.textContent = "⬇️ Importar";
    }
}
