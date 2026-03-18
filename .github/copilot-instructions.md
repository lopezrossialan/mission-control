# Mission Control — Instrucciones Globales para GitHub Copilot

Este repositorio es un Mission Control de agentes especializados en testing. Seguir siempre estas reglas:

## Convención de nombres
- Cada agente vive en `agents/{funcion}/`
- Definición del agente: `{funcion}.agent.md`
- Prompt del agente: `{funcion}.prompt.md`
- Skills del agente: `agents/{funcion}/skills/{skill}.skill.md`

## Reglas de estructura
- Cada agente tiene su propia carpeta con su .agent.md, su .prompt.md y su carpeta skills/
- Los skills son capacidades reutilizables en Markdown: describen qué hacen, cuándo usarlos y la instrucción al modelo
- Los documentos a procesar van en /inputs/
- Los resultados generados van en /outputs/
- El panel de control es HTML/CSS/JS vanilla, sin frameworks, sin servidor

## Para agregar un nuevo agente
1. Crear carpeta agents/{nueva-funcion}/
2. Crear {nueva-funcion}.agent.md con los campos: name, id, version, description, skills
3. Crear {nueva-funcion}.prompt.md con instrucción base, variables de entrada y restricciones
4. Crear carpeta skills/ y agregar los skills necesarios
5. Registrar el agente en panel/panel.js en el array AGENTS

## Para agregar un skill a un agente existente
1. Crear el archivo en agents/{funcion}/skills/{nuevo-skill}.skill.md
2. Agregar el nombre del skill al campo skills: del .agent.md correspondiente

## Flujo recomendado
doc-interpreter → testcase-general o testcase-gherkin
