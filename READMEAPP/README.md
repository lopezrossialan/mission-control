# 🛸 Mission Control — Documentación General

## ¿Qué es Mission Control?

Mission Control es un workspace local de agentes especializados en testing, orquestados desde un panel web. Cada agente usa la API de **GitHub Models** (GPT-4o) para interpretar documentación funcional y generar distintos tipos de artefactos de QA — casos de prueba, features Gherkin o tests Playwright automatizados.

---

## Arquitectura del proyecto

```
mission-control/
│
├── agents/                        # Agentes de IA especializados
│   ├── doc-interpreter/           # Interpreta documentación funcional
│   ├── testcase-general/          # Genera casos de prueba en tabla
│   ├── testcase-gherkin/          # Genera features Gherkin/BDD
│   └── playwright-agent/          # Genera tests Playwright (.spec.ts)
│
├── playwright-inspector/          # Herramienta: inspección de URLs con Playwright
│
├── panel/                         # Frontend del panel de control
│   ├── index.html                 # UI principal (vanilla HTML)
│   ├── panel.js                   # Lógica del panel, agentes, inspector
│   └── panel.css                  # Estilos dark theme
│
├── inputs/                        # Documentos a procesar (subir acá)
├── outputs/                       # Artefactos generados (se guardan acá)
│
├── server.js                      # Servidor Express — proxy LLM + API REST
├── package.json
├── .env                           # GITHUB_TOKEN (no commitear)
├── .gitignore
│
└── READMEAPP/                     # Documentación del proyecto
    ├── README.md                  # Este archivo
    ├── readme-doc-interpreter.md
    ├── readme-testcase-general.md
    ├── readme-testcase-gherkin.md
    ├── readme-playwright-agent.md
    └── readme-playwright-inspector.md
```

---

## Stack tecnológico

| Capa | Tecnología |
|---|---|
| Backend | Node.js + Express |
| LLM | GitHub Models API (GPT-4o) via `models.inference.ai.azure.com` |
| Auth | GitHub Personal Access Token (`.env`) |
| Frontend | Vanilla HTML / CSS / JS — sin frameworks |
| Inspección | Playwright headless (Chromium) |
| Upload docs | multer + mammoth (extracción de texto de .doc/.docx) |
| Streaming | Server-Sent Events (SSE) |

---

## Flujo de trabajo

```
                    ┌─────────────────────┐
                    │   Doc Interpreter   │  ← opcional, mejora calidad
                    │  (interpreta .docx) │
                    └──────────┬──────────┘
                               │
          ┌────────────────────┼────────────────────┐
          ▼                    ▼                    ▼
  ┌───────────────┐  ┌──────────────────┐  ┌────────────────────┐
  │ Test Case     │  │ Test Case Gherkin│  │  Playwright Agent  │
  │ General       │  │ (Feature/Scenario│  │  (.spec.ts)        │
  │ (tabla Markdown)│ │  Given-When-Then)│  │                    │
  └───────┬───────┘  └────────┬─────────┘  └─────────┬──────────┘
          │                   │                       │
          └───────────────────┴───────────────────────┘
                                      │
                                      ▼
                               /outputs/  💾

          ┌──────────────────────────────────────────┐
          │         🔍 Playwright Inspector          │
          │  URL → elementos + locators + screenshot │
          │          ↓ ⚡ Playwright Agent           │
          └──────────────────────────────────────────┘
```

---

## Endpoints del servidor (`http://localhost:3000`)

| Método | Endpoint | Descripción |
|---|---|---|
| `POST` | `/api/chat` | Chat con un agente — streaming SSE |
| `POST` | `/api/upload` | Subir `.doc`/`.docx` → devuelve texto extraído |
| `POST` | `/api/inspect` | Inspeccionar URL con Playwright |
| `POST` | `/api/save` | Guardar respuesta como `.md` en `/outputs/` |
| `POST` | `/api/save-json` | Guardar JSON del inspector en `/outputs/` |
| `GET`  | `/api/outputs` | Listar archivos en `/outputs/` |

---

## Documentación por componente

### Agentes

- [Doc Interpreter](readme-doc-interpreter.md) — lee documentación funcional y extrae requerimientos estructurados
- [Test Case General](readme-testcase-general.md) — genera casos de prueba en tabla (funcional, regresión, borde, negativo)
- [Test Case Gherkin](readme-testcase-gherkin.md) — genera features Gherkin/BDD listos para Cucumber / SpecFlow / Behave
- [Playwright Agent](readme-playwright-agent.md) — genera tests `.spec.ts` end-to-end con Playwright

### Herramientas

- [Playwright Inspector](readme-playwright-inspector.md) — inspecciona URLs y extrae locators + XPaths de todos los elementos interactuables

---

## Inicio rápido

```bash
# 1. Instalar dependencias
npm install

# 2. Instalar Chromium para el inspector
npx playwright install chromium

# 3. Configurar token
# Editar .env y agregar: GITHUB_TOKEN=ghp_...

# 4. Levantar servidor
npm start

# 5. Abrir el panel
# http://localhost:3000
```

---

## Cómo extender el proyecto

### Agregar un nuevo agente
1. Crear carpeta `agents/{funcion}/`  
2. Crear `{funcion}.agent.md`, `{funcion}.prompt.md` y carpeta `skills/`  
3. Registrar en `panel/panel.js` dentro del array `AGENTS`  
4. Agregar el system prompt en `server.js` dentro de `AGENT_SYSTEM_PROMPTS`  
5. Crear la documentación en `READMEAPP/readme-{funcion}.md`

### Agregar un skill a un agente existente
1. Crear `agents/{funcion}/skills/{nuevo-skill}.skill.md`  
2. Agregar el nombre en el campo `skills:` del `.agent.md` correspondiente

### Cambiar el modelo LLM
En `server.js`, modificar la línea:
```js
model: "gpt-4o"   // → cambiar por cualquier modelo compatible con la API
```
Y si se cambia de proveedor, actualizar también `baseURL` en el constructor de `OpenAI`.
