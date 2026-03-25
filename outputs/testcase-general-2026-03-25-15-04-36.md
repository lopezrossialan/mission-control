### Casos de Prueba para API

#### Módulo: Autenticación de Usuario

| ID      | Título                               | Precondiciones                                     | Pasos                                                                 | Resultado Esperado                                                   | Tipo          |
|---------|--------------------------------------|---------------------------------------------------|----------------------------------------------------------------------|----------------------------------------------------------------------|---------------|
| TC-001  | Login exitoso con credenciales válidas | API activa y accesible.                          | 1. Enviar una petición POST a `/login` con un JSON que incluya `username` y `password` válidos. | El endpoint responde con código 200 y un token de acceso válido en el cuerpo de la respuesta. | Funcional     |
| TC-002  | Login fallido con credenciales inválidas | API activa y accesible.                          | 1. Enviar una petición POST a `/login` con un JSON que incluya `username` y `password` inválidos. | El endpoint responde con código 401 y un mensaje de error que lo informe claramente. | Negativo      |
| TC-003  | Manejo de campos obligatorios en el login | API activa y accesible.                          | 1. Enviar una petición POST a `/login` omitiendo el campo `password` en el JSON del body. | El endpoint responde con código 400 indicando que el campo `password` es obligatorio. | Borde         |
| TC-004  | Expiración del token de autenticación    | Token generado al hacer login y válido por 1 hora. | 1. Esperar a que transcurra 1 hora desde la generación del token.<br>2. Realizar una petición GET a `/datos-protegidos` con el token expirado. | El endpoint responde con código 401 indicando que el token ha expirado. | Regresión     |
| TC-005  | Login fallido con payload vacío         | API activa y accesible.                          | 1. Enviar una petición POST a `/login` con un body vacío.           | El endpoint responde con código 400 y un mensaje que especifica los campos requeridos. | Negativo      |

#### Módulo: Gestión de Usuarios

| ID      | Título                                            | Precondiciones                                     | Pasos                                                                                       | Resultado Esperado                                                                          | Tipo          |
|---------|---------------------------------------------------|---------------------------------------------------|--------------------------------------------------------------------------------------------|-------------------------------------------------------------------------------------------|---------------|
| TC-006  | Creación exitosa de usuario                       | Usuario administrador autenticado.                | 1. Enviar una petición POST a `/usuarios` con un JSON que incluya `nombre`, `email` y `contraseña` válidos. | El endpoint responde con código 201 y el cuerpo incluye el `id` del usuario creado.        | Funcional     |
| TC-007  | Creación de usuario con email duplicado           | Usuario administrador autenticado, email existente en la base de datos. | 1. Enviar una petición POST a `/usuarios` con un `email` previamente registrado.            | El endpoint responde con código 409 indicando que el email ya está registrado.             | Negativo      |
| TC-008  | Eliminación de usuario inexistente                | Usuario administrador autenticado.                | 1. Enviar una petición DELETE a `/usuarios/{id}` con un `id` que no exista en la base de datos. | El endpoint responde con código 404 indicando que el usuario no fue encontrado.            | Negativo      |
| TC-009  | Actualización exitosa de datos de usuario         | Usuario administrador autenticado, usuario existente en la base de datos. | 1. Enviar una petición PUT a `/usuarios/{id}` con un `id` válido y datos actualizados.      | El endpoint responde con código 200 y el cuerpo contiene los datos actualizados del usuario. | Funcional     |
| TC-010  | Validación de formato de email en creación         | Usuario administrador autenticado.                | 1. Enviar una petición POST a `/usuarios` con un `email` que no cumpla el formato de RFC 5322. | El endpoint responde con código 400 y un mensaje que indique que el `email` no es válido.  | Borde         |

#### Módulo: Consultas de Datos

| ID      | Título                                     | Precondiciones                     | Pasos                                                                                       | Resultado Esperado                                                                                  | Tipo          |
|---------|--------------------------------------------|-------------------------------------|--------------------------------------------------------------------------------------------|-----------------------------------------------------------------------------------------------------|---------------|
| TC-011  | Listado de datos con paginación            | API activa y accesible.            | 1. Realizar una petición GET a `/datos?page=1&limit=10`.                                    | El endpoint responde con código 200 y un listado de 10 elementos correspondientes a la página 1.    | Funcional     |
| TC-012  | Solicitar página fuera de rango            | Base de datos contiene menos de 50 registros. | 1. Realizar una petición GET a `/datos?page=100&limit=10`.                                 | El endpoint responde con código 404 y un mensaje que indique que no hay datos disponibles.          | Negativo      |
| TC-013  | Filtrado correcto de datos por un parámetro | Base de datos incluye elementos con `status=activo`. | 1. Realizar una petición GET a `/datos?status=activo`.                                     | El endpoint responde con código 200 y un listado que incluye únicamente elementos con `status=activo`. | Funcional     |
| TC-014  | Tiempo de respuesta dentro del SLA establecido | Base de datos con más de 100 registros y API activa. | 1. Realizar una petición GET a `/datos`.                                                   | El endpoint responde con código 200, y el tiempo de respuesta es menor a 1 segundo.                 | Regresión     |
| TC-015  | Solicitud sin parámetros obligatorios       | API activa y accesible.            | 1. Enviar una petición GET a `/datos` sin incluir parámetros requeridos, si los hubiera [REQUIERE CLARIFICACIÓN]. | El endpoint responde con código 400 indicando qué parámetros faltan o cómo deben enviarse.          | Negativo      |

### Resumen de Totales por Tipo
| Tipo       | Total |
|------------|-------|
| Funcional  | 6     |
| Regresión  | 2     |
| Integración| 0     |
| Borde      | 2     |
| Negativo   | 5     |
| **Total**  | 15    |