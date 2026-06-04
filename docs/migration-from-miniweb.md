# Migration from MiniWeb

The first package was published as `@async/miniweb`. The new split is:

- `@async/web/runtime` for the existing runtime engine.
- `@async/web` for app-level authoring defaults.

Rename imports by responsibility:

| Old | New |
| --- | --- |
| `@async/miniweb` | `@async/web/runtime` |
| `createMiniWeb` | `createWebRuntime` |
| `createMiniWebApp` | `defineRuntime` |
| `@async/miniweb/platform` | `@async/web/runtime/platform` |
| `miniweb()` | `webRuntime()` |

This pass removes compatibility exports from the new packages. Existing projects should update imports before upgrading.
