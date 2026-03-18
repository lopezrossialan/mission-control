# PWPROMPT — Prompt para generar diapositivas de presentación

Copiá y pegá el siguiente prompt en cualquier IA (ChatGPT, Copilot, Claude, etc.) para generar una presentación sobre Mission Control.

---

## Prompt

```
Necesito que generes el contenido de una presentación de diapositivas profesional sobre un proyecto de software llamado "Mission Control".

**Contexto del proyecto:**
Mission Control es una herramienta local que actúa como panel de administración y orquestación de agentes de IA especializados en testing de software. La idea central es que cualquier equipo de QA pueda tener sus propios agentes de GitHub Copilot (definidos como archivos .agent.md y .prompt.md) y administrarlos, ejecutarlos e interactuar con ellos desde un frontend web local, sin necesidad de abrir VS Code. Cada agente recibe documentación funcional y genera artefactos de testing de forma automática usando LLMs (GPT-4o, Llama, Mistral, etc.) a través de la GitHub Models API.

**Stack tecnológico:**
- Frontend: HTML, CSS y JavaScript vanilla (sin frameworks)
- Backend: Node.js + Express
- LLMs: GitHub Models API (compatible con OpenAI SDK), modelo principal GPT-4o
- Autenticación: GitHub Personal Access Token (PAT)
- Procesamiento de documentos: mammoth (Word), multer (uploads)
- Inspección web: Playwright headless (Chromium)

**Agentes incluidos:**
1. Doc Interpreter: lee documentación funcional (.doc/.docx) y extrae requerimientos estructurados
2. Test Case General: genera casos de prueba en formato tabla Markdown (funcional, regresión, borde, negativo)
3. Test Case Gherkin: genera features BDD en formato Given/When/Then listos para Cucumber o SpecFlow
4. Playwright Agent: genera tests end-to-end en TypeScript (.spec.ts) listos para ejecutar

**Herramienta destacada — Playwright Inspector:**
Herramienta integrada en el panel que usa Playwright headless para navegar cualquier URL y extraer automáticamente todos los elementos interactuables (inputs, botones, links, selects) con sus locators semánticos de Playwright y sus XPaths. El resultado se puede copiar como JSON, guardar en /outputs/ o enviar directamente al Playwright Agent para generar tests con locators reales.

**Panel de LLMs & Consumo:**
Panel lateral que muestra en tiempo real: modelo LLM activo y selector para cambiarlo, cuota real disponible (tokens y requests) consultada directamente a la API de GitHub, historial de tokens consumidos por agente en la sesión, y barras de progreso de consumo estimado por modelo.

**Flujo de trabajo:**
Documento funcional → Doc Interpreter → [Test Case General / Gherkin / Playwright Agent] → /outputs/
URL del sistema → Playwright Inspector → Playwright Agent → /outputs/

**Propósito y audiencia:**
- Equipos de QA que quieren automatizar la generación de casos de prueba
- Desarrolladores que trabajan con GitHub Copilot y quieren una interfaz visual para sus agentes
- Cualquier persona con GitHub Pro o Education que quiera aprovechar los LLMs gratuitos de GitHub Models sin pagar APIs adicionales

---

Por favor generá el contenido de una presentación con las siguientes características:

**Formato:** Una diapositiva por sección, con título, puntos clave en bullet points, y una frase de impacto o tagline cuando corresponda.

**Estructura sugerida (podés ajustarla):**
1. Portada — nombre del proyecto, tagline, autor
2. El problema que resuelve — por qué es difícil generar testing de calidad hoy
3. ¿Qué es Mission Control? — definición en una frase + propósito
4. Arquitectura del sistema — componentes principales y cómo se conectan
5. Los agentes — qué hace cada uno, con ejemplos de output
6. Playwright Inspector — cómo funciona, qué extrae, por qué es útil
7. Panel de LLMs & Consumo — gestión de modelos y monitoreo de cuota
8. Flujo de trabajo completo — de la documentación al test automatizado
9. Stack tecnológico — tecnologías usadas y por qué
10. Costos — por qué es gratis con GitHub Education/Pro
11. Próximos pasos / roadmap sugerido
12. Cierre — frase de impacto + llamado a la acción

**Tono:** profesional pero accesible, orientado a equipos técnicos de QA y desarrollo.
**Idioma:** español.
**Para cada diapositiva incluir:** título, 3-5 bullets con el contenido, y opcionalmente una nota del presentador.

Si podés, al final sugerí también qué tipo de imagen o ícono representaría bien cada diapositiva.
```

---

## Variante corta (para presentación de 5 minutos)

```
Generá el contenido de una presentación corta (6-8 diapositivas, estilo pitch) sobre "Mission Control", una herramienta open-source que permite administrar agentes de IA de GitHub Copilot desde un panel web local. Los agentes leen documentación funcional y generan casos de prueba en distintos formatos (tabla, Gherkin, Playwright). Incluye un inspector de URLs con Playwright para extraer locators reales. Usa GitHub Models API con el token de GitHub, es gratis con cuentas Education y Pro. El stack es Node.js + Express + HTML/CSS/JS vanilla.

Estructura: problema → solución → cómo funciona → demo del flujo → stack y costos → próximos pasos.
Tono: directo, técnico, en español.
```

---

## Variante para README de GitHub

```
Generá un README.md profesional y visualmente atractivo (con badges, emojis y secciones bien organizadas) para un proyecto de GitHub llamado "Mission Control". Es un panel web local para orquestar agentes de IA de GitHub Copilot especializados en testing. Los agentes generan casos de prueba (tabla Markdown, Gherkin, Playwright) a partir de documentación funcional. Incluye un Playwright Inspector para extraer locators reales de cualquier URL, y un panel de gestión de LLMs con cuota real de GitHub Models API. Stack: Node.js, Express, Playwright, HTML/CSS/JS vanilla. Gratis con GitHub Education/Pro.

Incluir: descripción, badges de tecnologías, captura de pantalla placeholder, features principales, instalación paso a paso, uso básico, arquitectura, contribución y licencia.
```
