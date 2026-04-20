import React, { useState, useEffect, useMemo } from 'react';
import { 
  BarChart3, 
  ClipboardCheck, 
  Clock, 
  MapPin, 
  FileText, 
  ChevronLeft, 
  ChevronRight,
  TrendingUp,
  TrendingDown,
  Activity,
  User,
  CheckCircle2,
  XCircle
} from 'lucide-react';
import toast from 'react-hot-toast';
import { formatDate } from '../utils/helpers';

export default function AdminDashboard() {
  const [reports, setReports] = useState([]);
  const [fetching, setFetching] = useState(true);
  const [filters, setFilters] = useState({
    dateFrom: '',
    dateTo: '',
    personName: '',
    location: '',
    searchQuery: ''
  });
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  const API_URL = import.meta.env.VITE_APPS_SCRIPT_URL;
  const REPORT_SHEET = (import.meta.env.VITE_DAILY_REPORT_SHEET_NAME || 'Daily Report').replace(/"/g, '');

  useEffect(() => {
    fetchReports();
  }, []);

  const fetchReports = async () => {
    try {
      setFetching(true);
      const resp = await fetch(`${API_URL}?sheet=${REPORT_SHEET}`);
      const result = await resp.json();
      if (result.success && result.data) {
        // Data starts at Row 7 (index 6)
        const reportData = result.data.slice(6); 
        const formattedReports = reportData
          .map((row, index) => ({
            rowIndex: index + 7,
            timestamp: row[0],
            sn: row[1],
            name: row[3],
            date: row[4],
            opStatus: row[5],
            details: row[6],
            location: row[7],
            remarks: row[8],
            colJ: row[9],
            colK: row[10],
            approveBy: row[12],
            status: row[13] || 'Pending'
          }))
          .filter(rpt => rpt.sn && rpt.sn !== '');
        setReports(formattedReports);
      }
    } catch (err) {
      console.error('Fetch dashboard error:', err);
      toast.error('Failed to sync dashboard data');
    } finally {
      setFetching(false);
    }
  };

  // Stats Logic
  const stats = useMemo(() => {
    const total = reports.length;
    const pending = reports.filter(r => r.colJ && r.colJ !== '' && (!r.colK || r.colK === '')).length;
    const approved = reports.filter(r => r.status === 'Approved').length;
    const rejected = reports.filter(r => r.status === 'Rejected').length;
    
    // Operational Status counts
    const fullDay = reports.filter(r => r.opStatus === 'Full Day').length;
    const halfDay = reports.filter(r => r.opStatus === 'Half Day').length;

    return { total, pending, approved, rejected, fullDay, halfDay };
  }, [reports]);

  // Operational Status Breakdown (Chart)
  const opStatusBreakdown = useMemo(() => {
    const data = {};
    reports.forEach(r => {
      if (r.opStatus) {
        data[r.opStatus] = (data[r.opStatus] || 0) + 1;
      }
    });
    return Object.entries(data).sort((a, b) => b[1] - a[1]);
  }, [reports]);

  // Location breakdown
  const locationBreakdown = useMemo(() => {
    const data = {};
    reports.forEach(r => {
      if (r.location) {
        data[r.location] = (data[r.location] || 0) + 1;
      }
    });
    return Object.entries(data).sort((a, b) => b[1] - a[1]).slice(0, 5);
  }, [reports]);

  // Filtering Logic
  const filteredItems = useMemo(() => {
    return reports.filter(rpt => {
      if (filters.dateFrom && rpt.date < filters.dateFrom) return false;
      if (filters.dateTo && rpt.date > filters.dateTo) return false;
      if (filters.personName && !rpt.name?.toLowerCase().includes(filters.personName.toLowerCase())) return false;
      if (filters.location && !rpt.location?.toLowerCase().includes(filters.location.toLowerCase())) return false;
      
      if (filters.searchQuery) {
        const q = filters.searchQuery.toLowerCase();
        return (
          rpt.sn?.toLowerCase().includes(q) ||
          rpt.name?.toLowerCase().includes(q) ||
          rpt.details?.toLowerCase().includes(q) ||
          rpt.location?.toLowerCase().includes(q)
        );
      }
      return true;
    }).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  }, [reports, filters]);

  const totalPages = Math.ceil(filteredItems.length / itemsPerPage);
  const paginatedItems = filteredItems.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  return (
    <div className="p-6 space-y-6">
      {/* Header & Quick Action */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 uppercase tracking-tight">Admin Dashboard</h1>
          <p className="text-xs font-bold text-sky-600 uppercase tracking-widest mt-1">Real-Time Reporting Overview</p>
        </div>
        <button 
          onClick={fetchReports}
          disabled={fetching}
          className="bg-white border border-sky-200 px-4 py-2 rounded-lg text-sky-600 font-bold text-sm shadow-sm hover:bg-sky-50 transition-all flex items-center gap-2 disabled:opacity-50"
        >
          <Activity size={18} className={fetching ? 'animate-spin' : ''} />
          {fetching ? 'Syncing...' : 'Sync Data'}
        </button>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Reports */}
        <div className="bg-gradient-to-br from-white to-sky-50 p-6 rounded-xl border border-sky-100 shadow-sm group hover:shadow-md transition-all">
          <div className="flex justify-between items-center">
            <div>
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Total Reports</p>
              <h3 className="text-3xl font-black text-gray-900 mt-1">{stats.total}</h3>
            </div>
            <div className="w-12 h-12 bg-sky-100 rounded-lg flex items-center justify-center text-sky-600 group-hover:scale-110 transition-transform">
              <FileText size={24} />
            </div>
          </div>
        </div>

        {/* Pending */}
        <div className="bg-gradient-to-br from-white to-amber-50 p-6 rounded-xl border border-amber-100 shadow-sm group hover:shadow-md transition-all">
          <div className="flex justify-between items-center">
            <div>
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Pending Approvals</p>
              <h3 className="text-3xl font-black text-amber-600 mt-1">{stats.pending}</h3>
            </div>
            <div className="w-12 h-12 bg-amber-100 rounded-lg flex items-center justify-center text-amber-600 group-hover:scale-110 transition-transform">
              <Clock size={24} />
            </div>
          </div>
        </div>

        {/* Approved */}
        <div className="bg-gradient-to-br from-white to-green-50 p-6 rounded-xl border border-green-100 shadow-sm group hover:shadow-md transition-all">
          <div className="flex justify-between items-center">
            <div>
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Approved Today</p>
              <h3 className="text-3xl font-black text-green-600 mt-1">{stats.approved}</h3>
            </div>
            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center text-green-600 group-hover:scale-110 transition-transform">
              <ClipboardCheck size={24} />
            </div>
          </div>
        </div>

        {/* Rejected */}
        <div className="bg-gradient-to-br from-white to-red-50 p-6 rounded-xl border border-red-100 shadow-sm group hover:shadow-md transition-all">
          <div className="flex justify-between items-center">
            <div>
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Rejected Reports</p>
              <h3 className="text-3xl font-black text-red-600 mt-1">{stats.rejected}</h3>
            </div>
            <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center text-red-600 group-hover:scale-110 transition-transform">
              <XCircle size={24} />
            </div>
          </div>
        </div>
      </div>

      {/* Analytics Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Operational Status (Full/Half Day) */}
        <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
          <h3 className="text-sm font-black text-gray-900 uppercase tracking-widest mb-6 flex items-center gap-2">
            <BarChart3 size={18} className="text-sky-600" />
            Operational Status Breakdown
          </h3>
          <div className="space-y-4">
            {opStatusBreakdown.map(([status, count]) => {
              const percentage = Math.round((count / stats.total) * 100) || 0;
              return (
                <div key={status} className="space-y-2">
                  <div className="flex justify-between text-xs font-bold uppercase">
                    <span className="text-gray-600">{status}</span>
                    <span className="text-sky-600">{count} Reports ({percentage}%)</span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-2.5 overflow-hidden">
                    <div 
                      className={`h-full rounded-full transition-all duration-500 ${
                        status === 'Full Day' ? 'bg-green-500' : 
                        status === 'Half Day' ? 'bg-amber-500' : 'bg-red-500'
                      }`}
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

      </div>

      {/* Filter Row */}
      <div className="flex flex-col md:flex-row items-center gap-3 pb-4 border-b border-gray-100">
        <div className="relative flex-1">
          <input
            type="text"
            placeholder="Search recent reports..."
            value={filters.searchQuery}
            onChange={(e) => setFilters({ ...filters, searchQuery: e.target.value })}
            className="w-full bg-white border border-gray-300 rounded-lg pl-4 pr-3 py-2 focus:outline-none focus:ring-2 focus:ring-sky-500 text-sm shadow-sm"
          />
        </div>
        <div className="flex gap-2">
          <input
            type="date"
            value={filters.dateFrom}
            onChange={(e) => setFilters({ ...filters, dateFrom: e.target.value })}
            className="bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm shadow-sm focus:ring-2 focus:ring-sky-500 focus:outline-none"
          />
          <input
            type="text"
            placeholder="Filter location..."
            value={filters.location}
            onChange={(e) => setFilters({ ...filters, location: e.target.value })}
            className="bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm shadow-sm focus:ring-2 focus:ring-sky-500 focus:outline-none"
          />
        </div>
      </div>

      {/* Recent Activity Table/Cards */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden flex flex-col">
        <div className="p-4 border-b border-gray-100 bg-gray-50 flex justify-between items-center">
          <h3 className="text-sm font-black text-gray-900 uppercase tracking-widest">Recent Activity Feed</h3>
          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Showing {paginatedItems.length} Reports</span>
        </div>

        {/* Mobile View: Activity Cards */}
        <div className="md:hidden flex flex-col gap-3 p-3 bg-gray-50/50 overflow-y-auto max-h-[500px]">
          {paginatedItems.map((rpt, idx) => (
            <div key={idx} className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-col gap-3">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-sky-100 flex items-center justify-center text-sky-600">
                    <User size={16} />
                  </div>
                  <div>
                    <p className="text-xs font-black text-gray-900 uppercase tracking-tight leading-none mb-1">{rpt.name}</p>
                    <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-1">
                      <Clock size={10} /> {rpt.date ? formatDate(rpt.date) : '-'}
                    </p>
                  </div>
                </div>
                <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase ${
                  rpt.status === 'Approved' ? 'bg-green-100 text-green-700' : 
                  rpt.status === 'Rejected' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
                }`}>
                  {rpt.status}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="bg-gray-50 p-2 rounded-lg border border-gray-100">
                  <p className="text-[9px] text-gray-400 font-bold uppercase mb-0.5 tracking-tighter">Op Status</p>
                  <p className="text-xs font-bold text-gray-700 uppercase">{rpt.opStatus}</p>
                </div>
                <div className="bg-gray-50 p-2 rounded-lg border border-gray-100">
                  <p className="text-[9px] text-gray-400 font-bold uppercase mb-0.5 tracking-tighter">Location</p>
                  <p className="text-xs font-bold text-indigo-600 uppercase truncate">{rpt.location}</p>
                </div>
              </div>

              <div className="flex items-center justify-between border-t border-gray-50 pt-2">
                <span className="text-[10px] font-black text-sky-600 tracking-widest">{rpt.sn}</span>
                <span className="text-[9px] font-bold text-gray-400 uppercase italic truncate max-w-[150px]">
                  {rpt.remarks || 'No remarks'}
                </span>
              </div>
            </div>
          ))}
          {paginatedItems.length === 0 && (
            <div className="py-10 text-center text-gray-400 text-xs font-bold uppercase tracking-widest">No Recent Activity</div>
          )}
        </div>

        {/* Desktop View: Activity Table */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-white border-b border-gray-100">
                <th className="px-4 py-3 text-center text-sm font-semibold text-gray-900">SN</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">Operator</th>
                <th className="px-4 py-3 text-center text-sm font-semibold text-gray-900">Status</th>
                <th className="px-4 py-3 text-center text-sm font-semibold text-gray-900">Work Status</th>
                <th className="px-4 py-3 text-center text-sm font-semibold text-gray-900">Location</th>
                <th className="px-4 py-3 text-center text-sm font-semibold text-gray-900">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {paginatedItems.map((rpt, idx) => (
                <tr key={idx} className="hover:bg-sky-50/30 transition-colors group">
                  <td className="px-6 py-4 text-xs font-black text-sky-600">{rpt.sn}</td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded bg-gray-100 flex items-center justify-center">
                        <User size={12} className="text-gray-400" />
                      </div>
                      <span className="text-sm font-bold text-gray-800 uppercase tracking-tight">{rpt.name}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider ${
                      rpt.status === 'Approved' ? 'bg-green-100 text-green-700' : 
                      rpt.status === 'Rejected' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
                    }`}>
                      {rpt.status === 'Approved' ? <CheckCircle2 size={10} /> : 
                       rpt.status === 'Rejected' ? <XCircle size={10} /> : <Clock size={10} />}
                      {rpt.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-tighter bg-gray-50 px-2 py-0.5 rounded">
                      {rpt.opStatus}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-xs font-bold text-gray-500 uppercase">{rpt.location}</td>
                  <td className="px-6 py-4 text-xs text-gray-400 font-medium">{rpt.date ? formatDate(rpt.date) : '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        
        {/* Pagination */}
        <div className="p-4 border-t border-gray-100 bg-gray-50/30 flex justify-between items-center">
           <button 
            disabled={currentPage === 1}
            onClick={() => setCurrentPage(prev => prev - 1)}
            className="p-1 border border-gray-300 rounded hover:bg-white disabled:opacity-30"
          >
            <ChevronLeft size={16} />
          </button>
          <span className="text-xs font-bold text-gray-500 uppercase tracking-widest">Page {currentPage} of {totalPages || 1}</span>
          <button 
            disabled={currentPage === totalPages}
            onClick={() => setCurrentPage(prev => prev + 1)}
            className="p-1 border border-gray-300 rounded hover:bg-white disabled:opacity-30"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
