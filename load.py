import csv
import io
import json
import os
import posixpath
import sys
import zipfile
from fnmatch import fnmatch

import psycopg2
from psycopg2 import sql
from psycopg2.extras import execute_values

DSN = os.environ.get("DATABASE_URL", "postgresql://postgres:postgres@localhost:5432/companies")
WORK_PATH = os.path.dirname(os.path.abspath(__file__))
ARCHIVE = os.path.join(WORK_PATH, "data_pack.zip")


# Ищем по имени файла, а не по полному пути: пачку архивируют и с папкой внутри, и без неё
def entries(pack, pattern):
    names = sorted(n for n in pack.namelist() if fnmatch(posixpath.basename(n), pattern))
    if not names:
        raise SystemExit(f"в архиве нет файлов {pattern}")
    return names


def read_pack(pack):
    for name in entries(pack, "page_*.json"):
        with pack.open(name) as fh:
            yield from json.load(fh)["items"]


def fix_encoding(value):
    try:
        return value.encode("cp1251").decode("utf-8")
    except (UnicodeEncodeError, UnicodeDecodeError):
        return value


# Мусор в rating/reviews_count -> NULL/0, разбор случаев в ANOMALIES.md
def to_rating(value):
    try:
        rating = float(value.replace(",", "."))
    except ValueError:
        return None
    return rating if 0 <= rating <= 5 else None


def to_count(value):
    try:
        count = int(float(value))
    except ValueError:
        return 0
    return max(count, 0)


def read_csv(pack, pattern="review.csv"):
    for name in entries(pack, pattern):
        with pack.open(name) as raw:
            fh = io.TextIOWrapper(raw, encoding="utf-8-sig", newline="")
            for row in csv.DictReader(fh):
                row = {k: fix_encoding((v or "").strip()) or None for k, v in row.items()}
                if not row["id"] or not row["name"]:
                    continue
                if not row["address"]:  # признак сдвига колонок, см. ANOMALIES.md
                    continue
                row["rating"] = to_rating(row["rating"] or "")
                row["reviews_count"] = to_count(row["reviews_count"] or "0")
                yield row


def load(rows):
    cols = list(rows[0])  
    query = sql.SQL("""
        insert into companies ({cols}) values %s
        on conflict (id) do update set {updates}
    """).format(
        cols=sql.SQL(", ").join(map(sql.Identifier, cols)),
        updates=sql.SQL(", ").join(
            sql.SQL("{0} = excluded.{0}").format(sql.Identifier(c)) for c in cols if c != "id"),
    )
    with psycopg2.connect(DSN) as conn, conn.cursor() as cur:
        with open(os.path.join(WORK_PATH, "schema.sql"), encoding="utf-8") as fh:
            cur.execute(fh.read())
        execute_values(cur, query, [tuple(row[c] for c in cols) for row in rows])
        cur.execute("select count(*) from companies")
        return cur.fetchone()[0]


if __name__ == "__main__":
    import itertools
    path = sys.argv[1] if len(sys.argv) > 1 else ARCHIVE
    if not os.path.isfile(path):
        raise SystemExit(f"нет файла: {path}\nиспользование: python load.py [пачка.zip]")
    if not zipfile.is_zipfile(path):
        raise SystemExit(f"на вход нужен .zip архив, а не {path}")
    with zipfile.ZipFile(path) as pack:
        rows = list({row["id"]: row
                     for row in itertools.chain(read_pack(pack), read_csv(pack))}.values())
    print(f"{os.path.basename(path)}: загружено {len(rows)} компаний; в таблице: {load(rows)}")
