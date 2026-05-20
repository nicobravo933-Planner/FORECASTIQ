"use client";

/**
 * MLflowLink — MLOps Phase 8
 * Button that opens the Dagshub MLflow experiment UI for the current user.
 * Only visible in production (dagshub_url is populated by the backend).
 * In dev mode, shows a local MLflow fallback URL.
 */

import ScienceIcon from "@mui/icons-material/Science";
import Button from "@mui/material/Button";
import Tooltip from "@mui/material/Tooltip";

interface MLflowLinkProps {
  /** Full Dagshub experiment URL — populated by backend only in prod. */
  dagshabUrl?: string | null;
  /** Dataset ID used to scope the experiment view. */
  datasetId?: string | null;
}

export function MLflowLink({ dagshabUrl, datasetId }: MLflowLinkProps) {
  // In dev there is no Dagshub URL — fall back to local MLflow UI
  const href =
    dagshabUrl ||
    (datasetId
      ? `http://localhost:5000/#/experiments`
      : "http://localhost:5000");

  const label = dagshabUrl ? "Ver en Dagshub" : "MLflow local";

  return (
    <Tooltip
      title={
        dagshabUrl
          ? "Abre el panel de experimentos en Dagshub"
          : "Abre MLflow UI local (solo disponible en desarrollo)"
      }
    >
      <Button
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        component="a"
        variant="contained"
        size="small"
        startIcon={<ScienceIcon />}
        sx={{ fontSize: "0.8125rem", textTransform: "none" }}
      >
        {label}
      </Button>
    </Tooltip>
  );
}
