from __future__ import annotations

import hashlib
import io
import json
import re
import time
import urllib.parse
import uuid
from pathlib import Path
from typing import Any

import pandas as pd
from sqlalchemy import create_engine, inspect, text
from sqlalchemy.engine import Engine

from backend.connectors.base import (
    BaseSQLConnector,
    ColumnProfile,
    ConnectorCreateRequest,
    ConnectorInfo,
    QueryExecutionResult,
    SchemaCatalog,
    SQLDialectType,
    TableProfile,
)
from backend.connectors.seed_data import TABLE_DESCRIPTIONS, ensure_sample_sqlite_db
from backend.connectors.sql_guard import SQLValidationError, validate_and_transpile_sql


def build_sqlalchemy_url(req: ConnectorCreateRequest) -> tuple[str, str]:
    """Constructs the SQLAlchemy URL and a clean display label for SQLite, MySQL, or MS SQL Server."""
    if req.connection_uri and req.connection_uri.strip():
        uri = req.connection_uri.strip()
        # Mask password in display
        masked = re.sub(r"://([^:]+):([^@]+)@", r"://\1:****@", uri)
        return uri, masked

    dialect = req.dialect
    if dialect == "sqlite":
        path_str = (req.sqlite_path or "data/insightforge_commerce.db").strip()
        resolved = Path(path_str).resolve()
        return f"sqlite:///{resolved.as_posix()}", resolved.name

    host = (req.host or "localhost").strip()
    user = urllib.parse.quote_plus((req.username or "").strip())
    pwd = urllib.parse.quote_plus(req.password or "")
    db = (req.database or "").strip()
    auth = f"{user}:{pwd}@" if pwd else (f"{user}@" if user else "")

    if dialect == "mysql":
        port = req.port or 3306
        url = f"mysql+pymysql://{auth}{host}:{port}/{db}?charset=utf8mb4"
        return url, f"mysql://{host}:{port}/{db}"

    if dialect == "mssql":
        port = req.port or 1433
        url = f"mssql+pymssql://{auth}{host}:{port}/{db}?charset=utf8"
        return url, f"mssql://{host}:{port}/{db}"

    raise ValueError(f"Unsupported SQL dialect: {dialect}")


class SQLAlchemyConnector(BaseSQLConnector):
    """Unified SQL connector supporting SQLite, MySQL, and Microsoft SQL Server (T-SQL)."""

    def __init__(
        self,
        connector_id: str,
        name: str,
        dialect: SQLDialectType,
        sqlalchemy_url: str,
        database_display: str,
        is_builtin: bool = False,
    ) -> None:
        self.connector_id = connector_id
        self.name = name
        self.dialect = dialect
        self.sqlalchemy_url = sqlalchemy_url
        self.database_display = database_display
        self.is_builtin = is_builtin
        self._catalog_cache: SchemaCatalog | None = None

        connect_args: dict[str, Any] = {}
        if dialect == "sqlite":
            connect_args["check_same_thread"] = False
        elif dialect == "mysql":
            connect_args["connect_timeout"] = 8
        elif dialect == "mssql":
            connect_args["login_timeout"] = 8
            connect_args["timeout"] = 25

        self.engine: Engine = create_engine(
            sqlalchemy_url,
            connect_args=connect_args,
            pool_pre_ping=True,
        )

    def test_connection(self) -> tuple[bool, str | None]:
        """Verifies connectivity with a lightweight read probe."""
        try:
            with self.engine.connect() as conn:
                conn.execute(text("SELECT 1"))
            return True, None
        except Exception as exc:
            return False, str(exc)

    def _quote_ident(self, ident: str) -> str:
        if self.dialect == "mssql":
            return f"[{ident}]"
        if self.dialect == "mysql":
            return f"`{ident}`"
        return f'"{ident}"'

    def get_schema_catalog(self, force_refresh: bool = False) -> SchemaCatalog:
        """Introspects tables, columns, PK/FK constraints, row counts, and sample values."""
        if self._catalog_cache is not None and not force_refresh:
            return self._catalog_cache

        insp = inspect(self.engine)
        table_names = sorted(insp.get_table_names())
        tables: list[TableProfile] = []
        hash_payload: list[str] = [self.dialect, self.database_display]

        with self.engine.connect() as conn:
            for t_name in table_names:
                if t_name.startswith("sqlite_"):
                    continue
                q_table = self._quote_ident(t_name)
                try:
                    row_count = int(conn.execute(text(f"SELECT COUNT(*) FROM {q_table}")).scalar() or 0)
                except Exception:
                    row_count = 0

                pk_constraint = insp.get_pk_constraint(t_name) or {}
                pk_cols = set(pk_constraint.get("constrained_columns", []) or [])

                fk_map: dict[str, str] = {}
                for fk in insp.get_foreign_keys(t_name) or []:
                    referred_table = fk.get("referred_table", "")
                    referred_cols = fk.get("referred_columns", []) or []
                    for loc_col, ref_col in zip(fk.get("constrained_columns", []) or [], referred_cols):
                        fk_map[loc_col] = f"{referred_table}.{ref_col}"

                # Fetch up to 5 sample rows
                sample_rows: list[dict[str, Any]] = []
                try:
                    if self.dialect == "mssql":
                        sample_sql = f"SELECT TOP 5 * FROM {q_table}"
                    else:
                        sample_sql = f"SELECT * FROM {q_table} LIMIT 5"
                    res = conn.execute(text(sample_sql))
                    col_keys = list(res.keys())
                    for r in res.fetchall():
                        sample_rows.append(dict(zip(col_keys, [self._serialize_val(v) for v in r])))
                except Exception:
                    sample_rows = []

                columns_meta = insp.get_columns(t_name)
                col_profiles: list[ColumnProfile] = []

                for col in columns_meta:
                    c_name = col["name"]
                    c_type = str(col.get("type", "TEXT"))
                    q_col = self._quote_ident(c_name)
                    hash_payload.append(f"{t_name}.{c_name}:{c_type}")

                    distinct_cnt: int | None = None
                    min_val: Any | None = None
                    max_val: Any | None = None
                    samples: list[Any] = []

                    try:
                        stat_sql = f"SELECT COUNT(DISTINCT {q_col}), MIN({q_col}), MAX({q_col}) FROM {q_table}"
                        stat_row = conn.execute(text(stat_sql)).fetchone()
                        if stat_row:
                            distinct_cnt = int(stat_row[0] or 0)
                            min_val = self._serialize_val(stat_row[1])
                            max_val = self._serialize_val(stat_row[2])
                    except Exception:
                        pass

                    for s_row in sample_rows:
                        val = s_row.get(c_name)
                        if val is not None and val not in samples:
                            samples.append(val)

                    col_profiles.append(
                        ColumnProfile(
                            name=c_name,
                            data_type=c_type,
                            nullable=bool(col.get("nullable", True)),
                            is_primary_key=c_name in pk_cols,
                            is_foreign_key=c_name in fk_map,
                            foreign_key_target=fk_map.get(c_name),
                            distinct_count=distinct_cnt,
                            min_value=min_val,
                            max_value=max_val,
                            sample_values=samples[:5],
                        )
                    )

                tables.append(
                    TableProfile(
                        table_name=t_name,
                        row_count=row_count,
                        columns=col_profiles,
                        sample_rows=sample_rows,
                        description=TABLE_DESCRIPTIONS.get(t_name, ""),
                    )
                )

        fingerprint = "sha256:" + hashlib.sha256("|".join(hash_payload).encode("utf-8")).hexdigest()[:16]
        catalog = SchemaCatalog(
            connector_id=self.connector_id,
            connector_name=self.name,
            dialect=self.dialect,
            database_display=self.database_display,
            schema_fingerprint=fingerprint,
            tables=tables,
        )
        self._catalog_cache = catalog
        return catalog

    def execute_safe_query(self, sql: str, max_rows: int = 2000) -> QueryExecutionResult:
        """Validates read-only SQL via SQLGlot, transpiles to target dialect, and executes."""
        t0 = time.perf_counter()
        try:
            transpiled_sql = validate_and_transpile_sql(sql, self.dialect, max_rows=max_rows)
        except SQLValidationError as exc:
            return QueryExecutionResult(
                success=False,
                original_sql=sql,
                executed_sql=sql,
                dialect=self.dialect,
                error=str(exc),
                execution_ms=round((time.perf_counter() - t0) * 1000, 2),
            )

        try:
            with self.engine.connect() as conn:
                if self.dialect == "mysql":
                    try:
                        conn.execute(text("SET SESSION TRANSACTION READ ONLY"))
                    except Exception:
                        pass
                result = conn.execute(text(transpiled_sql))
                columns = list(result.keys())
                raw_rows = result.fetchmany(max_rows)
                rows = [
                    {col: self._serialize_val(val) for col, val in zip(columns, r)}
                    for r in raw_rows
                ]
            elapsed = round((time.perf_counter() - t0) * 1000, 2)
            return QueryExecutionResult(
                success=True,
                original_sql=sql,
                executed_sql=transpiled_sql,
                dialect=self.dialect,
                columns=columns,
                rows=rows,
                row_count=len(rows),
                execution_ms=elapsed,
            )
        except Exception as exc:
            elapsed = round((time.perf_counter() - t0) * 1000, 2)
            return QueryExecutionResult(
                success=False,
                original_sql=sql,
                executed_sql=transpiled_sql,
                dialect=self.dialect,
                error=str(exc),
                execution_ms=elapsed,
            )

    def import_csv_table(self, table_name: str, file_bytes: bytes) -> TableProfile:
        """Imports a CSV dataset into a SQLite connector and refreshes the schema catalog."""
        if self.dialect != "sqlite":
            raise ValueError("Direct CSV table upload is only supported on SQLite connectors.")
        clean_name = re.sub(r"[^a-zA-Z0-9_]", "_", table_name.lower()).strip("_") or "uploaded_dataset"
        df = pd.read_csv(io.BytesIO(file_bytes))
        df.columns = [re.sub(r"[^a-zA-Z0-9_]", "_", str(c).lower()).strip("_") for c in df.columns]
        df.to_sql(clean_name, self.engine, if_exists="replace", index=False)
        catalog = self.get_schema_catalog(force_refresh=True)
        for tbl in catalog.tables:
            if tbl.table_name == clean_name:
                return tbl
        raise RuntimeError(f"Table {clean_name} was not found after import.")

    @staticmethod
    def _serialize_val(val: Any) -> Any:
        if val is None or isinstance(val, (int, float, str, bool)):
            return val
        return str(val)


class ConnectorRegistry:
    """Manages active SQLite, MySQL, and MS SQL Server connectors."""

    def __init__(self, data_dir: Path | None = None) -> None:
        self.data_dir = data_dir or (Path(__file__).resolve().parent.parent.parent / "data")
        self.data_dir.mkdir(parents=True, exist_ok=True)
        self._connectors: dict[str, SQLAlchemyConnector] = {}
        self._init_default_sqlite()

    def _init_default_sqlite(self) -> None:
        sample_db = ensure_sample_sqlite_db(self.data_dir / "insightforge_commerce.db")
        default_conn = SQLAlchemyConnector(
            connector_id="default_sqlite_commerce",
            name="InsightForge SaaS & Commerce (SQLite)",
            dialect="sqlite",
            sqlalchemy_url=f"sqlite:///{sample_db.as_posix()}",
            database_display=sample_db.name,
            is_builtin=True,
        )
        self._connectors[default_conn.connector_id] = default_conn

    def list_connectors(self) -> list[ConnectorInfo]:
        infos: list[ConnectorInfo] = []
        for cid, conn in self._connectors.items():
            ok, err = conn.test_connection()
            if ok:
                try:
                    cat = conn.get_schema_catalog()
                    t_count = len(cat.tables)
                    r_count = sum(t.row_count for t in cat.tables)
                    infos.append(
                        ConnectorInfo(
                            id=cid,
                            name=conn.name,
                            dialect=conn.dialect,
                            database_display=conn.database_display,
                            is_builtin=conn.is_builtin,
                            status="connected",
                            table_count=t_count,
                            total_rows=r_count,
                        )
                    )
                except Exception as exc:
                    infos.append(
                        ConnectorInfo(
                            id=cid,
                            name=conn.name,
                            dialect=conn.dialect,
                            database_display=conn.database_display,
                            is_builtin=conn.is_builtin,
                            status="error",
                            error_message=str(exc),
                        )
                    )
            else:
                infos.append(
                    ConnectorInfo(
                        id=cid,
                        name=conn.name,
                        dialect=conn.dialect,
                        database_display=conn.database_display,
                        is_builtin=conn.is_builtin,
                        status="error",
                        error_message=err,
                    )
                )
        return infos

    def get_connector(self, connector_id: str | None = None) -> SQLAlchemyConnector:
        if not connector_id or connector_id not in self._connectors:
            return self._connectors["default_sqlite_commerce"]
        return self._connectors[connector_id]

    def register_connector(self, req: ConnectorCreateRequest) -> ConnectorInfo:
        url, display = build_sqlalchemy_url(req)
        cid = f"{req.dialect}_{uuid.uuid4().hex[:8]}"
        conn = SQLAlchemyConnector(
            connector_id=cid,
            name=req.name.strip() or f"{req.dialect.upper()} ({display})",
            dialect=req.dialect,
            sqlalchemy_url=url,
            database_display=display,
            is_builtin=False,
        )
        ok, err = conn.test_connection()
        if not ok:
            raise ValueError(f"Failed to connect to {req.dialect.upper()} ({display}): {err}")

        cat = conn.get_schema_catalog(force_refresh=True)
        self._connectors[cid] = conn
        return ConnectorInfo(
            id=cid,
            name=conn.name,
            dialect=conn.dialect,
            database_display=conn.database_display,
            is_builtin=False,
            status="connected",
            table_count=len(cat.tables),
            total_rows=sum(t.row_count for t in cat.tables),
        )

    def remove_connector(self, connector_id: str) -> bool:
        conn = self._connectors.get(connector_id)
        if not conn or conn.is_builtin:
            return False
        del self._connectors[connector_id]
        return True


connector_registry = ConnectorRegistry()
