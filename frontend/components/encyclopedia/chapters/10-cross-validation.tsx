"use client"
import Box from "@mui/material/Box"
import Typography from "@mui/material/Typography"
import Divider from "@mui/material/Divider"
import Alert from "@mui/material/Alert"
import { PythonCodeBlock } from "../PythonCodeBlock"

const CV_CODE = `from sklearn.model_selection import TimeSeriesSplit
import numpy as np

def rolling_cv(model_fn, X, y, n_splits=5):
    """
    Cross-validation temporal. NUNCA usar KFold aleatorio en series de tiempo
    porque mezcla futuro en el entrenamiento (data leakage).
    """
    tscv   = TimeSeriesSplit(n_splits=n_splits)
    wapes  = []

    for fold, (train_idx, val_idx) in enumerate(tscv.split(X)):
        X_train, X_val = X.iloc[train_idx], X.iloc[val_idx]
        y_train, y_val = y.iloc[train_idx], y.iloc[val_idx]

        model = model_fn()
        model.fit(X_train, y_train)
        pred  = model.predict(X_val)

        wape = np.abs(y_val - pred).sum() / np.abs(y_val).sum()
        wapes.append(wape)
        print(f'Fold {fold+1}: WAPE = {wape:.1%}')

    print(f'WAPE promedio: {np.mean(wapes):.1%} ± {np.std(wapes):.1%}')
    return wapes`

export function Chapter10() {
  return (
    <Box>
      <Typography variant="h4" sx={{ fontWeight: 800, mb: "0.5rem" }}>🔬 Validación y Overfitting</Typography>
      <Typography sx={{ color: "text.secondary", fontSize: "1rem", mb: "2rem", fontStyle: "italic" }}>
        TimeSeriesSplit y Rolling CV — cómo evaluar modelos honestamente
      </Typography>

      <Alert severity="error" sx={{ mb: "1.5rem" }}>
        <strong>El error más frecuente en ML con series de tiempo:</strong> usar K-Fold aleatorio.
        Mezcla datos del futuro en el entrenamiento, lo que hace que el modelo parezca mucho mejor de lo que
        realmente es. En producción, el modelo falla.
      </Alert>

      <Typography variant="h6" sx={{ fontWeight: 700, mb: "0.75rem" }}>10.1 ¿Por qué K-Fold aleatorio es incorrecto?</Typography>
      <Typography sx={{ mb: "1.5rem", lineHeight: 1.8 }}>
        K-Fold shuffle mezcla aleatoriamente los datos y los divide. Para series de tiempo, esto significa que
        el <em>período de validación</em> puede incluir datos del 2020 mientras el <em>período de entrenamiento</em>
        incluye datos del 2023. El modelo aprende del futuro — algo imposible en producción.
      </Typography>

      <Divider sx={{ my: "1.5rem" }} />

      <Typography variant="h6" sx={{ fontWeight: 700, mb: "0.75rem" }}>10.2 TimeSeriesSplit — la forma correcta</Typography>
      <Typography sx={{ mb: "1rem", lineHeight: 1.8 }}>
        Con <code>TimeSeriesSplit</code>, cada fold tiene el siguiente esquema:
        el entrenamiento siempre es <em>anterior</em> al período de validación. El tiempo fluye hacia adelante.
      </Typography>
      <Box sx={{ p: "1rem", bgcolor: "action.hover", borderRadius: "0.5rem", mb: "1.5rem", fontFamily: "monospace", fontSize: "0.8125rem" }}>
        <Typography sx={{ fontFamily: "monospace", fontSize: "0.8125rem", mb: "0.25rem" }}>Fold 1: Train [===========]  Val [==]</Typography>
        <Typography sx={{ fontFamily: "monospace", fontSize: "0.8125rem", mb: "0.25rem" }}>Fold 2: Train [===============]  Val [==]</Typography>
        <Typography sx={{ fontFamily: "monospace", fontSize: "0.8125rem", mb: "0.25rem" }}>Fold 3: Train [===================]  Val [==]</Typography>
        <Typography sx={{ fontFamily: "monospace", fontSize: "0.8125rem", mb: "0.25rem" }}>Fold 4: Train [=======================]  Val [==]</Typography>
        <Typography sx={{ fontFamily: "monospace", fontSize: "0.8125rem" }}>Fold 5: Train [===========================]  Val [==]</Typography>
      </Box>

      <PythonCodeBlock code={CV_CODE} title="rolling_cv() — TimeSeriesSplit correcto" />

      <Divider sx={{ my: "1.5rem" }} />

      <Typography variant="h6" sx={{ fontWeight: 700, mb: "0.75rem" }}>10.3 Hold-out temporal</Typography>
      <Typography sx={{ mb: "1.5rem", lineHeight: 1.8 }}>
        Además del CV, siempre reservar un <strong>hold-out final</strong> (los últimos N períodos) que
        nunca se toca durante el entrenamiento ni el CV. Es la prueba definitiva de generalización.
        En ForecastIQ, este es el parámetro <code>test_periods</code>.
      </Typography>

      <Divider sx={{ my: "1.5rem" }} />

      <Typography variant="h6" sx={{ fontWeight: 700, mb: "0.75rem" }}>10.4 Detectar overfitting</Typography>
      <Typography sx={{ mb: "1rem", lineHeight: 1.8 }}>
        Un modelo sobreajustado tiene un WAPE excelente en entrenamiento pero pobre en validación.
      </Typography>
      <Box sx={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.875rem" }}>
          <thead>
            <tr style={{ background: "rgba(59,130,246,0.08)" }}>
              {["Situación", "WAPE Train", "WAPE Val", "Diagnóstico"].map(h => (
                <th key={h} style={{ padding: "0.5rem 1rem", textAlign: "left", fontWeight: 600, borderBottom: "2px solid rgba(0,0,0,0.1)" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[
              ["Ideal", "~10%", "~12%", "✅ Buen modelo"],
              ["Overfitting", "3%", "25%", "❌ Aprende de memoria, no generaliza"],
              ["Underfitting", "30%", "31%", "⚠️ Modelo demasiado simple"],
              ["Data leakage", "0%", "50%", "🚨 Futuro en el entrenamiento"],
            ].map(([sit, tr, val, diag], i) => (
              <tr key={sit as string} style={{ background: i % 2 === 0 ? "transparent" : "rgba(0,0,0,0.02)" }}>
                <td style={{ padding: "0.4rem 1rem" }}>{sit as string}</td>
                <td style={{ padding: "0.4rem 1rem", fontFamily: "monospace" }}>{tr as string}</td>
                <td style={{ padding: "0.4rem 1rem", fontFamily: "monospace" }}>{val as string}</td>
                <td style={{ padding: "0.4rem 1rem" }}>{diag as string}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Box>

      <Alert severity="info" sx={{ mt: "1.5rem", fontSize: "0.8125rem" }}>
        <strong>En ForecastIQ:</strong> cuando WAPE_train &lt;&lt; WAPE_test, aparece automáticamente
        un warning de overfitting en la vista de resultados del forecast. Es la señal de que hay que
        reducir la complejidad del modelo o aumentar los datos de entrenamiento.
      </Alert>
    </Box>
  )
}
