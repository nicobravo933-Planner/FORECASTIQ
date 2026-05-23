"""
generate_forecastiq_dataset.py
==============================
Genera un dataset sintético de ventas retail argentino para forecastiq.

Produce 4 CSVs listos para subir a Supabase:
  - products.csv          (~50 filas)
  - sales.csv             (~36,000 filas, ~2 años diarios)
  - calendar_events.csv   (~80 filas)
  - forecasts.csv         (vacía, estructura lista)

Características del dataset:
  - Estacionalidad anual real (picos diciembre, julio, Hot Sale mayo)
  - Tendencia de crecimiento suave (+15% anual)
  - Ruido realista por categoría
  - Feriados argentinos afectando las ventas
  - Eventos: Hot Sale, Black Friday, Navidad, Año Nuevo, Día de la Madre, etc.
  - 5 categorías: Electrónica, Ropa, Alimentos, Hogar, Deportes

Uso:
  pip install pandas numpy faker
  python generate_forecastiq_dataset.py

Los CSVs se generan en ./data/forecastiq/
"""

import os
import math
import random
import numpy as np
import pandas as pd
from datetime import date, timedelta
from pathlib import Path

# ── Reproducibilidad ──────────────────────────────────────────────────────
SEED = 42
random.seed(SEED)
np.random.seed(SEED)

# ── Config ────────────────────────────────────────────────────────────────
OUTPUT_DIR = Path("./data/forecastiq")
START_DATE = date(2023, 1, 1)
END_DATE = date(2024, 12, 31)  # 2 años exactos
CURRENCY = "ARS"

OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

print("=" * 60)
print("  forecastiq — Generador de Dataset Sintético")
print("  Retail Argentino 2023-2024")
print("=" * 60)


# ══════════════════════════════════════════════════════════════════════════
# 1. PRODUCTOS
# ══════════════════════════════════════════════════════════════════════════

CATEGORIES = {
    "Electrónica": {
        "products": [
            ("Smartphone Samsung A54", 280_000, 0.8),
            ("Smartphone Motorola G84", 210_000, 0.9),
            ("Auriculares Bluetooth JBL", 45_000, 1.5),
            ("Tablet Lenovo M10", 150_000, 0.6),
            ("Smartwatch Xiaomi Band 8", 35_000, 1.2),
            ("Notebook Lenovo IdeaPad", 580_000, 0.4),
            ("Cargador Inalámbrico 20W", 18_000, 2.0),
            ("Parlante Bluetooth JBL Go", 28_000, 1.8),
            ("Mouse Inalámbrico Logitech", 22_000, 1.6),
            ("Teclado Mecánico Redragon", 55_000, 0.7),
        ],
        "seasonality": "electronics",  # pico diciembre, hot sale
        "noise": 0.18,
    },
    "Ropa": {
        "products": [
            ("Remera Básica Hombre", 8_500, 3.0),
            ("Remera Básica Mujer", 7_800, 3.2),
            ("Jeans Skinny Mujer", 24_000, 1.8),
            ("Jean Recto Hombre", 22_000, 1.7),
            ("Campera Polar Hombre", 38_000, 1.2),
            ("Campera Polar Mujer", 35_000, 1.3),
            ("Zapatillas Running Nike", 85_000, 0.9),
            ("Buzo Hoodie Unisex", 28_000, 2.0),
            ("Medias Pack x6", 4_200, 4.5),
            ("Ropa Interior Pack x3", 12_000, 2.8),
        ],
        "seasonality": "clothing",  # pico invierno (julio), verano (enero)
        "noise": 0.22,
    },
    "Alimentos": {
        "products": [
            ("Aceite de Oliva 500ml", 3_800, 5.0),
            ("Café Molido 250g Premium", 4_200, 4.2),
            ("Yerba Mate 500g", 2_100, 6.0),
            ("Proteína Whey 1kg", 28_000, 1.5),
            ("Snack Proteico x12", 18_000, 2.0),
            ("Granola Artesanal 500g", 3_500, 4.8),
            ("Chocolate 70% Cacao 100g", 2_800, 5.5),
            ("Infusiones Orgánicas x20", 3_200, 4.0),
            ("Aceite de Coco 500ml", 5_500, 3.0),
            ("Mix de Frutos Secos 300g", 6_800, 3.5),
        ],
        "seasonality": "food",  # relativamente estable, pico fin de año
        "noise": 0.12,
    },
    "Hogar": {
        "products": [
            ("Sábanas 2 Plazas Algodón", 22_000, 1.5),
            ("Juego de Toallas x3", 18_000, 1.8),
            ("Almohada Viscoelástica", 35_000, 1.0),
            ("Organizador Cajones x6", 8_500, 2.5),
            ("Set Freidora de Aire 5L", 85_000, 0.6),
            ("Aspiradora Ciclónica", 120_000, 0.5),
            ("Hervidor Eléctrico 1.7L", 28_000, 1.2),
            ("Set Sábanas Microfibra", 16_000, 2.0),
            ("Velas Aromáticas Pack x4", 7_200, 3.5),
            ("Difusor Aromas 300ml", 22_000, 1.8),
        ],
        "seasonality": "home",  # pico día de la madre, navidad
        "noise": 0.16,
    },
    "Deportes": {
        "products": [
            ("Mochila Deportiva 30L", 38_000, 1.2),
            ("Colchoneta Yoga 6mm", 18_000, 2.0),
            ("Mancuernas Par 5kg", 24_000, 1.5),
            ("Cuerda de Saltar Pro", 8_500, 3.0),
            ("Botella Térmica 750ml", 12_000, 2.8),
            ("Guantes Boxeo Training", 28_000, 1.3),
            ("Banda Elástica Set x5", 15_000, 2.2),
            ("Pelota Fútbol N°5 Pro", 22_000, 1.8),
            ("Casco Bicicleta MTB", 45_000, 0.9),
            ("Zapatillas Trail Running", 72_000, 0.8),
        ],
        "seasonality": "sports",  # pico enero (propósitos año nuevo), junio
        "noise": 0.20,
    },
}

# Construir tabla products
products_rows = []
product_id = 1
for cat_name, cat_data in CATEGORIES.items():
    for prod_name, base_price, base_demand in cat_data["products"]:
        # SKU estilo real
        sku_prefix = {
            "Electrónica": "ELE",
            "Ropa": "ROP",
            "Alimentos": "ALI",
            "Hogar": "HOG",
            "Deportes": "DEP",
        }[cat_name]
        sku = f"{sku_prefix}-{product_id:04d}"

        # Precio con algo de variación realista
        price = base_price * random.uniform(0.9, 1.1)
        cost = price * random.uniform(0.45, 0.65)  # margen 35-55%

        products_rows.append(
            {
                "id": product_id,
                "sku": sku,
                "name": prod_name,
                "category": cat_name,
                "base_price": round(price, 2),
                "base_cost": round(cost, 2),
                "base_demand": base_demand,  # unidades/día base
                "currency": CURRENCY,
                "active": True,
                "created_at": "2023-01-01T00:00:00Z",
            }
        )
        product_id += 1

df_products = pd.DataFrame(products_rows)
print(f"\n✓ Products:  {len(df_products)} filas")


# ══════════════════════════════════════════════════════════════════════════
# 2. CALENDARIO DE EVENTOS (feriados AR + eventos comerciales)
# ══════════════════════════════════════════════════════════════════════════

calendar_events = []
event_id = 1


def add_event(name, ev_type, date_from, date_to, impact_pct, affects_cats, notes=""):
    global event_id
    calendar_events.append(
        {
            "id": event_id,
            "name": name,
            "event_type": ev_type,  # holiday | promotion | seasonal | external
            "date_from": str(date_from),
            "date_to": str(date_to),
            "impact_pct": impact_pct,  # % sobre demanda base, puede ser negativo
            "affects_categories": affects_cats,  # JSON array como string
            "notes": notes,
            "created_at": "2023-01-01T00:00:00Z",
        }
    )
    event_id += 1


# ── Feriados nacionales 2023 ──
add_event(
    "Año Nuevo 2023",
    "holiday",
    date(2023, 1, 1),
    date(2023, 1, 1),
    -60,
    "all",
    "Feriado nacional",
)
add_event("Carnaval 2023", "holiday", date(2023, 2, 20), date(2023, 2, 21), -40, "all")
add_event(
    "Día Memoria 2023", "holiday", date(2023, 3, 24), date(2023, 3, 24), -50, "all"
)
add_event(
    "Semana Santa 2023", "holiday", date(2023, 4, 6), date(2023, 4, 9), -45, "all"
)
add_event(
    "Día del Trabajador 2023", "holiday", date(2023, 5, 1), date(2023, 5, 1), -55, "all"
)
add_event(
    "25 de Mayo 2023", "holiday", date(2023, 5, 25), date(2023, 5, 25), -50, "all"
)
add_event(
    "Día de la Bandera 2023",
    "holiday",
    date(2023, 6, 20),
    date(2023, 6, 20),
    -50,
    "all",
)
add_event("9 de Julio 2023", "holiday", date(2023, 7, 9), date(2023, 7, 9), -55, "all")
add_event(
    "Día del Maestro 2023", "holiday", date(2023, 9, 11), date(2023, 9, 11), -45, "all"
)
add_event(
    "Día de la Raza 2023", "holiday", date(2023, 10, 16), date(2023, 10, 16), -45, "all"
)
add_event(
    "Día Soberanía 2023", "holiday", date(2023, 11, 20), date(2023, 11, 20), -40, "all"
)
add_event("Navidad 2023", "holiday", date(2023, 12, 25), date(2023, 12, 25), -65, "all")
add_event(
    "Fin de Año 2023", "holiday", date(2023, 12, 31), date(2023, 12, 31), -60, "all"
)

# ── Feriados nacionales 2024 ──
add_event("Año Nuevo 2024", "holiday", date(2024, 1, 1), date(2024, 1, 1), -60, "all")
add_event("Carnaval 2024", "holiday", date(2024, 2, 12), date(2024, 2, 13), -40, "all")
add_event(
    "Día Memoria 2024", "holiday", date(2024, 3, 24), date(2024, 3, 24), -50, "all"
)
add_event(
    "Semana Santa 2024", "holiday", date(2024, 3, 28), date(2024, 3, 31), -45, "all"
)
add_event(
    "Día del Trabajador 2024", "holiday", date(2024, 5, 1), date(2024, 5, 1), -55, "all"
)
add_event(
    "25 de Mayo 2024", "holiday", date(2024, 5, 25), date(2024, 5, 25), -50, "all"
)
add_event(
    "Día de la Bandera 2024",
    "holiday",
    date(2024, 6, 17),
    date(2024, 6, 17),
    -50,
    "all",
)
add_event("9 de Julio 2024", "holiday", date(2024, 7, 9), date(2024, 7, 9), -55, "all")
add_event(
    "Día Soberanía 2024", "holiday", date(2024, 11, 18), date(2024, 11, 18), -40, "all"
)
add_event("Navidad 2024", "holiday", date(2024, 12, 25), date(2024, 12, 25), -65, "all")
add_event(
    "Fin de Año 2024", "holiday", date(2024, 12, 31), date(2024, 12, 31), -60, "all"
)

# ── Eventos comerciales argentinos ──
add_event(
    "Hot Sale 2023",
    "promotion",
    date(2023, 5, 8),
    date(2023, 5, 10),
    +180,
    "Electrónica,Hogar,Deportes",
    "3 días de descuentos masivos",
)
add_event(
    "Día de la Madre 2023",
    "promotion",
    date(2023, 10, 12),
    date(2023, 10, 15),
    +120,
    "Ropa,Hogar,Electrónica",
    "Preventa + día",
)
add_event(
    "Black Friday 2023",
    "promotion",
    date(2023, 11, 24),
    date(2023, 11, 24),
    +200,
    "Electrónica,Ropa,Hogar",
    "Viernes negro",
)
add_event(
    "Cyber Monday 2023",
    "promotion",
    date(2023, 11, 27),
    date(2023, 11, 27),
    +160,
    "Electrónica,Hogar",
    "Lunes cyber",
)
add_event(
    "Pre-Navidad 2023",
    "seasonal",
    date(2023, 12, 15),
    date(2023, 12, 24),
    +90,
    "all",
    "Compras navideñas",
)
add_event(
    "Hot Sale 2024",
    "promotion",
    date(2024, 5, 13),
    date(2024, 5, 15),
    +190,
    "Electrónica,Hogar,Deportes",
)
add_event(
    "Día de la Madre 2024",
    "promotion",
    date(2024, 10, 17),
    date(2024, 10, 20),
    +125,
    "Ropa,Hogar,Electrónica",
)
add_event(
    "Black Friday 2024",
    "promotion",
    date(2024, 11, 29),
    date(2024, 11, 29),
    +210,
    "Electrónica,Ropa,Hogar",
)
add_event(
    "Cyber Monday 2024",
    "promotion",
    date(2024, 12, 2),
    date(2024, 12, 2),
    +170,
    "Electrónica,Hogar",
)
add_event(
    "Pre-Navidad 2024", "seasonal", date(2024, 12, 15), date(2024, 12, 24), +95, "all"
)

# ── Estacionalidades ──
add_event(
    "Temporada Invierno 2023",
    "seasonal",
    date(2023, 6, 21),
    date(2023, 8, 20),
    +35,
    "Ropa",
    "Pico ventas ropa de abrigo",
)
add_event(
    "Temporada Verano 2023-24",
    "seasonal",
    date(2023, 12, 21),
    date(2024, 2, 28),
    +25,
    "Deportes,Ropa",
    "Ropa de verano y deportes",
)
add_event(
    "Temporada Invierno 2024",
    "seasonal",
    date(2024, 6, 21),
    date(2024, 8, 20),
    +40,
    "Ropa",
)
add_event(
    "Vuelta al Cole 2023",
    "seasonal",
    date(2023, 2, 15),
    date(2023, 3, 10),
    +30,
    "Deportes,Hogar",
    "Mochillas y útiles",
)
add_event(
    "Vuelta al Cole 2024",
    "seasonal",
    date(2024, 2, 15),
    date(2024, 3, 10),
    +35,
    "Deportes,Hogar",
)
add_event(
    "Propósitos Año Nuevo 2023",
    "seasonal",
    date(2023, 1, 2),
    date(2023, 1, 31),
    +45,
    "Deportes,Alimentos",
    "Fitness enero",
)
add_event(
    "Propósitos Año Nuevo 2024",
    "seasonal",
    date(2024, 1, 2),
    date(2024, 1, 31),
    +50,
    "Deportes,Alimentos",
)
add_event(
    "Día del Padre 2023",
    "promotion",
    date(2023, 6, 18),
    date(2023, 6, 18),
    +80,
    "Deportes,Electrónica,Ropa",
)
add_event(
    "Día del Padre 2024",
    "promotion",
    date(2024, 6, 16),
    date(2024, 6, 16),
    +85,
    "Deportes,Electrónica,Ropa",
)
add_event(
    "Día del Niño 2023",
    "promotion",
    date(2023, 8, 13),
    date(2023, 8, 13),
    +70,
    "Electrónica,Deportes",
)
add_event(
    "Día del Niño 2024",
    "promotion",
    date(2024, 8, 11),
    date(2024, 8, 11),
    +75,
    "Electrónica,Deportes",
)

df_events = pd.DataFrame(calendar_events)
print(f"✓ Events:    {len(df_events)} filas")


# ══════════════════════════════════════════════════════════════════════════
# 3. VENTAS — el corazón del dataset
# ══════════════════════════════════════════════════════════════════════════


def seasonal_factor(d: date, season_type: str, category: str) -> float:
    """Devuelve multiplicador de demanda según día del año y tipo de estacionalidad."""
    doy = d.timetuple().tm_yday  # día del año 1-365
    dow = d.weekday()  # 0=lun, 6=dom
    month = d.month

    # Factor día de semana (sábado y domingo venden más en retail)
    dow_factor = {0: 0.85, 1: 0.80, 2: 0.83, 3: 0.88, 4: 1.05, 5: 1.30, 6: 1.20}[dow]

    # Factor estacional anual (seno para suavidad)
    if season_type == "electronics":
        # Pico diciembre (día ~355), valle marzo
        annual = 1.0 + 0.45 * math.sin(2 * math.pi * (doy - 60) / 365 * -1 + math.pi)
        # Boost adicional noviembre-diciembre
        if month in (11, 12):
            annual *= 1.3
        elif month in (5,):  # Hot Sale
            annual *= 1.2

    elif season_type == "clothing":
        # Dos picos: invierno (julio) y verano (enero)
        winter = 0.5 * math.sin(2 * math.pi * (doy - 180) / 365)  # pico julio
        summer = 0.3 * math.sin(2 * math.pi * (doy - 10) / 365)  # pico enero
        annual = 1.0 + winter + summer
        if month in (6, 7, 8):  # invierno AR
            annual *= 1.2

    elif season_type == "food":
        # Relativamente estable, leve pico fin de año y semana santa
        annual = 1.0 + 0.15 * math.sin(2 * math.pi * (doy - 350) / 365)
        if month == 12:
            annual *= 1.1
        if month in (4,) and 1 <= d.day <= 10:  # Semana Santa
            annual *= 0.85

    elif season_type == "home":
        # Pico octubre (día de la madre) y diciembre
        annual = 1.0 + 0.30 * math.sin(2 * math.pi * (doy - 280) / 365)
        if month == 12:
            annual *= 1.25
        if month == 10:
            annual *= 1.15

    elif season_type == "sports":
        # Pico enero (propósitos) y junio (día del padre)
        jan_boost = 0.4 * math.exp(-((doy - 15) ** 2) / (2 * 20**2))  # gaussiana enero
        jun_boost = 0.3 * math.exp(-((doy - 167) ** 2) / (2 * 15**2))  # gaussiana junio
        annual = 1.0 + jan_boost + jun_boost
    else:
        annual = 1.0

    return max(0.05, annual * dow_factor)


def event_multiplier(d: date, category: str, events_df: pd.DataFrame) -> float:
    """Multiplica la demanda por eventos activos en la fecha."""
    d_str = str(d)
    mult = 1.0
    for _, ev in events_df.iterrows():
        if ev["date_from"] <= d_str <= ev["date_to"]:
            cats = ev["affects_categories"]
            affects_this = cats == "all" or category in cats
            if affects_this:
                mult += ev["impact_pct"] / 100.0
    return max(0.05, mult)


def trend_factor(d: date) -> float:
    """Tendencia de crecimiento: +15% anual suave."""
    days_from_start = (d - START_DATE).days
    total_days = (END_DATE - START_DATE).days
    return 1.0 + 0.15 * (days_from_start / total_days)


print("\nGenerando ventas diarias (puede tardar 10-20 segundos)...")

sales_rows = []
sale_id = 1

all_dates = [
    START_DATE + timedelta(days=i) for i in range((END_DATE - START_DATE).days + 1)
]

for d in all_dates:
    t = trend_factor(d)
    for _, prod in df_products.iterrows():
        cat = prod["category"]
        season_key = CATEGORIES[cat]["seasonality"]
        noise_lvl = CATEGORIES[cat]["noise"]

        s = seasonal_factor(d, season_key, cat)
        ev = event_multiplier(d, cat, df_events)

        # Demanda base con todos los factores
        base = prod["base_demand"] * s * ev * t
        noise = np.random.lognormal(0, noise_lvl)
        demand = base * noise

        # Cantidad vendida (entero, mínimo 0)
        quantity = max(0, int(round(demand)))

        # Si la demanda es muy baja (feriados), puede ser 0
        if quantity == 0 and random.random() > 0.3:
            continue  # ~70% de los días con 0 demanda no generan registro

        # Precio con inflación argentina simulada (~130% anual 2023, ~150% 2024)
        days_elapsed = (d - START_DATE).days
        if d.year == 2023:
            inflation_mult = 1 + 1.30 * (days_elapsed / 365)
        else:
            days_2024 = (d - date(2024, 1, 1)).days
            inflation_mult = 2.30 + 1.50 * (days_2024 / 365)  # base ya inflado

        unit_price = prod["base_price"] * inflation_mult * random.uniform(0.95, 1.05)
        unit_cost = prod["base_cost"] * inflation_mult * random.uniform(0.93, 1.03)

        revenue = round(unit_price * quantity, 2)
        cost = round(unit_cost * quantity, 2)
        margin = round(revenue - cost, 2)

        # Canal de venta
        channel = random.choices(
            ["online", "marketplace", "whatsapp"], weights=[0.55, 0.35, 0.10]
        )[0]

        sales_rows.append(
            {
                "id": sale_id,
                "date": str(d),
                "product_id": prod["id"],
                "sku": prod["sku"],
                "category": cat,
                "quantity": quantity,
                "unit_price": round(unit_price, 2),
                "unit_cost": round(unit_cost, 2),
                "revenue": revenue,
                "cost": cost,
                "margin": margin,
                "channel": channel,
                "currency": CURRENCY,
            }
        )
        sale_id += 1

df_sales = pd.DataFrame(sales_rows)
print(f"✓ Sales:     {len(df_sales):,} filas")


# ══════════════════════════════════════════════════════════════════════════
# 4. FORECASTS (tabla vacía con estructura lista)
# ══════════════════════════════════════════════════════════════════════════

df_forecasts = pd.DataFrame(
    columns=[
        "id",
        "user_id",
        "dataset_id",
        "product_id",
        "sku",
        "category",
        "model_used",  # moving_average | holt_winters | prophet | lightgbm
        "horizon_months",
        "forecast_date",  # fecha de la predicción
        "predicted_quantity",
        "lower_bound",
        "upper_bound",
        "mape",
        "rmse",
        "mae",
        "model_params",  # JSON
        "created_at",
    ]
)

print("\u2713 Forecasts: tabla vacía (estructura lista)")


# ══════════════════════════════════════════════════════════════════════════
# 5. GUARDAR CSVs
# ══════════════════════════════════════════════════════════════════════════

print("\nGuardando CSVs...")

df_products.to_csv(OUTPUT_DIR / "products.csv", index=False, encoding="utf-8-sig")
df_events.to_csv(OUTPUT_DIR / "calendar_events.csv", index=False, encoding="utf-8-sig")
df_sales.to_csv(OUTPUT_DIR / "sales.csv", index=False, encoding="utf-8-sig")
df_forecasts.to_csv(OUTPUT_DIR / "forecasts.csv", index=False, encoding="utf-8-sig")


# ══════════════════════════════════════════════════════════════════════════
# 6. REPORTE FINAL
# ══════════════════════════════════════════════════════════════════════════


def file_size_mb(path):
    return os.path.getsize(path) / 1_048_576


print("\n" + "=" * 60)
print("  ARCHIVOS GENERADOS")
print("=" * 60)
for fname in ["products.csv", "sales.csv", "calendar_events.csv", "forecasts.csv"]:
    p = OUTPUT_DIR / fname
    mb = file_size_mb(p)
    rows = len(pd.read_csv(p))
    print(f"  {fname:<25} {rows:>7,} filas   {mb:>6.2f} MB")

total_mb = sum(
    file_size_mb(OUTPUT_DIR / f)
    for f in ["products.csv", "sales.csv", "calendar_events.csv", "forecasts.csv"]
)
print(f"\n  Total:                        {total_mb:.2f} MB / 500 MB free tier")
print(f"  Supabase usado:               {total_mb / 500 * 100:.1f}%  ← muy cómodo")

print("\n" + "=" * 60)
print("  RESUMEN DEL DATASET")
print("=" * 60)
print(
    f"\n  Período:      {START_DATE} → {END_DATE} ({(END_DATE - START_DATE).days} días)"
)
print(f"  Productos:    {len(df_products)} SKUs en 5 categorías")
print(f"  Ventas:       {len(df_sales):,} registros")
print(f"  Eventos:      {len(df_events)} (feriados + promociones + estacionalidades)")
print(f"  Moneda:       {CURRENCY} (con inflación simulada ~130% 2023 / ~150% 2024)")

print("\n  Ventas por categoría:")
for cat in df_sales["category"].unique():
    sub = df_sales[df_sales["category"] == cat]
    print(
        f"    {cat:<15} {len(sub):>7,} registros   ${sub['revenue'].sum():>15,.0f} ARS"
    )

print("\n  Canales:")
for ch, cnt in df_sales["channel"].value_counts().items():
    pct = cnt / len(df_sales) * 100
    print(f"    {ch:<15} {cnt:>7,}  ({pct:.1f}%)")

print("\n" + "=" * 60)
print("  PRÓXIMOS PASOS — Subir a Supabase")
print("=" * 60)
print("""
  OPCIÓN A — Supabase Dashboard (más fácil, recomendado):
  --------------------------------------------------------
  1. ir a supabase.com → tu proyecto → Table Editor
  2. "New Table" → crear con las columnas del CSV
     (o usar los SQL de supabase_schema.sql que se genera abajo)
  3. "Import data from CSV" en cada tabla
  4. Listo ✓

  OPCIÓN B — supabase CLI:
  -------------------------
  supabase db push                  # aplica migrations
  psql $DATABASE_URL -c "\\COPY products FROM 'products.csv' CSV HEADER"
  psql $DATABASE_URL -c "\\COPY calendar_events FROM 'calendar_events.csv' CSV HEADER"
  psql $DATABASE_URL -c "\\COPY sales FROM 'sales.csv' CSV HEADER"

  OPCIÓN C — Python + supabase-py (script upload_to_supabase.py):
  ----------------------------------------------------------------
  Se genera automáticamente junto a este script.
""")


# ══════════════════════════════════════════════════════════════════════════
# 7. GENERAR SQL SCHEMA para Supabase
# ══════════════════════════════════════════════════════════════════════════

schema_sql = """-- ============================================================
-- forecastiq — Schema PostgreSQL para Supabase
-- Ejecutar en: Supabase Dashboard → SQL Editor
-- ============================================================

-- Extensión UUID
create extension if not exists "uuid-ossp";

-- ── Products ────────────────────────────────────────────────
create table if not exists products (
  id            serial primary key,
  sku           text unique not null,
  name          text not null,
  category      text not null,
  base_price    numeric(12,2),
  base_cost     numeric(12,2),
  base_demand   numeric(8,2),
  currency      text default 'ARS',
  active        boolean default true,
  created_at    timestamptz default now()
);

-- ── Calendar Events ──────────────────────────────────────────
create table if not exists calendar_events (
  id                  serial primary key,
  name                text not null,
  event_type          text check (event_type in ('holiday','promotion','seasonal','external')),
  date_from           date not null,
  date_to             date not null,
  impact_pct          numeric(8,2),
  affects_categories  text,
  notes               text,
  user_id             uuid references auth.users on delete cascade,  -- null = global
  created_at          timestamptz default now()
);

-- ── Sales ────────────────────────────────────────────────────
create table if not exists sales (
  id            bigserial primary key,
  date          date not null,
  product_id    int references products(id),
  sku           text,
  category      text,
  quantity      int,
  unit_price    numeric(12,2),
  unit_cost     numeric(12,2),
  revenue       numeric(14,2),
  cost          numeric(14,2),
  margin        numeric(14,2),
  channel       text check (channel in ('online','marketplace','whatsapp')),
  currency      text default 'ARS'
);

-- Índices para performance
create index if not exists idx_sales_date        on sales(date);
create index if not exists idx_sales_product_id  on sales(product_id);
create index if not exists idx_sales_category    on sales(category);
create index if not exists idx_sales_channel     on sales(channel);

-- ── Forecasts ────────────────────────────────────────────────
create table if not exists forecasts (
  id                  bigserial primary key,
  user_id             uuid references auth.users on delete cascade,
  product_id          int references products(id),
  sku                 text,
  category            text,
  model_used          text check (model_used in ('moving_average','holt_winters','prophet','lightgbm')),
  horizon_months      int,
  forecast_date       date not null,
  predicted_quantity  numeric(12,4),
  lower_bound         numeric(12,4),
  upper_bound         numeric(12,4),
  mape                numeric(8,4),
  rmse                numeric(12,4),
  mae                 numeric(12,4),
  model_params        jsonb,
  created_at          timestamptz default now()
);

create index if not exists idx_forecasts_user_id    on forecasts(user_id);
create index if not exists idx_forecasts_product_id on forecasts(product_id);
create index if not exists idx_forecasts_date       on forecasts(forecast_date);

-- ── Row Level Security ────────────────────────────────────────
-- Sales y products son públicos (datos de demo)
alter table sales            enable row level security;
alter table products         enable row level security;
alter table calendar_events  enable row level security;
alter table forecasts        enable row level security;

-- Todos pueden leer sales y products (datos de demo públicos)
create policy "sales_public_read"    on sales           for select using (true);
create policy "products_public_read" on products        for select using (true);

-- Calendar events: los globales (user_id null) los ve todo el mundo
create policy "events_public_read"   on calendar_events for select
  using (user_id is null or auth.uid() = user_id);
create policy "events_user_insert"   on calendar_events for insert
  with check (auth.uid() = user_id);
create policy "events_user_delete"   on calendar_events for delete
  using (auth.uid() = user_id);

-- Forecasts: cada usuario solo ve los suyos
create policy "forecasts_user_read"  on forecasts for select
  using (auth.uid() = user_id);
create policy "forecasts_user_insert" on forecasts for insert
  with check (auth.uid() = user_id);
create policy "forecasts_user_delete" on forecasts for delete
  using (auth.uid() = user_id);

-- Comentario final
comment on table sales is 'Ventas históricas retail AR 2023-2024 — dataset de demostración forecastiq';
"""

schema_path = OUTPUT_DIR / "supabase_schema.sql"
schema_path.write_text(schema_sql, encoding="utf-8")
print(f"✓ SQL Schema guardado en: {schema_path}")


# ══════════════════════════════════════════════════════════════════════════
# 8. GENERAR script upload_to_supabase.py
# ══════════════════════════════════════════════════════════════════════════

upload_script = '''"""
upload_to_supabase.py
=====================
Sube los CSVs generados a Supabase via psycopg2 COPY (más rápido que row-by-row).

Requisitos:
  pip install psycopg2-binary pandas python-dotenv

Variables de entorno necesarias en .env:
  SUPABASE_DB_URL=postgresql://postgres:[PASSWORD]@db.[PROJECT].supabase.co:5432/postgres

Obtené la URL en: Supabase Dashboard → Settings → Database → Connection string (URI)
"""

import os
import pandas as pd
import psycopg2
from io import StringIO
from pathlib import Path
from dotenv import load_dotenv

load_dotenv()

DATA_DIR = Path("./data/forecastiq")
DB_URL   = os.getenv("SUPABASE_DB_URL")

if not DB_URL:
    raise ValueError("SUPABASE_DB_URL no configurada en .env")

def copy_csv_to_table(conn, csv_path: Path, table: str):
    """Usa COPY FROM STDIN — orders of magnitude más rápido que INSERT."""
    df = pd.read_csv(csv_path)
    if df.empty:
        print(f"  {table}: vacía, saltando")
        return
    
    buffer = StringIO()
    df.to_csv(buffer, index=False, header=False)
    buffer.seek(0)
    
    with conn.cursor() as cur:
        cur.copy_expert(
            f"COPY {table} ({\\',\\'.join(df.columns)}) FROM STDIN CSV",
            buffer
        )
    conn.commit()
    print(f"  ✓ {table}: {len(df):,} filas subidas")

def main():
    print("Conectando a Supabase...")
    conn = psycopg2.connect(DB_URL)
    
    print("\\nSubiendo tablas (orden respeta FK):")
    copy_csv_to_table(conn, DATA_DIR / "products.csv", "products")
    copy_csv_to_table(conn, DATA_DIR / "calendar_events.csv", "calendar_events")
    copy_csv_to_table(conn, DATA_DIR / "sales.csv", "sales")
    # forecasts se llena con la app
    
    conn.close()
    print("\\n✓ Upload completo")

if __name__ == "__main__":
    main()
'''

upload_path = OUTPUT_DIR / "upload_to_supabase.py"
upload_path.write_text(upload_script, encoding="utf-8")
print(f"✓ Upload script guardado en: {upload_path}")

print(f"\n  Archivos en {OUTPUT_DIR}/")
print("  ├── products.csv")
print("  ├── sales.csv")
print("  ├── calendar_events.csv")
print("  ├── forecasts.csv")
print("  ├── supabase_schema.sql    ← ejecutar primero en Supabase SQL Editor")
print("  └── upload_to_supabase.py  ← opción C para subir via Python")
print("\n¡Dataset listo! 🚀")


# ══════════════════════════════════════════════════════════════════════════
# 9. CSV AGREGADO MENSUAL — para subir a forecastiq Phase 1
# ══════════════════════════════════════════════════════════════════════════
# El usuario sube un CSV simple (fecha + valor). Generamos 3 variantes:
#   - ventas_totales_mensual.csv       → todas las categorías agregadas
#   - ventas_electronica_mensual.csv   → solo Electrónica (clara estacionalidad)
#   - ventas_ropa_mensual.csv          → solo Ropa (2 picos: julio + enero)

print("\n" + "=" * 60)
print("  CSVs AGREGADOS PARA FORECASTIQ APP")
print("=" * 60)

df_sales["date"] = pd.to_datetime(df_sales["date"])
df_sales["month"] = df_sales["date"].dt.to_period("M").dt.to_timestamp()

# ── Total mensual ──
agg_total = (
    df_sales.groupby("month")["quantity"]
    .sum()
    .reset_index()
    .rename(columns={"month": "fecha", "quantity": "ventas_unidades"})
)

# ── Outliers controlados: 2 eventos extremos sobre el total ──
# Mar-2023: quiebre de stock (-65% del valor del mes)
mar23_idx = agg_total[agg_total["fecha"] == "2023-03-01"].index
if len(mar23_idx):
    agg_total.loc[mar23_idx[0], "ventas_unidades"] = int(
        agg_total.loc[mar23_idx[0], "ventas_unidades"] * 0.35
    )

# Sep-2024: evento extraordinario externo (+120% del valor del mes)
sep24_idx = agg_total[agg_total["fecha"] == "2024-09-01"].index
if len(sep24_idx):
    agg_total.loc[sep24_idx[0], "ventas_unidades"] = int(
        agg_total.loc[sep24_idx[0], "ventas_unidades"] * 2.20
    )

agg_total.to_csv(
    OUTPUT_DIR / "ventas_totales_mensual.csv", index=False, encoding="utf-8-sig"
)
print(
    f"  ventas_totales_mensual.csv     {len(agg_total):>3} filas  (outliers: mar-2023 stock, sep-2024 spike)"
)

# ── Electrónica mensual ──
agg_elec = (
    df_sales[df_sales["category"] == "Electrónica"]
    .groupby("month")["quantity"]
    .sum()
    .reset_index()
    .rename(columns={"month": "fecha", "quantity": "ventas_unidades"})
)
agg_elec.to_csv(
    OUTPUT_DIR / "ventas_electronica_mensual.csv", index=False, encoding="utf-8-sig"
)
print(
    f"  ventas_electronica_mensual.csv {len(agg_elec):>3} filas  (pico dic, Hot Sale mayo, Black Friday)"
)

# ── Ropa mensual ──
agg_ropa = (
    df_sales[df_sales["category"] == "Ropa"]
    .groupby("month")["quantity"]
    .sum()
    .reset_index()
    .rename(columns={"month": "fecha", "quantity": "ventas_unidades"})
)
agg_ropa.to_csv(
    OUTPUT_DIR / "ventas_ropa_mensual.csv", index=False, encoding="utf-8-sig"
)
print(
    f"  ventas_ropa_mensual.csv        {len(agg_ropa):>3} filas  (pico invierno jul, verano ene)"
)

print("""
  Uso en forecastiq:
    → Subir ventas_totales_mensual.csv
    → Columna fecha:  fecha
    → Columna target: ventas_unidades
    → Frecuencia:     M (mensual)
    → Detector debería recomendar: Holt-Winters (estacionalidad anual + tendencia)
    → Outliers detectados por MAD: mar-2023 y sep-2024
""")

print("¡Dataset listo! 🚀")
