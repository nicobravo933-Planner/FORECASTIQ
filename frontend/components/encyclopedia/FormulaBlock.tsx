"use client"

/**
 * FormulaBlock — renders a KaTeX math formula with an optional label.
 * Usage: <FormulaBlock label="WAPE" formula="\frac{\sum|y_t - \hat{y}_t|}{\sum y_t}" />
 */

import Box from "@mui/material/Box"
import Typography from "@mui/material/Typography"
import "katex/dist/katex.min.css"
import { InlineMath, BlockMath } from "react-katex"

interface FormulaBlockProps {
  label?: string
  formula: string
  inline?: boolean
  description?: string
}

export function FormulaBlock({ label, formula, inline = false, description }: FormulaBlockProps) {
  return (
    <Box
      sx={{
        my: "1.25rem",
        p: "1rem 1.25rem",
        borderRadius: "0.5rem",
        bgcolor: "rgba(59,130,246,0.05)",
        borderLeft: "0.1875rem solid",
        borderLeftColor: "primary.main",
      }}
    >
      {label && (
        <Typography
          variant="overline"
          sx={{ fontSize: "0.6875rem", fontWeight: 700, color: "primary.main", letterSpacing: "0.08em", mb: "0.5rem", display: "block" }}
        >
          {label}
        </Typography>
      )}
      <Box sx={{ textAlign: inline ? "left" : "center", overflowX: "auto", py: "0.25rem" }}>
        {inline ? <InlineMath math={formula} /> : <BlockMath math={formula} />}
      </Box>
      {description && (
        <Typography
          variant="body2"
          sx={{ mt: "0.625rem", color: "text.secondary", fontSize: "0.8125rem", lineHeight: 1.6 }}
        >
          {description}
        </Typography>
      )}
    </Box>
  )
}
