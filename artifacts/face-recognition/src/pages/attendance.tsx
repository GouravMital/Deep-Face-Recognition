import { useState } from "react";
import { useListAttendance, useExportAttendance } from "@workspace/api-client-react";
import { Card, Button, CyberBadge } from "../components/ui-elements";
import { ClipboardList, Download, Calendar as CalendarIcon, Clock } from "lucide-react";
import { format } from "date-fns";

export default function Attendance() {
  const [dateFilter, setDateFilter] = useState(format(new Date(), 'yyyy-MM-dd'));
  const { data: records, isLoading } = useListAttendance({ date: dateFilter });
  const { refetch: exportCsv, isFetching: isExporting } = useExportAttendance({ date: dateFilter }, { query: { enabled: false }});

  const handleExport = async () => {
    const { data } = await exportCsv();
    if (data) {
      const blob = new Blob([data], { type: 'text/csv' });
      const url = window.URL.createUrl(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `attendance-${dateFilter}.csv`;
      a.click();
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-display font-bold text-foreground">ATTENDANCE LOGS</h2>
          <p className="font-mono text-muted-foreground text-sm uppercase tracking-wider">Automated Personnel Tracking</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center bg-input border border-border rounded-lg px-3 py-2">
            <CalendarIcon className="w-4 h-4 text-primary mr-2" />
            <input 
              type="date" 
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="bg-transparent border-none text-sm font-mono text-foreground focus:outline-none"
            />
          </div>
          <Button variant="outline" onClick={handleExport} disabled={isExporting || !records?.length}>
            <Download className="w-4 h-4 mr-2" /> Export CSV
          </Button>
        </div>
      </div>

      <Card className="p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-secondary/50 border-b border-border font-mono text-xs text-primary uppercase tracking-widest">
                <th className="p-4 font-medium">Record ID</th>
                <th className="p-4 font-medium">Personnel</th>
                <th className="p-4 font-medium">Date</th>
                <th className="p-4 font-medium">Check In</th>
                <th className="p-4 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="font-mono text-sm divide-y divide-border/50">
              {isLoading ? (
                <tr><td colSpan={5} className="p-8 text-center text-muted-foreground">Loading records...</td></tr>
              ) : records?.length === 0 ? (
                <tr><td colSpan={5} className="p-8 text-center text-muted-foreground">No attendance records found for this date.</td></tr>
              ) : (
                records?.map(record => (
                  <tr key={record.id} className="hover:bg-primary/5 transition-colors">
                    <td className="p-4 text-muted-foreground">#{record.id.toString().padStart(4, '0')}</td>
                    <td className="p-4 font-bold text-foreground">{record.personName}</td>
                    <td className="p-4 text-muted-foreground">{record.date}</td>
                    <td className="p-4 flex items-center gap-2">
                      <Clock className="w-3 h-3 text-primary" />
                      {format(new Date(record.checkInTime), 'HH:mm:ss')}
                    </td>
                    <td className="p-4">
                      <CyberBadge color={record.status === 'present' ? 'success' : record.status === 'late' ? 'warning' : 'destructive'}>
                        {record.status.toUpperCase()}
                      </CyberBadge>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
