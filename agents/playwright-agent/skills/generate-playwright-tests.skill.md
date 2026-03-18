---
skill: generate-playwright-tests
version: 1.0.0
---

## Skill: Generar Tests Playwright

### Descripción
Capacidad para generar tests end-to-end en Playwright (TypeScript) estructurados, mantenibles y listos para ejecutar.

### Cuándo usarlo
Cuando el output requerido sea código Playwright `.spec.ts` para automatización de tests en browser.

### Instrucción al modelo
Al generar tests Playwright:
- Preferir locators semánticos: `getByRole`, `getByLabel`, `getByText`, `getByPlaceholder`
- Seguir el patrón Arrange / Act / Assert dentro de cada test
- Agrupar tests relacionados con `test.describe()`
- Usar `test.beforeEach()` para setup común (navegación, login)
- Agregar `await expect(page).toHaveURL(...)` para verificar navegación
- Para formularios, usar `fill()` seguido de verificación del estado del campo
- Marcar con `// TODO: ajustar selector` los locators que dependen de implementación
- Para flujos con múltiples datos usar `test.each()`

### Extensión futura
- Generación de Page Object Model completo con clases TypeScript
- Fixtures reutilizables para autenticación y estado previo
- Visual regression tests con `expect(page).toHaveScreenshot()`
- Integración con reportes Allure o HTML reporter
