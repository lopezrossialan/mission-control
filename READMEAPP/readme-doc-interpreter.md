# Doc Interpreter Agent

**ID:** `doc-interpreter`  
**Versión:** 1.0.0

## Descripción

Lee e interpreta documentación funcional (`.doc`, `.docx`) y extrae requerimientos estructurados listos para que los demás agentes del proyecto los consuman.

## Cuándo usarlo

Antes de invocar cualquier agente generador de casos de prueba. Procesarlo primero garantiza que el documento fue correctamente analizado y que la información es precisa para la generación.

## Qué produce

Un archivo `{nombre-documento}-interpreted.md` en `/outputs/` con los requerimientos organizados:

- **Actores** del sistema
- **Flujos principales y alternativos**
- **Reglas de negocio**
- **Precondiciones y postcondiciones**
- **Excepciones y casos de error**
- **Ambigüedades detectadas** — zonas sin especificar en el documento original

## Cómo usarlo

### Desde el panel (recomendado)
1. Abrir el panel en `http://localhost:3000`
2. Hacer click en el card **Doc Interpreter**
3. Adjuntar el archivo `.doc` / `.docx` con el ícono 📎
4. Enviar el mensaje — el agente procesará y devolverá el análisis en el chat
5. Guardar como `.md` con el botón 💾

### Desde Copilot Chat
1. Depositar el documento en `/inputs/`
2. Abrir el agente `doc-interpreter` en Copilot Chat
3. Pegar el contenido del prompt base del archivo `doc-interpreter.prompt.md`

## Skills disponibles

| Skill | Descripción |
|---|---|
| `read-doc` | Lectura y procesamiento de archivos Word |
| `read-pdf` | Lectura y procesamiento de archivos PDF |
| `extract-functional-requirements` | Extracción estructurada de requerimientos funcionales |

## Flujo recomendado

```
Doc Interpreter → testcase-general
              ↘ testcase-gherkin
              ↘ playwright-agent
```

## Archivos

```
agents/doc-interpreter/
├── doc-interpreter.agent.md     # Configuración del agente
├── doc-interpreter.prompt.md    # Prompt base
├── readme-doc-interpreter.md    # Este archivo
└── skills/
    ├── read-doc.skill.md
    ├── read-pdf.skill.md
    └── extract-functional-requirements.skill.md
```
