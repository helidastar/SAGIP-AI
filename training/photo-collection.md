# Collecting our own photos: shot list and rules

**Owner:** Ricabo, with Jayno, Hamo-ay and Fabroa · **Checklist:** AI Integration 5 · **Status:** guide ready (2026-10-29), target reduced 2026-11-05. Photos not taken yet. **Done 2026-11-20 with a changed scope: test on real Philippine photos, no retrain (team decision, rye). Own-photo collection and retraining moved to after the defense.**

## Outcome (2026-11-20): what AI 5 became, and why

**Decision.** AI 5 was "collect our own ground-level photos and retrain". On 2026-11-18 the team changed it to "test the frozen model on real Philippine photos", and on 2026-11-20 closed it with that scope (decided by rye; no adviser sign-off was requested).

**Why.** The Nov 18 model had just passed all three AI 25 marks. Retraining 3 to 4 days before the 24 November defense could produce a model that fails a mark with no time to fix it. The question the panel is most likely to ask is not "did you retrain" but "how does it do on real local photos", and a test answers that.

**What was done.** No team-taken photos were collected. Instead Ricabo collected real Philippine incident photos from Facebook and news. 77 were used (`benchmark/dataset/own/`, git-ignored; mapping to the original files in `mapping.csv`). They are for testing only: never used for training, never published, source stated. None is in the training set (checked by file match and image fingerprint against 10,540 training and benchmark photos). Type labels are the folder each photo was filed in, by one person; severity was not labeled.

**Result** (details in `docs/handoffs/ai-benchmarking.md`): type correct, local model 39/77 (51%), Gemini alone 59/76 (78%), local model with Gemini second opinion as the app runs 55/77 (71%), against 88% for the local model on the 50-photo benchmark. Recorded as risk R-019.

**How to say it in the defense.** "We did not retrain on our own photos before the defense. We tested the final model on 77 real Philippine incident photos from Facebook and news, used for testing only: 51% with the local model alone, 71% as the app runs with Gemini as a second opinion. That gap is why every report is confirmed by a responder. Retraining with our own phone photos is our first step after the defense."

**Not done (stated as a limit):** photos taken by the team; retraining on real local photos; severity accuracy on real photos.

The sections below are the original training plan, kept for reference. They are not in scope this round.

Public datasets cover all 8 types now, but they are weak on Philippine street scenes and on
`medical_emergency` and `fallen_debris` (see [README.md "Gaps to fill yourselves"](README.md#gaps-to-fill-yourselves)).
Our own ground-level phone photos fix exactly that, and they show the panel that the model was tested on local scenes.

**Update 2026-11-05:** staging a real-looking road accident or medical emergency ourselves takes time and isn't
something to force before a deadline, so most of that gap is now covered by four more CC BY 4.0 Roboflow Universe
datasets (road_accident +52, fallen_debris +200, medical_emergency +204 - see
[README.md's dataset table](README.md#second-training-run-2026-10-25)). The targets below are cut roughly in half
from the original plan: just enough of our own photos to cover what the public sets still can't - Philippine streets
(jeepneys, tricycles, barangay roads) and scenes that actually look like a citizen's phone photo rather than a
dataset photo.

## Target (reduced 2026-11-05; proposed, not yet agreed by the team)
| Type | Photos | What to shoot |
|---|---|---|
| medical_emergency | 15 | Staged only: a person lying on the ground, someone helping another person, a first-aid scene. Faces turned away or out of frame. |
| fallen_debris | 20 | Branches or trees across a road, downed wires (from a safe distance), rubble or signs on the road - ideally a barangay road, which the public sets don't have. |
| road_accident | 15 | Parked dented vehicles, tricycle or motorcycle on its side (staged), a roadside crash scene from a distance. No plate numbers. |
| flood | 20 | Flooded streets and barangay roads after rain, water at house doors. |
| structural_damage | 15 | Cracked walls, collapsed fences, damaged roofs. |
| other | 15 | Normal street scenes, a blank wall, a meme on a screen: things that are not incidents. |
| fire, landslide | 0 | Already strong in the public sets; skip unless one happens safely nearby. |

Total: 100 photos, about 25 per member (down from 180/45, see the 2026-11-05 update above). If there's time
closer to the defense, going back up toward the original 180 only helps - this is a floor, not a cap.

## Rules
1. **Safety first.** Never go near a real fire, flood current, landslide or downed wire for a photo.
2. **No faces, no plate numbers.** Turn faces away or crop. Staged scenes need the person's OK.
3. **Like a citizen would.** Phone camera, held normally, daylight and night, some blurry ones too.
4. **Never photograph the same scene used in the benchmark.** The benchmark sources are in `benchmark/dataset/SOURCES.md`.
5. Each member keeps photos only in the team Drive, not in personal chats.

## Naming and upload
- Drive folder: `sagip/own-photos/<type>/` (one folder per type, names as in `INCIDENT_TYPES`).
- File name: `<type>_<member>_<nn>.jpg`, for example `fallen_debris_ricabo_07.jpg`.
- Log each batch in the tracker under AI Integration 5 (count per type and who took them).

## Folding them into training
Copy each type folder into `training/raw/<type>/own-photos/` on the training laptop (for example `training/raw/flood/own-photos/`), then run:

```bash
npm run dataset:prepare -- --holdout 0 --max-size 512
```

Then zip and train in Colab as in [README.md](README.md#4-train), and rerun the 50-photo benchmark.
Pass mark: type accuracy stays at 88% or higher, and medical_emergency precision does not drop.

## Open items
- Who takes which types: not assigned yet. Suggested split: Ricabo medical + other, Jayno fallen_debris, Hamo-ay flood + structural, Fabroa road_accident.
- Deadline: the checklist says 2026-10-31. Since retraining is paused, the team should confirm a new date.
