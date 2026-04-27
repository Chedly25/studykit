#!/usr/bin/env bash
# Runner for local GPU embedding of the remaining ~4M chunks.
# Each cache file is embedded in its own subprocess with --resume, so a
# crash/kill only costs the 5k-vector flush boundary in the current file;
# the other files are unaffected and re-runs are idempotent.
#
# Launch with:
#   nohup caffeinate -i -s bash scripts/embed-all-local.sh > \
#     legal-sources-output/embed-all.log 2>&1 &
#
# Tail with:
#   tail -f legal-sources-output/embed-all.log
set -u

REPO="/Users/chedlyboukhris/Desktop/studykit"
CACHE="$REPO/legal-sources-output/cache"
LOG="$REPO/legal-sources-output/embed-all.log"

# Smallest first: text corpora → small codes → bigger → CA bulk → Cass-full.
# jade-full-caa-part000 sits here because it's a resume (only 15k left of 100k).
FILES=(
  # Tier F + G + H: text corpora (~5.5k chunks)
  "crfpa-grounding.json"
  "grands-arrets.json"
  "international-texts.json"
  "constitution.json"
  "deontologie.json"
  "lois-non-codifiees.json"
  "eu-regulations.json"
  "crfpa-official.json"
  "institutional-rapports.json"
  # Tier A extra codes (~5.3k)
  "cjpm.json"
  "coj.json"
  "cgfp.json"
  # 13 extra codes (~62k)
  "cgct.json"
  "crpa.json"
  "code-sante-publique.json"
  "code-monetaire-financier.json"
  "casf.json"
  "cgppp.json"
  "code-assurances.json"
  "code-rural.json"
  "code-transports.json"
  "code-education.json"
  "code-postes.json"
  "code-sport.json"
  "code-defense.json"
  # CJUE (~161k)
  "cjue-part000.json"
  "cjue-part001.json"
  "cjue-part002.json"
  "cjue-part003.json"
  # JADE CAA resume: ~15k remaining
  "jade-full-caa-part000.json"
  # CA 2019–2021 (~107k)
  "ca-bulk-2019.json"
  "ca-bulk-2020.json"
  "ca-bulk-2021.json"
  # CA 2022–2026 parts (~2.4M)
  "ca-bulk-2022-part000.json"
  "ca-bulk-2022-part001.json"
  "ca-bulk-2022-part002.json"
  "ca-bulk-2022-part003.json"
  "ca-bulk-2022-part004.json"
  "ca-bulk-2023-part000.json"
  "ca-bulk-2023-part001.json"
  "ca-bulk-2023-part002.json"
  "ca-bulk-2023-part003.json"
  "ca-bulk-2023-part004.json"
  "ca-bulk-2023-part005.json"
  "ca-bulk-2023-part006.json"
  "ca-bulk-2024-part000.json"
  "ca-bulk-2024-part001.json"
  "ca-bulk-2024-part002.json"
  "ca-bulk-2024-part003.json"
  "ca-bulk-2024-part004.json"
  "ca-bulk-2024-part005.json"
  "ca-bulk-2024-part006.json"
  "ca-bulk-2025-part000.json"
  "ca-bulk-2025-part001.json"
  "ca-bulk-2025-part002.json"
  "ca-bulk-2025-part003.json"
  "ca-bulk-2025-part004.json"
  "ca-bulk-2025-part005.json"
  "ca-bulk-2025-part006.json"
  "ca-bulk-2026-part000.json"
  "ca-bulk-2026-part001.json"
  # Cass-full 1990–2026 (~819k)
  "cass-full-1990.json"
  "cass-full-1991.json"
  "cass-full-1992.json"
  "cass-full-1993.json"
  "cass-full-1994.json"
  "cass-full-1995.json"
  "cass-full-1996.json"
  "cass-full-1997.json"
  "cass-full-1998.json"
  "cass-full-1999.json"
  "cass-full-2000.json"
  "cass-full-2001.json"
  "cass-full-2002.json"
  "cass-full-2003.json"
  "cass-full-2004.json"
  "cass-full-2005.json"
  "cass-full-2006.json"
  "cass-full-2007.json"
  "cass-full-2008.json"
  "cass-full-2009.json"
  "cass-full-2010.json"
  "cass-full-2011.json"
  "cass-full-2012.json"
  "cass-full-2013.json"
  "cass-full-2014.json"
  "cass-full-2015.json"
  "cass-full-2016.json"
  "cass-full-2017.json"
  "cass-full-2018.json"
  "cass-full-2019.json"
  "cass-full-2020.json"
  "cass-full-2021.json"
  "cass-full-2022.json"
  "cass-full-2023.json"
  "cass-full-2024.json"
  "cass-full-2025.json"
  "cass-full-2026.json"
)

ts() { date '+%Y-%m-%d %H:%M:%S'; }

echo "[$(ts)] embed-all-local START ($(( ${#FILES[@]} )) files queued)" | tee -a "$LOG"
cd "$REPO" || { echo "[$(ts)] cd failed" | tee -a "$LOG"; exit 1; }

TOTAL=${#FILES[@]}
IDX=0
for F in "${FILES[@]}"; do
  IDX=$((IDX + 1))
  INPUT="$CACHE/$F"
  if [[ ! -f "$INPUT" ]]; then
    echo "[$(ts)] [$IDX/$TOTAL] SKIP $F (missing on disk)" | tee -a "$LOG"
    continue
  fi

  for attempt in 1 2 3; do
    echo "[$(ts)] [$IDX/$TOTAL] START $F (attempt $attempt)" | tee -a "$LOG"
    NODE_OPTIONS="--max-old-space-size=8192" nice -n 10 \
      npx tsx "$REPO/scripts/embed-sources.ts" \
        --input "$INPUT" \
        --resume \
        --batch-size 64 \
        --dtype fp16 \
      >> "$LOG" 2>&1
    rc=$?
    if [[ $rc -eq 0 ]]; then
      echo "[$(ts)] [$IDX/$TOTAL] DONE  $F" | tee -a "$LOG"
      break
    fi
    echo "[$(ts)] [$IDX/$TOTAL] FAIL  $F rc=$rc attempt=$attempt; sleeping 30s" | tee -a "$LOG"
    sleep 30
  done
done

echo "[$(ts)] embed-all-local END" | tee -a "$LOG"
