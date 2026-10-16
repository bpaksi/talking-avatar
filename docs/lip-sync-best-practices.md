# Best Practices for Hand-Drawn Lip-Sync Animation

## Direct answer

Yes. The established method is **lip-sync animation**: record the dialogue first, break the soundtrack into speech sounds called **phonemes**, and map groups of visually similar sounds to reusable drawings called **visemes**. You normally do **not** need one drawing per letter or even one per phoneme, because many sounds look identical on the lips.[^1][^2]

For this project the required kit is **eight drawings**: REST, MBP, CONS/EE, EH/AE, AH, OH/ER, OO/W, and FV. **L** and **TH** are optional and are drawn only when a line test shows the required kit cannot show that sound. Rhubarb’s letters A–F are its basic poses, G is FV, H is L, and X is rest; this project requires X and A–G.[^3][^4]

## Recommended mouth set

| ID | Visual pose | Typical sounds | Notes |
|---|---|---|---|
| REST | Relaxed or closed | Silence, pauses | Distinct from a forcefully closed consonant pose if the design supports it. |
| MBP | Lips pressed together | **M, B, P** | One of the most important anchor poses; the closure generally begins just before the audible release.[^5][^6] |
| CONS/EE | Slightly open; teeth close or visible | **S, Z, T, D, K, G, N, Y**, and often **EE** | A useful catch-all pose for many consonants.[^3][^4] |
| EH/AE | Medium, horizontally open | **E** in “men,” **A** in “cat” | Also works as a transition between closed and wide-open poses.[^3] |
| AH | Wide open, jaw dropped | **AH/AA** as in “father” | Usually the largest jaw opening.[^3][^4] |
| OH/ER | Rounded and somewhat open | **O/AW**, often **ER** | A bridge between open and tightly rounded poses.[^3] |
| OO/W | Puckered or tightly rounded | **OO, U, W**, and some **OW** sounds | Make this visually different from AH and CONS/EE.[^3][^4] |
| FV | Upper teeth on lower lip | **F, V** | Required in this project’s kit.[^3] |
| L | Tongue behind upper teeth | **L** | Optional; useful mainly in close shots or a detailed style.[^3][^4] |
| TH | Tongue briefly between teeth | **TH** | Optional. Rhubarb has no TH letter, so this pose is placed with an override.[^5][^7] |

This project’s required kit is those eight drawings. L and TH stay optional.

Other tools use different counts. Adobe Character Animator uses 11 audio-driven visemes plus three silent/expression states, Toon Boom’s standard chart uses six core labeled drawings, and some 3D systems use around 15 shape keys. Those counts are not this project’s kit. More drawings increase setup and correction work; they do not automatically make the result more convincing.[^8][^9][^10]

## Sounds, not letters

Do not map written letters directly to drawings. Map the **sound actually spoken**. The letter “c,” for example, can sound like **K** in “cat” or **S** in “city,” while combinations such as “sh,” “th,” and “oo” represent sounds that a letter-by-letter system handles poorly.

A robust processing model is:

```text
script -> recorded performance -> timed phonemes -> viseme groups -> mouth poses
```

The script can improve recognition, but the **recorded audio is the timing authority**. Toon Boom recommends recording first, then breaking dialogue into syllables and mouth poses before drawing the final animation. Automatic systems likewise analyze the soundtrack and insert references to mouth drawings that must already exist.[^11][^9]

## Timing workflow

1. **Record and lock the final dialogue.** Do not finish lip animation from script timing alone; natural pauses, emphasis, contractions, and speaking rate come from the performance.[^12][^11]
2. **Import the audio and expose its waveform.** Enable audio scrubbing so individual sounds can be located frame by frame.[^9][^12]
3. **Mark phrases and acting beats first.** Note pauses, stressed words, hesitation, and energy changes before marking every mouth pose.[^13]
4. **Block only the strongest poses.** Start with MBP closures, large AH openings, clear OO/W rounding, and important FV or TH moments.
5. **Place anticipatory shapes slightly early.** The lips must close before a B, M, or P becomes audible; the sound often occurs as the pose releases.[^5]
6. **Hold readable shapes briefly.** Avoid changing the drawing for every tiny acoustic event. Prioritize stressed sounds and visible contrasts rather than constant mouth chatter.[^13][^5]
7. **Add transitions only where needed.** EH/AE and OH/ER can bridge extreme changes. Too many in-betweens make limited animation mushy rather than smooth.[^3][^5]
8. **Replay at normal speed repeatedly.** Judge the phrase as motion, not as isolated frames; revise shapes that feel late, noisy, or over-articulated.[^5]
9. **Add the acting pass.** Eye direction, blinks, brows, cheeks, head movement, posture, and gestures carry intention and prevent the result from looking like a moving mouth pasted onto a still face.[^11][^13]

## Coarticulation

Real speech is **coarticulated**: the mouth starts preparing for the next sound while the current sound is still being heard, and its shape depends on surrounding sounds. Research therefore treats convincing visual speech as movement and blending over time, not simply a sequence of unrelated static phoneme cards.[^14][^15][^16]

For hand animation, apply this with three simple rules:

- Let strong poses influence neighboring frames; start rounding early before **OO/W**, and begin closing early before **MBP**.
- Favor the most visually distinctive or stressed sound when several phonemes occur too quickly to show separately.
- Skip shapes that would appear for only an unreadable instant unless they create a useful transition.

This is why exact one-to-one phoneme-to-viseme tables differ across tools and research. There is no single unequivocal mapping; pronunciation, neighboring sounds, emotion, volume, speed, and character design all affect the visible result.[^15][^6]

## Drawing the library

Keep each pose registered to the same head so swapping drawings does not make the face jitter. Hold the upper teeth and skull relationship relatively stable, drive most vertical opening from the jaw, and check that extreme transitions—REST to AH, CONS/EE to OO/W, and AH to OO/W—still read as the same character.[^17]

Build the library in layers where possible:

- Base mouth/viseme drawing.
- Jaw position.
- Teeth and tongue.
- Expression overlay, such as happy, neutral, angry, or sad.
- Head-angle variant, such as front, three-quarter, or profile.

Separating expression from speech avoids multiplying every combination. If the software only supports replacement drawings, create emotion-specific mouth sets only for emotions that persist through meaningful portions of a scene. Adobe supports custom mouth sets and manual correction of generated visemes, while production workflows commonly maintain variants for expressions and viewing angles.[^18][^8]

## Automation options

| Tool/workflow | Mouth scheme | Best use |
|---|---|---|
| **Rhubarb Lip Sync** | Letters A–H and X. This project requires X and A–G (eight drawings). H (`L`) and TH are optional. | Free command-line pipeline. JSON export is `{ metadata, mouthCues }` with letter values.[^3] |
| **OpenToonz + Rhubarb** | Rhubarb-compatible set | Free 2D animation workflow with integrated automatic lip-sync support.[^19] |
| **Toon Boom Harmony** | Standard six-pose A–F chart, with manual editing | Full 2D production and drawing-substitution workflow.[^9] |
| **Adobe Character Animator** | 11 audio visemes plus neutral/expression states | Fast puppet animation from a microphone or prerecorded dialogue, followed by timeline correction.[^8][^20] |
| **Custom application/game** | Usually 6–10 sprites or blend shapes | Generate timestamped JSON/TSV and switch sprites, or blend parameters for smoother 3D motion.[^3][^16] |

For a custom TypeScript, React, canvas, or game-engine pipeline, store kit ids on a cue track. Rhubarb does not emit that track. `rhubarb --exportFormat json` writes letters:[^3]

```json
{
  "metadata": {
    "soundFile": "audio/intro-001.wav",
    "duration": 1.86
  },
  "mouthCues": [
    { "start": 0.00, "end": 0.05, "value": "X" },
    { "start": 0.05, "end": 0.42, "value": "C" },
    { "start": 0.42, "end": 0.70, "value": "F" }
  ]
}
```

`value` is a letter (`A`–`H` or `X`). TSV rows are `start<tab>letter`. Map `start` to `time`, map the letter to a kit id (A MBP, B CONS/EE, C EH/AE, D AH, E OH/ER, F OO/W, G FV, H L or EH/AE when the kit has no L, X REST), and drop `end`:

```json
[
  { "time": 0.00, "shape": "REST" },
  { "time": 0.05, "shape": "EH/AE" },
  { "time": 0.42, "shape": "OO/W" }
]
```

At playback time, a per-frame callback samples the audio element’s `currentTime` (not the `timeupdate` event, and not a separate elapsed clock while audio is playing) and binary-searches the latest cue whose `time` is not greater than that sample. Before the first cue, and when reduced motion is requested, show REST. An override file can add, replace, or remove cues after the mapping.

## Practical starting recipe

For a first test, draw the required eight: **REST, MBP, CONS/EE, EH/AE, AH, OH/ER, OO/W, and FV**. Do not draw L or TH for that test. Record a 5–10 second line containing closed lips, wide vowels, rounded vowels, and F/V sounds; generate the cue track from the audio; then correct it by eye and ear.

Add L or TH only when repeated testing shows the eight-shape kit cannot show that sound. If the dialogue still feels artificial, improve timing, holds, anticipation, expression, and head/eye acting before expanding the viseme library; those factors commonly matter more than matching every sound literally.[^13][^5]

---

[^1]: [CS205: Character Animator - Labs](https://www.labs.cs.uregina.ca/205/CharacterAnimator/)
[^2]: [Development of Real-Time Lip Sync Animation Framework Based on Viseme and Expression](https://aodr.org/_common/do.php?a=full&b=&bidx=230&aidx=2738)
[^3]: [Rhubarb Lip Sync](https://github.com/DanielSWolf/rhubarb-lip-sync)
[^4]: [Rhubarb Shape.h](https://github.com/DanielSWolf/rhubarb-lip-sync/blob/master/rhubarb/src/core/Shape.h)
[^5]: [Extended Preston Blair phoneme series - Gary C. Martin](http://www.garycmartin.com/phoneme_examples.html)
[^6]: [Viseme Variability: Gritted Teeth & Muted Speech - Face the FACS](https://melindaozel.com/viseme-variability-gritted-teeth-muted-speech/)
[^7]: [Read My Lips: Facial Animation Techniques - Game Developer](https://www.gamedeveloper.com/programming/read-my-lips-facial-animation-techniques)
[^8]: [Learn Character Animator - Creating mouth shapes - Adobe](https://www.adobe.com/learn/adobe-character-animator/web/lip-sync-mouth-shapes)
[^9]: [Harmony 25 Essentials Documentation: Animating Lip-Sync](https://docs.toonboom.com/help/harmony-25/essentials/cut-out-animation/animate-lip-sync.html)
[^10]: [Lip sync - MakeHuman Community](https://static.makehumancommunity.org/mpfb/docs/lipsync/index.html)
[^11]: [Visual Breakdown | Toon Boom Learn Portal](http://learn.toonboom.com/modules/lip-sync-animation1/topic/visual-breakdown)
[^12]: [Odds & Ends: Lip Syncing - After Effects & Animation (Spring 2017)](https://fmspracticumspring2017.blogs.bucknell.edu/2017/04/18/odds-ends-lip-syncing/)
[^13]: [Lip Sync Like a Pro: Dialogue Animation & Performance - rmcad](https://www.rmcad.edu/blog/lip-sync-like-a-pro-dialogue-animation-performance/)
[^14]: [Creating Speech-Synchronized Animation - IEEE Computer Society](https://www.computer.org/csdl/journal/tg/2005/03/v0341/13rRUxE04tq)
[^15]: [A Mouth Full of Words: Visually Consistent Acoustic Redubbing](https://la.disneyresearch.com/wp-content/uploads/A-Mouth-Full-of-Words-Visually-Consistent-Acoustic-Redubbing-Paper.pdf)
[^16]: [Learning Audio-Driven Viseme Dynamics for 3D Face Animation](https://ar5iv.labs.arxiv.org/html/2301.06059)
[^17]: [Lip Sync - Preston Blair phoneme series](http://www.natmax.com/ART292/Lip%20Sync%20-%20Preston%20Blair%20phoneme%20series.pdf)
[^18]: [Animating LIP SYNC in TOON BOOM HARMONY | Tutorial | Part 24](https://www.youtube.com/watch?v=lisoZFfhBok)
[^19]: [Using Rhubarb with OpenToonz — OpenToonz 1.7.1 documentation](https://opentoonz.readthedocs.io/en/latest/using_rhubarb_with_opentoonz.html)
[^20]: [Animated lip-syncing powered by Adobe AI](https://www.adobe.com/creativecloud/video/discover/animation-lip-sync.html)

