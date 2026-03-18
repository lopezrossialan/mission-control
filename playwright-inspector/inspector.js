const { chromium } = require("playwright");

/**
 * Inspecciona una URL y extrae todos los elementos interactuables con sus locators.
 * @param {string} url - URL a inspeccionar
 * @returns {Promise<{elements: Array, screenshot: string, title: string, url: string}>}
 */
async function inspectUrl(url) {
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
        userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36",
        viewport: { width: 1280, height: 800 },
    });
    const page = await context.newPage();

    try {
        await page.goto(url, { waitUntil: "domcontentloaded", timeout: 20000 });
        await page.waitForTimeout(1500); // esperar renders asincrónicos

        const title = await page.title();

        // Captura de pantalla en base64
        const screenshotBuffer = await page.screenshot({ type: "jpeg", quality: 70, fullPage: false });
        const screenshot = `data:image/jpeg;base64,${screenshotBuffer.toString("base64")}`;

        // Extraer elementos interactuables
        const elements = await page.evaluate(() => {
            const results = [];
            let idCounter = 1;

            function getXPath(el) {
                if (!el || el.nodeType !== 1) return "";
                if (el === document.body) return "/html/body";
                const idx = Array.from(el.parentNode?.children || [])
                    .filter(c => c.tagName === el.tagName)
                    .indexOf(el) + 1;
                const part = idx > 1 ? `${el.tagName.toLowerCase()}[${idx}]` : el.tagName.toLowerCase();
                return `${getXPath(el.parentNode)}/${part}`;
            }

            function getLabel(el) {
                // aria-label
                if (el.getAttribute("aria-label")) return el.getAttribute("aria-label");
                // label[for]
                if (el.id) {
                    const lbl = document.querySelector(`label[for="${el.id}"]`);
                    if (lbl) return lbl.textContent.trim();
                }
                // placeholder
                if (el.placeholder) return el.placeholder;
                // value (buttons)
                if (el.value && el.tagName === "INPUT" && ["button", "submit", "reset"].includes(el.type)) return el.value;
                // text content
                const text = el.textContent?.trim();
                if (text && text.length < 80) return text;
                // name attr
                if (el.name) return el.name;
                return "";
            }

            function getPlaywrightLocator(el, label) {
                const tag = el.tagName.toLowerCase();
                const type = el.type?.toLowerCase();
                const role = el.getAttribute("role");
                const testId = el.getAttribute("data-testid") || el.getAttribute("data-test") || el.getAttribute("data-cy");

                if (testId) return `getByTestId('${testId}')`;

                // Inputs con label
                if (tag === "input" && label && !["submit", "button", "reset"].includes(type)) {
                    return `getByLabel('${label}')`;
                }

                // Buttons
                if (tag === "button" || type === "submit" || type === "button" || role === "button") {
                    return label ? `getByRole('button', { name: '${label}' })` : `getByRole('button')`;
                }

                // Links
                if (tag === "a" && label) return `getByRole('link', { name: '${label}' })`;

                // Select
                if (tag === "select" && label) return `getByLabel('${label}')`;

                // Textarea
                if (tag === "textarea" && label) return `getByLabel('${label}')`;

                // Checkboxes / radios
                if (type === "checkbox") return label ? `getByLabel('${label}')` : `getByRole('checkbox')`;
                if (type === "radio") return label ? `getByLabel('${label}')` : `getByRole('radio')`;

                // Input genérico
                if (tag === "input" && el.placeholder) return `getByPlaceholder('${el.placeholder}')`;

                // Fallback
                if (label) return `getByText('${label}')`;
                return `locator('${tag}') // TODO: refinar selector`;
            }

            function getElementType(el) {
                const tag = el.tagName.toLowerCase();
                const type = el.type?.toLowerCase();
                if (tag === "input") return type || "input";
                if (tag === "button") return "button";
                if (tag === "a") return "link";
                if (tag === "select") return "select";
                if (tag === "textarea") return "textarea";
                return tag;
            }

            const selectors = [
                "input:not([type='hidden'])",
                "button",
                "a[href]",
                "select",
                "textarea",
                "[role='button']",
                "[role='link']",
                "[role='checkbox']",
                "[role='radio']",
                "[role='tab']",
                "[role='menuitem']",
            ];

            const seen = new Set();
            document.querySelectorAll(selectors.join(",")).forEach(el => {
                if (seen.has(el)) return;
                seen.add(el);

                const rect = el.getBoundingClientRect();
                if (rect.width === 0 && rect.height === 0) return; // invisible

                const label = getLabel(el);
                const xpath = getXPath(el);
                const locator = getPlaywrightLocator(el, label);
                const type = getElementType(el);

                results.push({
                    id: idCounter++,
                    type,
                    tag: el.tagName.toLowerCase(),
                    label: label || "(sin texto)",
                    xpath,
                    locator,
                    name: el.name || "",
                    id_attr: el.id || "",
                    classes: el.className ? el.className.split(" ").filter(Boolean).slice(0, 3).join(" ") : "",
                });
            });

            return results;
        });

        return { elements, screenshot, title, url };
    } finally {
        await browser.close();
    }
}

module.exports = { inspectUrl };
