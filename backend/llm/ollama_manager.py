from __future__ import annotations

import asyncio
import json
import os
import platform
import shutil
import subprocess
from pathlib import Path
from typing import Any, AsyncGenerator, Literal

import httpx
from pydantic import BaseModel, Field

OLLAMA_DEFAULT_BASE_URL = os.environ.get("OLLAMA_HOST", "http://127.0.0.1:11434")
if not OLLAMA_DEFAULT_BASE_URL.startswith("http"):
    OLLAMA_DEFAULT_BASE_URL = f"http://{OLLAMA_DEFAULT_BASE_URL}"


class RecommendedModelSpec(BaseModel):
    id: str
    name: str
    tag: str
    category: Literal["SQL & BI Specialist", "Balanced Reasoning", "Deep Analytical Reasoning", "Fast & Lightweight", "Enterprise Pro"]
    size_gb: float
    min_ram_gb: int
    description: str
    strengths: list[str]
    recommended_for: str
    is_installed: bool = False
    is_top_pick: bool = False


class InstalledModelInfo(BaseModel):
    name: str
    size_gb: float
    family: str = "unknown"
    parameter_size: str = "unknown"
    quantization_level: str = "unknown"
    modified_at: str = ""
    is_running: bool = False


class OllamaSystemStatus(BaseModel):
    status: Literal["running", "installed_stopped", "not_installed"]
    base_url: str
    binary_path: str | None = None
    cli_version: str | None = None
    os_platform: str = Field(default_factory=lambda: platform.system().lower())
    installed_models: list[InstalledModelInfo] = Field(default_factory=list)
    selected_model: str | None = None
    recommended_models: list[RecommendedModelSpec] = Field(default_factory=list)
    action_required: Literal["none", "launch_ollama", "install_ollama", "pull_model"] = "none"
    message: str = ""
    install_guide: dict[str, Any] = Field(default_factory=dict)


RECOMMENDED_MODELS_CATALOG: list[dict[str, Any]] = [
    {
        "id": "qwen2.5-coder:7b",
        "name": "Qwen 2.5 Coder 7B",
        "tag": "qwen2.5-coder:7b",
        "category": "SQL & BI Specialist",
        "size_gb": 4.7,
        "min_ram_gb": 8,
        "description": "Best-in-class open model for multi-dialect SQL generation (SQLite, MySQL, MS SQL T-SQL), schema reasoning, and strict JSON output.",
        "strengths": ["Dialect-aware SQL (T-SQL, MySQL, SQLite)", "Strict JSON schema adherence", "Fast local inference"],
        "recommended_for": "Default choice for 8GB–16GB RAM systems",
        "is_top_pick": True,
    },
    {
        "id": "llama3.1:8b",
        "name": "Llama 3.1 8B Instruct",
        "tag": "llama3.1:8b",
        "category": "Balanced Reasoning",
        "size_gb": 4.9,
        "min_ram_gb": 8,
        "description": "Meta's flagship 8B model offering strong executive business intelligence storytelling, KPI interpretation, and SQL planning.",
        "strengths": ["Executive BI narration", "Multi-turn follow-up queries", "General analytical planning"],
        "recommended_for": "Balanced SQL + executive insight summaries",
        "is_top_pick": True,
    },
    {
        "id": "deepseek-r1:8b",
        "name": "DeepSeek R1 8B",
        "tag": "deepseek-r1:8b",
        "category": "Deep Analytical Reasoning",
        "size_gb": 4.9,
        "min_ram_gb": 8,
        "description": "Reasoning-first model that excels at decomposing ambiguous business questions into multi-step statistical & cohort pipelines.",
        "strengths": ["Chain-of-thought BI planning", "Root-cause & anomaly hypothesis generation", "Complex CTE decomposition"],
        "recommended_for": "Complex multi-table analytical workflows",
        "is_top_pick": False,
    },
    {
        "id": "qwen2.5-coder:3b",
        "name": "Qwen 2.5 Coder 3B",
        "tag": "qwen2.5-coder:3b",
        "category": "Fast & Lightweight",
        "size_gb": 1.9,
        "min_ram_gb": 4,
        "description": "Ultra-fast compact coding and SQL model that runs smoothly even on CPU-only laptops or constrained memory.",
        "strengths": ["Sub-second token generation", "Low memory footprint (<2.5 GB)", "Strong basic SQL & JSON"],
        "recommended_for": "Laptops with 4GB–8GB RAM or integrated GPUs",
        "is_top_pick": False,
    },
    {
        "id": "qwen2.5-coder:14b",
        "name": "Qwen 2.5 Coder 14B",
        "tag": "qwen2.5-coder:14b",
        "category": "Enterprise Pro",
        "size_gb": 9.0,
        "min_ram_gb": 16,
        "description": "Near-frontier accuracy on complex multi-join schemas, window functions, and MS SQL Server / MySQL query optimization.",
        "strengths": ["Enterprise multi-join SQL", "Window functions & cohort queries", "Zero-shot schema accuracy"],
        "recommended_for": "Workstations with 16GB+ RAM or dedicated GPU",
        "is_top_pick": False,
    },
]


class OllamaManager:
    """Manages local Ollama detection, daemon startup, model selection, and model pulling."""

    def __init__(self, base_url: str = OLLAMA_DEFAULT_BASE_URL) -> None:
        self.base_url = base_url.rstrip("/")
        self._selected_model: str | None = None
        self._cached_binary: str | None = None
        self._cached_version: str | None = None
        self._binary_checked: bool = False

    def find_ollama_binary(self) -> str | None:
        """Detects the ollama executable across PATH and standard OS installation directories."""
        in_path = shutil.which("ollama")
        if in_path:
            return in_path

        candidates: list[Path] = []
        if os.name == "nt":
            local_app_data = os.environ.get("LOCALAPPDATA", "")
            program_files = os.environ.get("ProgramFiles", "C:\\Program Files")
            user_profile = os.environ.get("USERPROFILE", "")
            if local_app_data:
                candidates.append(Path(local_app_data) / "Programs" / "Ollama" / "ollama.exe")
            if user_profile:
                candidates.append(Path(user_profile) / "AppData" / "Local" / "Programs" / "Ollama" / "ollama.exe")
            candidates.append(Path(program_files) / "Ollama" / "ollama.exe")
        else:
            candidates.extend([
                Path("/usr/local/bin/ollama"),
                Path("/opt/homebrew/bin/ollama"),
                Path("/usr/bin/ollama"),
            ])

        for candidate in candidates:
            if candidate.exists() and candidate.is_file():
                return str(candidate)
        return None

    def get_cli_version(self, binary_path: str | None = None, force_refresh: bool = False) -> str | None:
        """Gets the installed Ollama CLI version without requiring the server to run."""
        if self._cached_version is not None and not force_refresh:
            return self._cached_version
        exe = binary_path or self.find_ollama_binary()
        if not exe:
            return None
        try:
            clean_env = {
                **os.environ,
                "NO_PROXY": "127.0.0.1,localhost",
                "no_proxy": "127.0.0.1,localhost",
                "HTTP_PROXY": "",
                "HTTPS_PROXY": "",
                "http_proxy": "",
                "https_proxy": "",
            }
            proc = subprocess.run(
                [exe, "--version"],
                stdin=subprocess.DEVNULL,
                capture_output=True,
                text=True,
                timeout=1.0,
                check=False,
                env=clean_env,
            )
            output = (proc.stdout or proc.stderr or "").strip()
            for line in output.splitlines():
                if "version" in line.lower():
                    ver = line.replace("Warning: could not connect to a running Ollama instance", "").strip()
                    self._cached_version = ver
                    return ver
            ver = output.splitlines()[-1].strip() if output else "installed"
            self._cached_version = ver
            return ver
        except Exception:
            self._cached_version = "installed"
            return "installed"

    async def get_status(self, force_refresh: bool = False) -> OllamaSystemStatus:
        """Performs full auto-detection of Ollama installation, server state, and installed models."""
        if not self._binary_checked or force_refresh:
            self._cached_binary = self.find_ollama_binary()
            self._binary_checked = True
        binary_path = self._cached_binary
        cli_version: str | None = "Installed" if binary_path else None

        install_guide = {
            "windows_installer_url": "https://ollama.com/download/OllamaSetup.exe",
            "windows_winget_cmd": "winget install -e --id Ollama.Ollama",
            "mac_brew_cmd": "brew install --cask ollama",
            "linux_curl_cmd": "curl -fsSL https://ollama.com/install.sh | sh",
            "official_site": "https://ollama.com/download",
            "serve_cmd": "ollama serve",
        }

        installed_models: list[InstalledModelInfo] = []
        running_names: set[str] = set()
        server_reachable = False

        try:
            async with httpx.AsyncClient(timeout=0.8, trust_env=False, verify=False) as client:
                tags_resp = await client.get(f"{self.base_url}/api/tags")
                if tags_resp.status_code == 200:
                    server_reachable = True
                    tags_data = tags_resp.json()
                    try:
                        ver_resp = await client.get(f"{self.base_url}/api/version")
                        if ver_resp.status_code == 200:
                            v_str = ver_resp.json().get("version")
                            if v_str:
                                cli_version = f"v{v_str}"
                    except Exception:
                        pass
                    try:
                        ps_resp = await client.get(f"{self.base_url}/api/ps")
                        if ps_resp.status_code == 200:
                            for m in ps_resp.json().get("models", []):
                                running_names.add(m.get("name", ""))
                    except Exception:
                        pass

                    for raw in tags_data.get("models", []):
                        name = raw.get("name", "")
                        size_bytes = raw.get("size", 0) or 0
                        details = raw.get("details", {}) or {}
                        installed_models.append(
                            InstalledModelInfo(
                                name=name,
                                size_gb=round(size_bytes / (1024 ** 3), 2),
                                family=details.get("family", "llm"),
                                parameter_size=details.get("parameter_size", ""),
                                quantization_level=details.get("quantization_level", ""),
                                modified_at=raw.get("modified_at", ""),
                                is_running=name in running_names,
                            )
                        )
        except Exception:
            server_reachable = False

        installed_tag_set = {m.name.lower() for m in installed_models}
        installed_base_set = {m.name.split(":")[0].lower() for m in installed_models}

        recommended_list: list[RecommendedModelSpec] = []
        for item in RECOMMENDED_MODELS_CATALOG:
            tag_lower = item["tag"].lower()
            base_lower = tag_lower.split(":")[0]
            is_inst = tag_lower in installed_tag_set or (
                tag_lower.endswith(":latest") and base_lower in installed_base_set
            )
            recommended_list.append(RecommendedModelSpec(**item, is_installed=is_inst))

        # Auto-select the best installed model if none explicitly selected or if selected is missing
        if installed_models:
            available_names = [m.name for m in installed_models]
            if self._selected_model not in available_names:
                self._selected_model = self._pick_best_installed_model(available_names)
        else:
            self._selected_model = None

        if server_reachable:
            if installed_models:
                return OllamaSystemStatus(
                    status="running",
                    base_url=self.base_url,
                    binary_path=binary_path,
                    cli_version=cli_version,
                    installed_models=installed_models,
                    selected_model=self._selected_model,
                    recommended_models=recommended_list,
                    action_required="none",
                    message=f"Ollama is online with {len(installed_models)} model(s) ready.",
                    install_guide=install_guide,
                )
            else:
                return OllamaSystemStatus(
                    status="running",
                    base_url=self.base_url,
                    binary_path=binary_path,
                    cli_version=cli_version,
                    installed_models=[],
                    selected_model=None,
                    recommended_models=recommended_list,
                    action_required="pull_model",
                    message="Ollama server is running, but no models are installed yet. Pull a recommended model below.",
                    install_guide=install_guide,
                )

        if binary_path:
            return OllamaSystemStatus(
                status="installed_stopped",
                base_url=self.base_url,
                binary_path=binary_path,
                cli_version=cli_version,
                installed_models=[],
                selected_model=None,
                recommended_models=recommended_list,
                action_required="launch_ollama",
                message=f"Ollama is installed ({cli_version or binary_path}), but the background server is not running. Click 'Launch Ollama' to start it.",
                install_guide=install_guide,
            )

        return OllamaSystemStatus(
            status="not_installed",
            base_url=self.base_url,
            binary_path=None,
            cli_version=None,
            installed_models=[],
            selected_model=None,
            recommended_models=recommended_list,
            action_required="install_ollama",
            message="Ollama was not detected on your system. Install Ollama to enable local LLM multi-agent SQL & BI generation.",
            install_guide=install_guide,
        )

    def _pick_best_installed_model(self, names: list[str]) -> str:
        """Selects the strongest SQL/coding/reasoning model among installed tags."""
        priority_prefixes = [
            "qwen2.5-coder",
            "qwen2.5",
            "llama3.1",
            "llama3.3",
            "deepseek-r1",
            "deepseek-coder",
            "llama3.2",
            "codellama",
            "mistral",
            "gemma2",
        ]
        for prefix in priority_prefixes:
            for name in names:
                if name.lower().startswith(prefix):
                    return name
        return names[0]

    def set_selected_model(self, model_name: str) -> None:
        self._selected_model = model_name

    async def start_server(self) -> OllamaSystemStatus:
        """Launches `ollama serve` in the background if Ollama is installed and waits for readiness."""
        current = await self.get_status()
        if current.status == "running":
            return current

        binary_path = self.find_ollama_binary()
        if not binary_path:
            return current

        creationflags = 0
        if os.name == "nt":
            creationflags = (
                getattr(subprocess, "DETACHED_PROCESS", 0x00000008)
                | getattr(subprocess, "CREATE_NEW_PROCESS_GROUP", 0x00000200)
                | getattr(subprocess, "CREATE_NO_WINDOW", 0x08000000)
            )

        try:
            subprocess.Popen(
                [binary_path, "serve"],
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
                stdin=subprocess.DEVNULL,
                creationflags=creationflags,
                close_fds=True,
            )
        except Exception as exc:
            current.message = f"Failed to start Ollama daemon ({exc}). Please run `ollama serve` in your terminal."
            return current

        # Poll up to 8 seconds for the server to listen on 11434
        for _ in range(16):
            await asyncio.sleep(0.5)
            updated = await self.get_status()
            if updated.status == "running":
                return updated

        return await self.get_status()

    async def pull_model_stream(self, model_tag: str) -> AsyncGenerator[str, None]:
        """Streams model download progress from Ollama's /api/pull endpoint as SSE events."""
        status = await self.get_status()
        if status.status == "installed_stopped":
            status = await self.start_server()
        if status.status != "running":
            yield f"data: {json.dumps({'status': 'error', 'error': 'Ollama server is not running. Please launch Ollama first.'})}\n\n"
            return

        try:
            async with httpx.AsyncClient(timeout=None, trust_env=False, verify=False) as client:
                async with client.stream(
                    "POST",
                    f"{self.base_url}/api/pull",
                    json={"name": model_tag, "stream": True},
                ) as resp:
                    if resp.status_code != 200:
                        body = await resp.aread()
                        yield f"data: {json.dumps({'status': 'error', 'error': body.decode('utf-8', errors='replace')})}\n\n"
                        return

                    async for line in resp.aiter_lines():
                        if not line.strip():
                            continue
                        try:
                            payload = json.loads(line)
                            total = payload.get("total", 0)
                            completed = payload.get("completed", 0)
                            pct = round((completed / total) * 100, 1) if total else None
                            event = {
                                "model": model_tag,
                                "status": payload.get("status", "downloading"),
                                "total": total,
                                "completed": completed,
                                "percent": pct,
                            }
                            yield f"data: {json.dumps(event)}\n\n"
                        except Exception:
                            continue

            self._selected_model = model_tag
            yield f"data: {json.dumps({'model': model_tag, 'status': 'success', 'percent': 100.0})}\n\n"
        except Exception as exc:
            yield f"data: {json.dumps({'model': model_tag, 'status': 'error', 'error': str(exc)})}\n\n"


ollama_manager = OllamaManager()
