"use client"

/**
 * DataPreview — shows the first 10 rows of the uploaded CSV as a table.
 * Uses a plain MUI Table (no DataGrid dependency needed for 10 rows).
 */

import Box from "@mui/material/Box"
import Typography from "@mui/material/Typography"
import Table from "@mui/material/Table"
import TableBody from "@mui/material/TableBody"
import TableCell from "@mui/material/TableCell"
import TableContainer from "@mui/material/TableContainer"
import TableHead from "@mui/material/TableHead"
import TableRow from "@mui/material/TableRow"
import Chip from "@mui/material/Chip"
import type { DatasetPreview } from "@/lib/types"

interface DataPreviewProps {
  preview: DatasetPreview
}

const DTYPE_COLOR: Record<string, "primary" | "secondary" | "default"> = {
  datetime: "secondary",
  numeric: "primary",
  text: "default",
}

export function DataPreview({ preview }: DataPreviewProps) {
  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap" }}>
        <Typography variant="h6" color="text.primary">
          Vista previa
        </Typography>
        {preview.columns.map((col) => (
          <Chip
            key={col.name}
            label={`${col.name} · ${col.dtype}`}
            size="small"
            color={DTYPE_COLOR[col.dtype] ?? "default"}
            variant="outlined"
            sx={{ fontSize: "0.75rem" }}
          />
        ))}
      </Box>

      <TableContainer
        sx={{
          bgcolor: "background.paper",
          borderRadius: "0.75rem",
          border: "1px solid",
          borderColor: "divider",
          maxHeight: "18rem",
          overflow: "auto",
        }}
      >
        <Table size="small" stickyHeader>
          <TableHead>
            <TableRow>
              {preview.columns.map((col) => (
                <TableCell
                  key={col.name}
                  sx={{
                    bgcolor: "background.paper",
                    color: "text.secondary",
                    fontSize: "0.75rem",
                    fontWeight: 600,
                    whiteSpace: "nowrap",
                    borderBottom: "1px solid",
                    borderColor: "divider",
                  }}
                >
                  {col.name}
                </TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {preview.rows.map((row, i) => (
              <TableRow
                key={i}
                sx={{ "&:last-child td": { borderBottom: 0 } }}
              >
                {preview.columns.map((col) => (
                  <TableCell
                    key={col.name}
                    sx={{
                      fontSize: "0.8125rem",
                      color: "text.primary",
                      whiteSpace: "nowrap",
                      borderColor: "divider",
                    }}
                  >
                    {String(row[col.name] ?? "")}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      <Typography variant="caption" color="text.disabled">
        Mostrando primeras {preview.rows.length} filas de {preview.total_rows} totales
      </Typography>
    </Box>
  )
}
