from __future__ import annotations

import re
import sqlglot
from sqlglot import exp

from backend.connectors.base import SQLDialectType

FORBIDDEN_KEYWORDS = {
    "DROP",
    "DELETE",
    "UPDATE",
    "INSERT",
    "ALTER",
    "TRUNCATE",
    "CREATE",
    "REPLACE",
    "GRANT",
    "REVOKE",
    "EXEC",
    "EXECUTE",
    "ATTACH",
    "DETACH",
    "PRAGMA",
    "MERGE",
    "CALL",
}

DIALECT_MAP: dict[SQLDialectType, str] = {
    "sqlite": "sqlite",
    "mysql": "mysql",
    "mssql": "tsql",
}


class SQLValidationError(ValueError):
    """Raised when a query violates read-only or syntax safety rules."""


def clean_llm_sql(raw_sql: str) -> str:
    """Strips markdown code fences and trailing semicolons from LLM-generated SQL."""
    cleaned = raw_sql.strip()
    fence_match = re.search(r"```(?:sql|tsql|mysql|sqlite)?\s*(.*?)```", cleaned, flags=re.DOTALL | re.IGNORECASE)
    if fence_match:
        cleaned = fence_match.group(1).strip()
    cleaned = re.sub(r"^SQL:\s*", "", cleaned, flags=re.IGNORECASE).strip()
    return cleaned.rstrip(";").strip()


def validate_and_transpile_sql(
    raw_sql: str,
    target_dialect: SQLDialectType,
    max_rows: int = 2000,
) -> str:
    """
    Validates that the SQL statement is strictly a single read-only SELECT/UNION query,
    enforces a row limit (`LIMIT N` for SQLite/MySQL or `TOP N` for MS SQL Server),
    and transpiles to the target dialect (`sqlite`, `mysql`, or `tsql`).
    """
    cleaned_sql = clean_llm_sql(raw_sql)
    if not cleaned_sql:
        raise SQLValidationError("Empty SQL query.")

    # Quick token check for forbidden DDL/DML verbs outside quotes
    upper_tokens = set(re.findall(r"\b[A-Z_]+\b", cleaned_sql.upper()))
    illegal = upper_tokens.intersection(FORBIDDEN_KEYWORDS)
    if illegal:
        raise SQLValidationError(
            f"Read-only violation: Query contains forbidden keyword(s): {', '.join(sorted(illegal))}"
        )

    glot_dialect = DIALECT_MAP.get(target_dialect, "sqlite")

    # Try parsing with target dialect first, then fallback to generic/postgres dialect
    statements = None
    parse_error = None
    for read_dialect in (glot_dialect, None, "postgres"):
        try:
            statements = sqlglot.parse(cleaned_sql, read=read_dialect)
            if statements and statements[0] is not None:
                break
        except Exception as exc:
            parse_error = exc
            continue

    if not statements or statements[0] is None:
        raise SQLValidationError(f"SQL syntax parse error: {parse_error}")

    if len(statements) > 1:
        raise SQLValidationError("Multiple SQL statements are not allowed. Submit a single SELECT query.")

    root = statements[0]
    if not isinstance(root, (exp.Select, exp.Union)):
        raise SQLValidationError(
            f"Only read-only SELECT queries are permitted (got {type(root).__name__})."
        )

    # Ensure no mutating expressions exist anywhere inside the AST
    for forbidden_node in (
        exp.Insert,
        exp.Update,
        exp.Delete,
        exp.Drop,
        exp.Create,
        exp.Alter,
        exp.Command,
    ):
        if root.find(forbidden_node) is not None:
            raise SQLValidationError(
                f"Forbidden SQL AST operation detected: {forbidden_node.__name__}"
            )

    # Apply max_rows limit if not already constrained
    if isinstance(root, exp.Select) and root.args.get("limit") is None:
        root = root.limit(max_rows)

    try:
        transpiled = root.sql(dialect=glot_dialect)
        return transpiled
    except Exception as exc:
        raise SQLValidationError(f"Failed to transpile SQL to {glot_dialect}: {exc}") from exc
