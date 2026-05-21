"""
Drift detector — Fase 8.

Usa Evidently AI para detectar data drift entre la serie histórica
y las últimas semanas de datos.

Flujo:
  1. Recibe serie histórica completa + ventana reciente
  2. Genera reporte Evidently (DataDriftPreset)
  3. Guarda HTML del reporte en Supabase Storage (bucket drift_reports)
  4. Retorna resumen JSON con score por columna y alerta de drift

Uso:
    from app.services.drift_detector import detect_drift
    result = detect_drift(series_full, series_recent, dataset_id)
"""

from __future__ import annotations

from typing import Any

import pandas as pd
import structlog
from evidently.metrics import DataDriftTable
from evidently.pipeline.column_mapping import ColumnMapping
from evidently.report import Report

from app.services.supabase import get_supabase

log = structlog.get_logger(__name__)

# Umbral para considerar drift significativo (configurable)
DRIFT_THRESHOLD = 0.05  # 5% de cambio relativo en WAPE


def detect_drift(
    series_full: pd.Series,
    series_recent: pd.Series,
    dataset_id: str,
    job_id: str | None = None,
) -> dict[str, Any]:
    """
    Compara la distribución de la serie completa vs la ventana reciente.

    Args:
        series_full:   serie histórica completa (referencia)
        series_recent: últimas N semanas (actual)
        dataset_id:    ID del dataset (para guardar reporte en Storage)
        job_id:        ID del job (usado en el nombre del archivo)

    Returns:
        {
            "drift_detected": bool,
            "drift_score": float,       # p-value o score de drift (0-1)
            "drift_share": float,       # fracción de columnas con drift
            "columns": {...},           # score por columna
            "report_url": str | None,   # URL pública del HTML en Storage
        }
    """
    try:
        # Construir DataFrames de referencia y actual
        ref_df = pd.DataFrame({"value": series_full.values})
        cur_df = pd.DataFrame({"value": series_recent.values})

        column_mapping = ColumnMapping(target=None, numerical_features=["value"])

        report = Report(metrics=[DataDriftTable()])
        report.run(
            reference_data=ref_df,
            current_data=cur_df,
            column_mapping=column_mapping,
        )

        # Extraer resultados del reporte
        report_dict = report.as_dict()
        drift_result = _parse_drift_result(report_dict)

        # Guardar HTML del reporte en Supabase Storage
        report_url = _save_report_html(report, dataset_id, job_id)
        drift_result["report_url"] = report_url

        log.info(
            "drift_detection_complete",
            dataset_id=dataset_id,
            drift_detected=drift_result["drift_detected"],
            drift_score=drift_result.get("drift_score"),
        )

        return drift_result

    except Exception as exc:
        log.warning("drift_detection_failed", dataset_id=dataset_id, error=str(exc))
        return {
            "drift_detected": False,
            "drift_score": None,
            "drift_share": None,
            "columns": {},
            "report_url": None,
            "error": str(exc),
        }


def detect_wape_drift(
    current_wape: float,
    historical_wapes: list[float],
) -> bool:
    """
    Alerta simple: el WAPE actual subió >5% relativo vs promedio histórico.
    Usado en celery_app.py para loguear drift_alert=True.

    Args:
        current_wape:     WAPE del run más reciente
        historical_wapes: lista de WAPEs de los últimos N runs

    Returns:
        True si hay drift significativo
    """
    if not historical_wapes or len(historical_wapes) < 2:
        return False

    avg_wape = sum(historical_wapes) / len(historical_wapes)
    if avg_wape == 0:
        return False

    relative_change = (current_wape - avg_wape) / avg_wape
    return relative_change > DRIFT_THRESHOLD


def _parse_drift_result(report_dict: dict[str, Any]) -> dict[str, Any]:
    """Extrae métricas relevantes del reporte Evidently."""
    try:
        metrics = report_dict.get("metrics", [])
        if not metrics:
            return {
                "drift_detected": False,
                "drift_score": None,
                "drift_share": None,
                "columns": {},
            }

        # DataDriftTable devuelve el primer métrico con los resultados de columnas
        drift_table = metrics[0].get("result", {})
        drift_share: float = drift_table.get("share_of_drifted_columns", 0.0)
        number_of_drifted = drift_table.get("number_of_drifted_columns", 0)
        drift_detected: bool = drift_share > 0

        # Score por columna
        columns_info: dict[str, Any] = {}
        for col_data in drift_table.get("drift_by_columns", {}).values():
            col_name = col_data.get("column_name", "value")
            columns_info[col_name] = {
                "drift_detected": col_data.get("drift_detected", False),
                "drift_score": col_data.get("drift_score"),
                "stattest": col_data.get("stattest_name", ""),
                "threshold": col_data.get("stattest_threshold"),
            }

        return {
            "drift_detected": drift_detected,
            "drift_score": drift_share,  # fracción 0-1
            "drift_share": drift_share,
            "number_of_drifted_columns": number_of_drifted,
            "columns": columns_info,
        }
    except Exception as exc:
        log.warning("drift_parse_failed", error=str(exc))
        return {"drift_detected": False, "drift_score": None, "drift_share": None, "columns": {}}


def _save_report_html(
    report: Report,
    dataset_id: str,
    job_id: str | None,
) -> str | None:
    """
    Guarda el HTML de Evidently en Supabase Storage (bucket: drift_reports).
    Retorna la URL pública o None si falla.
    """
    try:
        html_bytes = report.get_html().encode("utf-8")
        filename = f"{dataset_id}/{job_id or 'latest'}.html"

        client = get_supabase()
        # Supabase Storage: upsert para sobreescribir si ya existe
        # Supabase Storage client espera bytes, no BytesIO
        client.storage.from_("drift_reports").upload(
            path=filename,
            file=html_bytes,
            file_options={
                "content-type": "text/html",
                "upsert": "true",
            },
        )

        # URL pública (el bucket drift_reports debe ser público en Supabase)
        url_response = client.storage.from_("drift_reports").get_public_url(filename)
        report_url: str = url_response if isinstance(url_response, str) else str(url_response)

        log.info("drift_report_saved", filename=filename, url=report_url)
        return report_url

    except Exception as exc:
        log.warning("drift_report_save_failed", dataset_id=dataset_id, error=str(exc))
        return None


def get_drift_summary(dataset_id: str) -> dict[str, Any]:
    """
    Recupera el último reporte de drift para un dataset (URL del HTML en Storage).
    Usado por GET /api/drift/{dataset_id}.
    """
    try:
        client = get_supabase()
        prefix = f"{dataset_id}/"

        # Lista todos los reportes del dataset y devuelve el más reciente
        files = client.storage.from_("drift_reports").list(prefix)
        if not files:
            return {"dataset_id": dataset_id, "reports": [], "latest_url": None}

        # Ordenar por nombre (job_id o 'latest')
        file_names = sorted(
            [f["name"] for f in files if f["name"].endswith(".html")],
            reverse=True,
        )

        reports = []
        for name in file_names[:5]:  # últimos 5 reportes
            full_path = f"{dataset_id}/{name}"
            url = client.storage.from_("drift_reports").get_public_url(full_path)
            reports.append({"name": name, "url": url})

        return {
            "dataset_id": dataset_id,
            "reports": reports,
            "latest_url": reports[0]["url"] if reports else None,
        }

    except Exception as exc:
        log.warning("drift_get_summary_failed", dataset_id=dataset_id, error=str(exc))
        return {"dataset_id": dataset_id, "reports": [], "latest_url": None, "error": str(exc)}
