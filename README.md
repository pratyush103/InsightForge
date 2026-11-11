# InsightForge

**Multi-Agent AI Business Intelligence Dashboard Generator with Reproducible Data Analysis Pipelines**
*(LangGraph • Python FastAPI • Ollama • SQLite / MySQL / MS SQL Server • React • Apache ECharts)*

---

## Key Capabilities

1. **6-Agent LangGraph BI Orchestrator (`backend/agents/`)**:
   - **SchemaProfilerAgent**: Introspects SQLite, MySQL, and MS SQL Server tables, PK/FK constraints, cardinality, and sample values.
   - **BIPlannerAgent**: Decomposes natural-language prompts into complementary KPI cards, multi-dimensional charts, and data tables.
   - **SQLDataAgent**: Authors dialect-aware SQL, validates read-only safety via **SQLGlot** AST parsing, transpiles dialects (`sqlite`, `mysql`, `tsql`), and self-heals on errors.
   - **PipelineBuilderAgent**: Computes deterministic SHA-256 dataset lineage hashes, 3-period moving averages, and Z-score statistical anomalies (`|Z| >= 1.75`).
   - **VizLayoutAgent**: Compiles **Apache ECharts** specifications and packs widgets into a responsive 12-column **`react-grid-layout`** coordinate system (`lg`, `md`, `sm`).
   - **InsightNarratorAgent**: Synthesizes grounded executive summaries, key metric takeaways, and follow-up analytical questions.

2. **Ollama Auto-Detection, Server Lifecycle & Model Recommendations (`backend/llm/ollama_manager.py`)**:
   - Automatically detects if Ollama is **running**, **installed but stopped**, or **not installed**.
   - Provides a 1-click **"Launch Ollama Server"** action when installed and stopped, or guided installation instructions when not installed.
   - Curates recommended SQL & BI models (`qwen2.5-coder:7b`, `llama3.1:8b`, `deepseek-r1:8b`, `qwen2.5-coder:3b`, `qwen2.5-coder:14b`) with 1-click SSE streaming download progress.

3. **Multi-Dialect Read-Only SQL Connectors (`backend/connectors/`)**:
   - **SQLite** (ships with a pre-seeded 6-table *SaaS & Global Commerce* BI database + CSV-to-SQLite table importer).
   - **MySQL** (`mysql+pymysql`) with read-only session enforcement.
   - **MS SQL Server** (`mssql+pymssql`) with automatic `sqlglot` T-SQL (`TOP N`, `[brackets]`) dialect transpilation.

4. **Dynamic React Dashboard Canvas (`frontend/`)**:
   - Built with **React**, **TypeScript**, **Tailwind CSS**, **Apache ECharts (`echarts-for-react`)**, and **`react-grid-layout`**.
   - Supports 14+ chart archetypes (Area Spline, Multi-Line, Grouped/Stacked/Horizontal Bar, Dual-Axis Combo, Donut, Nightingale Rose, Funnel, Heatmap, Sankey Flow, Radar, Treemap, Scatter), cross-filtering, layout presets (*Executive*, *Bento*, *Compact*), and 1-click zero-LLM pipeline replay.

---

## Quick Start

### 1. Backend (FastAPI + LangGraph)
```bash
pip install -r requirements.txt
uvicorn backend.main:app --reload --port 8000
```

### 2. Frontend (React + Vite)
```bash
cd frontend
npm install
npm run dev
```
