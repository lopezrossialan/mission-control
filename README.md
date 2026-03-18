# 🛸 Mission Control — Testing Agents Workspace

Workspace local de agentes especializados en testing, orquestados desde un panel web con backend Node.js y GPT-4o via GitHub Models API.

## Inicio rápido

```bash
npm install
npx playwright install chromium
# Agregar GITHUB_TOKEN en .env
npm start
# Abrir http://localhost:3000
```

## Documentación

Toda la documentación detallada del proyecto está en la carpeta [`READMEAPP/`](READMEAPP/):

| Documento | Descripción |
|---|---|
| [README general + arquitectura](READMEAPP/README.md) | Arquitectura, stack, endpoints, flujo de trabajo y guía de extensión |
| [Doc Interpreter](READMEAPP/readme-doc-interpreter.md) | Agente que interpreta documentación funcional |
| [Test Case General](READMEAPP/readme-testcase-general.md) | Agente generador de casos de prueba en tabla |
| [Test Case Gherkin](READMEAPP/readme-testcase-gherkin.md) | Agente generador de features Gherkin/BDD |
| [Playwright Agent](READMEAPP/readme-playwright-agent.md) | Agente generador de tests `.spec.ts` con Playwright |
| [Playwright Inspector](READMEAPP/readme-playwright-inspector.md) | Herramienta de inspección de URLs — extrae locators y XPaths |
