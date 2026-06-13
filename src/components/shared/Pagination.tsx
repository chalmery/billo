import { Pagination as MuiPagination, Box, Select, MenuItem } from "@mui/material";

interface PaginationProps {
  current: number;
  total: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
}

export function Pagination({ current, total, pageSize, onPageChange, onPageSizeChange }: PaginationProps) {
  const totalPages = Math.ceil(total / pageSize);

  return (
    <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, fontSize: "0.875rem", color: "text.secondary" }}>
        <span>每页</span>
        <Select
          value={pageSize}
          onChange={(e) => onPageSizeChange(Number(e.target.value))}
          size="small"
          sx={{ minWidth: 70, "& .MuiSelect-select": { py: 0.5 } }}
        >
          <MenuItem value={10}>10</MenuItem>
          <MenuItem value={20}>20</MenuItem>
          <MenuItem value={50}>50</MenuItem>
        </Select>
        <span>条</span>
      </Box>
      <MuiPagination
        count={totalPages}
        page={current}
        onChange={(_, p) => onPageChange(p)}
        size="small"
        shape="rounded"
      />
    </Box>
  );
}
