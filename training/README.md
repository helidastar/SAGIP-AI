# Training Our Own Incident Classifier

How to collect photos, prepare them, and train the model used by the `local` AI provider.
Everything here is free: public datasets, Google Colab, and our own server.

**Related:** training notebook → [`sagip_classifier_colab.ipynb`](sagip_classifier_colab.ipynb) · benchmark → [`benchmark/README.md`](../benchmark/README.md) · AI log → [`docs/handoffs/ai-benchmarking.md`](../docs/handoffs/ai-benchmarking.md)

## 1. Where to get photos

Download these yourself: most need a free Kaggle or Hugging Face account, and you must accept each license.
Read the license before use. All of these allow academic use; most are **non-commercial only**, which fits a thesis.

| Dataset | Covers | Fit for SAGIP-AI | Link |
|---|---|---|---|
| Disaster Damage 5-Class (~9,000 images) | fire, smoke, flood, landslide, earthquake, normal | Good. Ground-level photos | [Kaggle](https://www.kaggle.com/datasets/sarthaktandulje/disaster-damage-5class) · [GitHub](https://github.com/sarthaktandulje/Disaster-Dataset) |
| Disasters Dataset | fire, flood, earthquake, neutral | Good | [Kaggle](https://www.kaggle.com/datasets/georgemystriotis/disasters-dataset) |
| Disaster Images Dataset | several disaster types | Good | [Kaggle](https://www.kaggle.com/datasets/varpit94/disaster-images-dataset) |
| Disaster Images Dataset (CNN Model) (~4,500 images) | 4 natural disaster types | Good | [Kaggle](https://www.kaggle.com/datasets/mikolajbabula/disaster-images-dataset-cnn-model) |
| CrisisMMD (~18,000 images, CC BY-NC-SA 4.0) | real disaster tweets: damage, injured people, rescue | Good for real-world, messy photos. Labels are by category, not type; sort by hand | [CrisisNLP](https://crisisnlp.qcri.org/crisismmd.html) · [Hugging Face](https://huggingface.co/datasets/QCRI/CrisisMMD) |
| MEDIC (QCRI) | disaster type, damage severity, humanitarian category | Good. Includes damage severity labels | [Hugging Face](https://huggingface.co/datasets/QCRI/MEDIC) |
| C2A | fire/smoke, flood, collapsed building, traffic accident | Mostly aerial/drone views; use a few only | [Kaggle](https://www.kaggle.com/datasets/rgbnihal/c2a-dataset) |
| AIDER | flood, fire, collapsed building, traffic accident (aerial) | Drone views, unlike citizen phone photos; use sparingly | [GitHub](https://github.com/ckyrkou/AIDER) |
| Incidents1M (~977,000 images, 43 incident types) | very broad, incl. accidents and damage | Large, but images must be downloaded from URLs; many links are dead | [Paper](https://arxiv.org/abs/2201.04236) |

More lists: [Benchmark Datasets for Machine Learning for Natural Disasters](https://roc-hci.github.io/NADBenchmarks/).

### Gaps to fill yourselves
Public datasets cover fire, flood, landslide and collapsed buildings well. They are weak on:
- **medical_emergency** (few public photos, and privacy concerns)
- **fallen_debris** (fallen trees, downed power lines)
- **road_accident** at street level (most public sets are aerial)

For these, take your own photos (staged or of real scenes, without identifiable faces or plate numbers), or use Philippine news photos only with permission. Add photos from local settings too, like flooded barangay streets and jeepneys, because the model learns what it sees.

### Mapping dataset classes to ours
| Dataset label | Our folder |
|---|---|
| fire, wildfire, smoke (with visible fire) | `fire` |
| flood, water disaster | `flood` |
| landslide, mudslide | `landslide` |
| traffic accident, car crash | `road_accident` |
| earthquake damage, collapsed building, rubble | `structural_damage` |
| injured people, rescue of injured | `medical_emergency` |
| fallen tree, debris on road | `fallen_debris` |
| normal, neutral, non-disaster | `other` |

Skip labels that don't clearly fit (for example "smoke only" or "hurricane" without visible damage), and look at the photos rather than trusting the dataset label blindly.

## 2. Prepare the photos

1. Sort photos into `training/raw/<type>/`. Folder names must match exactly (`fire`, `flood`, `landslide`, `road_accident`, `structural_damage`, `medical_emergency`, `fallen_debris`, `other`). Subfolders inside are fine, e.g. `training/raw/flood/kaggle-disasters/`.
2. Check first (writes nothing):
   ```bash
   npm run dataset:prepare -- --dry-run
   ```
3. Build the sets:
   ```bash
   npm run dataset:prepare
   ```

The script removes unreadable and tiny photos and duplicates (including resized copies, keeping the largest), flags photos filed under two types, and shrinks everything to 1024 px. It also moves 6 photos per type into `benchmark/dataset/` so they are **never trained on**.

4. Open `benchmark/dataset/labels.csv` and fill in the **severity** of each photo (`low`, `moderate`, `high`, `critical`). A description is optional. Check it with `npm run benchmark -- --dry-run`.
5. Added more photos later? Rebuild only the training set, keeping your filled-in benchmark:
   ```bash
   npm run dataset:prepare -- --holdout 0
   ```
   Photos already in the benchmark are automatically kept out of training.

`training/raw/`, `training/dataset/` and the model file are git-ignored. Share photos through Google Drive, not the repository.

**Target:** at least 100 training photos per type (the script shows how many are missing), 300 is better.

## 3. Keep growing the set from real reports (ongoing)

Once the app is live, every report an admin corrects or confirms in the review queue is a
free, human-verified label. Pull those into `training/raw/` alongside the public datasets:

```bash
npm run export:training-data -- --dry-run   # preview: what would be exported, per type
npm run export:training-data                 # download the photos
```

**Privacy:** these are real citizen photos and may show faces or plate numbers. Blur or remove
those before training, keep `training/raw` inside the team, and say in the thesis how consent
and anonymity are handled.

Only reports with a human review (`reviews.final_type`) are exported by default — an unchecked
AI guess isn't a trustworthy label. It's safe to run on a schedule (weekly is enough): already-
exported photos are skipped, nothing is re-downloaded or duplicated.

**Team habit:** review the queue as part of normal ops (you're already doing this), then once a
week someone runs the export above and re-runs `npm run dataset:prepare` to fold the new photos
into the training set before the next Colab run.

## 4. Train
1. Zip the `training/dataset` folder itself, so the zip contains `dataset/<type>/...`. On Windows, right-click the folder, then **Compress to ZIP file**.
2. Upload it to Google Drive as `MyDrive/sagip/dataset.zip`.
3. Open the notebook in [Colab](https://colab.research.google.com) (**File → Upload notebook**), set **Runtime → Change runtime type → T4 GPU**, then **Runtime → Run all**.

## 5. Use the model
1. Download `sagip-classifier.onnx` and `labels.json` from `MyDrive/sagip/runs/<date>/` into `models/`.
2. Compare it with Gemini on the benchmark photos:
   ```bash
   npm run benchmark -- --models local,gemini:gemini-3.1-flash-lite --concurrency 1 --yes
   ```
3. If it performs well, set `AI_PROVIDER=local` in `.env.local` (see [DOCUMENTATION.md Appendix B.6](../docs/DOCUMENTATION.md)).
