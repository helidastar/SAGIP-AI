# Collecting our own photos: shot list and rules

**Owner:** Ricabo, with Jayno, Hamo-ay and Fabroa · **Checklist:** AI Integration 5 · **Status:** guide ready (2026-10-29). Photos not taken yet.

Public datasets cover all 8 types now, but they are weak on Philippine street scenes and on
`medical_emergency` and `fallen_debris` (see [README.md "Gaps to fill yourselves"](README.md#gaps-to-fill-yourselves)).
Our own ground-level phone photos fix exactly that, and they show the panel that the model was tested on local scenes.

## Target (proposed, not yet agreed by the team)
| Type | Photos | What to shoot |
|---|---|---|
| medical_emergency | 40 | Staged only: a person lying on the ground, someone helping another person, a first-aid scene. Faces turned away or out of frame. |
| fallen_debris | 40 | Branches or trees across a road, downed wires (from a safe distance), rubble or signs on the road. |
| road_accident | 30 | Parked dented vehicles, tricycle or motorcycle on its side (staged), a roadside crash scene from a distance. No plate numbers. |
| flood | 30 | Flooded streets and barangay roads after rain, water at house doors. |
| structural_damage | 20 | Cracked walls, collapsed fences, damaged roofs. |
| other | 20 | Normal street scenes, a blank wall, a meme on a screen: things that are not incidents. |
| fire, landslide | 0 | Already strong in the public sets; skip unless one happens safely nearby. |

Total: 180 photos, about 45 per member.

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
