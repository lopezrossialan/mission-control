---
skill: generate-testcases
version: 1.0.0
---

## Skill: Generar Casos de Prueba Generales

### Descripción
Capacidad para diseñar y estructurar casos de prueba en formato estándar de tabla Markdown.

### Cuándo usarlo
Cuando el objetivo sea producir casos de prueba en formato tabular clásico (no Gherkin).

### Instrucción al modelo
Al generar casos de prueba:
- Cubrir siempre al menos: 1 caso feliz, 1 caso alternativo, 1 caso negativo por funcionalidad
- Los pasos deben ser reproducibles por cualquier tester sin conocimiento previo
- El resultado esperado debe ser verificable y específico (no usar "funciona correctamente")
- Considerar precondiciones de datos, permisos y estado del sistema

### Extensión futura
- Generación de datos de prueba asociados a cada caso
- Estimación de tiempo de ejecución
- Asignación automática de prioridad por riesgo
