---
sidebar_position: 2
---

# Models

Models in ROSS are the core declarative contract of your application. Defined under the `data.models` section of your configuration, models serve two foundational purposes:

1. **Database Schema Provisioning**: ROSS automatically synchronizes tables, column data types, nullability constraints, primary keys, auto-increment sequences, indexes, and foreign key relationships with your database.
2. **Instant REST API Generation**: For every declared model, ROSS automatically generates production-ready REST API endpoints for creation (`POST`), paginated retrieval (`GET`), indexed lookups, partial updates (`PATCH`), deletions (`DELETE`), full-text search, and analytical aggregations with built-in input validation.

## Model Configuration Structure

Models are defined under `data.models`, where each key represents the table name:

```json
{
  "data": {
    "models": {
      "articles": {
        "timestamps": true,
        "fields": {
          "id": {
            "type": "integer",
            "primaryKey": true,
            "autoIncrement": true,
            "nullable": false
          },
          "title": {
            "type": "string",
            "nullable": false,
            "apis": ["search", "index", "edit"],
            "query": ["eq", "ne", "sort"]
          },
          "content": {
            "type": "text",
            "nullable": true
          }
        },
        "indexes": {
          "idx_article_title": {
            "fields": ["title"],
            "unique": false
          }
        }
      }
    }
  }
}
```

### Model-Level Properties

| Property | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `fields` | `object` | **Yes** | — | Map of field names to their column configuration objects. |
| `timestamps` | `boolean` | No | `false` | When `true`, automatically injects and manages `created_at` and `updated_at` datetime columns. |
| `indexes` | `object` | No | `{}` | Map of custom single-column or composite indexes. |
| `relations` | `object` | No | `{}` | Map of foreign key relationships linking this model to other models. |
| `validation` | `object` | No | — | Optional JSON Schema specifying body validation rules for mutations. |

### Managed Timestamps (`timestamps: true`)

When `timestamps` is set to `true`, ROSS automatically injects two managed columns into your database schema:

- **`created_at`**: Populated with the current timestamp when a new record is inserted.
- **`updated_at`**: Populated on insert and automatically updated whenever a record is modified via `PATCH` or `PUT`.

ROSS automatically applies the appropriate native timestamp default for your active database engine:

- In PostgreSQL: `now()`
- In MySQL: `CURRENT_TIMESTAMP`
- In SQLite: `(datetime('now'))`

If your configuration already defines a field named `created_at` or `updated_at`, ROSS respects your custom field definition instead of overwriting it.

## Supported Data Types

Every field requires a `type` property specifying its data type:

| Data Type | Description | PostgreSQL | MySQL | SQLite |
| --- | --- | --- | --- | --- |
| `"integer"` | Whole number (32-bit / 64-bit). Supports `autoIncrement`. | `integer` / `serial` | `int` | `integer` |
| `"decimal"` | Floating-point or fixed-point decimal number. | `double precision` | `double` | `real` |
| `"string"` | Short text string (up to 255 characters). Supports search. | `text` | `varchar(255)` | `text` |
| `"text"` | Unbounded long text or markdown content. | `text` | `text` | `text` |
| `"boolean"` | True / false boolean value. | `boolean` | `boolean` | `integer` (1 / 0) |
| `"datetime"` | Date and time with timezone information. | `timestamp` | `datetime` | `integer` (timestamp) |
| `"date"` | Calendar date (`YYYY-MM-DD`). | `date` | `date` | `text` |
| `"json"` | Structured JSON object or array. | `jsonb` | `json` | `text` (JSON mode) |
| `"enum"` | Restricted string matching a defined list of `values`. | Custom enum type | `enum(...)` | `text` |
| `"uuid"` | 36-character Universally Unique Identifier. | `uuid` | `varchar(36)` | `text` |
| `"ulid"` | 26-character Lexicographically Sortable Identifier. | `text` | `varchar(26)` | `text` |

## Field Attributes

Each field in `fields` accepts the following attributes:

| Attribute | Type | Default | Description |
| --- | --- | --- | --- |
| `type` | `string` | **Required** | The data type for the column (see table above). |
| `primaryKey` | `boolean` | `false` | Designates this field as the table's primary key. Allowed on `integer`, `string`, `uuid`, and `ulid`. |
| `autoIncrement` | `boolean` | `false` | Enables database-managed auto-incrementing. Only allowed on `integer` primary keys. |
| `nullable` | `boolean` | `true` | When `false`, enforces a `NOT NULL` constraint on the column. |
| `unique` | `boolean` | `false` | Enforces a unique constraint and index on this column. |
| `default` | `any` | — | Default value applied on insert. Can be a literal primitive or an object with `{ "raw": "<sql>" }`. |
| `secret` | `boolean` | `false` | Marks a field as sensitive (passwords, tokens, salts). Stripped from API responses and search. |
| `values` | `string[]` | — | Array of allowed string options. **Required** when `type: "enum"`. |
| `apis` | `string[]` | `[]` | List of REST endpoint operations enabled for this specific field. |
| `query` | `string[]` | `[]` | List of query filter operators allowed on this field in `GET` requests. |
| `aggregations` | `string[]` | `[]` | List of aggregation functions allowed on this field in aggregation endpoints. |

### Primary Key Rules

- A model can designate at most one primary key field.
- The `primaryKey` attribute is only valid on `integer`, `string`, `uuid`, or `ulid` fields.
- `autoIncrement` can only be set to `true` when `primaryKey` is `true` and `type` is `"integer"`.
- Secret fields (`secret: true`) cannot be primary keys.

### Default Values

You can provide default values for columns when records are inserted:

```json
{
  "status": {
    "type": "enum",
    "values": ["draft", "published", "archived"],
    "default": "draft"
  },
  "view_count": {
    "type": "integer",
    "default": 0
  },
  "published_at": {
    "type": "datetime",
    "default": {
      "raw": "CURRENT_TIMESTAMP"
    }
  }
}
```

### Secret Fields (`secret: true`)

Fields that store sensitive information such as password hashes, two-factor authentication secrets, or external API keys should be marked with `secret: true`:

```json
{
  "password_hash": {
    "type": "string",
    "nullable": false,
    "secret": true,
    "apis": ["edit"]
  }
}
```

When a field is marked as secret:

- It is automatically stripped from all `GET` API responses (list, detail lookups, and search results).
- It cannot be configured with `"search"` or `"index"` in its `apis` array.
- It cannot have `query` filter operations or `aggregations` enabled.
- It cannot be a `primaryKey`.
- It can still be updated via `PATCH` or `PUT` endpoints if `"edit"` is included in `apis`.

### Enum Fields (`type: "enum"`)

Enum fields restrict stored values to an explicit list of allowed strings:

```json
{
  "role": {
    "type": "enum",
    "values": ["user", "manager", "admin"],
    "nullable": false,
    "default": "user",
    "apis": ["index", "edit", "delete"],
    "query": ["eq", "ne", "in"]
  }
}
```

- In PostgreSQL: ROSS automatically provisions a native database enum type named `<model>_<field>_enum`.
- In MySQL: Configured as a native `ENUM('user', 'manager', 'admin')` column.
- In SQLite: Stored as text with runtime and schema validation.

## API Operations (`apis`)

The `apis` array controls which field-specific REST endpoints ROSS generates:

| Operation | Allowed Field Types | Generated Endpoint | Description |
| --- | --- | --- | --- |
| `"index"` | `integer`, `decimal`, `string`, `enum`, `uuid`, `ulid` | `GET /api/v1/<model>/<field>/:<field>` | Look up records by this field's value. Returns a single object if unique, or a paginated array if non-unique. |
| `"search"` | `string` | `GET /api/v1/<model>/search/<field>?<field>_search=<term>` | Case-insensitive substring search matching text on this specific field. |
| `"edit"` | `integer`, `decimal`, `string`, `enum`, `uuid`, `ulid` | `PATCH` / `PUT /api/v1/<model>/<field>/:<field>` | Update records matching the specified field parameter. |
| `"delete"` | `integer`, `decimal`, `string`, `enum`, `uuid`, `ulid` | `DELETE /api/v1/<model>/<field>/:<field>` | Delete records matching the specified field parameter. |

:::info[Search Is Restricted to String Fields]

Full-text substring search (`apis: ["search"]`) is only supported on `"string"` fields. Unbounded `"text"` columns, booleans, dates, and numbers cannot have `"search"` enabled in `apis`.

:::

## Query Operations (`query`)

The `query` array defines which filter operators are permitted for a field on the `GET /api/v1/<model>/` listing endpoint:

| Query Operator | Filter Suffix | SQL Equivalent | Example Query Parameter |
| --- | --- | --- | --- |
| `"eq"` | `_eq` | `=` | `?status_eq=active` |
| `"ne"` | `_ne` | `!=` | `?status_ne=archived` |
| `"lt"` | `_lt` | `<` | `?price_lt=100` |
| `"lte"` | `_lte` | `<=` | `?rating_lte=4.5` |
| `"gt"` | `_gt` | `>` | `?created_at_gt=2026-01-01` |
| `"gte"` | `_gte` | `>=` | `?age_gte=18` |
| `"in"` | `_in` | `IN (...)` | `?role_in=admin,manager` |
| `"not_in"` | `_not_in` | `NOT IN (...)` | `?status_not_in=draft,deleted` |
| `"sort"` | (via `orderBy`) | `ORDER BY` | `?orderBy=created_at&orderDir=desc` |

### Allowed Query Operators by Data Type

| Data Type | Allowed Query Operators |
| --- | --- |
| `integer`, `decimal` | `eq`, `ne`, `lt`, `lte`, `gt`, `gte`, `in`, `not_in`, `sort` |
| `datetime`, `date` | `eq`, `ne`, `lt`, `lte`, `gt`, `gte`, `in`, `not_in`, `sort` |
| `string`, `uuid`, `ulid` | `eq`, `ne`, `in`, `not_in`, `sort` |
| `enum` | `eq`, `ne`, `in`, `not_in` |
| `boolean` | `eq`, `ne` |
| `text`, `json` | *(None allowed)* |

Multiple filters can be combined in a single request and are joined with `AND`:

```http
GET /api/v1/tasks?status_in=todo,in_progress&priority_gte=2&orderBy=created_at&orderDir=desc&page=1&limit=25
```

## Aggregations (`aggregations`)

The `aggregations` array specifies which analytical calculations can be performed on a field via the `GET /api/v1/<model>/aggregation/<field>` endpoint:

| Aggregation | Description | Allowed Types |
| --- | --- | --- |
| `"count"` | Total count of non-null values. | `integer`, `decimal`, `string`, `boolean`, `datetime`, `date`, `enum`, `uuid`, `ulid` |
| `"avg"` | Average mathematical value. | `integer`, `decimal`, `datetime`, `date` |
| `"sum"` | Sum total of numeric values. | `integer`, `decimal` |
| `"min"` | Minimum value. | `integer`, `decimal`, `datetime`, `date` |
| `"max"` | Maximum value. | `integer`, `decimal`, `datetime`, `date` |
| `"frequency"` | Value count breakdown grouped by value. | `boolean`, `enum` |

### Running Aggregations

To compute aggregations, call the aggregation endpoint with the `operations` query parameter containing a comma-separated list of requested calculations:

```http
GET /api/v1/orders/aggregation/total_amount?operations=avg,sum,count
```

Example response:

```json
{
  "code": 200,
  "message": "Successfully aggregated data for total_amount in orders",
  "data": {
    "avg": 42.5,
    "sum": 850,
    "count": 20
  }
}
```

For boolean and enum fields, the `"frequency"` aggregation returns a breakdown mapping each value to its occurrence count:

```http
GET /api/v1/tasks/aggregation/status?operations=frequency,count
```

Example response:

```json
{
  "code": 200,
  "message": "Successfully aggregated data for status in tasks",
  "data": {
    "count": 50,
    "frequency": {
      "todo": 15,
      "in_progress": 20,
      "completed": 15
    }
  }
}
```

## Indexes (`indexes`)

Custom database indexes accelerate queries on frequently filtered or joined columns. Indexes are declared in the `indexes` object of a model:

```json
{
  "indexes": {
    "idx_user_email": {
      "fields": ["email"],
      "unique": true
    },
    "idx_tasks_project_status": {
      "fields": ["project_id", "status"],
      "unique": false
    }
  }
}
```

### Index Properties

- **`fields` (`string[]`, required)**: Array of field names included in the index. Multiple fields create a composite index in the specified column order.
- **`unique` (`boolean`, optional, default `false`)**: When `true`, enforces that all values in the indexed column(s) are distinct.

Every field referenced in `fields` must exist in the model's `fields` definition.

## Relations & Foreign Keys (`relations`)

Relations define foreign key constraints linking models together, enforcing referential integrity in your database.

```json
{
  "data": {
    "models": {
      "projects": {
        "fields": {
          "id": { "type": "integer", "primaryKey": true, "autoIncrement": true }
        }
      },
      "tasks": {
        "fields": {
          "id": { "type": "integer", "primaryKey": true, "autoIncrement": true },
          "project_id": { "type": "integer", "nullable": false }
        },
        "relations": {
          "project": {
            "type": "belongsTo",
            "model": "projects",
            "localField": "project_id",
            "foreignField": "id",
            "onDelete": "cascade",
            "onUpdate": "cascade"
          }
        }
      }
    }
  }
}
```

### Relation Properties

| Property | Type | Required | Description |
| --- | --- | --- | --- |
| `type` | `"belongsTo"` | **Yes** | Relationship type. Currently, `"belongsTo"` is supported. |
| `model` | `string` | **Yes** | The target model name being referenced. |
| `localField` | `string` | **Yes** | The foreign key column on the current model. Must exist in `fields`. |
| `foreignField` | `string` | **Yes** | The referenced primary key or unique column on the target model. |
| `onDelete` | `string` | No | Referential action when the referenced parent record is deleted. |
| `onUpdate` | `string` | No | Referential action when the referenced parent key is updated. |

### Referential Actions (`onDelete` / `onUpdate`)

- `"cascade"`: Automatically delete or update child records when the referenced parent record is deleted or updated.
- `"set null"`: Set the foreign key column in child records to `NULL` (requires `nullable: true` on `localField`).
- `"set default"`: Set the foreign key column to its default value.
- `"restrict"`: Prevent deletion or modification of the parent record if matching child records exist.
- `"no action"`: Standard database behavior (defer constraint check to the end of the transaction).

## Request Body Validation (`validation`)

By default, ROSS validates incoming request bodies against the basic data types declared in `fields`. To enforce stricter business rules—such as string length constraints, regular expression patterns, number ranges, or custom required field subsets—add a `validation` object using standard JSON Schema syntax:

```json
{
  "data": {
    "models": {
      "users": {
        "fields": {
          "id": { "type": "integer", "primaryKey": true, "autoIncrement": true },
          "email": { "type": "string", "nullable": false, "unique": true },
          "age": { "type": "integer", "nullable": true },
          "bio": { "type": "text", "nullable": true }
        },
        "validation": {
          "type": "object",
          "required": ["email"],
          "properties": {
            "email": {
              "type": "string",
              "format": "email",
              "maxLength": 255
            },
            "age": {
              "type": "integer",
              "minimum": 13,
              "maximum": 120
            },
            "bio": {
              "type": "string",
              "maxLength": 500
            }
          }
        }
      }
    }
  }
}
```

### Validation Rules

- **Field Existence**: Every property defined in `validation.properties` must correspond to a field declared in the model's `fields`.
- **Type Consistency**: The JSON Schema type specified for each property must be compatible with the model field type (e.g. `integer` fields must use `"type": "integer"`).
- **Automatic Enforcement**: ROSS compiles validation schemas into Fastify's route pre-validation layer. Requests that violate the schema receive an immediate `400 Bad Request` response detailing the invalid fields before any database query executes.

## Auto-Generated REST Endpoints

For every model configured in `data.models`, ROSS automatically mounts the following endpoints under your application variant path (default `/api/v1/`):

### 1. Create Record

- **Method**: `POST`
- **Path**: `/api/v1/<model>/`
- **Body**: JSON payload matching model fields and validation rules.
- **Response**: `201 Created` with the inserted record and generated primary key.

### 2. List Records (Paginated & Filtered)

- **Method**: `GET`
- **Path**: `/api/v1/<model>/`
- **Query Parameters**:
  - `page`: Page number (integer, default `1`).
  - `limit`: Records per page (integer between `10` and `100`, default `20`).
  - `orderBy`: Column name to sort by (must have `"sort"` in `query`).
  - `orderDir`: Sort direction (`"asc"` or `"desc"`, default `"asc"`).
  - `<field>_<operator>`: Any configured query filters (e.g. `?status_eq=active&views_gte=100`).
- **Response**: `200 OK` with `{ data: [...], pagination: { page, limit, total, totalPages } }`.

### 3. Record Lookup by Index

- **Method**: `GET`
- **Path**: `/api/v1/<model>/<field>/:<field>`
- **Generated for**: Primary keys, fields with `unique: true`, or fields with `"index"` in `apis`.
- **Response**:
  - For unique fields (or primary keys): `200 OK` returning `{ code: 200, message: "...", data: { ... } }` (or `404 Not Found` if no record matches).
  - For non-unique fields: `200 OK` returning `{ code: 200, message: "...", data: [...], pagination: { page, limit, total, totalPages } }` with support for pagination (`page`, `limit`), sorting (`orderBy`, `orderDir`), and query filters.

### 4. Edit Record

- **Method**: `PATCH` (partial update) or `PUT` (complete update)
- **Path**: `/api/v1/<model>/<field>/:<field>`
- **Generated for**: Fields with `"edit"` in `apis`.
- **Body**: JSON payload of fields to update. When using `PATCH`, body fields are optional; when using `PUT`, all model fields are required.
- **Behavior**: Automatically updates the `updated_at` column if `timestamps: true` is enabled. If the field is not unique, you can provide query filters to narrow the update target.
- **Response**: `200 OK` returning `{ code: 200, message: "...", data: { ... } }` with updated values. If no matching record was found to update, returns `404 Not Found`.

### 5. Delete Record

- **Method**: `DELETE`
- **Path**: `/api/v1/<model>/<field>/:<field>`
- **Generated for**: Fields with `"delete"` in `apis`.
- **Response**: `204 No Content` (empty response body).

### 6. Substring Search

- **Method**: `GET`
- **Path**: `/api/v1/<model>/search/<field>`
- **Generated for**: Fields with `"search"` in `apis` (string fields only).
- **Query Parameters**:
  - `<field>_search`: Search string to match case-insensitively using `LIKE %<term>%` (**required**). E.g. for field `title`, parameter is `?title_search=javascript`.
  - `page`, `limit`: Standard pagination parameters.
  - `orderBy`, `orderDir`: Sorting parameters.
  - `<field>_<operator>`: Any supported model query filters (e.g. `&status_eq=published`).
- **Example**:

  ```http
  GET /api/v1/articles/search/title?title_search=javascript&page=1&limit=20
  ```

- **Response**: `200 OK` returning `{ code: 200, message: "...", data: [...], pagination: { page, limit, total, totalPages } }`.

### 7. Analytical Aggregations

- **Method**: `GET`
- **Path**: `/api/v1/<model>/aggregation/<field>`
- **Generated for**: Fields with one or more operations in `aggregations`.
- **Query Parameters**:
  - `operations`: Comma-separated list of operations to compute (**required**, e.g. `?operations=avg,sum,count` or `?operations=frequency,count`).
- **Example**:

  ```http
  GET /api/v1/orders/aggregation/total_amount?operations=avg,sum,count
  ```

- **Response**: `200 OK` returning `{ code: 200, message: "...", data: { ... } }` with the requested metric values (`avg`, `sum`, `min`, `max`, `count`, `frequency`).

## Complete Example

Here is a comprehensive model configuration demonstrating relations, timestamps, enums, indexes, validation, query operations, and aggregations:

```json
{
  "data": {
    "models": {
      "organizations": {
        "timestamps": true,
        "fields": {
          "id": {
            "type": "integer",
            "primaryKey": true,
            "autoIncrement": true,
            "nullable": false
          },
          "name": {
            "type": "string",
            "nullable": false,
            "apis": ["search", "index", "edit"],
            "query": ["eq", "ne", "sort"]
          },
          "slug": {
            "type": "string",
            "nullable": false,
            "unique": true,
            "apis": ["index"]
          }
        }
      },
      "members": {
        "timestamps": true,
        "fields": {
          "id": {
            "type": "integer",
            "primaryKey": true,
            "autoIncrement": true,
            "nullable": false
          },
          "organization_id": {
            "type": "integer",
            "nullable": false,
            "apis": ["index", "delete"],
            "query": ["eq", "in"]
          },
          "email": {
            "type": "string",
            "nullable": false,
            "apis": ["search", "index", "edit"],
            "query": ["eq", "sort"]
          },
          "role": {
            "type": "enum",
            "values": ["owner", "admin", "member", "guest"],
            "default": "member",
            "nullable": false,
            "apis": ["index", "edit"],
            "query": ["eq", "ne", "in"],
            "aggregations": ["count", "frequency"]
          },
          "is_active": {
            "type": "boolean",
            "default": true,
            "nullable": false,
            "query": ["eq", "ne"],
            "aggregations": ["count", "frequency"]
          },
          "api_secret": {
            "type": "string",
            "nullable": false,
            "secret": true,
            "apis": ["edit"]
          }
        },
        "indexes": {
          "idx_org_email": {
            "fields": ["organization_id", "email"],
            "unique": true
          }
        },
        "relations": {
          "organization": {
            "type": "belongsTo",
            "model": "organizations",
            "localField": "organization_id",
            "foreignField": "id",
            "onDelete": "cascade",
            "onUpdate": "cascade"
          }
        },
        "validation": {
          "type": "object",
          "required": ["organization_id", "email", "api_secret"],
          "properties": {
            "email": {
              "type": "string",
              "format": "email",
              "maxLength": 255
            },
            "role": {
              "type": "string",
              "enum": ["owner", "admin", "member", "guest"]
            }
          }
        }
      }
    }
  }
}
```
