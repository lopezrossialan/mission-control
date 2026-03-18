# Playwright Agent

**ID:** `playwright-agent`  
**Versión:** 1.0.0

## Descripción

Genera tests automatizados en **Playwright (TypeScript)** a partir de documentación funcional o requerimientos interpretados. Produce archivos `.spec.ts` listos para ejecutar con `npx playwright test`, siguiendo buenas prácticas de automatización.

## Cuándo usarlo

Cuando necesitás automatizar casos de prueba end-to-end en un browser real. Podés pasarle el documento directamente, el output del Doc Interpreter, o los locators extraídos por el **Playwright Inspector**.

## Qué produce

Archivos `.spec.ts` en `/outputs/` con:

- Tests organizados por flujo / módulo
- **Page Object Model (POM)** cuando la complejidad lo justifica
- Locators robustos: `getByRole`, `getByLabel`, `getByText`, `data-testid`
- Cobertura de: flujo feliz, flujos alternativos, validaciones de UI y casos de error
- Assertions completos con `expect()`

### Ejemplo de output

```typescript
import { test, expect } from '@playwright/test';

test.describe('Login', () => {
  test('login exitoso con credenciales válidas', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Email').fill('usuario@test.com');
    await page.getByLabel('Contraseña').fill('Pass123!');
    await page.getByRole('button', { name: 'Iniciar sesión' }).click();
    await expect(page).toHaveURL('/dashboard');
    await expect(page.getByRole('heading', { name: /bienvenido/i })).toBeVisible();
  });

  test('muestra error con credenciales inválidas', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Email').fill('invalido@test.com');
    await page.getByLabel('Contraseña').fill('wrong');
    await page.getByRole('button', { name: 'Iniciar sesión' }).click();
    await expect(page.getByText('Credenciales incorrectas')).toBeVisible();
  });
});
```

## Cómo usarlo

### Desde el panel (recomendado)
1. Abrir el panel en `http://localhost:3000`
2. Hacer click en el card **Playwright Agent**
3. Escribir o pegar los requerimientos, o adjuntar el `.doc` / `.docx` con 📎
4. Indicar la URL base del sistema si la conocés (ej: `https://staging.miapp.com`)
5. Guardar el output como `.md` con 💾 y renombrar a `.spec.ts`

### Con el Playwright Inspector
1. Inspeccionar la URL con el **Playwright Inspector** en el panel
2. Hacer click en **⚡ Usar en Playwright Agent**
3. El agente recibirá automáticamente los locators reales de la página

### Con output del Doc Interpreter
1. Primero usar el agente **Doc Interpreter** para procesar el documento
2. Copiar el output generado
3. Abrir el chat del **Playwright Agent** y pegarlo como entrada

## Tips

- Indicar la URL base mejora significativamente la calidad de los tests generados
- Usar el **Playwright Inspector** primero garantiza que los locators coincidan con la implementación real
- El código generado es un punto de partida — ajustar selectores según el DOM real siempre que sea necesario

## Skills disponibles

| Skill | Descripción |
|---|---|
| `read-doc` | Lectura y procesamiento de archivos Word |
| `read-pdf` | Lectura y procesamiento de archivos PDF |
| `generate-playwright-tests` | Generación de tests Playwright en TypeScript |

## Archivos

```
agents/playwright-agent/
├── playwright-agent.agent.md     # Configuración del agente
├── playwright-agent.prompt.md    # Prompt base
├── readme-playwright-agent.md    # Este archivo
└── skills/
    ├── read-doc.skill.md
    ├── read-pdf.skill.md
    └── generate-playwright-tests.skill.md
```
