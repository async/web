import { definePipeline, job, sh, task, trigger } from "@async/pipeline";

export default definePipeline({
  name: "async-web",
  cache: "file:local",
  triggers: {
    pr: trigger.github({ events: ["pull_request"] }),
    main: trigger.github({ events: ["push"], branches: ["main"] })
  },
  sync: {
    github: true,
    tasks: {
      prefix: "pipeline",
      runners: ["package"],
      targets: [{ package: "async-web" }],
      jobs: ["verify"],
      scripts: {
        "sync:check": "sync check",
        "github:generate": "github generate"
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
      run: sh`pnpm test`
    }),
    build: task({
      dependsOn: ["test"],
      inputs: ["source"],
      outputs: ["packages/*/dist/**"],
      cache: true,
      run: sh`pnpm build`
    }),
    pack: task({
      dependsOn: ["build"],
      inputs: ["source"],
      cache: false,
      run: sh`pnpm -r pack:check`
    })
  },
  jobs: {
    verify: job({
      target: "pack",
      trigger: ["pr", "main"]
    })
  }
});
