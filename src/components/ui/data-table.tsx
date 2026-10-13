import * as React from 'react';
import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp, ChevronsUpDown } from 'lucide-react';
import { cn } from '@/lib/cn';
import { Button } from './button';
import { Skeleton } from './skeleton';

export interface ColumnDef<T> {
  key: string;
  header: React.ReactNode;
  cell?: (item: T, index: number) => React.ReactNode;
  sortable?: boolean;
  className?: string;
}

export interface DataTableProps<T> {
  data: T[];
  columns: ColumnDef<T>[];
  loading?: boolean;
  emptyMessage?: string;
  striped?: boolean;
  pagination?: {
    page: number;
    pageSize: number;
    total: number;
  };
  onPageChange?: (page: number) => void;
  onSort?: (column: string, direction: 'asc' | 'desc') => void;
  sortColumn?: string;
  sortDirection?: 'asc' | 'desc';
  className?: string;
}

export function DataTable<T extends Record<string, unknown>>({
  data,
  columns,
  loading = false,
  emptyMessage = 'No records found',
  striped = false,
  pagination,
  onPageChange,
  onSort,
  sortColumn,
  sortDirection,
  className,
}: DataTableProps<T>) {
  const [internalSortCol, setInternalSortCol] = React.useState<string | undefined>(sortColumn);
  const [internalSortDir, setInternalSortDir] = React.useState<'asc' | 'desc' | undefined>(
    sortDirection
  );

  const activeSortCol = sortColumn !== undefined ? sortColumn : internalSortCol;
  const activeSortDir = sortDirection !== undefined ? sortDirection : internalSortDir;

  const handleSort = (colKey: string) => {
    let nextDir: 'asc' | 'desc' = 'asc';
    if (activeSortCol === colKey) {
      nextDir = activeSortDir === 'asc' ? 'desc' : 'asc';
    }
    if (sortColumn === undefined) {
      setInternalSortCol(colKey);
      setInternalSortDir(nextDir);
    }
    onSort?.(colKey, nextDir);
  };

  const totalPages = pagination
    ? Math.max(1, Math.ceil(pagination.total / pagination.pageSize))
    : 1;

  const currentPage = pagination ? pagination.page : 1;

  return (
    <div className={cn('w-full space-y-4', className)}>
      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-gray-700">
            <thead className="border-b border-gray-200 bg-gray-50 text-xs uppercase font-semibold text-gray-600">
              <tr>
                {columns.map((col) => {
                  const isSorted = activeSortCol === col.key;
                  return (
                    <th
                      key={col.key}
                      scope="col"
                      className={cn(
                        'px-4 py-3.5 whitespace-nowrap',
                        col.sortable && 'cursor-pointer select-none hover:bg-gray-100 transition-colors',
                        col.className
                      )}
                      onClick={col.sortable ? () => handleSort(col.key) : undefined}
                    >
                      <div className="inline-flex items-center gap-1.5">
                        <span>{col.header}</span>
                        {col.sortable && (
                          <span className="text-gray-400">
                            {isSorted ? (
                              activeSortDir === 'asc' ? (
                                <ChevronUp className="h-3.5 w-3.5 text-blue-600" />
                              ) : (
                                <ChevronDown className="h-3.5 w-3.5 text-blue-600" />
                              )
                            ) : (
                              <ChevronsUpDown className="h-3.5 w-3.5" />
                            )}
                          </span>
                        )}
                      </div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                Array.from({ length: 5 }).map((_, rIdx) => (
                  <tr key={`loading-row-${rIdx}`} className="animate-pulse">
                    {columns.map((col) => (
                      <td key={col.key} className="px-4 py-3.5 whitespace-nowrap">
                        <Skeleton className="h-4 w-full max-w-[120px]" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : data.length === 0 ? (
                <tr>
                  <td
                    colSpan={columns.length}
                    className="px-4 py-8 text-center text-sm text-gray-500"
                  >
                    {emptyMessage}
                  </td>
                </tr>
              ) : (
                data.map((row, rowIdx) => (
                  <tr
                    key={`row-${rowIdx}`}
                    className={cn(
                      'transition-colors hover:bg-gray-50/80',
                      striped && rowIdx % 2 === 1 && 'bg-gray-50/50'
                    )}
                  >
                    {columns.map((col) => (
                      <td
                        key={col.key}
                        className={cn('px-4 py-3.5 whitespace-nowrap', col.className)}
                      >
                        {col.cell
                          ? col.cell(row, rowIdx)
                          : (row[col.key] as React.ReactNode) ?? null}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {pagination && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 text-sm text-gray-600 px-1">
          <div>
            Showing{' '}
            <span className="font-medium text-gray-900">
              {pagination.total === 0 ? 0 : (currentPage - 1) * pagination.pageSize + 1}
            </span>{' '}
            to{' '}
            <span className="font-medium text-gray-900">
              {Math.min(currentPage * pagination.pageSize, pagination.total)}
            </span>{' '}
            of <span className="font-medium text-gray-900">{pagination.total}</span> results
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={currentPage <= 1 || loading}
              onClick={() => onPageChange?.(currentPage - 1)}
              aria-label="Previous page"
            >
              <ChevronLeft className="h-4 w-4 mr-1" />
              Previous
            </Button>
            <span className="text-xs font-medium text-gray-500 px-1">
              Page {currentPage} of {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={currentPage >= totalPages || loading}
              onClick={() => onPageChange?.(currentPage + 1)}
              aria-label="Next page"
            >
              Next
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
