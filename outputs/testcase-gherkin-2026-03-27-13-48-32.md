### Archivo 1: `authentication.feature`

```gherkin
Feature: Módulo de Autenticación
  Como GUEST
  Quiero autenticarme en el sistema utilizando mi email y contraseña
  Para obtener un token de acceso y usar los servicios de la API

  @functional @smoke
  Scenario: Autenticar usuario con credenciales válidas
    Given el endpoint POST /api/auth/login con Content-Type application/json
    And un usuario con email "user@example.com" y password "Password1" ya existe en el sistema y tiene active=true
    When envío una solicitud con body:
      """
      {
        "email": "user@example.com",
        "password": "Password1"
      }
      """
    Then el sistema responde HTTP 200
    And el body contiene accessToken con una validez de 24 horas
    And el body contiene refreshToken con una validez de 7 días

  @negative @regression
  Scenario Outline: Autenticar usuario con credenciales inválidas
    Given el endpoint POST /api/auth/login con Content-Type application/json
    And un usuario con email <email> ya existe en el sistema y tiene active=true
    When envío una solicitud con body:
      """
      {
        "email": "<email>",
        "password": "<password>"
      }
      """
    Then el sistema responde HTTP 401
    And el body contiene el mensaje de error "Credenciales inválidas"

    Examples:
      | email                  | password      |
      | user@example.com       | wrongPass     |
      | anotherUser@example.com| Password123!  |

  @negative @regression
  Scenario: Usuario inactivo intentando autenticarse
    Given el endpoint POST /api/auth/login con Content-Type application/json
    And un usuario con email "inactiveUser@example.com" ya existe en el sistema y tiene active=false
    When envío una solicitud con body:
      """
      {
        "email": "inactiveUser@example.com",
        "password": "Password1"
      }
      """
    Then el sistema responde HTTP 403
    And el body contiene el mensaje de error "Cuenta deshabilitada. Contacte al administrador"
```

---

### Archivo 2: `users.feature`

```gherkin
Feature: Módulo de Usuarios
  Como ADMIN
  Quiero gestionar usuarios en el sistema mediante CRUD
  Para administrar el sistema y mantener la información actualizada

  @functional @smoke
  Scenario: Crear un usuario con datos válidos
    Given el endpoint POST /api/users con Content-Type application/json
    And un token válido con rol ADMIN
    When envío una solicitud con body:
      """
      {
        "email": "newuser@example.com",
        "password": "SecurePass1",
        "role": "USER"
      }
      """
    Then el sistema responde HTTP 201
    And el body contiene el objeto del usuario sin incluir el campo password

  @negative @regression
  Scenario Outline: Crear usuario con email duplicado
    Given el endpoint POST /api/users con Content-Type application/json
    And un token válido con rol ADMIN
    And ya existe un usuario con email <email> en el sistema
    When envío una solicitud con body:
      """
      {
        "email": "<email>",
        "password": "SecurePass1",
        "role": "USER"
      }
      """
    Then el sistema responde HTTP 400
    And el body contiene el mensaje de error "El email ya está registrado"

    Examples:
      | email                  |
      | existingUser@example.com |
      | admin@example.com       |

  @negative @functional
  Scenario: Crear usuario con contraseña no válida
    Given el endpoint POST /api/users con Content-Type application/json
    And un token válido con rol ADMIN
    When envío una solicitud con body:
      """
      {
        "email": "anotheruser@example.com",
        "password": "123",
        "role": "USER"
      }
      """
    Then el sistema responde HTTP 400
    And el body contiene el mensaje de error "El password no cumple con las reglas de negocio"
```

---

### Archivo 3: `profiles.feature`

```gherkin
Feature: Módulo de Perfiles
  Como USER o ADMIN
  Quiero actualizar la información de perfil de un usuario
  Para mantener datos actualizados como biografía, foto y preferencias

  @functional @regression @smoke
  Scenario: Actualizar perfil con datos válidos
    Given el endpoint PUT /api/users/123/profile con Content-Type application/json
    And un token válido perteneciente al usuario con id 123
    When envío una solicitud con body:
      """
      {
        "biography": "Nueva biografía",
        "photoUrl": "http://example.com/image.jpg",
        "preferences": {
          "notifications": "enabled"
        }
      }
      """
    Then el sistema responde HTTP 200
    And el body contiene el objeto del perfil actualizado

  @negative @pendiente
  Scenario: Intentar actualizar perfil con un token expirado
    Given el endpoint PUT /api/users/123/profile con Content-Type application/json
    And un token expirado
    When envío una solicitud con body:
      """
      {
        "biography": "Nueva biografía",
        "photoUrl": "http://example.com/image.jpg",
        "preferences": {
          "notifications": "enabled"
        }
      }
      """
    Then el sistema responde HTTP 401
    And el body contiene el mensaje de error "Token inválido o expirado"
```

Cada módulo se orienta a casos de flujo feliz, alternativos y errores, clasificándolos con tags adecuadamente. Puedes ajustar o extender los escenarios según ambigüedades detectadas.