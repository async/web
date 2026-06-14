# WebRuntime Local Redirect Extension

This is a narrow local Brave/Chrome workaround for a laptop where Tailscale MagicDNS does not resolve:

```txt
https://patrickjs-macbook-pro.lynx-in.ts.net/*
  -> http://127.0.0.1:5178/*
```

It only redirects top-level page navigations for the WebRuntime preview hostname. It does not redirect every Tailscale URL.

## Install In Brave

1. Open `brave://extensions`.
2. Turn on **Developer mode**.
3. Click **Load unpacked**.
4. Select this folder:

```txt
/Users/patrickjs/code/async/web/tools/brave-async-web-redirect
```

Then open:

[WebRuntime Tailscale preview](https://patrickjs-macbook-pro.lynx-in.ts.net/)

Brave should land on:

[WebRuntime local preview](http://127.0.0.1:5178/)

## Remove

Open `brave://extensions` and remove **WebRuntime Local Redirect**.

## Why This Exists

This is a local browser workaround. The real issue is still Tailscale DNS returning `NXDOMAIN` for this MagicDNS hostname on this laptop.
