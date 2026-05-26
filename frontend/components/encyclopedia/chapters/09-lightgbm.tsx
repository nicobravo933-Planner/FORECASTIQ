"use client"
import Box from "@mui/material/Box"
import Typography from "@mui/material/Typography"
import Divider from "@mui/material/Divider"
import Alert from "@mui/material/Alert"
import { PythonCodeBlock } from "../PythonCodeBlock"
import { WhenToUseCard } from "../WhenToUseCard"
import { TryInForecastButton } from "../TryInForecastButton"

function SectionAnchor({ id }: { id: string }) {
  return <Box component="span" data-section-id={id} sx={{ display: "block", mt: "-1rem", pt: "1rem" }} />
}

const LGB_CODE = `import lightgbm as lgb
import optuna
from sklearn.model_selection import TimeSeriesSplit

def objective(trial, X, y):
    params = {
        'n_estimators':     trial.suggest_int('n_estimators', 100, 1000),
        'max_depth':        trial.suggest_int('max_depth', 3, 8),
        'learning_rate':    trial.suggest_float('learning_rate', 0.01, 0.2, log=True),
        'num_leaves':       trial.suggest_int('num_leaves', 15, 127),
        'min_child_samples':trial.suggest_int('min_child_samples', 5, 50),
        'subsample':        trial.suggest_float('subsample', 0.6, 1.0),
        'colsample_bytree': trial.suggest_float('colsample_bytree', 0.6, 1.0),
        'reg_alpha':        trial.suggest_float('reg_alpha', 1e-4, 10, log=True),
    }
    tscv   = TimeSeriesSplit(n_splits=5)
    scores = []
    for train_idx, val_idx in tscv.split(X):
        X_tr, X_val = X.iloc[train_idx], X.iloc[val_idx]
        y_tr, y_val = y.iloc[train_idx], y.iloc[val_idx]
        model = lgb.LGBMRegressor(**params, random_state=42, verbose=-1)
        model.fit(X_tr, y_tr)
        pred  = model.predict(X_val)
        wape  = np.abs(y_val - pred).sum() / np.abs(y_val).sum()
        scores.append(wape)
    return np.mean(scores)

study = optuna.create_study(direction='minimize', pruner=optuna.pruners.MedianPruner())
study.optimize(lambda t: objective(t, X_train, y_train), n_trials=50, show_progress_bar=True)
best_params = study.best_params`

const FEAT_IMP_CODE = `import pandas as pd
import matplotlib.pyplot as plt

# Feature importance del modelo entrenado
feat_imp = pd.Series(
    model.feature_importances_,
    index=X_train.columns
).sort_values(ascending=False)

# Top 15 features
print(feat_imp.head(15))

# Visualización
feat_imp.head(15).plot(kind='barh', figsize=(8, 5), title='Feature Importance (LightGBM)')
plt.tight_layout()
plt.show()`

const RECURSIVE_CODE = `def predict_recursive(model, last_known, horizon, lag_cols, rolling_cols):
    """
    Predicción recursiva: usa predicciones previas como lags para las siguientes.
    last_known: últimas observaciones reales (DataFrame con features)
    """
    predictions = []
    current_row = last_known.copy()

    for h in range(horizon):
        pred = model.predict(current_row[model.feature_name_])[0]
        predictions.append(pred)

        # Actualizar lags con la predicción recién hecha
        for lag in [1, 2, 3, 6, 12]:
            if f'lag_{lag}' in current_row.columns:
                current_row[f'lag_{lag}'] = current_row.get(f'lag_{lag-1}', pred)
        current_row['lag_1'] = pred

    return predictions`

export function Chapter09() {
  return (
    <Box>
      <Typography variant="h4" sx={{ fontWeight: 800, mb: "0.5rem" }}>🤖 LightGBM y Machine Learning</Typography>
      <Typography sx={{ color: "text.secondary", fontSize: "1rem", mb: "2rem", fontStyle: "italic" }}>
        Gradient boosting sobre features de series de tiempo + Optuna HPO
      </Typography>

      <SectionAnchor id="9-1" />
      <Typography variant="h6" sx={{ fontWeight: 700, mb: "0.75rem" }}>9.1 ¿Por qué Gradient Boosting?</Typography>
      <Typography sx={{ mb: "1.5rem", lineHeight: 1.8 }}>
        Los modelos estadísticos (SARIMA, Holt-Winters) son excelentes para series univariadas limpias. Pero
        cuando tenés <strong>alta variabilidad</strong> (CV &gt; 1.0), muchas variables externas, o patrones
        no lineales, el Gradient Boosting gana. LightGBM en particular es:
      </Typography>
      {[
        ["⚡ Rápido", "Usa histogramas para el split — 10-100x más rápido que XGBoost en datasets grandes"],
        ["🎯 Preciso", "Generalmente gana en benchmarks de series de tiempo con features bien construidos"],
        ["🔧 Flexible", "Acepta cualquier variable externa como feature — precios, clima, promociones"],
        ["📊 Interpretable", "Feature importance nativa — sabés qué variables importan más"],
      ].map(([icon, desc]) => (
        <Box key={icon as string} sx={{ display: "flex", gap: "0.75rem", mb: "0.75rem" }}>
          <Typography sx={{ minWidth: "6.5rem", fontWeight: 600, fontSize: "0.875rem" }}>{icon as string}</Typography>
          <Typography sx={{ color: "text.secondary", fontSize: "0.875rem", lineHeight: 1.7 }}>{desc as string}</Typography>
        </Box>
      ))}

      <Divider sx={{ my: "1.75rem" }} />

      <SectionAnchor id="9-2" />
      <Typography variant="h6" sx={{ fontWeight: 700, mb: "0.75rem" }}>9.2 El flujo de entrenamiento</Typography>
      {[
        "Feature Engineering (Cap. 8) → crear lags, rolling stats, variables de calendario",
        "TimeSeriesSplit → validación cruzada temporal (nunca K-fold aleatorio)",
        "Optuna → búsqueda bayesiana de hiperparámetros minimizando WAPE",
        "Entrenamiento final con los mejores parámetros en todos los datos históricos",
        "Predicción recursiva → se predice período a período usando predicciones previas como lags",
      ].map((step, i) => (
        <Box key={i} sx={{ display: "flex", gap: "0.75rem", mb: "0.625rem", alignItems: "flex-start" }}>
          <Box sx={{ width: "1.5rem", height: "1.5rem", borderRadius: "50%", bgcolor: "primary.main", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, mt: "0.0625rem" }}>
            <Typography sx={{ fontSize: "0.6875rem", fontWeight: 700, color: "#fff" }}>{i + 1}</Typography>
          </Box>
          <Typography sx={{ fontSize: "0.875rem", lineHeight: 1.7 }}>{step}</Typography>
        </Box>
      ))}

      <Divider sx={{ my: "1.75rem" }} />

      <SectionAnchor id="9-3" />
      <Typography variant="h6" sx={{ fontWeight: 700, mb: "0.75rem" }}>9.3 Optuna — Búsqueda bayesiana</Typography>
      <Typography sx={{ mb: "1rem", lineHeight: 1.8 }}>
        Los hiperparámetros de LightGBM tienen un impacto enorme en la precisión. En lugar de un Grid Search
        (fuerza bruta) u Random Search (aleatorio), Optuna usa <strong>optimización bayesiana</strong>:
        aprende qué zonas del espacio de hiperparámetros son prometedoras y las explora más.
      </Typography>
      <Alert severity="info" sx={{ mb: "1.5rem", fontSize: "0.8125rem" }}>
        Con <code>n_trials=50</code> y <code>MedianPruner</code>, Optuna encuentra parámetros muy buenos
        en minutos. El pruner mata los trials malos temprano, ahorrando tiempo de cómputo.
      </Alert>
      <PythonCodeBlock code={LGB_CODE} title="LightGBM + Optuna + TimeSeriesSplit" />

      <Divider sx={{ my: "1.75rem" }} />

      <SectionAnchor id="9-4" />
      <Typography variant="h6" sx={{ fontWeight: 700, mb: "0.75rem" }}>9.4 Feature importance</Typography>
      <Typography sx={{ mb: "1rem", lineHeight: 1.8 }}>
        Una de las ventajas de LightGBM sobre SARIMA/Holt-Winters es la <strong>interpretabilidad</strong>:
        podés ver exactamente qué features impactaron más en el pronóstico. Esto es valioso para:
        detectar cuándo los lags de largo plazo no aportan (eliminarlos acelera el modelo), confirmar que
        las variables de eventos tienen impacto real, y explicar el modelo al negocio.
      </Typography>
      <PythonCodeBlock code={FEAT_IMP_CODE} title="Feature importance — visualización" />
      <Alert severity="info" sx={{ mt: "1rem", mb: "1.5rem", fontSize: "0.8125rem" }}>
        <strong>ForecastIQ muestra la feature importance</strong> en el Tab &quot;Parámetros&quot; del resultado del
        forecast cuando se usa LightGBM. Los eventos del Calendario aparecen como columnas <code>is_*</code>.
      </Alert>

      <Divider sx={{ my: "1.75rem" }} />

      <SectionAnchor id="9-5" />
      <Typography variant="h6" sx={{ fontWeight: 700, mb: "0.75rem" }}>9.5 Predicción recursiva</Typography>
      <Typography sx={{ mb: "1rem", lineHeight: 1.8 }}>
        LightGBM no predice directamente una secuencia de h períodos — predice <strong>un período a la vez</strong>.
        Para proyectar el horizonte completo, se usa predicción recursiva: el valor predicho para t+1 se usa
        como lag_1 para predecir t+2, y así sucesivamente.
      </Typography>
      <Typography sx={{ mb: "1.5rem", lineHeight: 1.8 }}>
        Esto acumula error: el error en t+1 afecta t+2, que afecta t+3, etc. Por eso LightGBM suele tener
        intervalos de confianza más anchos que SARIMA en horizontes largos, aunque sea más preciso en
        horizontes cortos. La solución es no usar horizontes excesivamente largos con este modelo.
      </Typography>
      <PythonCodeBlock code={RECURSIVE_CODE} title="Predicción recursiva con lags actualizados" />

      <WhenToUseCard
        model="LightGBM"
        minObservations={104}
        requirements={[
          { condition: "Observaciones", value: "≥ 104 (para features de lag_12)" },
          { condition: "CV (std/media)", value: "> 1.0 (demanda errática)" },
          { condition: "Variables externas", value: "Opcional — potencia el modelo" },
          { condition: "Quality Score", value: "≥ 80 pts para mejores resultados" },
        ]}
        proscons={{
          pros: [
            "Captura patrones no lineales",
            "Acepta variables externas (precios, clima)",
            "Feature importance interpretable",
            "Optuna optimiza automáticamente",
          ],
          cons: [
            "Necesita Feature Engineering previo",
            "Riesgo de overfitting sin CV temporal",
            "No da intervalos de confianza nativos",
            "Predicción recursiva acumula error",
          ],
        }}
      />

      <TryInForecastButton modelId="lightgbm" label="Probar LightGBM en Forecast" />

      <Divider sx={{ my: "1.75rem" }} />

      {/* 9-6 */}
      <SectionAnchor id="9-6" />
      <Typography variant="h6" sx={{ fontWeight: 700, mb: "0.75rem" }}>9.6 Optuna y el cache de hiperparámetros</Typography>
      <Typography sx={{ mb: "1rem", lineHeight: 1.8 }}>
        Cuando correás LightGBM por primera vez, Optuna ejecuta <strong>50 trials</strong> de
        búsqueda de hiperparámetros. Cada trial entrena un modelo con TimeSeriesSplit de 5 folds.
        Eso equivale a <strong>50 × 5 = 250 entrenamientos</strong> en total. En un dataset mensual
        típico de 3-5 años, tarda entre <strong>30 y 90 segundos</strong>.
      </Typography>
      <Typography sx={{ mb: "1.5rem", lineHeight: 1.8 }}>
        ForecastIQ <strong>guarda en cache</strong> los mejores hiperparámetros por dataset y
        frecuencia. La segunda vez que corraás LightGBM sobre el mismo dataset, los parámetros
        se recuperan instantáneamente — <strong>cero tiempo de HPO</strong>.
      </Typography>

      {/* Cache flow visual */}
      <Box sx={{ my: "1.5rem", p: "1rem 1.25rem", borderRadius: "0.75rem", border: "1px solid", borderColor: "divider", bgcolor: "action.hover" }}>
        <Typography sx={{ fontSize: "0.75rem", fontWeight: 700, color: "text.disabled", textTransform: "uppercase", letterSpacing: "0.05em", mb: "0.75rem" }}>Flujo del cache HPO en ForecastIQ</Typography>
        {[
          { step: "1", label: "Primera vez",     desc: "Optuna corre 50 trials (~30–90s). Los mejores parámetros se guardan en Supabase con key {dataset_id}_{freq}.", color: "warning.main" },
          { step: "2", label: "Corridas siguientes", desc: "Cache hit instantáneo. El modelo entrena directamente con los parámetros guardados — sin espera.", color: "success.main" },
          { step: "3", label: "Re-optimizar manual", desc: "Botón \u201cRe-optimizar\u201d en ForecastIQ invalida el cache y corre Optuna de nuevo con los datos actualizados.", color: "info.main" },
        ].map(({ step, label, desc, color }) => (
          <Box key={step} sx={{ display: "flex", gap: "0.875rem", mb: "0.75rem", alignItems: "flex-start" }}>
            <Box sx={{ width: "1.625rem", height: "1.625rem", borderRadius: "50%", bgcolor: color, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <Typography sx={{ fontSize: "0.6875rem", fontWeight: 700, color: "#fff" }}>{step}</Typography>
            </Box>
            <Box>
              <Typography sx={{ fontSize: "0.8125rem", fontWeight: 600, mb: "0.125rem" }}>{label}</Typography>
              <Typography sx={{ fontSize: "0.8125rem", color: "text.secondary", lineHeight: 1.6 }}>{desc}</Typography>
            </Box>
          </Box>
        ))}
      </Box>

      <Alert severity="info" sx={{ mb: "1.5rem", fontSize: "0.8125rem" }}>
        <strong>¿Cuándo tiene sentido re-optimizar?</strong>
        <Box component="ul" sx={{ mt: "0.5rem", mb: 0, pl: "1.25rem" }}>
          <li>Agregás 6+ meses nuevos de datos (el rango cambió significativamente)</li>
          <li>Detectaste un cambio estructural: nueva estacionalidad, corte de tendencia</li>
          <li>Los parámetros del cache dan WAPE claramente peor en el nuevo período</li>
        </Box>
        <Typography sx={{ mt: "0.5rem", fontSize: "0.8125rem" }}>
          Si solo agregaste 1-2 meses rutinarios, el cache es suficiente. Optuna no va a encontrar
          parámetros significativamente mejores con cambios pequeños en los datos.
        </Typography>
      </Alert>

      <Alert severity="warning" sx={{ mb: "1.5rem", fontSize: "0.8125rem" }}>
        <strong>Modo local sin Supabase:</strong> en desarrollo sin conexión a Supabase, el cache
        no persiste entre sesiones. Optuna corre siempre al iniciar (\u201eslow path\u201f). Esto es
        esperado y no un bug. En producción con Supabase activo, el cache funciona normalmente.
      </Alert>
    </Box>
  )
}
