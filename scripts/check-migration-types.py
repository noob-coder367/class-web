#!/usr/bin/env python3
"""Static type compatibility check for Supabase migration SQL.

This is intentionally read-only and does not connect to PostgreSQL/Supabase.
It parses CREATE TABLE column declarations, inline/table-level/ALTER FK clauses,
ADD COLUMN declarations, and a small explicit contract for common external UUID
keys whose base-table DDL is not checked into this repository.
"""
from __future__ import annotations

import re
import sys
from pathlib import Path
from typing import Dict, List, Tuple

ROOT = Path(__file__).resolve().parents[1]
MIGRATIONS = ROOT / "supabase" / "migrations"
SCHEMA_ROOT = ROOT / "supabase"

# Contracts established by the deployed application/repository conventions.
# These are not a substitute for a live catalog check; they let this static
# checker catch a migration that accidentally changes one side to text.
EXTERNAL_TYPES = {
    ("public", "profiles", "id"): "uuid",
    ("auth", "users", "id"): "uuid",
    ("public", "homework_assignments", "id"): "uuid",
    ("public", "homework_submissions", "id"): "uuid",
}
EXTERNAL_UNIQUE_KEYS = {
    ("public", "profiles", ("id",)),
    ("auth", "users", ("id",)),
    ("public", "homework_assignments", ("id",)),
    ("public", "homework_submissions", ("id",)),
}
EXPECTED_UUID_COLUMNS = {
    ("public", "announcements", "id"),
    ("public", "announcements", "created_by"),
    ("public", "announcements", "hidden_by"),
    ("public", "announcements", "subject_user_id"),
    ("public", "announcements", "source_homework_id"),
    ("public", "announcement_images", "announcement_id"),
    ("public", "homework_notices", "exam_announcement_id"),
    ("public", "profiles", "id"),
    ("public", "homework_assignments", "id"),
    ("public", "homework_submissions", "id"),
    ("auth", "users", "id"),
}
EXPECTED_BIGINT_COLUMNS = {
    ("public", "timetables", "id"),
    ("public", "timetable_sessions", "timetable_id"),
    ("public", "timetable_periods", "timetable_id"),
    ("public", "timetable_breaks", "timetable_id"),
    ("public", "timetable_entries", "timetable_id"),
    ("public", "timetable_change_notices", "timetable_id"),
}
EXPECTED_TIMETABLE_BIGINT_FKS = {
    ("public", "timetable_sessions", "timetable_id", "public", "timetables", "id"),
    ("public", "timetable_periods", "timetable_id", "public", "timetables", "id"),
    ("public", "timetable_breaks", "timetable_id", "public", "timetables", "id"),
    ("public", "timetable_entries", "timetable_id", "public", "timetables", "id"),
    ("public", "timetable_change_notices", "timetable_id", "public", "timetables", "id"),
}

CREATE_TABLE_RE = re.compile(
    r"\bcreate\s+table\s+(?:if\s+not\s+exists\s+)?"
    r"(?:(?P<schema>[a-z_][\w$]*)\s*\.\s*)?(?P<table>[a-z_][\w$]*)\s*\(",
    re.I,
)
COLUMN_RE = re.compile(
    r'^\s*"?(?P<column>[a-z_][\w$]*)"?\s+'
    r'(?P<type>(?:timestamp|time)\s+(?:with|without)\s+time\s+zone|'
    r'character\s+varying|double\s+precision|smallint|integer|bigint|'
    r'varchar|char|text|uuid|jsonb|json|boolean|bool|date|bytea|numeric|'
    r'real|serial|bigserial|int2|int4|int8|timestamptz|timetz|interval)'
    r'(?:\s*\([^)]*\))?(?:\s*\[\])?',
    re.I,
)


def strip_comments(sql: str) -> str:
    """Remove SQL comments while retaining quoted strings and dollar bodies."""
    out: List[str] = []
    i = 0
    n = len(sql)
    quote: str | None = None
    dollar: str | None = None
    line_comment = False
    block_depth = 0
    while i < n:
        if line_comment:
            if sql[i] == "\n":
                line_comment = False
                out.append("\n")
            i += 1
            continue
        if block_depth:
            if sql.startswith("/*", i):
                block_depth += 1
                i += 2
            elif sql.startswith("*/", i):
                block_depth -= 1
                i += 2
            else:
                if sql[i] == "\n":
                    out.append("\n")
                i += 1
            continue
        if dollar:
            if sql.startswith(dollar, i):
                out.append(dollar)
                i += len(dollar)
                dollar = None
            else:
                out.append(sql[i])
                i += 1
            continue
        if quote:
            out.append(sql[i])
            if sql[i] == quote:
                if i + 1 < n and sql[i + 1] == quote:
                    out.append(sql[i + 1])
                    i += 2
                    continue
                quote = None
            elif sql[i] == "\\" and quote == "'" and i + 1 < n:
                out.append(sql[i + 1])
                i += 2
                continue
            i += 1
            continue
        if sql.startswith("--", i):
            line_comment = True
            i += 2
            continue
        if sql.startswith("/*", i):
            block_depth = 1
            i += 2
            continue
        if sql[i] in "'\"":
            quote = sql[i]
            out.append(sql[i])
            i += 1
            continue
        if sql[i] == "$":
            match = re.match(r"\$[A-Za-z_][\w$]*\$|\$\$", sql[i:])
            if match:
                dollar = match.group(0)
                out.append(dollar)
                i += len(dollar)
                continue
        out.append(sql[i])
        i += 1
    return "".join(out)


def normalize_type(raw: str) -> str:
    value = re.sub(r"\s+", " ", raw.strip().lower())
    value = re.sub(r"\([^)]*\)", "", value).strip()
    value = value.replace("[]", "[]")
    aliases = {
        "int2": "smallint",
        "int4": "integer",
        "int8": "bigint",
        "bool": "boolean",
        "timestamptz": "timestamp with time zone",
        "timestamp": "timestamp without time zone",
        "timetz": "time with time zone",
        "varchar": "character varying",
        "char": "character",
    }
    return aliases.get(value, value)


def split_top_level(body: str) -> List[str]:
    parts: List[str] = []
    start = 0
    depth = 0
    quote: str | None = None
    i = 0
    while i < len(body):
        char = body[i]
        if quote:
            if char == quote:
                if i + 1 < len(body) and body[i + 1] == quote:
                    i += 2
                    continue
                quote = None
        elif char in "'\"":
            quote = char
        elif char == "(":
            depth += 1
        elif char == ")":
            depth -= 1
        elif char == "," and depth == 0:
            parts.append(body[start:i].strip())
            start = i + 1
        i += 1
    tail = body[start:].strip()
    if tail:
        parts.append(tail)
    return parts


def matching_paren(sql: str, opening: int) -> int:
    depth = 0
    quote: str | None = None
    i = opening
    while i < len(sql):
        char = sql[i]
        if quote:
            if char == quote:
                if i + 1 < len(sql) and sql[i + 1] == quote:
                    i += 2
                    continue
                quote = None
        elif char in "'\"":
            quote = char
        elif char == "(":
            depth += 1
        elif char == ")":
            depth -= 1
            if depth == 0:
                return i
        i += 1
    return -1


def relation_name(schema: str | None, table: str) -> Tuple[str, str]:
    return ((schema or "public").lower(), table.lower())


def parse_sql_file(path: Path, columns: Dict[Tuple[str, str, str], str], fk_rows: set,
                   fk_groups: set, unique_keys: set) -> None:
    sql = strip_comments(path.read_text(encoding="utf-8"))
    for match in CREATE_TABLE_RE.finditer(sql):
        schema, table = relation_name(match.group("schema"), match.group("table"))
        opening = match.end() - 1
        closing = matching_paren(sql, opening)
        if closing < 0:
            print(f"ERROR {path.relative_to(ROOT)}: unmatched CREATE TABLE parenthesis")
            continue
        body = sql[opening + 1:closing]
        for part in split_top_level(body):
            col_match = COLUMN_RE.match(part)
            if col_match:
                column = col_match.group("column").lower()
                sql_type = normalize_type(col_match.group("type"))
                key = (schema, table, column)
                prior = columns.get(key)
                if prior and prior != sql_type:
                    print(f"ERROR {path.relative_to(ROOT)}: conflicting declaration {schema}.{table}.{column}: {prior} vs {sql_type}")
                columns[key] = sql_type
                if re.search(r"\b(primary\s+key|unique)\b", part, re.I):
                    unique_keys.add((schema, table, (column,)))
                ref = re.search(r"\breferences\s+(?:(\w+)\s*\.\s*)?(\w+)\s*\(\s*(\w+)\s*\)", part, re.I)
                if ref:
                    target_schema, target_table = relation_name(ref.group(1), ref.group(2))
                    fk_rows.add((path, schema, table, column, target_schema, target_table, ref.group(3).lower()))
                    fk_groups.add((path, schema, table, (column,), target_schema, target_table, (ref.group(3).lower(),)))
                continue
            unique_match = re.search(r"\b(?:primary\s+key|unique)\s*\(\s*([\w\s,]+?)\s*\)", part, re.I)
            if unique_match:
                unique_cols = tuple(x.strip().lower() for x in unique_match.group(1).split(","))
                unique_keys.add((schema, table, unique_cols))
            fk = re.search(
                r"\bforeign\s+key\s*\(\s*([\w\s,]+?)\s*\)\s*"
                r"references\s+(?:(\w+)\s*\.\s*)?(\w+)\s*\(\s*([\w\s,]+?)\s*\)",
                part, re.I,
            )
            if fk:
                source_cols = [x.strip().lower() for x in fk.group(1).split(",")]
                target_schema, target_table = relation_name(fk.group(2), fk.group(3))
                target_cols = [x.strip().lower() for x in fk.group(4).split(",")]
                if len(source_cols) == len(target_cols):
                    fk_groups.add((path, schema, table, tuple(source_cols), target_schema, target_table, tuple(target_cols)))
                    for source_col, target_col in zip(source_cols, target_cols):
                        fk_rows.add((path, schema, table, source_col, target_schema, target_table, target_col))

    # Track ADD COLUMN types too: IF NOT EXISTS does not reconcile a pre-existing
    # column, so contradictory declarations in one migration are a static error.
    add_column_re = re.compile(
        r"\balter\s+table\s+(?:(\w+)\s*\.\s*)?(\w+)\s+"
        r"add\s+column\s+(?:if\s+not\s+exists\s+)?(\w+)\s+"
        r"((?:timestamp|time)\s+(?:with|without)\s+time\s+zone|"
        r"character\s+varying|double\s+precision|smallint|integer|bigint|"
        r"varchar|char|text|uuid|jsonb|json|boolean|bool|date|bytea|numeric|"
        r"real|serial|bigserial|int2|int4|int8|timestamptz|timetz|interval)", re.I,
    )
    for match in add_column_re.finditer(sql):
        schema, table = relation_name(match.group(1), match.group(2))
        column = match.group(3).lower()
        add_type = normalize_type(match.group(4))
        key = (schema, table, column)
        prior = columns.get(key)
        if prior and prior != add_type:
            print(f"ERROR {path.relative_to(ROOT)}: ADD COLUMN {schema}.{table}.{column} {add_type} conflicts with declared {prior}")
        elif not prior:
            columns[key] = add_type

    # Concrete ALTER TABLE ... ADD CONSTRAINT ... FOREIGN KEY statements.
    # Dynamic EXECUTE templates are verified through explicit domain contracts.
    alter_fk_re = re.compile(
        r"\balter\s+table\s+(?:(\w+)\s*\.\s*)?(\w+)\s+"
        r"add\s+constraint\s+\w+\s+"
        r"\bforeign\s+key\s*\(\s*([\w\s,]+?)\s*\)\s*"
        r"references\s+(?:(\w+)\s*\.\s*)?(\w+)\s*\(\s*([\w\s,]+?)\s*\)", re.I,
    )
    for match in alter_fk_re.finditer(sql):
        schema, table = relation_name(match.group(1), match.group(2))
        source_cols = [x.strip().lower() for x in match.group(3).split(",")]
        target_schema, target_table = relation_name(match.group(4), match.group(5))
        target_cols = [x.strip().lower() for x in match.group(6).split(",")]
        if len(source_cols) == len(target_cols):
            fk_groups.add((path, schema, table, tuple(source_cols), target_schema, target_table, tuple(target_cols)))
            for source_col, target_col in zip(source_cols, target_cols):
                fk_rows.add((path, schema, table, source_col, target_schema, target_table, target_col))

    unique_index_re = re.compile(
        r"\bcreate\s+unique\s+index\s+(?:if\s+not\s+exists\s+)?\w+\s+on\s+"
        r"(?:(\w+)\s*\.\s*)?(\w+)\s*\(\s*([\w\s,]+?)\s*\)", re.I,
    )
    for match in unique_index_re.finditer(sql):
        schema, table = relation_name(match.group(1), match.group(2))
        index_cols = tuple(x.strip().lower().split()[0] for x in match.group(3).split(","))
        if all(re.fullmatch(r"[a-z_][\w$]*", column) for column in index_cols):
            unique_keys.add((schema, table, index_cols))


def main() -> int:
    migrations = sorted(MIGRATIONS.glob("2026100400*.sql"))
    if not migrations:
        print("ERROR: no numbered migrations found")
        return 2

    columns: Dict[Tuple[str, str, str], str] = {}
    fk_rows = set()
    fk_groups = set()
    unique_keys = set()
    # Baseline schema declarations establish target types before migrations.
    schema_files = sorted(
        path for path in SCHEMA_ROOT.rglob("*.sql")
        if MIGRATIONS not in path.parents
    )
    for path in schema_files + migrations:
        parse_sql_file(path, columns, fk_rows, fk_groups, unique_keys)

    errors = 0
    warnings = 0
    for path, schema, table, source_col, target_schema, target_table, target_col in sorted(
        fk_rows, key=lambda row: (str(row[0]), row[1], row[2], row[3], row[4], row[5], row[6])
    ):
        source_key = (schema, table, source_col)
        target_key = (target_schema, target_table, target_col)
        source_type = columns.get(source_key)
        target_type = columns.get(target_key) or EXTERNAL_TYPES.get(target_key)
        label = f"{path.relative_to(ROOT)}: {schema}.{table}.{source_col} -> {target_schema}.{target_table}.{target_col}"
        if source_type is None:
            print(f"ERROR {label}: source column type unresolved")
            errors += 1
        elif target_type is None:
            print(f"WARN  {label}: target type unresolved (no checked-in base DDL or explicit contract)")
            warnings += 1
        elif source_type != target_type:
            print(f"ERROR {label}: {source_type} != {target_type}")
            errors += 1

    for key in sorted(EXPECTED_UUID_COLUMNS):
        actual = columns.get(key) or EXTERNAL_TYPES.get(key)
        if actual is None:
            print(f"WARN  expected UUID column {'.'.join(key)} is unresolved")
            warnings += 1
        elif actual != "uuid":
            print(f"ERROR expected UUID column {'.'.join(key)} is {actual}")
            errors += 1

    for key in sorted(EXPECTED_BIGINT_COLUMNS):
        actual = columns.get(key)
        if actual != "bigint":
            print(f"ERROR expected BIGINT column {'.'.join(key)} is {actual or '<unresolved>'}")
            errors += 1

    timetable_migration = MIGRATIONS / "202610040005_timetable_relational.sql"
    timetable_sql = timetable_migration.read_text(encoding="utf-8").lower()
    if "foreign key (timetable_id) references public.timetables(id)" not in timetable_sql:
        print("ERROR migration 005 does not declare the expected timetable_id -> public.timetables(id) FK")
        errors += 1
    expected_timetable_children = {entry[1] for entry in EXPECTED_TIMETABLE_BIGINT_FKS}
    foreach_blocks = re.findall(
        r"foreach\s+child_table\s+in\s+array\s+array\[(.*?)\]\s+loop",
        timetable_sql,
        re.S,
    )
    if len(foreach_blocks) < 2:
        print("ERROR migration 005 must independently type-check and install timetable child FKs")
        errors += 1
    for block_number, block in enumerate(foreach_blocks, start=1):
        declared_children = set(re.findall(r"'([a-z_][a-z0-9_]*)'", block))
        missing_children = expected_timetable_children - declared_children
        if missing_children:
            print(f"ERROR migration 005 child loop {block_number} omits: {', '.join(sorted(missing_children))}")
            errors += 1
    for child_schema, child_table, child_column, target_schema, target_table, target_column in EXPECTED_TIMETABLE_BIGINT_FKS:
        child_key = (child_schema, child_table, child_column)
        target_key = (target_schema, target_table, target_column)
        if columns.get(child_key) != "bigint" or columns.get(target_key) != "bigint":
            print(f"ERROR expected BIGINT FK {child_schema}.{child_table}.{child_column} -> {target_schema}.{target_table}.{target_column}")
            errors += 1
        if child_table not in timetable_sql:
            print(f"ERROR migration 005 is missing timetable child table {child_table}")
            errors += 1

    for path, schema, table, source_cols, target_schema, target_table, target_cols in sorted(
        fk_groups, key=lambda row: (str(row[0]), row[1], row[2], row[3], row[4], row[5], row[6])
    ):
        target_key = (target_schema, target_table, target_cols)
        if target_key not in unique_keys and target_key not in EXTERNAL_UNIQUE_KEYS:
            print(f"ERROR {path.relative_to(ROOT)}: FK target {target_schema}.{target_table}{target_cols} is not declared PRIMARY KEY/UNIQUE in checked-in SQL or external contracts")
            errors += 1

    # Catch the specific risky pattern that originally caused 003 to fail:
    # known announcements primary key and FK must both be uuid.
    required = {
        ("public", "announcements", "id"): "uuid",
        ("public", "announcement_images", "announcement_id"): "uuid",
        ("public", "homework_notices", "exam_announcement_id"): "uuid",
    }
    for key, expected in required.items():
        actual = columns.get(key)
        if actual != expected:
            print(f"ERROR required announcement reference {'.'.join(key)} must be {expected}; found {actual or '<unresolved>'}")
            errors += 1

    print(f"Checked {len(migrations)} numbered migrations; {len(fk_rows)} FK column pairs; {len(fk_groups)} FK constraints; 5 timetable BIGINT FK contracts; {errors} errors; {warnings} unresolved external references.")
    if errors:
        return 1
    print("PASS: no statically detectable FK type mismatch. Live database schema was not inspected; compare production catalog before execution.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
