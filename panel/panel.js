const API_BASE = "http://localhost:3000/api";

// Límites basados en documentación pública de GitHub Models (plan Free/Pro)
// https://docs.github.com/en/github-models/prototyping-with-ai-models#rate-limits
const MODELS = [
    { id: "gpt-4o", label: "GPT-4o", provider: "OpenAI", cost: 3, rpm: 10, tpd: 8_000, tpm: 4_000 },
    { id: "gpt-4o-mini", label: "GPT-4o mini", provider: "OpenAI", cost: 1, rpm: 15, tpd: 16_000, tpm: 8_000 },
    { id: "o3-mini", label: "o3-mini", provider: "OpenAI", cost: 3, rpm: 10, tpd: 8_000, tpm: 4_000 },
    { id: "Meta-Llama-3.3-70B-Instruct", label: "Llama 3.3 70B", provider: "Meta", cost: 2, rpm: 15, tpd: 16_000, tpm: 8_000 },
    { id: "Meta-Llama-3.1-8B-Instruct", label: "Llama 3.1 8B", provider: "Meta", cost: 1, rpm: 30, tpd: 32_000, tpm: 16_000 },
    { id: "Mistral-Large-2411", label: "Mistral Large", provider: "Mistral", cost: 3, rpm: 10, tpd: 8_000, tpm: 4_000 },
    { id: "Phi-4", label: "Phi-4", provider: "Microsoft", cost: 1, rpm: 15, tpd: 16_000, tpm: 8_000 },
    { id: "DeepSeek-R1", label: "DeepSeek R1", provider: "DeepSeek", cost: 3, rpm: 10, tpd: 8_000, tpm: 4_000 },
];

let activeChatModel = "gpt-4o";
let usageLog = [];
let realQuotaData = null;
let quotaFetching = false;

const AGENTS = [
    {
        id: "doc-interpreter",
        name: "Doc Interpreter",
        icon: "📄",
        description: "Lee e interpreta documentación funcional (.doc, .pdf) y extrae requerimientos estructurados.",
        skills: ["read-doc", "read-pdf", "extract-functional-requirements"],
        flow: "PRIMER PASO — Usarme antes que los otros agentes",
        hint: "Pegá el contenido de tu documento funcional y enviá.",
        prompt: `Eres un analista funcional senior. Se te entregará el contenido de un documento funcional.

Analizá el documento y generá el siguiente output en Markdown:

## Módulos identificados
## Actores y Roles
## Flujos por módulo (principal, alternativo, errores)
## Reglas de negocio
## Precondiciones globales
## Ambigüedades detectadas (marcar con ⚠️)
## Resumen ejecutivo

Variable de entrada:
{documento}: [PEGÁ AQUÍ EL CONTENIDO DEL DOCUMENTO]

Restricciones: no inventar funcionalidades, marcar ambigüedades con ⚠️, ser fiel al documento.`
    },
    {
        id: "testcase-general",
        name: "Test Case General",
        icon: "🧪",
        description: "Genera casos de prueba estándar (funcionales, regresión, integración, borde) en formato tabla Markdown.",
        skills: ["read-doc", "read-pdf", "generate-testcases"],
        flow: "SEGUNDO PASO — Usar después del Doc Interpreter",
        hint: "Pegá el documento funcional o el output del Doc Interpreter.",
        prompt: `Eres un QA Engineer senior. Se te proporcionará documentación funcional o requerimientos interpretados.

Generá casos de prueba completos en el siguiente formato de tabla:

| ID | Título | Precondiciones | Pasos | Resultado Esperado | Tipo |
|----|--------|----------------|-------|--------------------|------|

Tipos: Funcional / Regresión / Integración / Borde / Negativo
Agrupá los casos por módulo. Al final incluí un resumen con totales por tipo.

Variable de entrada:
{documento}: [PEGÁ AQUÍ EL DOCUMENTO O EL OUTPUT DEL DOC INTERPRETER]

Restricciones: IDs correlativos TC-001..., marcar ambigüedades con [REQUIERE CLARIFICACIÓN].`
    },
    {
        id: "testcase-gherkin",
        name: "Test Case Gherkin",
        icon: "🥒",
        description: "Genera casos de prueba en formato Gherkin/BDD listos para Cucumber, SpecFlow o Behave.",
        skills: ["read-doc", "read-pdf", "generate-gherkin"],
        flow: "SEGUNDO PASO — Usar después del Doc Interpreter",
        hint: "Pegá el documento funcional o el output del Doc Interpreter.",
        prompt: `Eres un especialista en BDD y Gherkin. Se te proporcionará documentación funcional.

Generá archivos .feature con sintaxis Gherkin válida:
- Cada funcionalidad = una Feature con narrativa (Como / Quiero / Para)
- Scenarios para: flujo feliz, alternativos, validaciones y errores
- Usar Scenario Outline + Examples para múltiples datos
- Tags: @smoke, @regression, @functional, @negative, @pendiente

Variable de entrada:
{documento}: [PEGÁ AQUÍ EL DOCUMENTO O EL OUTPUT DEL DOC INTERPRETER]
{idioma}: español

Restricciones: sintaxis Gherkin estrictamente válida, no mezclar idiomas.`
    },
    {
        id: "playwright-agent",
        name: "Playwright Agent",
        icon: "🎭",
        description: "Genera tests end-to-end en Playwright (TypeScript) listos para ejecutar con npx playwright test.",
        skills: ["read-doc", "read-pdf", "generate-playwright-tests"],
        flow: "SEGUNDO PASO — Usar después del Doc Interpreter",
        hint: "Pegá el documento o el output del Doc Interpreter. Podés indicar la URL base del sistema.",
        prompt: `Eres un automation engineer senior especializado en Playwright con TypeScript. Se te proporcionará documentación funcional.

Generá tests Playwright completos y listos para ejecutar:
- Usar getByRole, getByLabel, getByText como locators principales
- Patrón Arrange / Act / Assert en cada test
- Agrupar con test.describe() por módulo
- Cubrir: flujo feliz, casos alternativos y errores
- Marcar con // TODO: ajustar selector donde dependa de la implementación

Variable de entrada:
{documento}: [PEGÁ AQUÍ EL DOCUMENTO O EL OUTPUT DEL DOC INTERPRETER]
{url}: (opcional) URL base del sistema

Restricciones: solo TypeScript, locators semánticos, no inventar URLs específicas.`
    }
];

// ─── Utilidades ───────────────────────────────────────────────────────────

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
    grid.innerHTML = AGENTS.map(agent => `
    <div class="agent-card" id="card-${agent.id}">
      <div class="agent-header">
        <span class="agent-icon">${agent.icon}</span>
        <div>
          <div class="agent-name">${agent.name}</div>
          <div class="agent-id">${agent.id}.agent.md</div>
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
        <button class="btn-invoke" onclick="openChat('${agent.id}')">
          💬 Abrir Chat
        </button>
        <button class="btn-secondary" onclick="showPrompt('${agent.id}')">
          👁 Ver Prompt
        </button>
      </div>
    </div>
  `).join("");
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

function openChat(agentId) {
    const agent = AGENTS.find(a => a.id === agentId);
    activeChatAgentId = agentId;
    chatHistory = [];
    lastAssistantContent = "";
    removeAttachment();

    document.getElementById("chat-modal-title").textContent = `${agent.icon} ${agent.name} — Chat`;
    document.getElementById("chat-hint").textContent = agent.hint;
    document.getElementById("chat-messages").innerHTML = `
      <div class="chat-msg assistant">
        <div class="msg-bubble"><p>Hola! Soy el agente <strong>${agent.name}</strong>. ${agent.hint} También podés adjuntar un archivo <strong>.doc o .docx</strong> directamente.</p></div>
      </div>`;
    document.getElementById("chat-input").value = "";
    document.getElementById("btn-save-md").style.display = "none";

    // Poblar selector de modelo
    const modelSel = document.getElementById("chat-model-select");
    modelSel.innerHTML = buildModelOptions(activeChatModel);

    document.getElementById("chat-modal").style.display = "flex";
    setTimeout(() => document.getElementById("chat-input").focus(), 100);
}

function closeChatModal() {
    document.getElementById("chat-modal").style.display = "none";
    activeChatAgentId = null;
    chatHistory = [];
    lastAssistantContent = "";
    removeAttachment();
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

    chatHistory.push({ role: "user", content: messageContent });

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
                        if (data.usage) {
                            appendTokenBadge(bubble, data.usage, data.model || activeChatModel);
                            addUsageRecord(activeChatAgentId, data.model || activeChatModel, data.usage);
                        }
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
    const panel = document.getElementById("llm-panel");
    const overlay = document.getElementById("llm-panel-overlay");
    panel.classList.toggle("open");
    overlay.classList.toggle("open");
    if (panel.classList.contains("open")) {
        renderLLMPanel();
        if (!realQuotaData) fetchRealQuota();
    }
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
    const tokPct = Math.min(100, Math.round(((d.limit_tokens - d.remaining_tokens) / d.limit_tokens) * 100));
    const reqPct = Math.min(100, Math.round(((d.limit_requests - d.remaining_requests) / d.limit_requests) * 100));
    const tokWarn = tokPct >= 80 ? "bar-danger" : tokPct >= 50 ? "bar-warn" : "";
    const reqWarn = reqPct >= 80 ? "bar-danger" : reqPct >= 50 ? "bar-warn" : "";
    const checkedAt = new Date(d.checked_at).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
    document.getElementById("real-quota-box").innerHTML = `
        <div class="real-quota-model">${escapeHtml(d.model)} <span class="rq-region">${escapeHtml(d.region)}</span></div>
        <div class="rq-row">
            <div class="rq-label">Tokens restantes</div>
            <div class="rq-value">${d.remaining_tokens.toLocaleString()} <span class="rq-of">/ ${d.limit_tokens.toLocaleString()}</span></div>
        </div>
        <div class="mlr-bar-wrap"><div class="mlr-bar ${tokWarn}" style="width:${tokPct}%"></div></div>
        <div class="rq-row" style="margin-top:10px">
            <div class="rq-label">Requests restantes</div>
            <div class="rq-value">${d.remaining_requests.toLocaleString()} <span class="rq-of">/ ${d.limit_requests.toLocaleString()}</span></div>
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
    if (document.getElementById("llm-panel").classList.contains("open")) renderLLMPanel();
}

function appendTokenBadge(bubble, usage, model) {
    const badge = document.createElement("div");
    badge.className = "token-badge";
    badge.innerHTML = `📊 <span class="tb-prompt">${(usage.prompt_tokens || 0).toLocaleString()} prompt</span> + <span class="tb-completion">${(usage.completion_tokens || 0).toLocaleString()} completion</span> = <strong>${(usage.total_tokens || 0).toLocaleString()} tokens</strong> <span class="tb-model">${escapeHtml(model)}</span>`;
    bubble.parentElement.appendChild(badge);
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
        document.getElementById("outputs-count").textContent = data.files.length;
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
    renderAgents();
    loadOutputsCount();
    checkServerStatus();
    // Inicializar selector global de modelo y barras de límites
    document.getElementById("global-model-select").innerHTML = buildModelOptions(activeChatModel);
    renderLLMPanel();
    document.getElementById("inspector-url").addEventListener("keydown", (e) => {
        if (e.key === "Enter") runInspector();
    });
    document.getElementById("modal").addEventListener("click", function (e) {
        if (e.target === this) closeModal();
    });
    document.getElementById("chat-modal").addEventListener("click", function (e) {
        if (e.target === this) closeChatModal();
    });
});
