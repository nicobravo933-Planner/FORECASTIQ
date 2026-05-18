"""
Utilidades compartidas para modelos de forecasting.
"""

from __future__ import annotations

# Pandas 2.2+ renombró aliases de frecuencia.
# Mapeamos los alias viejos a los nuevos para compatibilidad.
_FREQ_ALIASES: dict[str, str] = {
    "M":  "ME",   # Month End
    "Q":  "QE",   # Quarter End
    "A":  "YE",   # Year End
    "Y":  "YE",
    "BM": "BME",  # Business Month End
    "BQ": "BQE",
}

# Períodos estacionales por frecuencia (alias nuevos como clave primaria)
SEASONAL_PERIODS: dict[str, int] = {
    "D":   7,
    "W":  52,
    "ME": 12,   # mensual → anual
    "MS": 12,
    "QE":  4,   # trimestral → anual
    "QS":  4,
    "YE":  1,
    "YS":  1,
}


def normalize_freq(freq: str) -> str:
    """Convierte aliases deprecados de pandas 2.2+ al nuevo formato."""
    return _FREQ_ALIASES.get(freq, freq)


def get_seasonal_periods(freq: str) -> int:
    """Retorna el período estacional según la frecuencia normalizada."""
    return SEASONAL_PERIODS.get(normalize_freq(freq), 12)
