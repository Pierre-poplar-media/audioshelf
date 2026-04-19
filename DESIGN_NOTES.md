# AudioShelf — Design Notes

## The core question

Every UX decision here passes through one filter: *what does a person who has loaded their own audiobooks want?* They don't want discovery, recommendations, or social proof. They want to find their book, press play, and have the app remember exactly where they were.

---

## Persistent mini-player (from Spotify)

**Decision: steal Spotify's bottom bar exactly.**

Spotify invented the pattern where a mini-player sits at the bottom of every screen, always visible, always tappable. Before this, every music app made you navigate back to the "now playing" screen to pause. The persistent bar means you can browse your library without losing your place visually.

Audible doesn't do this well — their mini-player disappears on some screens and requires a swipe to access. We copied Spotify here completely.

The bar shows: cover art, title, position/duration, skip back 30s, play/pause, skip forward 30s, expand chevron. Tapping anywhere expands to the full player.

**The 30-second skip** is Audible's standard, not Spotify's 15s. 15 seconds is fine for music but too short for audiobooks — you typically zone out for longer than 15s. 30s is the audiobook convention and listeners have muscle memory for it.

---

## Resume prompt behavior

**Decision: 10-minute threshold, human-readable timestamp.**

Audible prompts you when you return after >10 minutes. Spotify doesn't prompt at all — it just resumes (which works for music, not for a 20-hour book).

We copied Audible's approach: if you closed the app/tab within 10 minutes, auto-resume silently. After 10 minutes, show a prompt: "You were 4h 12m in — resume?" This uses `formatPosition()` to show human-readable time, not raw seconds.

The sleeper use-case: when the sleep timer fires, we auto-bookmark the position as "Sleep timer — [timestamp]" so the user wakes up and can find exactly where they drifted off.

---

## Chapter-aware scrubber

**Decision: chapters as first-class UI, not metadata afterthought.**

Audible shows chapter markers on the scrubber and has "next/previous chapter" as primary controls. Spotify has no concept of chapters. We followed Audible.

The full player shows chapter tick marks on the scrubber (via the chapter list panel), and the current chapter name appears under the book title. The chapter list panel slides in when you tap the book icon — you can jump to any chapter with one tap.

For the chapter-skipper use-case (zoned out for a full chapter): tap the book icon, see the chapter list, tap the previous chapter. One screen, two taps.

---

## Sleep timer with fade-out

**Decision: 10-second fade using Web Audio API GainNode.**

An abrupt cutoff wakes people up. Audible fades out, and so do we. The implementation:
1. 10 seconds before the timer expires, we start fading `GainNode.gain.value` from 1.0 → 0.0 over 100 steps of ~100ms each.
2. At t=0, we pause playback, auto-bookmark the position, and restore volume for next time.
3. If the user taps the screen during the fade (cancel intent), we cancel the interval and restore full volume.

We use `GainNode` rather than `HTMLAudioElement.volume` because (a) it supports volume above 1.0 for the "volume boost" feature, and (b) it gives smoother control over gain curves.

---

## Volume boost (up to 200%)

**Decision: GainNode, with iOS caveat disclosed.**

Some narrators whisper. Some recordings have very low gain. Audible addresses this with a volume boost setting. We do too, via Web Audio API's `GainNode` — you can set gain above 1.0, which amplifies the signal.

**iOS caveat:** iOS Safari limits the hardware output volume via system controls. A GainNode with gain=2.0 will push the signal harder, but the actual perceived boost depends on the iOS volume setting and speaker hardware. On desktop Chrome/Firefox this works as expected.

---

## Library layout

**Decision: cover-art-first grid, not a list.**

Spotify's library is shifting toward a grid with large artwork. Audible's library is a list with small thumbnails. For a personal collection of 20–200 books, a visual grid where each cover is immediately recognizable wins. Your eye finds "the one with the red cover" faster than scanning text.

We use a 2-col grid on mobile, 3-col on sm, 4-col on md, 5-col on lg. The cover fills the top 75% of the card. Title and author are below. A thin progress bar sits between the cover and the text.

---

## What we did better than both

**Zero-friction upload:** drag files onto the library page. No "Add book" → fill form → upload steps. Just drop.

**Editable metadata:** the app parses M4B/MP3 tags automatically but you can edit anything. Audible won't let you fix a wrong title.

**Progress on every device:** Supabase stores position and syncs on every play/pause/5s interval. Open the same book on another device and it resumes from where you were.

**No shuffle, no autoplay into "similar":** these features make sense for music, not for a 20-hour book you're working through deliberately.
