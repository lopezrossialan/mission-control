# 🛸 Agents Control — Tutorial de inicio

Guía rápida para instalar y correr el proyecto desde cero.

---

## 1. Requisitos previos

- [Node.js](https://nodejs.org/) v18 o superior
- Cuenta de GitHub con acceso a **GitHub Models** (actualmente en beta, disponible en [github.com/marketplace/models](https://github.com/marketplace/models))

---

## 2. Clonar el repositorio

```bash
git clone https://github.com/lopezrossialan/mission-control.git
cd mission-control
```

---

## 3. Instalar dependencias

```bash
npm install
```

Esto instala todas las dependencias listadas en `package.json` (Express, OpenAI SDK, Playwright, etc.).

---

## 4. Obtener el token de GitHub Models

1. Ingresá a [github.com/settings/tokens](https://github.com/settings/tokens)
2. Hacé click en **"Generate new token"** → **"Generate new token (classic)"**
3. Dale un nombre descriptivo (ej: `agents-control`)
4. En los **scopes**, no es necesario marcar ninguno especial — el acceso a GitHub Models se gestiona por la cuenta
5. Hacé click en **"Generate token"** y copiá el token generado (solo se muestra una vez)

> **Alternativa más rápida:** desde [github.com/marketplace/models](https://github.com/marketplace/models), abrí cualquier modelo y hacé click en **"Get API key"** — te lleva directamente a crear el token.

---

## 5. Configurar el token

En la raíz del proyecto, creá un archivo llamado **`.env`**:

```
GITHUB_TOKEN=ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

Reemplazá `ghp_xxx...` por el token que copiaste en el paso anterior.

> ⚠️ El archivo `.env` está en `.gitignore` y **no se sube al repositorio**. Nunca compartas este token.

---

## 6. Iniciar el servidor

```bash
node server.js
```

O usando el script de npm:

```bash
npm start
```

Para desarrollo con auto-reload:

```bash
npm run dev
```

---

## 7. Abrir el panel

Una vez iniciado el servidor, abrí el navegador en:

```
http://localhost:3000/index.html
```

El servidor corre en el **puerto 3000**.

---

## Estructura resumida

```
mission-control/
├── agents/          → Definición de agentes (.agent.md, .prompt.md, skills/)
├── inputs/          → Documentos a procesar
├── outputs/         → Resultados generados
├── panel/           → Frontend (index.html, panel.js, panel.css)
├── server.js        → Servidor Express (API + Playwright)
├── .env             → 🔑 Tu token de GitHub (NO subir a git)
└── package.json
```
