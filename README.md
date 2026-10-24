# Study Haven

A calm, full-screen study app in the style of Flocus. It has three modes:
- **Home**: greeting, clock, lecture tiles and what's due.
- **Focus**: the pomodoro timer.
- **Ambient**: just your background.

Tools sit at the bottom-left: due list, YouTube music, notes, subjects and calendar. Settings, stickers and
full screen are at the bottom-right. Everything bigger opens in an app window over the scene: subjects
with topic → chapter → unit → subject progress, three databases (textbooks, slides, your notes),
calendar, courses and embeds, the Aesthetic studio, and settings.

## The study room (Room mode, cube icon)

A 3D isometric study room you can orbit around. Every object is part of the app:

| Click | Opens or does |
|---|---|
| Laptop | Notes |
| Books with a bookmark | That subject |
| The shelf | Textbooks & slides |
| Wall calendar | Calendar (red dots = due days) |
| Corkboard | What’s due (your due items are pinned on it) |
| Wall clock | Starts or pauses your timer (it shows the live countdown) |
| Record player | Music (the record spins while it plays) |
| Window | Rain, snow or clear sky (the sky follows the real time of day) |
| Lamp | Light on and off |
| Chair | Sit down: switches to Focus and starts the timer |
| Plant | Grows with every focus block you finish |
| Poster | Aesthetic studio (it shows your current background) |
| Gallery wall (left wall) | Pick a picture for that frame |
| Speaker (by the record player) | Music panel; its LEDs, the woofer and the fairy lights follow the music |
| Yarn ball | Throw it: the cat chases it, pounces and bats it around |
| Desk globe | Spin it |
| Newton’s cradle (desk) | Set the balls clacking |
| Wind chime (by the window) | Brush past it to hear it; click to ring it |
| The cat | Click: meows and hops. Press and hold: pets, purring and hearts. Leave it alone and it falls asleep |
| Fairy lights, mug | Little things |

**The cat cheers you on** about every 5 minutes, in a speech bubble in the room or as a note elsewhere. What it says depends on whether you’re focusing, on a break, or haven’t started. Turn it, or the meows, off in the customise panel under Pet.

**Customise the room** (brush button in the room's top bar). Each option shows a preview:
- window view: city, forest, beach or mountains
- time of day and weather
- floor wood, walls, rug and curtains
- fairy lights
- your pet's colour and name
- backdrop: what you see around the room (blurred home background by default, or a gradient, photo, upload or link)
- wall posters: three frames on the left wall for your own pictures (upload, paste a link, or pick from your studio images)
- which pieces are in the room

**Arrange** (move button): drag furniture across the floor, and the clock, poster, calendar and corkboard along their walls. Press **R** to rotate. Everything on the desk moves with the desk, labels follow what you move, and friends' cushions stay around the rug. The layout saves automatically, and the customise panel can reset it.

**Music without ads** (Music panel):
- YouTube links (songs and playlists) play with no ads, video included, through Invidious servers, open-source YouTube front ends that fetch the streams for you. FOKUS reads the live list at api.invidious.io once a day and uses the healthiest public servers that allow other websites, remembering the last one that worked.
- Public servers come and go. For the steadiest setup, run your own Invidious server and add it under *Use your own server*; it's always tried first.
- If no server answers (or for live streams outside Safari), YouTube's own player takes over and a note says ads are possible.
- Radio: ten ad-free live stations (lofi, chillhop, jazz, ambient…). Their sound drives the visualiser directly.
- Music plays through the page itself, so it keeps going with a phone's screen locked and shows lock-screen controls.

**Ambient sounds** (in the Music panel): rain, fireplace, wind, brown noise and typing. They're generated live in the browser, so there are no audio files. So are the cat's meows and purr and the toys' sounds.

**Visualiser** (Music panel): bars or a wave along the bottom of the screen, plus the room's speaker and fairy lights. Ambient sounds drive it directly. YouTube plays in a sealed frame the page can't listen to, so while it plays the bars keep a gentle made-up groove. Click **React to YouTube** and share this tab with its audio to make them follow the real music.

**Study together** (people icon): create a room and share the code. Friends appear sitting in your study
room with their live timer and task. You can start a group focus, keep timers in sync, and chat. Rooms
run through five free public relay servers at once (two MQTT brokers plus three Nostr relays on the normal web port), with no accounts, so they work across different networks, even ones that block unusual ports. Friends need to open the
same app, so host it online (e.g. GitHub Pages) and send them the invite link. To try it alone, open a
second browser window and join your own room.

## Backgrounds and the Aesthetic studio

Set a background per mode in **Settings → Background**. Choose a gradient, a photo, an animated lofi
stream (muted YouTube), your own image or video upload, or any image, video or YouTube link.

**Aesthetic studio** (sparkle icon in the app window):
- Drop in pictures, or browse any public GitHub repo of images (e.g. `D3Ext/aesthetic-wallpapers`).
- It extracts the palette and builds a matching gradient, accent colour and text colour.
- GitHub images can also become backgrounds or stickers directly.
- Save a look to switch back to it in one click.

## Live

https://vedjamkar.github.io/fokus/ (GitHub Pages; every push to `main` updates it in about a minute). Invite links for Study together work from there.

Open copies of the app check `version.json` every few minutes and refresh themselves when it changes. Run `./release.sh` before committing a change so everyone picks it up.

## Run it locally

```bash
python3 serve.py
```

Then open http://localhost:5173. Always use the same address and port: the browser keeps your data
per address, so a different port means an empty app.

## Where your data lives

Everything saves in this browser (localStorage). Uploaded PDFs are stored separately in the browser
(IndexedDB). Use **Settings → Export backup** now and then; the backup holds everything except uploaded PDFs.

## Writing notes

| Type this | You get |
|---|---|
| `==text==` | highlighter |
| `Term :: definition` | a definition row |
| `> [!tip] Title` | a callout (note, tip, warn, exam, example, summary) |
| `- [ ] task` | a checkbox you can tick in reading view |
| `$x^2$`, `$$…$$` | math |

Pick a paper per note: ruled notebook, clean, graph paper, or Cornell. In Cornell, each `##` heading
becomes a cue in the left column, and a `> [!summary]` callout fills the bottom box.

## Files

- `index.html`: page shell and the music dock
- `styles.css`: all themes are token sets at the top
- `js/store.js`: data model, example data, file storage
- `js/app.js`: pages, timer, stickers, settings
- `js/md.js`: turns markdown into note sheets
- `js/player.js`: YouTube IFrame player wrapper
