---
skill: generate-gherkin
version: 1.0.0
---

## Skill: Generar Scenarios Gherkin

### Descripción
Capacidad para escribir archivos .feature con sintaxis Gherkin válida siguiendo buenas prácticas BDD.

### Cuándo usarlo
Cuando el output requerido sean archivos .feature para frameworks BDD (Cucumber, SpecFlow, Behave, Karate).

### Instrucción al modelo
Al escribir Gherkin:
- Los steps Given describen el estado inicial (no acciones)
- Los steps When describen la acción del usuario (una sola acción por When)
- Los steps Then describen el resultado observable y verificable
- Evitar steps con lógica condicional ("si X entonces Y")
- Preferir steps declarativos sobre imperativos
- Reutilizar steps entre scenarios cuando sea posible

### Extensión futura
- Generación de step definitions en Java, Python o TypeScript
- Integración con Page Object Model
- Generación de datos de prueba para la sección Examples
