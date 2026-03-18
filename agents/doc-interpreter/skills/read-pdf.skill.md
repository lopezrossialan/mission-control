---
skill: read-pdf
version: 1.0.0
---

## Skill: Leer PDF

### Descripción
Capacidad para recibir el contenido extraído de un archivo PDF y procesarlo como texto estructurado.

### Cuándo usarlo
Cuando el input sea un archivo .pdf. Extraer el texto y pasarlo como variable {documento}.

### Instrucción al modelo
Recibirás el contenido de un PDF como texto plano. Consideraciones:
- Trata cada página como un bloque de texto continuo
- Si hay tablas, reconstruí su estructura usando Markdown
- Ignorá headers, footers y numeración de páginas repetitivos
- Respetá la jerarquía de títulos si es detectable

### Extensión futura
- Soporte para PDFs escaneados (OCR)
- Extracción de diagramas y figuras
- Procesamiento de formularios PDF
