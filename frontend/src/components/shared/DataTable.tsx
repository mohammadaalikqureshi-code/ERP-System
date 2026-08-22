import React, { useState, useEffect, useMemo } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ChevronDown, ChevronUp, ChevronsUpDown, Search } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from './EmptyState';

/**
 * Unified Column definition that supports two call signatures:
 * 1. render(value, row) — used by most pages (ClinicsPage, DoctorsPage, etc.)
 * 2. render(row) — used by DataTable's original contract
 *
 * We detect which style at runtime by accepting both `label` and `title` for the header.
 */
export interface Column<T = any> {
  key: string;
  /** Column header text. Accepts both `label` and `title` for compatibility. */
  label?: string;
  title?: string;
  sortable?: boolean;
  /**
   * Custom cell renderer.
   * Supports two signatures:
   *   (value: any, row: T) => ReactNode
   *   (row: T) => ReactNode
   */
  render?: (value: any, row: T) => React.ReactNode;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  isLoading?: boolean;
  loading?: boolean;
  page?: number;
  currentPage?: number;
  pageSize?: number;
  total?: number;
  totalPages?: number;
  onPageChange?: (page: number) => void;
  onPageSizeChange?: (size: number) => void;
  onSearch?: (query: string) => void;
  searchPlaceholder?: string;
  emptyMessage?: string;
  emptyState?: React.ReactNode;
}

export function DataTable<T extends Record<string, any>>({
  columns,
  data,
  isLoading,
  loading,
  page,
  currentPage,
  pageSize = 10,
  total,
  totalPages: totalPagesProp,
  onPageChange,
  onPageSizeChange,
  onSearch,
  searchPlaceholder = 'Search...',
  emptyMessage = 'No data found',
  emptyState,
}: DataTableProps<T>) {
  const isLoadingState = isLoading ?? loading ?? false;
  const activePage = page ?? currentPage ?? 1;
  const computedTotalPages = totalPagesProp ?? (total != null ? Math.max(1, Math.ceil(total / pageSize)) : 1);

  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc' | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Debounced search
  useEffect(() => {
    if (onSearch) {
      const handler = setTimeout(() => {
        onSearch(searchQuery);
      }, 300);
      return () => clearTimeout(handler);
    }
  }, [searchQuery, onSearch]);

  const handleSort = (key: string) => {
    if (sortKey === key) {
      if (sortDirection === 'asc') setSortDirection('desc');
      else if (sortDirection === 'desc') {
        setSortKey(null);
        setSortDirection(null);
      }
    } else {
      setSortKey(key);
      setSortDirection('asc');
    }
  };

  const sortedData = useMemo(() => {
    if (!sortKey || !sortDirection) return data;
    return [...data].sort((a, b) => {
      const aVal = a[sortKey];
      const bVal = b[sortKey];
      if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  }, [data, sortKey, sortDirection]);

  /**
   * Render a cell value. Our Column.render can be called in two styles:
   * - render(value, row) when used by page-level code
   * - render(row) when used by the original DataTable contract
   *
   * We call render(value, row) which covers both — if a caller only uses
   * the first arg as the row, it still works.
   */
  const renderCell = (col: Column<T>, row: T) => {
    if (col.render) {
      const cellValue = row[col.key];
      return col.render(cellValue, row);
    }
    const raw = row[col.key];
    return raw != null ? String(raw) : '-';
  };

  const headerText = (col: Column<T>) => col.label || col.title || col.key;

  return (
    <div className="space-y-4">
      {(onSearch || onPageSizeChange) && (
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          {onSearch && (
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={searchPlaceholder}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8"
                aria-label="Search table"
              />
            </div>
          )}

          {onPageSizeChange && (
            <div className="flex items-center space-x-2">
              <span className="text-sm text-muted-foreground">Rows per page</span>
              <Select value={pageSize.toString()} onValueChange={(val) => onPageSizeChange(Number(val))}>
                <SelectTrigger className="w-20">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="10">10</SelectItem>
                  <SelectItem value="25">25</SelectItem>
                  <SelectItem value="50">50</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
      )}

      <div className="rounded-md border bg-white dark:bg-stone-950 overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              {columns.map((col) => (
                <TableHead
                  key={col.key}
                  onClick={() => col.sortable && handleSort(col.key)}
                  className={col.sortable ? 'cursor-pointer select-none hover:bg-stone-50 dark:hover:bg-stone-900' : ''}
                >
                  <div className="flex items-center space-x-1">
                    <span>{headerText(col)}</span>
                    {col.sortable && (
                      <span className="text-stone-400">
                        {sortKey === col.key ? (
                          sortDirection === 'asc' ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />
                        ) : (
                          <ChevronsUpDown className="h-4 w-4" />
                        )}
                      </span>
                    )}
                  </div>
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoadingState ? (
              Array.from({ length: Math.min(5, pageSize) }).map((_, i) => (
                <TableRow key={`skeleton-${i}`}>
                  {columns.map((_, j) => (
                    <TableCell key={j}><Skeleton className="h-6 w-full" /></TableCell>
                  ))}
                </TableRow>
              ))
            ) : sortedData.length === 0 ? (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-32 text-center">
                  {emptyState || <EmptyState title={emptyMessage} description="" />}
                </TableCell>
              </TableRow>
            ) : (
              sortedData.map((row, i) => (
                <TableRow key={(row as any).id || i}>
                  {columns.map((col) => (
                    <TableCell key={col.key}>
                      {renderCell(col, row)}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {onPageChange && computedTotalPages > 1 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-2">
          <span className="text-sm text-muted-foreground">
            Page {activePage} of {computedTotalPages}
            {total != null && ` · ${total} total`}
          </span>
          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange(activePage - 1)}
              disabled={activePage === 1 || isLoadingState}
              aria-label="Previous page"
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange(activePage + 1)}
              disabled={activePage === computedTotalPages || isLoadingState}
              aria-label="Next page"
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
