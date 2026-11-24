---
sidebar_position: 15
---

# API Variants (`apiVariants`)

The `apiVariants` configuration section enables you to generate multiple parallel, versioned, or specialized copies of endpoints from a single underlying data model without duplicating schemas, database migrations, or business logic.

This feature allows you to maintain versioned routes (`v1` vs. `v2`), isolate internal or administrative endpoints (`internal` or `admin`), or expose specialized API surfaces for third-party partners or mobile clients.

## Overview & Use Cases

When ROSS generates REST endpoints for your models, it assigns them to the default API version prefix (defaults to `v1`). With `apiVariants`, you can instruct ROSS to spawn additional route variations for any generated endpoint:

```text
                          ┌──> /v1/posts        (Public, strict rate limits, standard fields)
                          │
data.models.posts  ───────┼──> /v2/posts        (Updated pagination, new query filters)
                          │
                          └──> /admin/posts     (Requires admin role, bypasses secret fields)
```

### Common Use Cases

- **API Versioning**: Serve legacy clients on `/v1/` while introducing updated query behaviors, tags, or validation on `/v2/`.
- **Administrative Portals**: Expose `/admin/` variants of standard CRUD routes that bypass secret fields (`bypassSecret: true`) and require strict administrative roles.
- **Audience Segmentation**: Create dedicated `/partner/` or `/internal/` routes with specialized outbound webhooks or server-side parameter injection.

## Declaring Variants (`apiVariants`)

Variants are defined in the `apiVariants` section of your configuration.

The configuration is a dictionary where:

- **Key**: The **base default-variant API Identifier** of the route you want to replicate (e.g. `model.v1.posts.unknown.getAll`).
- **Value**: An object with a `variants` array containing the variant names you want to generate.

```json
{
  "apiVariants": {
    "model.v1.posts.unknown.getAll": {
      "variants": ["v2", "admin", "partner"]
    },
    "model.v1.posts.title.search": {
      "variants": ["internal"]
    }
  }
}
```

### Declaration Rules

1. **Variant Names**: Variant names must be non-empty strings between 1 and 25 characters containing only alphanumeric characters, underscores, and hyphens (`^[a-zA-Z0-9_-]+$`).
2. **Key Format**: Keys in `apiVariants` must match the base default-variant identifier format (`<module>.<defaultVariant>.<model>.<field>.<operation>`).
3. **Automatic Deduplication**: If the default variant (e.g. `v1`) is included in `variants`, ROSS deduplicates it automatically so only one base route is generated.

## URL Routing & Path Resolution

Every variant declared in `apiVariants` is mounted on an HTTP path matching its variant name:

| Target Endpoint | Variant | Generated API Identifier | HTTP Path |
| --- | --- | --- | --- |
| `model.v1.posts.unknown.getAll` | `v1` (default) | `model.v1.posts.unknown.getAll` | `GET /v1/posts/` |
| `model.v1.posts.unknown.getAll` | `v2` | `model.v2.posts.unknown.getAll` | `GET /v2/posts/` |
| `model.v1.posts.unknown.getAll` | `admin` | `model.admin.posts.unknown.getAll` | `GET /admin/posts/` |
| `model.v1.posts.title.search` | `internal` | `model.internal.posts.title.search` | `POST /internal/posts/search/title` |

All route operations support variants, including model CRUD, field indexes, substring search, field aggregations, and custom endpoints.

## Configuring Policies per Variant (`apis`)

Every generated variant receives a distinct API Identifier where the `<variant>` segment corresponds to the variant name:

```text
model.<variant>.<model>.<field>.<operation>
```

You can target each variant independently in the `apis` configuration section to assign custom security, tags, or operational behaviors:

```json
{
  "apiVariants": {
    "model.v1.posts.unknown.getAll": {
      "variants": ["v2", "admin"]
    }
  },
  "apis": {
    "model.v1.posts.unknown.getAll": {
      "authorization": false,
      "tags": ["Public Content"]
    },
    "model.v2.posts.unknown.getAll": {
      "authorization": true,
      "tags": ["V2 Content API"],
      "supportedQueries": ["eq", "in", "sort"]
    },
    "model.admin.posts.unknown.getAll": {
      "authorization": true,
      "roles": ["admin"],
      "bypassSecret": true,
      "tags": ["Admin Content Management"]
    }
  }
}
```

## Policy Inheritance Rules

When resolving policies for a variant route, ROSS applies hierarchical inheritance from the base default-variant policy:

### 1. Scalar Properties Inherit from Base

If a variant entry in `apis` does not define a scalar property, it automatically inherits the value declared on the default base variant:

- **`enabled`**: If `v1` disables a route (`"enabled": false`), variants inherit `false` unless explicitly overridden.
- **`authorization`**: Inherits the authentication requirement from the base variant.
- **`roles`**: Inherits RBAC role restrictions from the base variant.
- **`tags`**: Inherits OpenAPI tags from the base variant.
- **`bypassSecret`**: Inherits secret field exposure settings from the base variant.

```json
{
  "apis": {
    "model.v1.posts.id.delete": {
      "authorization": true,
      "roles": ["admin"]
    },
    "model.v2.posts.id.delete": {
      "tags": ["V2 Posts"]
    }
  }
}
```

In this example, `model.v2.posts.id.delete` automatically inherits `"authorization": true` and `"roles": ["admin"]` from `v1`.

### 2. List Properties Never Inherit

List properties represent explicit sets of route-specific operational rules. They **never inherit** across variants. Each variant must explicitly declare its own lists if needed:

- **`serverSideParams`**: Injected query/body parameters do not copy over.
- **`webhooks`**: Outbound event notifications do not copy over.
- **`supportedQueries`**: Allowed query filters do not copy over.
- **`supportedAggregations`**: Allowed statistical aggregations do not copy over.

### 3. Deactivating Specific Variants

You can turn off a specific variant route without affecting the base endpoint or other variants by setting `"enabled": false`:

```json
{
  "apis": {
    "model.v2.posts.id.delete": {
      "enabled": false
    }
  }
}
```

Calls to `DELETE /v2/posts/delete/id/:id` will return `404 Not Found`, while `DELETE /v1/posts/delete/id/:id` remains available.

:::warning[Auth User Model Protection on Variants]

When authentication is enabled with an identity provider (`up-auth` or `sso`), all auto-generated CRUD routes for the auth user model (e.g. `model.v1.users.*`) are disabled by default (`enabled: false`).

This protection extends to all variants. For instance, `model.admin.users.unknown.getAll` is disabled by default and must explicitly specify `"enabled": true` to be registered.

:::

## Complete Walkthrough Example

The following configuration demonstrates a complete setup featuring multi-version public endpoints and a privileged administrative variant:

```json
{
  "application": {
    "name": "E-Commerce API"
  },
  "data": {
    "models": {
      "orders": {
        "fields": {
          "id": {
            "type": "integer",
            "primaryKey": true,
            "autoIncrement": true,
            "apis": ["index"]
          },
          "customer_id": {
            "type": "integer",
            "apis": ["search"],
            "query": ["eq"]
          },
          "total_amount": {
            "type": "decimal",
            "query": ["gte", "lte"]
          },
          "internal_notes": {
            "type": "text",
            "secret": true
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
    "defaultRole": "customer",
    "roles": {
      "admin": {
        "includes": ["*"]
      },
      "customer": {}
    }
  },
  "apiVariants": {
    "model.v1.orders.unknown.getAll": {
      "variants": ["v2", "admin"]
    }
  },
  "apis": {
    "model.v1.orders.unknown.getAll": {
      "authorization": true,
      "tags": ["Customer Orders V1"],
      "serverSideParams": [
        {
          "type": "query",
          "name": "customer_id",
          "value": "[[userId]]"
        }
      ]
    },
    "model.v2.orders.unknown.getAll": {
      "authorization": true,
      "tags": ["Customer Orders V2"],
      "supportedQueries": ["eq", "gte", "lte"],
      "serverSideParams": [
        {
          "type": "query",
          "name": "customer_id",
          "value": "[[userId]]"
        }
      ]
    },
    "model.admin.orders.unknown.getAll": {
      "authorization": true,
      "roles": ["admin"],
      "bypassSecret": true,
      "tags": ["Backoffice Order Management"]
    }
  }
}
```

In this architecture:

1. `GET /v1/orders/` serves standard customer queries scoped automatically to the authenticated user via SSP.
2. `GET /v2/orders/` introduces whitelisted query operators (`eq`, `gte`, `lte`) alongside user scoping.
3. `GET /admin/orders/` gives administrators full visibility over all orders, removes customer scoping, exposes the `internal_notes` secret field, and restricts access strictly to the `admin` role.
