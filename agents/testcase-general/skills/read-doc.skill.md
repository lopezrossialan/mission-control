---
skill: read-doc
version: 1.0.0
---

## Skill: Leer DOC/DOCX

### Descripción
Capacidad para procesar el contenido de archivos Word (.doc, .docx) respetando su estructura.

### Cuándo usarlo
Cuando el input sea un archivo .doc o .docx. Extraer texto respetando jerarquía de títulos y tablas.

### Instrucción al modelo
Recibirás el contenido de un documento Word como texto. Consideraciones:
- Los títulos estarán marcados con #, ## o ### según su nivel
- Respetá esa jerarquía para entender la estructura del documento
- Procesá el contenido de tablas reconstruyéndolas en Markdown
- Prestá atención a listas numeradas y con viñetas como indicadores de pasos o reglas

### Extensión futura
- Procesamiento de comentarios y revisiones de Word
- Extracción de imágenes embebidas
- Soporte para macros y campos dinámicos
