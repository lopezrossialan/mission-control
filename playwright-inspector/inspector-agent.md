# Playwright Inspector

## Descripción
Herramienta de inspección de URLs que usa Playwright en modo headless para extraer todos los elementos interactuables de una página web con sus XPaths y locators equivalentes para Playwright.

## Qué extrae
- Inputs, buttons, links, selects, textareas y elementos con roles ARIA
- XPath de cada elemento
- Locator Playwright recomendado (semántico cuando es posible)
- Texto visible / label asociado
- Atributos relevantes: id, name, data-testid

## Cómo usarlo
1. En el panel, ir a la sección **Playwright Inspector**
2. Ingresar la URL a inspeccionar
3. Hacer click en **Inspeccionar**
4. Usar los resultados para:
   - Copiar al clipboard como JSON
   - Guardar como `.json` en `/outputs/`
   - Enviar directamente al **Playwright Agent** para generar tests con locators reales

## Limitaciones
- Solo funciona con URLs accesibles desde la máquina donde corre el servidor
- No accede a páginas que requieran login previo sin configuración adicional
- Sitios con mucho JavaScript async pueden requerir mayor tiempo de espera

## Archivos
- `inspector.js` — módulo Node.js que ejecuta Playwright y extrae los elementos
