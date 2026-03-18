# Test Case Gherkin Agent

**ID:** `testcase-gherkin`  
**Versión:** 1.0.0

## Descripción

Genera casos de prueba en formato **Gherkin / BDD** (Feature / Scenario / Given-When-Then) listos para usar con frameworks como **Cucumber**, **SpecFlow** o **Behave**. Produce archivos `.feature` válidos, comprensibles tanto por el equipo técnico como por el equipo de negocio.

## Cuándo usarlo

Cuando el equipo trabaja con metodología BDD o necesita casos de prueba legibles por personas no técnicas. También cuando la suite de automatización está basada en Cucumber, SpecFlow o Behave.

## Qué produce

Archivos `.feature` en `/outputs/` con:

- **Feature** por cada funcionalidad identificada
- **Scenario** para flujo principal y alternativos
- **Scenario Outline + Examples** para casos con múltiples conjuntos de datos
- **Tags** de clasificación:
  - `@smoke` — casos críticos de humo
  - `@regression` — regresión
  - `@functional` — pruebas funcionales
  - `@negative` — casos de error y validación

### Ejemplo de output

```gherkin
@functional @smoke
Feature: Login de usuario
  Como usuario registrado
  Quiero poder iniciar sesión
  Para acceder a mis datos

  Scenario: Login exitoso con credenciales válidas
    Given el usuario está en la página de login
    When ingresa el email "usuario@test.com" y la contraseña "Pass123!"
    And hace click en "Iniciar sesión"
    Then es redirigido al dashboard
    And ve su nombre en el header

  Scenario Outline: Login fallido
    Given el usuario está en la página de login
    When ingresa el email "<email>" y la contraseña "<password>"
    And hace click en "Iniciar sesión"
    Then ve el mensaje de error "<mensaje>"

    Examples:
      | email               | password  | mensaje                          |
      | invalido@test.com   | Pass123!  | Usuario no encontrado            |
      | usuario@test.com    | wrongpass | Contraseña incorrecta            |
      |                     | Pass123!  | El email es obligatorio          |
```

## Cómo usarlo

### Desde el panel (recomendado)
1. Abrir el panel en `http://localhost:3000`
2. Hacer click en el card **Test Case Gherkin**
3. Escribir o pegar los requerimientos, o adjuntar el `.doc` / `.docx` con 📎
4. El agente generará los archivos `.feature` en el chat
5. Guardar como `.md` con el botón 💾 (luego renombrar a `.feature`)

### Con output del Doc Interpreter
1. Primero usar el agente **Doc Interpreter** para procesar el documento
2. Copiar el output generado
3. Abrir el chat del **Test Case Gherkin** y pegarlo como entrada

## Skills disponibles

| Skill | Descripción |
|---|---|
| `read-doc` | Lectura y procesamiento de archivos Word |
| `read-pdf` | Lectura y procesamiento de archivos PDF |
| `generate-gherkin` | Generación de features y scenarios en sintaxis Gherkin |

## Archivos

```
agents/testcase-gherkin/
├── testcase-gherkin.agent.md     # Configuración del agente
├── testcase-gherkin.prompt.md    # Prompt base
├── readme-testcase-gherkin.md    # Este archivo
└── skills/
    ├── read-doc.skill.md
    ├── read-pdf.skill.md
    └── generate-gherkin.skill.md
```
