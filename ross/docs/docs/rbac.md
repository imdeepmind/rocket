---
sidebar_position: 14
---

# Role-Based Access Control (RBAC)

ROSS provides a built-in, declarative Role-Based Access Control (RBAC) engine that integrates seamlessly with your database models, JWT authentication, and endpoint policy configurations.

With RBAC enabled, user roles stored in your database are automatically extracted during authentication, embedded directly into signed JWT claims, and verified against route policies in Fastify's `preValidation` hook before any business handlers or database queries run.

## Architecture & How It Works

```text
1. Authentication (Login / SSO)
   Database User Record [roleField: "editor:senior"]
             │
             ▼
   Generate JWT with Claims { "sub": 1, "role": "editor:senior" }
             │
             ▼
2. Client Request (Authorization: Bearer <token>)
             │
             ▼
3. PreValidation Hook
   Extract user role: "editor:senior"
   Lookup Route Policy: apis["model.v1.articles.id.edit"].roles -> ["editor:junior"]
   Check Role Hierarchy: Is "editor:senior" authorized for "editor:junior"? -> Yes (200 OK)
   Otherwise: Return 403 Forbidden
```

### Key Capabilities

- **Hierarchical Inheritance**: Define parent/child role relationships (e.g. `admin` includes `manager`, which includes `editor`, which includes `viewer`).
- **Universal & Namespaced Wildcards in Hierarchies**: Use `"*"` to inherit all declared roles, or `"prefix:*"` (such as `"editor:*"`) to inherit all roles within a namespace inside `rbac.roles.<role>.includes`.
- **O(1) Verification**: ROSS precomputes transitive role inclusion maps at server startup, ensuring zero runtime overhead for permission checks.
- **Support for Scalar or Multi-Role Users**: Store roles as simple strings (e.g. `"admin"`), database enums, or arrays/JSON lists (e.g. `["editor", "billing"]`).

## Configuration (`rbac`)

Configure the `rbac` section in your root application configuration:

```json
{
  "rbac": {
    "enabled": true,
    "modelName": "users",
    "roleField": "role",
    "defaultRole": "viewer",
    "roles": {
      "admin": {
        "description": "Full administrative access",
        "includes": ["*"]
      },
      "manager": {
        "description": "Operations and content management",
        "includes": ["editor:*"]
      },
      "editor:senior": {
        "description": "Senior editor with publication privileges",
        "includes": ["editor:junior", "viewer"]
      },
      "editor:junior": {
        "description": "Junior editor with drafting privileges",
        "includes": ["viewer"]
      },
      "viewer": {
        "description": "Read-only access"
      }
    }
  }
}
```

### Configuration Options

| Option | Type | Required | Description |
| --- | --- | --- | --- |
| `enabled` | `boolean` | Yes | Toggles RBAC enforcement on or off. |
| `modelName` | `string` | Yes | The model in `data.models` that stores user accounts and role assignments. |
| `roleField` | `string` | Yes | The field name on `modelName` containing the user's role. Must be of type `string` or `enum`. |
| `defaultRole` | `string` | Yes | Fallback role applied when a user record has `null`, `undefined`, or an empty role value. Must exist in `roles`. |
| `roles` | `Record<string, RoleConfig>` | Yes | Dictionary defining all valid application roles and their inheritance hierarchies. |

:::warning[Authentication Requirement]

RBAC requires `authentication.enabled: true` with an identity provider (`up-auth` or `sso`). Static `api-key` authentication cannot be used with RBAC because API keys do not represent individual user identities.

:::

:::note[Enum Fields Validation]

If `roleField` is configured as an `enum` type in `data.models.<modelName>.fields`, its `values` array must match the declared role keys in `rbac.roles` exactly.

:::

## Role Inheritance & Hierarchies

Roles are configured in the `rbac.roles` dictionary. Role keys can contain alphanumeric characters, underscores, colons, and hyphens (`^[a-zA-Z0-9_:-]+$`).

Each role accepts an optional `description` and an `includes` array specifying other roles it inherits:

```typescript
interface RoleConfig {
  description?: string;
  includes?: string[];
}
```

### 1. Reflexive Inclusion

Every role implicitly includes itself. A route requiring `"viewer"` is automatically satisfied by any user holding the `"viewer"` role.

### 2. Concrete Inheritance

A role can explicitly include other declared roles:

```json
{
  "editor:senior": {
    "includes": ["editor:junior", "viewer"]
  }
}
```

Any user assigned `"editor:senior"` satisfies routes requiring `"editor:senior"`, `"editor:junior"`, or `"viewer"`.

### 3. Namespaced Wildcards (`prefix:*`)

Use the `prefix:*` syntax to inherit all declared roles sharing a common namespace:

```json
{
  "manager": {
    "includes": ["editor:*"]
  }
}
```

If your roles define `editor:senior` and `editor:junior`, `manager` automatically inherits both.

:::note

A wildcard pattern like `"editor:*"` must match at least one declared role in `rbac.roles`, or configuration validation will fail on startup.

:::

### 4. Universal Wildcard (`*`)

Use `"*"` to inherit every role declared in `rbac.roles`:

```json
{
  "admin": {
    "includes": ["*"]
  }
}
```

Users with the `"admin"` role automatically satisfy requirements for any endpoint across the application.

### 5. Transitive Resolution

Inheritance is resolved transitively using breadth-first traversal with cycle detection. If Role A includes Role B, and Role B includes Role C, Role A automatically inherits Role C:

```text
admin ──(includes: ["*"])──> [manager, editor:senior, editor:junior, viewer]
                                  │
manager ──(includes: ["editor:*"])─┘
                │
editor:senior ──(includes: ["editor:junior", "viewer"])
                      │
editor:junior ──(includes: ["viewer"])
                      │
viewer (base level)
```

## JWT Role Extraction

When a user logs in via username/password (`POST /auth/login`) or completes an SSO callback (`POST /auth/sso/callback`), ROSS extracts the user's role from the field specified in `rbac.roleField` and injects it into the JWT payload:

- **Single Role**: If `roleField` contains a string (e.g. `"admin"`), the token receives `{ "role": "admin" }`.
- **Multiple Roles**: If `roleField` contains an array or JSON array string (e.g. `["editor", "moderator"]`), the token receives `{ "roles": ["editor", "moderator"] }`.
- **Fallback to Default**: If the user record's role value is `null`, `undefined`, or empty, ROSS assigns `rbac.defaultRole`.

During subsequent API requests, Fastify's authentication plugin decodes the token and populates `request.user.role` or `request.user.roles`.

## Enforcing RBAC on Routes (`apis`)

Route-level permissions are declared under the `apis` configuration section using the target route's API Identifier:

```json
{
  "apis": {
    "model.v1.articles.id.delete": {
      "authorization": true,
      "roles": ["admin"]
    },
    "model.v1.articles.id.edit": {
      "authorization": true,
      "roles": ["editor:senior", "admin"]
    },
    "model.v1.articles.unknown.insert": {
      "authorization": true,
      "roles": ["editor:junior"]
    },
    "model.v1.articles.unknown.getAll": {
      "authorization": false
    }
  }
}
```

### Rules & Behaviors

1. **Explicit Authorization Required**: Any route entry specifying `roles` must explicitly declare `"authorization": true`.
2. **Concrete Roles on Routes**: Route policies accept concrete declared role names (e.g. `["admin"]` or `["editor:junior"]`). Wildcards (`*` and `prefix:*`) are strictly reserved for defining inheritance within `rbac.roles.<role>.includes`.
3. **Inherited Role Satisfaction**: A user's role satisfies a route policy if the user's role equals the required role or includes it through the hierarchy (e.g., a user with `admin` or `manager` satisfies routes requiring `editor:junior` because `admin` includes `*` and `manager` includes `editor:*`).
4. **No Roles Configured**: If a route specifies `"authorization": true` but omits `roles`, any authenticated user is permitted, and ROSS logs an informational warning.
5. **Access Denied Response**: When an authenticated user's role does not satisfy the route requirement, ROSS immediately halts execution and returns HTTP `403 Forbidden`:

```json
{
  "statusCode": 403,
  "message": "Forbidden: Insufficient permissions",
  "data": null
}
```

## Practical Example

Here is an end-to-end example configuring models, authentication, role hierarchies, and route protection:

```json
{
  "application": {
    "name": "Publishing Platform"
  },
  "data": {
    "models": {
      "users": {
        "fields": {
          "id": {
            "type": "integer",
            "primaryKey": true,
            "autoIncrement": true
          },
          "email": {
            "type": "string",
            "unique": true
          },
          "password": {
            "type": "string",
            "secret": true
          },
          "role": {
            "type": "string",
            "nullable": false
          }
        }
      },
      "articles": {
        "fields": {
          "id": {
            "type": "integer",
            "primaryKey": true,
            "autoIncrement": true,
            "apis": ["delete", "edit", "index"]
          },
          "title": {
            "type": "string",
            "apis": ["edit", "search"]
          },
          "content": {
            "type": "text"
          }
        }
      }
    }
  },
  "authentication": {
    "enabled": true,
    "jwtSecret": "env:JWT_SECRET",
    "userModel": {
      "modelName": "users",
      "idField": "id",
      "providerField": "provider"
    },
    "providers": [
      {
        "type": "up-auth",
        "config": {
          "fields": {
            "usernameField": "email",
            "passwordField": "password"
          }
        }
      }
    ]
  },
  "rbac": {
    "enabled": true,
    "modelName": "users",
    "roleField": "role",
    "defaultRole": "subscriber",
    "roles": {
      "admin": {
        "description": "Full access to all platform resources",
        "includes": ["*"]
      },
      "editor": {
        "description": "Article authoring and publishing",
        "includes": ["subscriber"]
      },
      "subscriber": {
        "description": "Read-only access to published content"
      }
    }
  },
  "apis": {
    "model.v1.articles.id.delete": {
      "authorization": true,
      "roles": ["admin"]
    },
    "model.v1.articles.unknown.insert": {
      "authorization": true,
      "roles": ["editor"]
    },
    "model.v1.articles.id.edit": {
      "authorization": true,
      "roles": ["editor"]
    },
    "model.v1.articles.unknown.getAll": {
      "authorization": false
    }
  }
}
```

In this setup:

- Anyone can read articles (`model.v1.articles.unknown.getAll` is public).
- Users with `editor` or `admin` roles can create and edit articles.
- Only users with the `admin` role can delete articles.
- New users without a specified role automatically receive the `subscriber` role.
