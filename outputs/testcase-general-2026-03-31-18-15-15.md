# Casos de Prueba - API de Gestión de Usuarios

## Módulo: Autenticación

| ID | Título | Precondiciones | Pasos | Resultado Esperado | Tipo |
|----|--------|----------------|-------|--------------------|------|
| TC-001 | Login exitoso con credenciales válidas | 1. Usuario registrado y activo<br>2. Email y password válidos | 1. Enviar POST a /api/auth/login con email y password válidos en body JSON | 1. HTTP 200<br>2. Response con accessToken y refreshToken válidos<br>3. Tokens con tiempos de expiración correctos (24h/7d) | Funcional |
| TC-002 | Login fallido con password incorrecto | 1. Usuario registrado | 1. Enviar POST a /api/auth/login con password incorrecto | 1. HTTP 401<br>2. Mensaje de error claro | Negativo |
| TC-003 | Login fallido con usuario inactivo | 1. Usuario registrado pero inactivo | 1. Enviar POST a /api/auth/login con credenciales válidas | 1. HTTP 403<br>2. Mensaje indicando usuario inactivo | Negativo |
| TC-004 | Logout exitoso | 1. Usuario autenticado<br>2. Token válido | 1. Enviar POST a /api/auth/logout con header Authorization válido | 1. HTTP 200<br>2. Token invalidado (no puede usarse en siguientes requests) | Funcional |
| TC-005 | Refresh token exitoso | 1. Usuario autenticado<br>2. refreshToken válido | 1. Enviar POST a /api/auth/refresh con refreshToken válido | 1. HTTP 200<br>2. Nuevo accessToken generado | Funcional |
| TC-006 | Refresh token con token expirado | 1. refreshToken expirado | 1. Enviar POST a /api/auth/refresh con token expirado | [REQUIERE CLARIFICACIÓN] Comportamiento no definido | Borde |

## Módulo: Usuarios

| ID | Título | Precondiciones | Pasos | Resultado Esperado | Tipo |
|----|--------|----------------|-------|--------------------|------|
| TC-007 | Creación exitosa de usuario por ADMIN | 1. Usuario ADMIN autenticado<br>2. Email no existente<br>3. Password cumple RN-002 | 1. Enviar POST a /api/users con datos válidos<br>2. Incluir header Authorization ADMIN | 1. HTTP 201<br>2. Usuario creado con active=true<br>3. Password hasheado | Funcional |
| TC-008 | Creación fallida por email duplicado | 1. Email ya registrado en sistema | 1. Enviar POST a /api/users con email existente | 1. HTTP 400<br>2. Mensaje indicando email duplicado | Negativo |
| TC-009 | Creación fallida por password inválido | 1. Password no cumple RN-002 | 1. Enviar POST a /api/users con password inválido | 1. HTTP 400<br>2. Mensaje detallando requisitos de password | Negativo |
| TC-010 | Actualización exitosa de usuario | 1. Usuario ADMIN autenticado<br>2. Usuario objetivo existe | 1. Enviar PUT a /api/users/:id con datos válidos | 1. HTTP 200<br>2. Campos actualizados correctamente | Funcional |
| TC-011 | Intento de cambio de rol no especificado | 1. Usuario ADMIN autenticado | 1. Enviar PUT a /api/users/:id intentando cambiar rol | [REQUIERE CLARIFICACIÓN] Comportamiento no definido | Borde |
| TC-012 | ADMIN intenta autoborrarse | 1. Último usuario ADMIN | 1. Enviar DELETE a /api/users/:id siendo el último ADMIN | 1. HTTP 403<br>2. Mensaje indicando restricción por RN-005 | Negativo |

## Módulo: Perfiles

| ID | Título | Precondiciones | Pasos | Resultado Esperado | Tipo |
|----|--------|----------------|-------|--------------------|------|
| TC-013 | Consulta exitosa de perfil propio | 1. Usuario USER autenticado | 1. Enviar GET a /api/users/:id/profile donde :id es el propio | 1. HTTP 200<br>2. Datos completos del perfil | Funcional |
| TC-014 | Intento de consulta de perfil ajeno por USER | 1. Usuario USER autenticado | 1. Enviar GET a /api/users/:id/profile donde :id es otro usuario | 1. HTTP 403<br>2. Mensaje de acceso denegado | Negativo |
| TC-015 | Actualización exitosa de foto de perfil | 1. Usuario autenticado | 1. Enviar PUT a /api/users/:id/profile con archivo de imagen válido | [REQUIERE CLARIFICACIÓN] Falta especificar formatos/tamaños aceptados | Funcional |
| TC-016 | Paginación máxima de perfiles | 1. Usuario ADMIN autenticado<br>2. Más de 100 usuarios registrados | 1. Enviar GET a /api/users?limit=150 | 1. HTTP 400<br>2. Mensaje indicando límite máximo por RN-006 | Borde |

## Resumen de Tipos de Prueba

| Tipo | Cantidad |
|------|----------|
| Funcional | 8 |
| Negativo | 6 |
| Borde | 3 |
| Integración | 0 |
| **Total** | **17** |

Notas:
- 3 casos marcados como [REQUIERE CLARIFICACIÓN] por ambigüedades en especificaciones
- Se recomienda validar comportamiento con tokens expirados, cambios de rol y políticas de archivos
- Considerar añadir pruebas de integración entre módulos una vez resueltas las ambigüedades