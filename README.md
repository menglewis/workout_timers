# Workout Timer

A hands-free interval workout timer you can install on your phone. It's a Progressive Web App (PWA) with no server. Everything runs in the browser, and your custom workouts are saved on the device.

- Built-in workouts, plus a builder for your own (blocks, rounds, work/rest/warm-up/cool-down steps, notes)
- Spoken cues: each step's name and length, "next up" during rests, round changes, halfway, 10 seconds, and a 3-2-1 countdown with beeps
- Pause and resume, previous and next, restart a step, or tap any step in the list to jump to it
- Keeps the screen on during a workout and works offline once loaded
- Back up and restore your workouts as a JSON file (Settings → Backup)

It's plain HTML, CSS and JavaScript (ES modules), with no build step or dependencies.

## Run locally

Any static file server works. From this folder:

```bash
python -m http.server 8000
```

Then open http://localhost:8000.

> Service workers and installing only work over `https://` or on `localhost`. Opening `index.html` straight from disk loads the app, but it won't work offline.

### Test on your phone before deploying

With the phone connected by USB and USB debugging on, open `chrome://inspect/#devices` in desktop Chrome, turn on **Port forwarding** for `8000 → localhost:8000`, and open `http://localhost:8000` in Chrome on the phone.

## Deploy to GitHub Pages

1. Create a GitHub repository and push this folder to it.
2. In the repository, go to **Settings → Pages**. Under *Build and deployment*, choose **Deploy from a branch**, then pick `main` and `/ (root)`.
3. After a minute the site is live at `https://<your-user>.github.io/<repo>/`. All paths are relative, so it works from that subfolder.

### Shipping updates

The service worker caches the app for offline use. When you change any file, **bump the `CACHE` version in `sw.js`** (for example `wt-v1` → `wt-v2`). Otherwise phones keep the old cached copy. If you add a new file, add it to the `ASSETS` list too.

## Install on Android

Open the site in Chrome, then tap **⋮ → Add to Home screen → Install** (or the **Install** button in the app's header when it appears). It then opens full screen like a normal app.

## Tips and limitations

- **Keep the app in front.** The app keeps the screen awake during a workout. If the phone locks or you switch to another app, Android may pause the timer's audio. The timer still shows the correct time when you come back.
- The first tap on **Start** turns on audio. Browsers block sound until you tap something.
- Voices come from the phone's text-to-speech engine. You can pick one in Settings. To get more voices, install them under Android **Settings → Text-to-speech output**.
- Custom workouts live in this browser's storage. Uninstalling the app or clearing Chrome's site data deletes them, so export a backup now and then.

## Project layout

```
index.html              app shell
manifest.webmanifest    PWA manifest
sw.js                   service worker (offline cache)
css/styles.css          styles
js/app.js               router and startup
js/model.js             workout data model, expand(), validation, formatting
js/builtins.js          built-in workouts
js/storage.js           localStorage persistence, settings, export/import
js/engine.js            timer state machine (timestamp-based, no DOM)
js/audio.js             speech + beeps, cue script
js/library.js           workout list and preview screens
js/player.js            workout player screen
js/editor.js            workout editor
js/settings.js          settings screen
js/ui.js                shared helpers (icons, step list, toast)
icons/                  app icons
```

### Workout format

```js
{
  id, name, description,
  blocks: [{
    name, rounds, restBetweenRounds,   // seconds; the rest is added between rounds, not after the last one
    steps: [{ name, type: 'work' | 'rest' | 'warmup' | 'cooldown', duration /* seconds */, notes }]
  }]
}
```
