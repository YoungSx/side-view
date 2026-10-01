<p align="center">
  <a href="README.md">English</a> ·
  <a href="README.zh-CN.md">简体中文</a> ·
  <a href="README.zh-TW.md">繁體中文</a> ·
  <a href="README.ja.md">日本語</a>
</p>

# Side View

**Read the post. Keep your timeline.**

![Side View opens a post beside the timeline on X](assets/store/screenshots/01-x-sidebar.jpg)

You know the feeling. You're halfway down your timeline, a post catches your eye, you click it —
and the whole feed is gone. Now you have to scroll all the way back, and whatever you were reading
a minute ago is out of reach.

Side View opens that post **in a column right beside your timeline**. Your feed stays exactly
where it was. Read it, reply, scroll through the thread, close it — and you're still looking at
the same screen.

Works on **X**, **Bluesky** and **Threads**.

---

## What it actually does

Click any post in your feed. Instead of taking over the page, it opens next to your feed. Click
another one and it takes the same place. Close it and your timeline is untouched — you never left.

That's the whole idea. No new app, no account, no different website. You stay logged in as you
are, and the post renders exactly the way your site renders it: threads, images, video, polls and
replies all included.

- **You decide what opens in the column.** Turn it off for profiles, hashtags and searches and
  only posts open this way, if you prefer.
- **You decide how wide it gets.** Anything from 320 to 1200 pixels, so it fits your window.
- **You decide how much room your navigation takes.** Slim it down to an icon rail, or leave it
  alone.
- **Four languages.** English, 简体中文, 繁體中文, 日本語 — or just follow your browser.

## Where it works

**On X and Bluesky**, Side View draws the column itself and puts it beside your feed. You can have
it take over the right sidebar, or sit next to the sidebar with both visible.

**On Threads home**, there's no sidebar to take over, so Side View reuses Threads' own column feature —
one native column, saved to your Threads account, reused every time you open a post. It behaves
like any other Threads column: you can move it, resize it, or scroll it the way you already know
how. On standalone activity, following, saved, liked, for-you, archive, custom-feed and search
pages, Side View renders a temporary native detail column beside the current content. The URL
stays unchanged and no column is saved to your account. Close it from the native column menu.
These standalone views require room for two 640px columns plus native navigation; when native rendering
is unavailable or there is insufficient room, clicks keep their normal behavior.

![The post opens beside the feed on Bluesky](assets/store/screenshots/02-bluesky-sidebar.jpg)

![On Threads, the post opens in Threads' own column](assets/store/screenshots/03-threads-native-column.jpg)

## Getting started

1. Install Side View from the Chrome Web Store. *(The link goes here as soon as the listing is
   live.)*
2. Open X, Bluesky or Threads as usual. Nothing else to configure.
3. Click a post. It opens beside your timeline.

If you want the post on its own instead, every detail panel has an "open in a new tab" button.

## Your settings

Open the settings page from your browser's extension menu. It has its own tab, so it never gets in
the way, and everything saves as you go.

![The Side View settings page](assets/store/screenshots/04-settings.png)

## Your privacy

Side View has no server, no account, and no analytics. It reads the post you clicked from the page
you're already looking at, shows it in the column, and forgets about it. Your settings stay in your
browser. Nothing is collected, sold, or sent anywhere.

One thing worth knowing: the Threads column is created by Threads and stored **in your Threads
account** — that's Threads' own doing, not ours. Turning Side View off, or removing it, won't
delete it. Removing it is a two-click job in Threads' own column menu, and there's more detail in
[the privacy policy](docs/privacy-policy.md).

## Good to know

- **Side View is an independent extension.** It isn't affiliated with, endorsed by, or sponsored by
  X, Bluesky, or Meta.
- **Sites change.** Side View attaches to each site's own layout, so when a site redesigns, things
  can stop working until an update lands. We're on it — [tell us when something breaks](docs/support.md).
- **No account, ever.** There's nothing to sign up for and nothing to pay — Side View is a browser
  extension that you install and use.
- **Your timeline is never modified.** Side View doesn't reorder, hide, or rewrite anything. Close
  it and the page is exactly as it was.

## Get help

Bug reports, feature requests and questions all go to the same place:
**[GitHub Issues](https://github.com/YoungSx/side-view/issues)**. There's a short checklist of what
to include in [docs/support.md](docs/support.md), and an email address if you'd rather not post
publicly.

## Build it yourself

Side View is open source. Node 22+ and pnpm 10:

```bash
git clone https://github.com/YoungSx/side-view.git
cd side-view
pnpm install
pnpm dev      # development build with hot reload
pnpm build    # production build → .output/chrome-mv3
pnpm test     # run the test suite
```

Load `.output/chrome-mv3` as an unpacked extension at `chrome://extensions`. Architecture notes,
the localization guide and the runtime verification checklist live in
[docs/development.md](docs/development.md).
