# Test Case General Agent

**ID:** `testcase-general`  
**Versión:** 1.0.0

## Descripción

Genera casos de prueba completos y detallados a partir de documentación funcional o del output del agente Doc Interpreter. Cubre flujos funcionales, de integración, regresión, casos borde y negativos.

## Cuándo usarlo

Cuando necesitás casos de prueba en formato estándar de tabla, trazables y listos para ejecutar manualmente o documentar en una suite de testing. Podés pasarle el documento directo o el output ya procesado por el Doc Interpreter.

## Qué produce

Un archivo Markdown en `/outputs/` con los casos de prueba organizados por módulo, en formato tabla con las columnas:

| ID | Título | Precondiciones | Pasos | Resultado esperado | Tipo |

### Tipos de casos que genera
- **Funcional** — flujo principal del requerimiento
- **Alternativo** — flujos secundarios y variantes
- **Negativo** — entradas inválidas, errores esperados
- **Borde** — valores límite y condiciones extremas
- **Regresión** — casos críticos para proteger funcionalidad existente
- **Integración** — interacciones entre módulos o sistemas

## Cómo usarlo

### Desde el panel (recomendado)
1. Abrir el panel en `http://localhost:3000`
2. Hacer click en el card **Test Case General**
3. Escribir o pegar los requerimientos, o adjuntar el `.doc` / `.docx` con 📎
4. El agente generará la tabla completa de casos de prueba en el chat
5. Guardar como `.md` con el botón 💾

### Con output del Doc Interpreter
1. Primero usar el agente **Doc Interpreter** para procesar el documento
2. Copiar el output generado
3. Abrír el chat del **Test Case General** y pegarlo como entrada

## Skills disponibles

| Skill | Descripción |
|---|---|
| `read-doc` | Lectura y procesamiento de archivos Word |
| `read-pdf` | Lectura y procesamiento de archivos PDF |
| `generate-testcases` | Generación de casos de prueba estructurados |

## Archivos

```
agents/testcase-general/
├── testcase-general.agent.md     # Configuración del agente
├── testcase-general.prompt.md    # Prompt base
├── readme-testcase-general.md    # Este archivo
└── skills/
    ├── read-doc.skill.md
    ├── read-pdf.skill.md
    └── generate-testcases.skill.md
```
