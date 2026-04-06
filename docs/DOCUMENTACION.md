# 🛸 Mission Control — Documentación de Instalación y Uso

Guía completa para clonar, configurar y levantar Mission Control desde cero en cualquier máquina.

---

## ¿Qué es Mission Control?

Mission Control es un workspace local que expone agentes de IA especializados en testing a través de un panel web interactivo. Cada agente usa la **GitHub Models API** (GPT-4o y otros LLMs) para interpretar documentación funcional y generar artefactos de QA: casos de prueba en tabla, features Gherkin/BDD, y tests automatizados en Playwright.

También incluye un **Playwright Inspector** que navega URLs con un browser headless y extrae todos los elementos interactuables con sus locators y XPaths, listo para usarlos en los tests.

**Agentes disponibles:**
- 📄 **Doc Interpreter** — lee documentación `.doc`/`.docx` y extrae requerimientos estructurados
- 🧪 **Test Case General** — genera casos de prueba en formato tabla Markdown
- 🥒 **Test Case Gherkin** — genera features BDD listos para Cucumber / SpecFlow / Behave
- 🎭 **Playwright Agent** — genera tests `.spec.ts` end-to-end listos para ejecutar

---

## Requisitos previos

| Herramienta | Versión mínima | Cómo verificar |
|---|---|---|
| **Node.js** | 18.x o superior | `node --version` |
| **npm** | 8.x o superior | `npm --version` |
| **Git** | cualquier versión reciente | `git --version` |
| **Cuenta de GitHub** | Free, Pro o Education | — |

---

## Paso 1 — Clonar el repositorio

```bash
git clone https://github.com/TU_USUARIO/mission-control.git
cd mission-control
```

---

## Paso 2 — Obtener el GitHub Token (PAT)

Mission Control necesita un **Personal Access Token (PAT)** de GitHub para acceder a la GitHub Models API. Es gratuito con cualquier cuenta de GitHub — no requiere tarjeta de crédito.

### Cómo obtenerlo

1. Ir a [github.com/settings/tokens](https://github.com/settings/tokens)
2. Hacer click en **"Generate new token"** → **"Generate new token (classic)"**
3. Darle un nombre descriptivo, por ejemplo: `mission-control-local`
4. En **Expiration**: elegir 90 días o "No expiration"
5. En **Select scopes**: no hace falta marcar ninguno adicional para GitHub Models (el acceso es por la cuenta, no por scopes)
6. Hacer click en **"Generate token"**
7. **Copiar el token inmediatamente** — solo se muestra una vez. Empieza con `ghp_`

> **Nota para cuentas Education/Pro:** La cuota es de 2.000.000 tokens/día y 20.000 requests/día — más que suficiente para uso intensivo diario.

> **Nota para cuentas Free:** La cuota es menor (8.000–32.000 tokens/día según el modelo), pero igual funciona para uso normal.

### Verificar acceso a GitHub Models

Podés confirmar que tu cuenta tiene acceso en: [github.com/marketplace/models](https://github.com/marketplace/models)

---

## Paso 3 — Configurar el archivo `.env`

En la raíz del proyecto, crear un archivo llamado `.env` (este archivo **no se sube a GitHub**, está en el `.gitignore`):

```bash
# En la terminal, desde la carpeta del proyecto:
echo GITHUB_TOKEN=ghp_TU_TOKEN_AQUI > .env
```

O crearlo manualmente con cualquier editor de texto con este contenido:

```
GITHUB_TOKEN=ghp_TU_TOKEN_AQUI
```

Reemplazar `ghp_TU_TOKEN_AQUI` con el token que copiaste en el paso anterior.

> ⚠️ **Nunca subas el archivo `.env` a GitHub.** Ya está incluido en el `.gitignore` del proyecto, pero verificarlo siempre antes de hacer un commit.

---

## Paso 4 — Instalar dependencias

```bash
npm install
```

Esto instala: Express, cors, dotenv, openai, mammoth, multer y playwright.

---

## Paso 5 — Instalar Chromium (para el Inspector)

El Playwright Inspector necesita el browser Chromium para navegar URLs:

```bash
npx playwright install chromium
```

> Esto descarga ~150 MB la primera vez. Solo se hace una vez.

---

## Paso 6 — Levantar el servidor

```bash
npm start
```

Deberías ver:

```
🛸 Mission Control server corriendo en http://localhost:3000
   Panel: http://localhost:3000/index.html
```

---

## Paso 7 — Abrir el panel

Abrir en el navegador:

```
http://localhost:3000
```

El panel está listo para usar. El indicador en el footer muestra **🟢 SERVIDOR ONLINE** cuando la conexión es correcta.

---

## Estructura del proyecto

```
mission-control/
│
├── agents/                          # Agentes de IA
│   ├── doc-interpreter/
│   │   ├── doc-interpreter.agent.md
│   │   ├── doc-interpreter.prompt.md
│   │   └── skills/
│   ├── testcase-general/
│   ├── testcase-gherkin/
│   └── playwright-agent/
│
├── playwright-inspector/            # Herramienta de inspección de URLs
│   └── inspector.js
│
├── panel/                           # Frontend (vanilla HTML/CSS/JS)
│   ├── index.html
│   ├── panel.js
│   └── panel.css
│
├── inputs/                          # Depositar documentos a procesar aquí
├── outputs/                         # Los resultados generados se guardan aquí
│
├── server.js                        # Servidor Express — backend principal
├── package.json
├── .env                             # ← TU TOKEN (nunca subir a GitHub)
├── .gitignore                       # .env y node_modules/ están aquí
│
├── READMEAPP/                       # Documentación por componente
│   ├── README.md                    # Arquitectura completa
│   ├── readme-doc-interpreter.md
│   ├── readme-testcase-general.md
│   ├── readme-testcase-gherkin.md
│   ├── readme-playwright-agent.md
│   └── readme-playwright-inspector.md
│
├── README.md                        # Índice del proyecto
├── DOCUMENTACION.md                 # Este archivo
└── PWPROMPT.md                      # Prompt para diapositivas
```

---

## Cómo usar el panel

### Chat con un agente

1. Hacer click en **"💬 Abrir Chat"** en cualquier agente
2. Escribir o pegar el contenido del documento funcional, **o**
3. Adjuntar un archivo `.doc` / `.docx` con el botón **📎 Adjuntar**
4. Hacer click en **⚡ Enviar** (o Enter)
5. Guardar el resultado con **💾 Guardar .md**

### Playwright Inspector

1. Ir a la sección **🔍 Playwright Inspector** en el panel
2. Ingresar la URL a inspeccionar y hacer click en **🔍 Inspeccionar**
3. Ver la tabla de elementos con sus locators y XPaths
4. Usar **⚡ Usar en Playwright Agent** para generar tests directamente con los locators reales

### Panel de LLMs & Consumo

Hacer click en **🤖 LLMs & Consumo** en el header del panel para:
- Cambiar el modelo LLM activo (GPT-4o, Llama, Mistral, Phi-4, DeepSeek, etc.)
- Ver la **cuota real disponible** con datos directos de la API (botón 🔄 Actualizar)
- Ver el historial de tokens consumidos en la sesión actual

---

## Endpoints del servidor

| Método | Endpoint | Descripción |
|---|---|---|
| `POST` | `/api/chat` | Chat con un agente — streaming SSE |
| `POST` | `/api/upload` | Subir `.doc`/`.docx` → extrae texto |
| `POST` | `/api/inspect` | Inspeccionar URL con Playwright |
| `GET`  | `/api/quota` | Cuota real disponible en GitHub Models |
| `POST` | `/api/save` | Guardar respuesta como `.md` en `/outputs/` |
| `POST` | `/api/save-json` | Guardar JSON del inspector en `/outputs/` |
| `GET`  | `/api/outputs` | Listar archivos generados en `/outputs/` |

---

## Modelos LLM disponibles

Todos disponibles con un PAT de GitHub sin costo adicional:

| Modelo | Proveedor | Costo relativo | Req/min | Tokens/día (Pro/Edu) |
|---|---|---|---|---|
| GPT-4o | OpenAI | ●●● | 10 | 2.000.000 |
| GPT-4o mini | OpenAI | ●○○ | 15 | 2.000.000 |
| o3-mini | OpenAI | ●●● | 10 | 2.000.000 |
| Llama 3.3 70B | Meta | ●●○ | 15 | 2.000.000 |
| Llama 3.1 8B | Meta | ●○○ | 30 | 2.000.000 |
| Mistral Large | Mistral | ●●● | 10 | 2.000.000 |
| Phi-4 | Microsoft | ●○○ | 15 | 2.000.000 |
| DeepSeek R1 | DeepSeek | ●●● | 10 | 2.000.000 |

---

## Cambiar el modelo por defecto

En `server.js`, el modelo por defecto es `gpt-4o`. Para cambiarlo globalmente, modificar la línea en el endpoint `/api/chat`:

```js
const model = ALLOWED_MODELS.has(requestedModel) ? requestedModel : "gpt-4o";
//                                                                     ^^^^^^^^
//                                                         Cambiar por otro modelo
```

También se puede cambiar modelo por sesión desde el selector en el panel.

---

## Flujo de trabajo recomendado

```
1. Depositar documento funcional en /inputs/
          ↓
2. Doc Interpreter → interpreta y estructura los requerimientos
          ↓
   ┌──────┴───────┐──────────────┐
   ▼              ▼              ▼
Test Case    Gherkin/BDD    Playwright
General      (.feature)     (.spec.ts)
   │              │              │
   └──────────────┴──────────────┘
                  ↓
            /outputs/  💾
```

---

## Solución de problemas frecuentes

### El servidor no arranca (`npm start` falla)

Verificar que el `.env` existe y tiene el token correcto:
```bash
# Windows PowerShell
Get-Content .env

# Linux/Mac
cat .env
```

### Error 401 Unauthorized en los chats

El token en `.env` es inválido o expiró. Generar uno nuevo siguiendo el Paso 2.

### El Inspector no funciona / timeout

Chromium no está instalado o la URL no es accesible desde tu máquina:
```bash
npx playwright install chromium
```

### Puerto 3000 ya en uso

```bash
# Windows PowerShell
Get-Process -Name "node" | Stop-Process -Force

# Linux/Mac
pkill node
```

Luego volver a ejecutar `npm start`.

### El panel muestra 🔴 SERVIDOR OFFLINE

El servidor no está corriendo. Ejecutar `npm start` en la terminal.

---

## Seguridad y privacidad

- El archivo `.env` con tu token **nunca debe subirse a GitHub** — ya está en `.gitignore`
- Los documentos que subís y las respuestas de los agentes se procesan localmente (pasan por tu servidor en `localhost`) antes de enviarse a la API de GitHub Models
- GitHub Models procesa los datos en servidores de Azure (East US) — considerarlo si trabajás con información confidencial
- El token de GitHub tiene acceso de lectura básico — si se compromete, revocarlo desde [github.com/settings/tokens](https://github.com/settings/tokens)

---

## Tecnologías utilizadas

- **Node.js + Express** — servidor backend
- **OpenAI SDK** — cliente para GitHub Models API
- **mammoth** — extracción de texto de archivos Word
- **multer** — manejo de uploads de archivos
- **Playwright** — browser automatizado para el inspector
- **HTML / CSS / JS vanilla** — frontend sin frameworks
- **GitHub Models API** — acceso a LLMs (GPT-4o, Llama, Mistral, etc.)
