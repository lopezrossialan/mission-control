# 🛸 Mission Control — Panel de Control de Agentes

Panel web local para crear, configurar y usar agentes especializados de GitHub Copilot sin necesidad de editar archivos. Backend Node.js + Express. Frontend HTML/CSS/JS puro, sin frameworks.

---

## Requisitos previos

- [Node.js](https://nodejs.org/) v18 o superior
- Cuenta de GitHub con acceso a [GitHub Models](https://github.com/marketplace/models) (plan Free o Pro)
- (Opcional) Cuenta de Atlassian para integración Jira

---

## Instalación paso a paso

### 1. Clonar o descargar el proyecto

```bash
git clone https://github.com/tu-usuario/mission-control.git
cd "mission control"
```

### 2. Instalar dependencias

```bash
npm install
```

### 3. Instalar Playwright (para el Inspector de URLs)

```bash
npx playwright install chromium
```

### 4. Levantar el servidor

```bash
npm start
```

El servidor queda corriendo en **http://localhost:3000**

### 5. Configurar tokens (sin editar archivos)

Abrí el panel en tu navegador → sección **⚙️ Configuración** en el menú lateral → pegá tu token de GitHub y los demás que necesites → **Guardar configuración**.

El panel escribe automáticamente el archivo `.env` en la carpeta del proyecto.

**Tokens disponibles para configurar:**

| Token | Dónde obtenerlo | Para qué sirve |
|---|---|---|
| `GITHUB_TOKEN` | [github.com/settings/tokens](https://github.com/settings/tokens) | GitHub Models API (GPT-4o, Claude, Llama, etc.) — **principal** |
| `OPENAI_API_KEY` | [platform.openai.com](https://platform.openai.com/api-keys) | OpenAI directo (sin pasar por GitHub Models) |
| `ANTHROPIC_API_KEY` | [console.anthropic.com](https://console.anthropic.com/) | Claude directo |
| `JIRA_BASE_URL` | Tu instancia: `https://empresa.atlassian.net` | Integración Jira |
| `JIRA_EMAIL` | Tu email de Atlassian | Integración Jira |
| `JIRA_TOKEN` | [id.atlassian.com/manage-profile/security/api-tokens](https://id.atlassian.com/manage-profile/security/api-tokens) | Integración Jira |

---

## Estructura del proyecto

```
mission-control/
├── server.js              # Backend Express — todos los endpoints de la API
├── package.json
├── .env                   # Tokens (se genera desde el panel, no editar a mano)
├── agents/                # Agentes incluidos
│   ├── doc-interpreter/
│   ├── testcase-general/
│   ├── testcase-gherkin/
│   └── playwright-agent/
├── panel/                 # Frontend del panel web
│   ├── index.html
│   ├── panel.js
│   └── panel.css
├── config/
│   └── agent-dirs.json    # Rutas externas de agentes (gestionado desde el panel)
├── inputs/                # Documentos de entrada (uso manual)
├── outputs/               # Resultados generados por los agentes (.md, .json)
├── playwright-inspector/  # Módulo de inspección de URLs con Playwright
├── docs/                  # Documentación técnica adicional
└── READMEAPP/             # Documentación por agente
```

### Estructura de un agente

```
agents/{nombre}/
├── {nombre}.agent.md      # Metadatos: id, name, icon, flow, skills
├── {nombre}.prompt.md     # System prompt que recibe el LLM
└── skills/
    └── {skill}.skill.md   # Capacidades reutilizables del agente
```

---

## Menú del panel y qué hace cada sección

| Sección | Función |
|---|---|
| 🏠 **Inicio** | Diagrama de flujo de trabajo + Playwright Inspector de URLs |
| 🤖 **Agentes** | Ver, chatear, editar, eliminar agentes. Crear nuevos o importar desde GitHub |
| 📁 **Historial** | Ver, copiar y eliminar los outputs `.md` y `.json` generados |
| ⚡ **Modelos LLM** | Elegir el modelo activo, ver cuota real de la API, consumo de tokens en sesión |
| 🔌 **MCPs** | Agregar/eliminar servidores MCP — se escribe en `.vscode/mcp.json` automáticamente |
| 🔗 **Jira** | Buscar issues por JQL, enviarlos a un agente, crear bugs, agregar comentarios |
| ⚙️ **Configuración** | Gestión de todos los tokens/credenciales sin editar archivos |

---

## Flujo de trabajo recomendado

```
1. Subir documento funcional (.doc/.docx)
         ↓
2. Doc Interpreter  →  extrae actores, flujos, reglas de negocio
         ↓
   ┌─────┴──────┬──────────────┐
3a. Test Case   3b. Gherkin    3c. Playwright
    General         BDD            Tests (.spec.ts)
         ↓
4. Guardar output como .md  →  aparece en Historial
```

### Escenario 1 — Generar test cases desde un documento Word

1. Ir a **Agentes** → abrir chat de **Doc Interpreter**
2. Adjuntar el `.docx` con el botón 📎 o pegarlo como texto
3. Enviar → el agente extrae los requerimientos estructurados
4. Guardar como `.md` con 💾
5. Abrir chat de **Test Case General** o **Gherkin**
6. Pegar el output del paso anterior → enviar
7. Guardar el resultado en Historial

### Escenario 2 — Generar tests Playwright desde una URL real

1. Ir a **Inicio** → sección **Playwright Inspector**
2. Ingresar la URL de la aplicación → **Inspeccionar**
3. El panel abre Playwright headless, captura todos los elementos interactuables (inputs, botones, links) con sus locators semánticos y XPaths
4. Hacer click en **⚡ Usar en Playwright Agent**
5. El contexto de la página se pre-carga en el chat del agente → enviar
6. El agente genera el `.spec.ts` listo para ejecutar con `npx playwright test`

### Escenario 3 — Trabajar con issues de Jira

1. Configurar credenciales en **⚙️ Configuración**
2. Ir a **🔗 Jira** → **Probar conexión**
3. Buscar issues con JQL (ej: `project = MYP AND issuetype = Story`)
4. Hacer click en **🧪 Test Cases** en un issue → se abre el chat del agente con la descripción pre-cargada
5. El agente genera los casos de prueba para esa user story
6. Opcionalmente: crear un **🐛 Bug** en Jira desde el panel o **💬 Comentar** sobre un issue

### Escenario 4 — Crear un agente propio

1. Ir a **Agentes** → **✏️ Crear agente**
2. Completar el formulario: ID, nombre, icono, descripción, prompt del sistema, skills
3. Guardar → el agente aparece en la grilla y en el diagrama de flujo
4. O importar desde GitHub: **⬇️ Importar de GitHub** → pegar URL del repo (público sin token, privado con PAT)

### Escenario 5 — Agregar un servidor MCP

1. Ir a **🔌 MCPs** → **➕ Agregar servidor**
2. Completar nombre, comando, argumentos y variables de entorno
3. Guardar → se escribe en `.vscode/mcp.json` del workspace
4. Reiniciar VS Code para que Copilot detecte el nuevo MCP

---

## Cómo se conectan los componentes

```
Browser (panel/index.html + panel.js)
    │
    │  HTTP REST + SSE streaming (localhost:3000)
    ▓
Express (server.js)
    ├── GET  /api/agents         →  lee agents/ + config/agent-dirs.json
    ├── POST /api/chat           →  stream SSE al LLM (GitHub Models / OpenAI / Anthropic)
    ├── POST /api/upload         →  extrae texto de .doc/.docx (mammoth / word-extractor)
    ├── POST /api/inspect        →  Playwright headless → captura elementos de la URL
    ├── GET  /api/quota          →  consulta límites reales de la API del modelo activo
    ├── POST /api/agents/create  →  crea carpeta + archivos del nuevo agente
    ├── POST /api/agents/import-github → descarga agente desde GitHub API
    ├── GET|POST|DELETE /api/mcp →  lee/escribe .vscode/mcp.json
    ├── GET|POST /api/config     →  lee/escribe .env (tokens)
    ├── GET|POST /api/jira/*     →  proxy a Jira REST API v3
    └── GET|POST|DELETE /api/outputs →  lee/escribe/elimina /outputs/
```

---

## Seguridad y privacidad

- Todo corre en **localhost** — ningún agente ni panel es accesible desde internet
- Los tokens se guardan en `.env` local, nunca se envían al frontend
- El texto que enviás en el chat **sí sale de tu máquina** hacia el proveedor del LLM (GitHub/OpenAI/Anthropic) — igual que cualquier uso de Copilot Chat
- Para información confidencial, usá modelos con garantías enterprise (Azure OpenAI con data residency)
