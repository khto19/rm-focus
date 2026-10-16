#!/usr/bin/env python3
"""Build the public, no-key Real Madrid fixture JSON from Openfootball."""

from __future__ import annotations

import argparse
import json
import os
import sys
import tempfile
from datetime import datetime, timezone
from pathlib import Path
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "outputs" / "api" / "fixtures.json"
TODAY = datetime.now(timezone.utc).date()
SEASON_START = TODAY.year if TODAY.month >= 7 else TODAY.year - 1
SEASON = f"{SEASON_START}-{str(SEASON_START + 1)[-2:]}"
SOURCE = f"https://raw.githubusercontent.com/openfootball/football.json/master/{SEASON}/es.1.json"

# Used only to create the initial checked-in snapshot. The scheduled workflow
# replaces it from the upstream CC0 dataset when that feed is reachable.
SEED = [
    ("2026-08-22", "Matchday 2", "RCD Espanyol de Barcelona", "Real Madrid CF", "21:30", 1, 2),
    ("2026-08-26", "Matchday 1", "Real Madrid CF", "Real Sociedad de Fútbol", "21:00", 4, 1),
    ("2026-08-30", "Matchday 3", "Real Madrid CF", "Málaga CF", "17:00", 4, 0),
    ("2026-09-04", "Matchday 4", "Real Betis Balompié", "Real Madrid CF", "21:00", 1, 0),
    ("2026-09-12", "Matchday 5", "Real Madrid CF", "Rayo Vallecano de Madrid", "21:00", 4, 1),
    ("2026-09-15", "Matchday 6", "Elche CF", "Real Madrid CF", "21:30", 2, 3),
    ("2026-09-20", "Matchday 7", "Club Atlético de Madrid", "Real Madrid CF", "16:15", 2, 1),
    ("2026-10-10", "Matchday 8", "Real Madrid CF", "Villarreal CF", "21:00", None, None),
    ("2026-10-18", "Matchday 9", "Real Madrid CF", "Sevilla FC", "21:00", None, None),
    ("2026-10-25", "Matchday 10", "FC Barcelona", "Real Madrid CF", None, None, None),
    ("2026-11-01", "Matchday 11", "Real Racing Club de Santander", "Real Madrid CF", None, None, None),
    ("2026-11-08", "Matchday 12", "Valencia CF", "Real Madrid CF", None, None, None),
    ("2026-11-22", "Matchday 13", "Real Madrid CF", "RC Celta de Vigo", None, None, None),
    ("2026-11-29", "Matchday 14", "Real Madrid CF", "Deportivo Alavés", None, None, None),
    ("2026-12-06", "Matchday 15", "Athletic Club", "Real Madrid CF", None, None, None),
    ("2026-12-13", "Matchday 16", "Real Madrid CF", "CA Osasuna", None, None, None),
    ("2026-12-20", "Matchday 17", "RC Deportivo La Coruña", "Real Madrid CF", None, None, None),
    ("2027-01-03", "Matchday 18", "Real Madrid CF", "Getafe CF", None, None, None),
    ("2027-01-10", "Matchday 19", "Real Madrid CF", "Levante UD", None, None, None),
    ("2027-01-17", "Matchday 20", "Málaga CF", "Real Madrid CF", None, None, None),
    ("2027-01-24", "Matchday 21", "Real Madrid CF", "Real Betis Balompié", None, None, None),
    ("2027-01-31", "Matchday 22", "Rayo Vallecano de Madrid", "Real Madrid CF", None, None, None),
    ("2027-02-07", "Matchday 23", "Real Sociedad de Fútbol", "Real Madrid CF", None, None, None),
    ("2027-02-14", "Matchday 24", "Real Madrid CF", "Athletic Club", None, None, None),
    ("2027-02-21", "Matchday 25", "Sevilla FC", "Real Madrid CF", None, None, None),
    ("2027-02-28", "Matchday 26", "Real Madrid CF", "Valencia CF", None, None, None),
    ("2027-03-07", "Matchday 27", "Villarreal CF", "Real Madrid CF", None, None, None),
    ("2027-03-14", "Matchday 28", "Real Madrid CF", "RCD Espanyol de Barcelona", None, None, None),
    ("2027-03-21", "Matchday 29", "RC Celta de Vigo", "Real Madrid CF", None, None, None),
    ("2027-04-04", "Matchday 30", "Real Madrid CF", "Club Atlético de Madrid", None, None, None),
    ("2027-04-11", "Matchday 31", "CA Osasuna", "Real Madrid CF", None, None, None),
    ("2027-04-18", "Matchday 32", "Getafe CF", "Real Madrid CF", None, None, None),
    ("2027-04-21", "Matchday 33", "Real Madrid CF", "Elche CF", None, None, None),
    ("2027-05-02", "Matchday 34", "Levante UD", "Real Madrid CF", None, None, None),
    ("2027-05-09", "Matchday 35", "Real Madrid CF", "FC Barcelona", None, None, None),
    ("2027-05-16", "Matchday 36", "Real Madrid CF", "Real Racing Club de Santander", None, None, None),
    ("2027-05-23", "Matchday 37", "Deportivo Alavés", "Real Madrid CF", None, None, None),
    ("2027-05-30", "Matchday 38", "Real Madrid CF", "RC Deportivo La Coruña", None, None, None),
]


def create_match(row: tuple) -> dict:
    date, round_name, home, away, time, home_goals, away_goals = row
    score = None if home_goals is None else {"home": home_goals, "away": away_goals}
    return {
        "id": f"{date}-{round_name.lower().replace(' ', '-')}",
        "date": date,
        "time": time,
        "round": round_name,
        "competition": "LaLiga",
        "home": home,
        "away": away,
        "score": score,
        "status": "finished" if score else "scheduled",
    }


def current_payload() -> dict:
    req = Request(SOURCE, headers={"User-Agent": "RM-Focus-fixture-sync/1.0"})
    with urlopen(req, timeout=15) as response:
        source_data = json.load(response)

    matches = []
    for item in source_data.get("matches", []):
        home, away = item.get("team1", ""), item.get("team2", "")
        if "real madrid" not in f"{home} {away}".casefold():
            continue
        full_time = (item.get("score") or {}).get("ft")
        score = None
        if isinstance(full_time, list) and len(full_time) == 2:
            score = {"home": int(full_time[0]), "away": int(full_time[1])}
        date = item.get("date")
        if not date:
            continue
        round_name = item.get("round", "")
        matches.append({
            "id": f"{date}-{str(round_name).lower().replace(' ', '-')}",
            "date": date,
            "time": item.get("time"),
            "round": round_name,
            "competition": "LaLiga",
            "home": home,
            "away": away,
            "score": score,
            "status": "finished" if score else "scheduled",
        })

    if len(matches) < 30:
        raise ValueError(f"Upstream dataset returned only {len(matches)} Madrid matches")
    matches.sort(key=lambda item: (item["date"], item.get("time") or "23:59"))
    return {
        "season": f"{SEASON_START}/{str(SEASON_START + 1)[-2:]}",
        "updatedAt": datetime.now(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z"),
        "dataSource": "Openfootball / football.json",
        "sourceUrl": SOURCE,
        "license": "CC0 1.0",
        "updateCadence": "Daily automated refresh; upstream timing may vary",
        "matches": matches,
    }


def seed_payload() -> dict:
    return {
        "season": "2026/27",
        "updatedAt": datetime.now(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z"),
        "dataSource": "Openfootball / football.json · checked-in starter snapshot",
        "sourceUrl": "https://github.com/openfootball/football.json",
        "license": "CC0 1.0",
        "updateCadence": "Starter snapshot; scheduled GitHub Actions refresh",
        "matches": [create_match(row) for row in SEED],
    }


def write_payload(payload: dict) -> None:
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    fd, temp_name = tempfile.mkstemp(prefix="fixtures-", suffix=".json", dir=OUTPUT.parent)
    try:
        with os.fdopen(fd, "w", encoding="utf-8", newline="\n") as handle:
            json.dump(payload, handle, ensure_ascii=False, indent=2)
            handle.write("\n")
        os.replace(temp_name, OUTPUT)
    finally:
        if os.path.exists(temp_name):
            os.unlink(temp_name)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--seed-only", action="store_true", help="write the starter snapshot without network access")
    args = parser.parse_args()
    if args.seed_only:
        write_payload(seed_payload())
        print(f"Wrote starter feed: {OUTPUT}")
        return 0
    try:
        payload = current_payload()
        write_payload(payload)
        print(f"Updated {len(payload['matches'])} matches from upstream: {OUTPUT}")
        return 0
    except Exception as error:  # Keep the last known good snapshot on upstream/network failure.
        print(f"Fixture refresh skipped; preserving the existing snapshot. Reason: {error}", file=sys.stderr)
        return 0


if __name__ == "__main__":
    raise SystemExit(main())

