function getVisiblePages(current: number, total: number): (number | '...')[] {
  if (total <= 7) return Array.from({length: total}, (_, i) => i + 1);
  const pages: (number | '...')[] = [1];
  if (current > 3) pages.push('...');
  for (let i = Math.max(2, current - 1); i <= Math.min(total - 1, current + 1); i++) pages.push(i);
  if (current < total - 2) pages.push('...');
  pages.push(total);
  return pages;
}

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
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <span>每页</span>
        <select value={pageSize} onChange={e => onPageSizeChange(Number(e.target.value))}
          className="border rounded-md px-2 py-1 text-sm bg-background">
          <option value={10}>10</option>
          <option value={20}>20</option>
          <option value={50}>50</option>
        </select>
        <span>条</span>
      </div>
      <div className="flex items-center gap-1">
        <button disabled={current <= 1} onClick={() => onPageChange(current - 1)}
          className="px-2 py-1 border rounded-md text-sm disabled:opacity-30 hover:bg-muted">&laquo;</button>
        {getVisiblePages(current, totalPages).map((p, i) =>
          p === '...' ? <span key={`...${i}`} className="px-1 text-muted-foreground">...</span> :
          <button key={p} onClick={() => onPageChange(p as number)}
            className={`px-3 py-1 rounded-md text-sm ${p === current
              ? 'bg-primary text-primary-foreground'
              : 'border hover:bg-muted'}`}>
            {p}
          </button>
        )}
        <button disabled={current >= totalPages} onClick={() => onPageChange(current + 1)}
          className="px-2 py-1 border rounded-md text-sm disabled:opacity-30 hover:bg-muted">&raquo;</button>
      </div>
    </div>
  );
}
