# Browser Shell

The browser shell is a local viewer for WebRuntime examples. It gives you:

- a fake URL bar
- back, forward, reload, run, and reset controls
- runtime mode selector
- preview iframe
- fake terminal
- trace panel
- edge cache panel

## Run Locally

```sh
pnpm --dir packages/webruntime dev
```

Open `http://localhost:5173/`.

The root page is the example directory.

## Runtime Modes

The selector supports:

- Same realm
- Backend iframe
- Two iframes

Same realm is the default because it matches the static-hosted demo use case. Iframe modes are for isolation experiments.

## Terminal

The terminal is fake and deterministic. It supports commands such as:

```sh
npm install
npm run dev
ls
cat /server.js
help
clear
```

`npm run dev` marks the fake terminal runtime as running and prints a local URL. It does not execute arbitrary npm packages.

## Phone Review Through Tailscale Serve

For this local workspace, the current safe review shape is:

```txt
Tailscale Serve HTTPS URL
  -> 127.0.0.1 static server
  -> dist/browser-shell
```

After changing browser shell code, rebuild:

```sh
pnpm --dir packages/webruntime build
```

Then refresh the Tailscale HTTPS URL. The root page should show the runtime example directory.
