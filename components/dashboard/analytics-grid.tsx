"use client";

import type { ReactNode } from "react";
import { AgGridReact } from "ag-grid-react";
import { AllCommunityModule, ModuleRegistry, themeQuartz, type ColDef, type GridApi } from "ag-grid-community";
import type { AnalyticsRow } from "@/lib/dashboard/analytics-model";

ModuleRegistry.registerModules([AllCommunityModule]);

const tableTheme = themeQuartz.withParams({
  accentColor: "#3352cc", backgroundColor: "#ffffff", foregroundColor: "#253650",
  headerBackgroundColor: "#f4f7fc", headerTextColor: "#405579", borderColor: "#e1e8f4",
  rowHoverColor: "#eef3ff", oddRowBackgroundColor: "#fafcff", fontFamily: "inherit", fontSize: 13,
  spacing: 8, wrapperBorder: false, wrapperBorderRadius: 0, headerHeight: 44, rowHeight: 48,
});

export default function LedgerGrid({ rows, columns, onReady, empty }: {
  rows: AnalyticsRow[];
  columns: ColDef<AnalyticsRow>[];
  onReady: (api: GridApi<AnalyticsRow>) => void;
  empty: ReactNode;
}) {
  return <AgGridReact<AnalyticsRow>
    theme={tableTheme} rowData={rows} columnDefs={columns}
    defaultColDef={{ sortable: true, resizable: true }}
    pagination={rows.length > 0} paginationPageSize={25} paginationPageSizeSelector={[25, 50, 100]}
    getRowId={({ data }) => data.id}
    onGridReady={event => onReady(event.api)}
    noRowsOverlayComponent={() => empty}
  />;
}
