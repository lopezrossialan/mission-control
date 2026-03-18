---
skill: extract-functional-requirements
version: 1.0.0
---

## Skill: Extraer Requerimientos Funcionales

### Descripción
Capacidad para identificar y clasificar requerimientos funcionales dentro de un documento de especificación.

### Cuándo usarlo
Después de leer el documento (read-doc o read-pdf), para estructurar los requerimientos antes de pasarlos a los agentes generadores.

### Instrucción al modelo
Al extraer requerimientos funcionales:
- Identificar requerimientos explícitos (están escritos como tal) e implícitos (se infieren del contexto)
- Clasificar por: funcionalidad, actor involucrado, prioridad si se menciona
- Asignar un ID a cada requerimiento: RF-001, RF-002, etc.
- Vincular cada requerimiento con su módulo correspondiente
- Detectar dependencias entre requerimientos

### Extensión futura
- Clasificación automática por épicas y user stories
- Detección de requerimientos no funcionales
- Generación de matriz de trazabilidad
