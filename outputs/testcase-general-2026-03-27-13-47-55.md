# Casos de Prueba — API de Gestión de Usuarios

## Módulo de Autenticación

| ID      | Título                                      | Precondiciones                                     | Pasos                                                                                                                                               | Resultado Esperado                                                                                             | Tipo        |
|----------|--------------------------------------------|---------------------------------------------------|-----------------------------------------------------------------------------------------------------------------------------------------------------|----------------------------------------------------------------------------------------------------------------|-------------|
| TC-001   | Inicio de sesión exitoso                  | Credenciales válidas                              | 1. Realizar POST /api/auth/login con un email y password válidos.                                                                                   | Responder HTTP 200 con accessToken (24h) y refreshToken (7 días).                                             | Funcional   |
| TC-002   | Usuario inexistente en login              | Usuario no registrado en el sistema              | 1. Realizar POST /api/auth/login con un email que no existe en el sistema.                                                                          | Responder HTTP 401 con mensaje "Credenciales inválidas".                                                       | Negativo    |
| TC-003   | Contraseña incorrecta en login            | Usuario registrado                                | 1. Realizar POST /api/auth/login con un email válido, pero contraseña incorrecta.                                                                   | Responder HTTP 401 con mensaje "Credenciales inválidas".                                                       | Negativo    |
| TC-004   | Usuario inactivo intenta iniciar sesión   | Usuario existe pero tiene active = false          | 1. Realizar POST /api/auth/login con un email y contraseña válidos de un usuario inactivo.                                                          | Responder HTTP 403 con mensaje "Cuenta deshabilitada. Contacte al administrador".                              | Negativo    |
| TC-005   | Login sin header Content-Type             | Ninguno                                           | 1. Realizar POST /api/auth/login sin incluir el header Content-Type: application/json.                                                              | Responder HTTP 415 con mensaje de error adecuado para tipo de contenido no soportado.                          | Negativo    |
| TC-006   | Login con input malformado                | Ninguno                                           | 1. Realizar POST /api/auth/login con un payload que falten campos clave (e.g., sin campo "email" o "password").                                      | Responder HTTP 400 con mensaje de error indicando campos requeridos.                                           | Negativo    |
| TC-007   | Renovación de token                       | Token expirado o inválido para renovación         | 1. Realizar POST /api/auth/refresh con un refreshToken caducado.                                                                                    | Responder HTTP 401 con mensaje [REQUIERE CLARIFICACIÓN].                                                       | [REQUIERE CLARIFICACIÓN]    |

---

## Módulo de Usuarios

| ID      | Título                                      | Precondiciones                                     | Pasos                                                                                                                                               | Resultado Esperado                                                                                             | Tipo        |
|----------|--------------------------------------------|---------------------------------------------------|-----------------------------------------------------------------------------------------------------------------------------------------------------|----------------------------------------------------------------------------------------------------------------|-------------|
| TC-008   | Creación exitosa de usuario (ADMIN)       | ADMIN autenticado                                | 1. Realizar POST /api/users con un payload válido (email único, password que cumpla RN-002).                                                        | Responder HTTP 201 con objeto del usuario creado (sin incluir el password).                                    | Funcional   |
| TC-009   | Creación de usuario con email duplicado   | ADMIN autenticado                                | 1. Realizar POST /api/users con un email que ya existe en el sistema.                                                                               | Responder HTTP 400 con mensaje de error indicando duplicidad del email.                                        | Negativo    |
| TC-010   | Creación de usuario con password inválida | ADMIN autenticado                                | 1. Realizar POST /api/users con un password que no cumple las reglas de complejidad definidas en RN-002.                                            | Responder HTTP 400 con mensaje de error indicando que el password no cumple los requisitos.                    | Negativo    |
| TC-011   | Intento de creación de usuario sin permisos | USER autenticado                                | 1. Realizar POST /api/users intentando crear un usuario con las credenciales de un rol USER.                                                        | Responder HTTP 403 con mensaje "Acceso denegado".                                                              | Seguridad   |
| TC-012   | Eliminación propia por ADMIN [REQUIERE CLARIFICACIÓN] | ADMIN autenticado                     | 1. Realizar DELETE /api/users/:id donde el id corresponde al usuario ADMIN autenticado.                                                             | [REQUIERE CLARIFICACIÓN].                                                                                      | [REQUIERE CLARIFICACIÓN]   |

---

## Módulo de Perfiles

| ID      | Título                                      | Precondiciones                                     | Pasos                                                                                                                                               | Resultado Esperado                                                                                             | Tipo        |
|----------|--------------------------------------------|---------------------------------------------------|-----------------------------------------------------------------------------------------------------------------------------------------------------|----------------------------------------------------------------------------------------------------------------|-------------|
| TC-013   | Actualización de perfil propia            | Usuario autenticado                               | 1. Realizar PUT /api/users/:id/profile con un payload válido (id correspondiente al usuario autenticado).                                           | Responder HTTP 200 con los datos del perfil actualizados.                                                     | Funcional   |
| TC-014   | Actualización de perfil de otro usuario (como ADMIN) | ADMIN autenticado                               | 1. Realizar PUT /api/users/:id/profile con un payload válido para un usuario id que no sea el autenticado.                                          | Responder HTTP 200 con los datos del perfil actualizados.                                                     | Funcional   |
| TC-015   | Actualización de perfil prohibida (como USER) | USER autenticado pero id distinto del perfil    | 1. Realizar PUT /api/users/:id/profile donde id no corresponde al usuario autenticado y un payload válido.                                          | Responder HTTP 403 con mensaje "Acceso denegado".                                                              | Seguridad   |
| TC-016   | Actualización de perfil con token inválido | Token expirado o inválido                        | 1. Realizar PUT /api/users/:id/profile con un token no válido en el header Authorization.                                                           | Responder HTTP 401 con mensaje "No autorizado".                                                                | Seguridad   |

---

## Resumen de Casos de Prueba

| Tipo       | Total      |
|------------|------------|
| Funcional  | 6          |
| Negativo   | 6          |
| Seguridad  | 3          |
| Integración| 0          |
| Borde      | 0          |
| Requiere Clarificación | 2 | 

**Total**: 17