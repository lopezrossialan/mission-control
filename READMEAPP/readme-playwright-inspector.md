# Playwright Inspector

## Descripción

Herramienta de inspección de URLs que usa **Playwright en modo headless** para extraer todos los elementos interactuables de una página web con sus XPaths, atributos y locators equivalentes para Playwright. Integrada directamente en el panel de Mission Control.

## Qué extrae

Por cada elemento interactuable encontrado en la página:

| Campo | Descripción |
|---|---|
| `tag` | Tipo de elemento HTML (`input`, `button`, `a`, `select`, `textarea`) |
| `type` | Atributo `type` del input cuando aplica (`text`, `password`, `email`, etc.) |
| `label` | Texto visible, `aria-label`, o `placeholder` — en ese orden de prioridad |
| `locator` | Locator Playwright recomendado (semántico cuando es posible) |
| `xpath` | XPath absoluto del elemento en el DOM |
| `id_attr` | Atributo `id` si existe |
| `name` | Atributo `name` si existe |
| `classes` | Lista de clases CSS |

### Tipos de elementos detectados
- Inputs (excepto `type="hidden"`)
- Buttons
- Links (`<a href>`)
- Selects
- Textareas
- Elementos con roles ARIA interactuables

### Prioridad de locators generados

El inspector intenta generar el locator más robusto disponible en este orden:

1. `getByTestId(...)` — si el elemento tiene `data-testid`
2. `getByLabel(...)` — si tiene label asociado
3. `getByRole(...)` — si es un elemento semántico con rol ARIA
4. `getByPlaceholder(...)` — si tiene placeholder
5. `getByText(...)` — si tiene texto visible (para links y botones)
6. `locator('xpath=...')` — fallback a XPath

## Cómo usarlo

### Desde el panel
1. Abrir el panel en `http://localhost:3000`
2. Ir a la sección **🔍 Playwright Inspector**
3. Ingresar la URL a inspeccionar (también podés pulsar Enter)
4. Hacer click en **🔍 Inspeccionar**
5. Esperar unos segundos mientras Playwright navega la página
6. Usar los resultados:

| Acción | Descripción |
|---|---|
| **Filtros** | Filtrar por tipo: Todos / Inputs / Botones / Links / Selects |
| **📋 Copiar JSON** | Copia el array de elementos al portapapeles |
| **💾 Guardar JSON** | Guarda el JSON en `/outputs/inspector-{hostname}-{timestamp}.json` |
| **⚡ Usar en Playwright Agent** | Abre el chat del Playwright Agent con los locators pre-cargados |

## API

La herramienta expone un endpoint en el servidor local:

```
POST /api/inspect
Content-Type: application/json

{ "url": "https://tu-app.com/pagina" }
```

**Respuesta:**
```json
{
  "url": "https://tu-app.com/pagina",
  "title": "Título de la página",
  "screenshot": "data:image/jpeg;base64,...",
  "elements": [
    {
      "id": 1,
      "tag": "input",
      "type": "email",
      "label": "Correo electrónico",
      "xpath": "/html/body/main/form/div[1]/input",
      "locator": "page.getByLabel('Correo electrónico')",
      "name": "email",
      "id_attr": "email-field",
      "classes": ["form-control", "input-email"]
    }
  ]
}
```

## Guardar JSON

El endpoint `POST /api/save-json` guarda el resultado en `/outputs/`:

```
POST /api/save-json
Content-Type: application/json

{ "filename": "inspector-mi-app-2026-03-16", "data": [...] }
```

## Limitaciones

- Solo funciona con URLs accesibles desde la máquina donde corre el servidor
- No accede a páginas que requieran login previo (sin configuración adicional)
- Sitios con mucho JavaScript asincrónico pueden mostrar menos elementos si cargan tarde
- El servidor debe estar corriendo (`npm start`) y Chromium debe estar instalado (`npx playwright install chromium`)

## Requisitos

- **Playwright** instalado: `npm install playwright`
- **Chromium** instalado: `npx playwright install chromium`
- Servidor corriendo en el puerto 3000

## Archivos

```
playwright-inspector/
├── inspector.js            # Módulo Node.js — lógica de inspección con Playwright
├── inspector-agent.md      # Documentación interna
└── readme-playwright-inspector.md  # Este archivo
```
