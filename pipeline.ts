import { definePipeline, env, job, sh, task, trigger } from "@async/pipeline";

const publishPackage = "packages/web";

export default definePipeline({
  name: "async-web",
  cache: "file:local",
  triggers: {
    pr: trigger.github({ events: ["pull_request"] }),
    main: trigger.github({ events: ["push"], branches: ["main"] }),
    release: trigger.github({ events: ["release"] }),
    manual: trigger.manual()
  },
  sync: {
    github: {
      nodeVersion: 24
    },
    tasks: {
      prefix: "pipeline",
      runners: ["package"],
      targets: "root",
      jobs: "all",
      tasks: [
        "api-ledger",
        "api-surface",
        "pages-build",
        "pack"
      ],
      scripts: {
        "github:check": "github check",
        "sync:check": "sync check",
        "sync:generate": "sync generate",
        "github:generate": "github generate",
        "api-surface": "run-task api-surface",
        "api:surface:generate": "run-task api-ledger",
        "publish:github:main": "publish github main --package packages/web",
        "publish:github:pr": "publish github pr --package packages/web",
        "publish:github:release": "publish github release --package packages/web",
        "publish:npm": "publish npm --package packages/web",
        "release:doctor": "release doctor --package packages/web",
        "release:ensure": "release ensure --package packages/web",
        "verify:force": "run verify --force"
      }
    }
  },
  namedInputs: {
    source: [
      "packages/*/src/**/*",
      "packages/*/tests/**/*",
      "packages/*/scripts/**/*",
      "packages/*/package.json",
      "packages/*/tsconfig*.json",
      "packages/*/vitest.config.ts",
      "docs/**/*.md",
      "scripts/**/*.js",
      "README.md",
      "API_SURFACE.md",
      "api-contract.json",
      "package.json",
      "pnpm-lock.yaml",
      "pnpm-workspace.yaml",
      "tsconfig.base.json",
      "tsconfig.json"
    ]
  },
  tasks: {
    typecheck: task({
      inputs: ["source"],
      cache: true,
      run: sh`pnpm typecheck`
    }),
    lint: task({
      inputs: ["source"],
      cache: true,
      run: sh`pnpm lint`
    }),
    test: task({
      dependsOn: ["typecheck"],
      inputs: ["source"],
      cache: true,
      run: sh`pnpm run test`
    }),
    build: task({
      dependsOn: ["test"],
      inputs: ["source"],
      outputs: ["packages/*/dist/**"],
      cache: true,
      run: sh`pnpm run build`
    }),
    pack: task({
      dependsOn: ["build"],
      inputs: ["source"],
      cache: false,
      run: sh`pnpm --dir packages/web pack:check`
    }),
    "api-manifest": task({
      inputs: ["api-contract.json"],
      cache: true,
      run: sh`pnpm api-contract check --manifest api-contract.json`
    }),
    "api-ledger": task({
      dependsOn: ["api-manifest"],
      inputs: ["api-contract.json"],
      outputs: ["API_SURFACE.md"],
      cache: false,
      run: sh`pnpm api-contract ledger --manifest api-contract.json --out API_SURFACE.md`
    }),
    "api-surface": task({
      dependsOn: ["api-manifest"],
      inputs: ["api-contract.json", "API_SURFACE.md"],
      cache: true,
      run: sh`pnpm api-contract ledger --manifest api-contract.json --check API_SURFACE.md`
    }),
    "pages-build": task({
      inputs: ["README.md", "docs/**/*.md", "scripts/build-pages.js"],
      outputs: ["_site/**"],
      cache: false,
      run: sh`node scripts/build-pages.js`
    }),
    "github-pr-preview": task({
      dependsOn: ["pack"],
      inputs: ["source"],
      cache: false,
      run: sh`pnpm async-pipeline publish github pr --package ${publishPackage}`
    }),
    "github-main-snapshot": task({
      dependsOn: ["pack"],
      inputs: ["source"],
      cache: false,
      run: sh`pnpm async-pipeline publish github main --package ${publishPackage}`
    }),
    "stable-release": task({
      dependsOn: ["release-ensure"],
      inputs: ["source"],
      cache: false,
      run: [
        sh`pnpm async-pipeline publish github release --package ${publishPackage}`,
        sh`pnpm async-pipeline publish npm --package ${publishPackage}`,
        sh`pnpm async-pipeline release doctor --package ${publishPackage}`
      ]
    }),
    "release-ensure": task({
      description: "Create or verify the release tag and GitHub Release before package publishing.",
      dependsOn: ["pack"],
      inputs: ["source"],
      cache: false,
      run: sh`pnpm async-pipeline release ensure --package ${publishPackage}`
    })
  },
  jobs: {
    verify: job({
      target: ["pack", "api-surface", "pages-build"],
      trigger: ["pr", "main"]
    }),
    "pr-preview": job({
      target: "github-pr-preview",
      trigger: ["pr"],
      env: {
        GITHUB_TOKEN: env.secret("GITHUB_TOKEN")
      },
      github: {
        permissions: {
          contents: "read",
          issues: "write",
          packages: "write",
          pullRequests: "write"
        }
      }
    }),
    "main-snapshot": job({
      target: "github-main-snapshot",
      trigger: ["main"],
      env: {
        GITHUB_TOKEN: env.secret("GITHUB_TOKEN")
      },
      github: {
        permissions: {
          contents: "read",
          packages: "write"
        }
      }
    }),
    "stable-release": job({
      target: "stable-release",
      trigger: ["manual", "release"],
      environment: "npm-publish",
      env: {
        GITHUB_TOKEN: env.secret("GITHUB_TOKEN"),
        NODE_AUTH_TOKEN: env.secret("NPM_TOKEN")
      },
      requires: {
        provenance: true
      },
      github: {
        permissions: {
          contents: "write",
          idToken: "write",
          packages: "write"
        }
      }
    }),
    pages: job({
      target: ["pack", "api-surface", "pages-build"],
      trigger: ["main", "manual"],
      github: {
        permissions: {
          contents: "read"
        },
        pages: {
          build: {
            kind: "static",
            path: "_site"
          }
        }
      }
    })
  }
});
