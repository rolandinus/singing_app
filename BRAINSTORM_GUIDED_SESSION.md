# Singing App — Guided Session Brainstorming Report

*March 2026 — Design & Direction Ideas*

---

## Overview

The app currently has solid mechanics: pitch detection, interval exercises, melody singing, and a progression engine. What it lacks is **musical intelligence and narrative**. Right now the guided session just picks the weakest skill and throws random exercises at it. This report explores how to turn that into something that genuinely teaches people to sing — and keeps them coming back.

The target user: an amateur who sings in the shower, wants to join a choir someday, or just wants to understand why they sound off. They are not studying for a conservatory audition. They want to feel progress and have fun.

---

## 1. Core Philosophy: Music First, Theory Second

The biggest trap singing apps fall into is front-loading music theory. Real singers learn by *hearing and doing*, not by reading about interval classes. Theory should live in the background — it explains *why* something works, not *how* to do it.

**Design principles:**
- Teach concepts through repetition and recognition, not explanation
- When theory is surfaced, make it feel like a helpful insight, not a homework assignment
- Every abstract concept should be anchored to something the user already knows (a familiar song, a physical sensation)
- Celebrate small wins constantly — singing is vulnerable, encouragement matters

---

## 2. Musical Learning Path — What to Actually Teach

### The Problem With "Random"

Currently, sing_melody generates random notes from the natural note pool with step sizes 1–3. This can produce anything from beautiful scale fragments to awkward, unsettling lines that are genuinely hard to sing. A beginner will fail these not because they can't sing, but because the melody itself is acoustically difficult.

### A Structured Interval Curriculum

Not all intervals are created equal. Some are easy to sing and instantly recognizable; others are notoriously tricky. Here is an evidence-based order for introducing them:

| Stage | Interval | Semitones | Memory Hook | Why First |
|-------|----------|-----------|-------------|-----------|
| 1 | Perfect 5th (P5) | 7 | "Twinkle Twinkle" | Strong, open, easy to feel |
| 1 | Major 3rd (M3) | 4 | "Oh When the Saints" | Bright and very recognizable |
| 1 | Minor 3rd (m3) | 3 | "Smoke on the Water" | Dark counterpart to M3 |
| 2 | Perfect 4th (P4) | 5 | "Here Comes the Bride" | Stable, common in folk music |
| 2 | Major 2nd (M2) | 2 | "Happy Birthday" (opening) | Scale steps — the most natural motion |
| 3 | Octave (P8) | 12 | "Somewhere Over the Rainbow" | Dramatic, satisfying |
| 3 | Major 6th (M6) | 9 | "My Bonnie Lies Over the Ocean" | Bright leap |
| 3 | Minor 6th (m6) | 8 | "The Entertainer" | Melancholic |
| 4 | Minor 7th (m7) | 10 | "Star Trek theme" | Edgy, cool |
| 4 | Tritone (TT) | 6 | "The Simpsons theme" | The "danger" interval — fun to learn |
| 5 | Minor 2nd (m2) | 1 | "Jaws theme" | Tense, chromatic — needs care |
| 5 | Major 7th (M7) | 11 | "Take On Me" | Dissonant, advanced |

Instead of unlocking intervals purely by level number, the app could **explicitly introduce one new interval per milestone** and build exercises around it.

### The Pentatonic Gateway

The five-note pentatonic scale (C–D–E–G–A) is magical for beginners:

- **No note clashes** — any combination sounds musical
- Used in folk music, blues, pop, and children's songs worldwide
- Easy to sing because it avoids the tricky minor 2nd and tritone
- Provides an immediate sense of success

Level 1 melodies built exclusively from pentatonic notes would sound satisfying even when sung imperfectly. This alone would dramatically improve the beginner experience.

**Pentatonic → Diatonic → Chromatic**: a natural progression for melody content.

### Scale Degrees as Landmarks

Instead of just MIDI numbers, thinking in terms of **scale degrees** opens up meaningful structure:

- Degree 1 (Do / tonic): home, stable, always feels resolved
- Degree 3 (Mi): warm, major-sounding
- Degree 5 (Sol): open and strong
- Degree 7 (Ti): tension — wants to resolve up to tonic
- Degree 4 (Fa): subdominant — wants to resolve down

Melodies that **start and end on degree 1** feel complete and are easier to remember. Currently the app can generate melodies that start and end anywhere, which feels random and is harder to evaluate subjectively.

---

## 3. Smarter Melody Generation

### Idea A: "Musical Shape" Templates

Give melodies a recognizable shape. Instead of random walks, use templates:

- **Arc**: starts low, rises to a peak, returns (most singable)
- **Descent**: starts high, comes down (calming, natural)
- **Ascent**: builds up (energizing)
- **Wave**: alternates up-down-up (interesting, but harder)

Each template is just a tendency (60–70% probability), not a rigid rule. This creates melodies that feel composed, not generated.

### Idea B: Chord-Skeleton Melodies

1. Choose a chord (e.g., C major = C–E–G)
2. Place chord tones on beats 1 and 3 (strong beats)
3. Fill remaining beats with neighboring scale notes
4. Result: a melody that outlines the harmony, sounds musical, and teaches interval recognition implicitly

User sees: "Sing this melody over a C major chord"
User learns (without being told): what a C major arpeggio sounds like

### Idea C: Named Short Patterns

Instead of entirely generated melodies, offer recognizable short patterns:

- **Do–Re–Mi–Re–Do** (simple step scale)
- **Do–Mi–Sol** (major triad up)
- **Sol–Mi–Do** (major triad down)
- **Do–Re–Mi–Fa–Sol** (scale fragment)
- **Do–Mi–Sol–Mi–Do** (arc over chord tones)

These can be transposed to any key, used at any level, and have the advantage of being repeatable — the user builds memory of specific shapes.

### Idea D: Call and Echo

Show a 3–4 note phrase. User hears it played. User sings it back. Then the app shows a slight variation and repeats. This is how children naturally learn songs, and how most vocal teachers work. It is also forgiving — a small mistake is still a near-correct answer.

---

## 4. Guided Session Redesign

### Current Structure

```
weakest skill → 40% focus + 40% mixed + 20% review
```

This is statistically sensible but musically hollow. Every session feels the same.

### Idea A: Thematic Sessions

Group exercises around a **musical theme** for each session. Examples:

**"The Perfect Fifth" session:**
- Aural: hear two P5 intervals, identify them
- Sing: match a P5 above a reference note
- Melody: sing a melody built around P5 leaps
- Visual: identify P5 on the staff
- Closing: "You practiced the interval that opens Twinkle Twinkle!"

**"Home Base" session (tonic-focused):**
- Hear a scale, identify where Do (tonic) is
- Sing: match the tonic after hearing a scale fragment
- Melody: all melodies start and end on C

**"Major Triad" session:**
- Sing Do–Mi–Sol and back
- Melody built on C–E–G
- "You sang the notes of a C major chord today"

Each session has a coherent musical identity. The user walks away having practiced *one thing well* rather than touching everything briefly.

### Idea B: The Learning Map (Skills as a Journey)

Replace the abstract "skill map" with a visual journey — a path through musical concepts:

```
[ Unison ] → [ Steps ] → [ Thirds ] → [ Fifths ] → [ Triads ] → [ Scale ] → [ Leaps ] → ...
```

Each node is not just a skill but a **musical concept**. Unlocking "Thirds" means you've earned it through the "Steps" stage. This gives the user a clear sense of direction and progress even if they don't know music theory.

Under the hood it maps to the existing skill structure — but the framing changes from "you are practicing interval_aural level 3" to "you are exploring the world of thirds."

### Idea C: Micro-Lessons Before Exercise Batches

Before each new concept is introduced (once only, not every time), show a 3-second card:

> **"The Perfect Fifth"**
> This interval feels wide open and strong. You hear it in "Twinkle Twinkle" (the jump from "Twin" to "kle"). Let's practice it!

Dismiss to continue. Never shown again for that concept. Completely optional to read.

This tiny framing moment gives meaning to what they are about to do without feeling like a lecture.

### Idea D: Spaced Repetition for Intervals

The current rolling window tracks mastery per skill at a coarse level. More granular tracking would be powerful:

Track accuracy **per specific interval** (not just per skill):
- "User gets P5 right 90% of the time"
- "User gets m6 right 40% of the time"

Guided sessions then target the specific weak intervals, not just the weak skill family. Two users both at "interval_aural level 2" could be practicing completely different intervals.

This could live entirely in the background — the user just notices that they keep seeing m6 exercises more often without understanding why.

---

## 5. Engagement & Motivation

### Idea A: Vocal Range Tracking

One of the most satisfying things for a singer is to **know their range is growing**. After each session, the app knows the highest and lowest notes the user successfully sang. A simple "Your range today: C3 to G4" with a small graph over time would be deeply motivating.

A subtle animation could show the range expanding slightly when a new high or low note is successfully hit.

### Idea B: Real-Time Pitch Visualization

Currently the user sings and gets a pass/fail. A **live pitch needle** (like a tuner) that shows how close they are in real time would:

- Give immediate feedback on direction (too high vs too low)
- Help users understand *how* to adjust, not just that they're wrong
- Be engaging to watch — it's like a game

A simple arc or vertical bar that lights up green when in the target zone works perfectly. This is a UI feature but with huge pedagogical impact.

### Idea C: "Warm Up With Me" Session Opener

The first 60 seconds of a session could be a guided vocal warm-up:

1. **Hum a comfortable mid-note** (just get the voice working)
2. **Siren: slide from low to high** (opens up the range)
3. **Find your Do** (sing the tonic, establishing home base)

No scoring, no pressure. Just a ritual that prepares the voice and sets the musical key for the session. Singers of all levels do this. It signals: "this is singing time."

### Idea D: Post-Session Insight

After each session, one personal insight — not just a score:

- "You sang the major third cleanly 8 out of 10 times. That's your best interval!"
- "Your pitch was a bit flat today — try supporting with more breath"
- "New personal best: you reached A4 for the first time!"
- "You've practiced 4 days in a row. Your voice is learning!"

One insight, friendly tone, no jargon. This is what keeps people coming back — feeling *seen* by the app.

### Idea E: Practice Streaks & Tiny Celebrations

- Daily streak counter (visible but not anxiety-inducing)
- Small animation when a new interval is "unlocked" or mastered
- "First time you sang a perfect fifth!" badge, shown once and quietly stored
- No leaderboards — this is a personal journey, not a competition

### Idea F: The "Exploration Mode"

No scoring. No judgment. Just:
- Play any note
- The app plays it back
- Slide a pitch wheel and hear different notes
- Tap an interval name and hear what it sounds like

This is the sandbox. It builds musical intuition without pressure. Some users will spend more time here than in formal exercises. That is completely fine — it is still learning.

---

## 6. Practice Session Formats

### "Quick Spark" (2–3 minutes)
- 5 exercises only
- One skill focus
- For commuters or busy days
- Counts toward streak

### "Full Session" (10–15 minutes)
- Warm-up + focus exercises + mixed review
- Thematic structure (one musical concept per session)
- Post-session insight

### "Deep Dive" (20–30 minutes)
- Extended focus on one challenging area
- More repetitions with slight variations
- Includes a "mastery check" at the end

### "Free Exploration" (unlimited)
- Sandbox mode — no scoring
- Try anything, hear anything
- Good for curious beginners before they commit to formal practice

---

## 7. Content That Teaches Without Preaching

### The Solfège Option

Solfège (Do–Re–Mi–Fa–Sol–La–Ti–Do) is beloved by choral singers and vocal teachers. As an optional display setting:

- Show solfège syllables alongside note names
- "Sing Mi–Sol–Do" instead of "Sing E4–G4–C5"
- Feels more musical, less technical
- Can be toggled off for users who prefer traditional notation

### Song Anchors for Intervals

Show a tiny mnemonic alongside each interval during the learning phase:

> **"große Terz"** *(Major Third)*
> Think of: "Oh When the Saints Go Marching In"

This uses existing musical memory — every user already knows dozens of songs. Anchoring intervals to songs is the oldest and most effective ear training technique. It stays in the background and is never mandatory.

### "Did You Know?" Cards

Occasional one-sentence music facts, shown at session end:

- "The Perfect Fifth is so stable that medieval musicians thought adding a third was dissonant."
- "The pentatonic scale — just 5 notes — is used in virtually every musical culture on Earth."
- "Most children's songs use only stepwise motion (adjacent notes) because it's the most natural for the voice."

Light, interesting, never tested on.

---

## 8. Technical Directions (Without Coding Details)

### A: Interval Taxonomy in the Generator

Tag each generated exercise with the specific interval(s) it contains. Track accuracy per interval tag. This enables fine-grained weak-point detection without the user knowing it is happening.

### B: Key-Fixed Melody Generation

Pin melodies to a specific tonic (C by default, adjustable). All notes come from C major, C minor, or C pentatonic. This ensures every generated melody is in a coherent key and can be compared across sessions.

### C: Contour-Controlled Melody Generator

Instead of random walks, parameterize melody shape:
- Target contour (arc, descent, etc.)
- Stability of landing notes (prefer chord tones on beats 1/3)
- Maximum leap size by level

### D: Interval Curriculum Config

A declarative config (not just level numbers) that says:
- Level 1 intervals: P5, M3
- Level 2 intervals: m3, P4, M2
- Level 3 intervals: P8, M6
- etc.

This makes the curriculum easy to adjust without touching exercise logic.

---

## 9. Big Picture Directions — Choose One

These three directions represent different philosophical bets:

---

### Direction 1: "The Musical Journey" 🗺️

Build the app around a **story map** — a visual path through musical concepts from first steps to advanced skills. Each node on the map is a small musical concept (a specific interval, a chord, a scale). Completing a concept unlocks the next. The user always knows where they are and where they're going.

**Strengths:** Clear progress, sense of achievement, easy to explain to friends ("I'm on the thirds section!"), great for motivation
**Tradeoffs:** Needs content design upfront, less flexible

---

### Direction 2: "The Intelligent Ear Trainer" 🧠

Keep the session-based structure but radically improve the intelligence underneath. Track every interval individually, use spaced repetition, adapt to the user's specific weak points. Sessions look similar to now but feel much more targeted.

**Strengths:** Works with existing UI, most improvement per line of code, invisible to user (magic happens in background)
**Tradeoffs:** Less visible progress narrative, users may not notice improvements

---

### Direction 3: "The Musical Playground" 🎮

Lean into exploration, play, and low-stakes discovery. Real-time pitch feedback, sandbox mode, thematic "worlds" to explore (the world of fifths, the world of blues notes). Score less, explore more. Make it feel like a musical toy rather than a training app.

**Strengths:** Most fun, lowest anxiety, great for complete beginners, highly shareable
**Tradeoffs:** Harder to measure progress, may not satisfy users who want structured improvement

---

### Recommendation: Hybrid of 1 + 2

The **Journey Map** (Direction 1) provides the visible story and motivation. The **Intelligent Ear Trainer** (Direction 2) provides the pedagogical depth. Together: a clear path forward for the user, with smart content adaptation underneath. Direction 3's sandbox/exploration features can be added as a "free play" section without affecting the main flow.

---

## 10. Quick Wins vs. Big Bets

### Quick Wins (low effort, high impact)

| Idea | Impact | Why Easy |
|------|--------|----------|
| Pentatonic melody mode | High | Just constrain note pool to 5 notes |
| Song mnemonic cards for intervals | Medium | Static content, shown once |
| Post-session insight text | High | Template strings based on existing data |
| Melody starts/ends on tonic | Medium | Small generator change |
| Contour bias (arc tendency) | Medium | Weight direction probabilities |
| Interval-specific tracking | High | Add a tag to existing exercise data |

### Big Bets (higher effort, transformational)

| Idea | Impact | Why Hard |
|------|--------|----------|
| Journey Map (visual path UI) | Very High | New screen, content design, UX |
| Real-time pitch needle | Very High | Continuous audio analysis + rendering |
| Spaced repetition per interval | High | New progression logic, data model |
| Thematic session templates | High | New session planner concept + content |
| Vocal range tracker | Medium | Persistent pitch history |
| Warm-up flow | Medium | New exercise type, guided audio |

---

## 11. Open Questions for the Next Conversation

1. **Should the app teach in a fixed key (C major) or adapt to the user's comfortable range?**
   C major is pedagogically clean and visually obvious. Adapting to vocal range is more musical but more complex.

2. **How much UI real estate for theory/context?**
   More context = more learning but more friction. Less = cleaner but users learn less about *why*.

3. **What is the target session length?**
   5 minutes → maximize engagement/accessibility. 15–20 minutes → more substantial learning.

4. **Do we want a "song fragments" feature?**
   Using 4-bar fragments from actual folk songs or children's songs as exercises would be very engaging — but requires a song library.

5. **Solfège — yes or no?**
   Great for vocal training tradition. Might confuse users unfamiliar with it.

6. **How gamified should this be?**
   Badges and streaks motivate some users and stress out others. A light touch is probably right for this audience.

---

*End of brainstorm. The ideas above span from small generator tweaks to full redesigns — all in service of making this a genuinely musical and engaging learning experience for casual singers.*
