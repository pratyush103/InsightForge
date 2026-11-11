from __future__ import annotations

from abc import ABC, abstractmethod
from typing import Any, Literal
from pydantic import BaseModel, Field

SQLDialectType = Literal["sqlite", "mysql", "mssql"]


class ColumnProfile(BaseModel):
    name: str
    data_type: str
    nullable: bool = True
    is_primary_key: bool = False
    is_foreign_key: bool = False
    foreign_key_target: str | None = None
    distinct_count: int | None = None
    null_count: int | None = None
    min_value: Any | None = None
    max_value: Any | None = None
    sample_values: list[Any] = Field(default_factory=list)


class TableProfile(BaseModel):
    table_name: str
    row_count: int = 0
    columns: list[ColumnProfile] = Field(default_factory=list)
    sample_rows: list[dict[str, Any]] = Field(default_factory=list)
    description: str = ""


class SchemaCatalog(BaseModel):
    connector_id: str
    connector_name: str
    dialect: SQLDialectType
    database_display: str
    schema_fingerprint: str
    tables: list[TableProfile] = Field(default_factory=list)

    def to_prompt_context(self) -> str:
        """Formats the schema catalog into a compact, LLM-friendly DDL + statistics summary."""
        lines: list[str] = [
            f"DATABASE DIALECT: {self.dialect.upper()} (Database: {self.database_display})",
            f"SCHEMA FINGERPRINT: {self.schema_fingerprint}",
            "TABLES & COLUMNS:",
        ]
        for tbl in self.tables:
            lines.append(f"\n### Table `{tbl.table_name}` ({tbl.row_count:,} rows)")
            if tbl.description:
                lines.append(f"Description: {tbl.description}")
            for col in tbl.columns:
                pk_str = " [PK]" if col.is_primary_key else ""
                fk_str = f" [FK -> {col.foreign_key_target}]" if col.is_foreign_key and col.foreign_key_target else ""
                stats_parts: list[str] = []
                if col.distinct_count is not None:
                    stats_parts.append(f"distinct={col.distinct_count}")
                if col.min_value is not None and col.max_value is not None:
                    stats_parts.append(f"range=[{col.min_value} .. {col.max_value}]")
                if col.sample_values:
                    preview = ", ".join(repr(v) for v in col.sample_values[:5])
                    stats_parts.append(f"samples=[{preview}]")
                stats_str = f" -- {'; '.join(stats_parts)}" if stats_parts else ""
                lines.append(f"  - {col.name} ({col.data_type}){pk_str}{fk_str}{stats_str}")
        return "\n".join(lines)


class QueryExecutionResult(BaseModel):
    success: bool
    original_sql: str
    executed_sql: str
    dialect: SQLDialectType
    columns: list[str] = Field(default_factory=list)
    rows: list[dict[str, Any]] = Field(default_factory=list)
    row_count: int = 0
    execution_ms: float = 0.0
    error: str | None = None


class ConnectorCreateRequest(BaseModel):
    name: str
    dialect: SQLDialectType
    # For SQLite
    sqlite_path: str | None = None
    # For MySQL & MS SQL Server
    host: str | None = "localhost"
    port: int | None = None
    database: str | None = None
    username: str | None = None
    password: str | None = None
    connection_uri: str | None = None
    ssl_enabled: bool = False
    trust_server_certificate: bool = True


class ConnectorInfo(BaseModel):
    id: str
    name: str
    dialect: SQLDialectType
    database_display: str
    is_builtin: bool = False
    status: Literal["connected", "error"] = "connected"
    table_count: int = 0
    total_rows: int = 0
    error_message: str | None = None


class BaseSQLConnector(ABC):
    connector_id: str
    name: str
    dialect: SQLDialectType

    @abstractmethod
    def get_schema_catalog(self, force_refresh: bool = False) -> SchemaCatalog:
        """Introspects tables, columns, foreign keys, sample rows, and statistics."""

    @abstractmethod
    def execute_safe_query(self, sql: str, max_rows: int = 2000) -> QueryExecutionResult:
        """Validates read-only SQL via AST guard, transpiles to target dialect, and executes."""
