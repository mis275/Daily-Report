import React, { useState, useEffect, useMemo } from 'react';
import toast from 'react-hot-toast';
import {
  Search,
  ChevronLeft,
  ChevronRight,
  Calendar,
  MapPin,
  User,
  FileText,
  CheckCircle2,
  Clock,
  X,
  Filter,
  CheckCircle,
  XCircle,
  Save,
  Check
} from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { formatDate } from '../utils/helpers';

export default function AdminApproval() {
  const { user } = useAuthStore();
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [activeTab, setActiveTab] = useState('pending'); // 'pending' or 'history'

  // Selection State
  const [selectedIds, setSelectedIds] = useState([]);
  const [rowStatuses, setRowStatuses] = useState({}); // { sn: 'Approve' | 'Reject' }

  // Filters
  const [filters, setFilters] = useState({
    fromDate: '',
    toDate: '',
    personName: '',
    searchQuery: ''
  });

  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(15);

  // View Modal State
  const [showViewModal, setShowViewModal] = useState(false);
  const [selectedReport, setSelectedReport] = useState(null);
  const [previewImage, setPreviewImage] = useState(null);

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
            originalRow: row,
            rowIndex: index + 7, // Row 7 in sheet is index 0 in reportData (data[6])
            timestamp: row[0],  // A
            sn: row[1],         // B
            empId: row[2],      // C
            name: row[3],       // D
            date: row[4],       // E
            opStatus: row[5],   // F
            details: row[6],    // G
            location: row[7],   // H
            remarks: row[8],    // I
            colJ: row[9],       // J (Condition: J != Null)
            colK: row[10],      // K (Processed flag: Null=Pending, Not Null=History)
            approveBy: row[12], // M
            status: row[13],    // N
            imageLinks: row[14] ? JSON.parse(row[14]) : [] // O
          }))
          .filter(rpt => rpt.sn && rpt.sn !== ''); // Filter after mapping to preserve rowIndex
        setReports(formattedReports);
      }
    } catch (err) {
      console.error('Fetch reports error:', err);
      toast.error('Failed to load reports');
    } finally {
      setFetching(false);
    }
  };

  const getIndiaTime = () => {
    const now = new Date();
    const indiaOffset = 5.5 * 60 * 60 * 1000;
    const indiaTime = new Date(now.getTime() + indiaOffset);
    const pad = (num) => String(num).padStart(2, '0');
    return `${indiaTime.getUTCFullYear()}/${pad(indiaTime.getUTCMonth() + 1)}/${pad(indiaTime.getUTCDate())}`;
  };

  const handleSelectRow = (sn) => {
    if (selectedIds.includes(sn)) {
      setSelectedIds(selectedIds.filter(id => id !== sn));
      const newStatuses = { ...rowStatuses };
      delete newStatuses[sn];
      setRowStatuses(newStatuses);
    } else {
      setSelectedIds([...selectedIds, sn]);
      setRowStatuses({ ...rowStatuses, [sn]: 'Approved' });
    }
  };

  const handleSelectAll = (filteredData) => {
    if (selectedIds.length === filteredData.length) {
      setSelectedIds([]);
      setRowStatuses({});
    } else {
      const allIds = filteredData.map(r => r.sn);
      setSelectedIds(allIds);
      const allStatuses = {};
      allIds.forEach(id => { allStatuses[id] = 'Approved'; });
      setRowStatuses(allStatuses);
    }
  };

  const handleBulkSubmit = async () => {
    if (selectedIds.length === 0) {
      toast.error('No reports selected');
      return;
    }

    setLoading(true);
    try {
      const timestamp = getIndiaTime();
      const adminName = user?.name || 'Admin';

      // Prepare update batch
      const updates = selectedIds.map(sn => {
        const report = reports.find(r => r.sn === sn);
        return {
          sn: sn,
          rowIndex: report?.rowIndex,
          colK: timestamp,      // K: Mark as processed
          approveBy: adminName, // M: Admin Name
          status: rowStatuses[sn] // N: Approve/Reject
        };
      });

      // Assume the API supports a batch update or we call it sequentially
      // For safety, we'll try to find a bulk action or use specific updates
      // Using action=update_status as a predicted GAS endpoint for this requirement
      // Parallel Processing: Fire all update requests simultaneously for maximum speed
      const allUpdatePromises = [];

      for (const update of updates) {
        if (!update.rowIndex) continue;

        // Surgical Update Columns: K (11), M (13), N (14)
        const cellsToUpdate = [
          { col: 11, val: update.colK },
          { col: 13, val: update.approveBy },
          { col: 14, val: update.status }
        ];

        cellsToUpdate.forEach(cell => {
          const params = new URLSearchParams({
            action: 'updateCell',
            sheetName: REPORT_SHEET,
            rowIndex: String(update.rowIndex),
            columnIndex: String(cell.col),
            value: cell.val
          });

          const url = `${API_URL}?${params.toString()}`;

          // Add the fetch promise to our collection
          allUpdatePromises.push(
            fetch(url, { method: 'POST' })
              .then(resp => resp.text())
              .catch(err => console.error(`Failed cell ${cell.col} at Row ${update.rowIndex}:`, err))
          );
        });
      }

      // Wait for all requests to finish in parallel
      await Promise.all(allUpdatePromises);

      toast.success(`Successfully processed ${selectedIds.length} reports!`);
      // Instant reload after completion
      window.location.reload();
    } catch (err) {
      console.error('Update error:', err);
      toast.error('Failed to update reports: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleViewDetails = (report) => {
    setSelectedReport(report);
    setShowViewModal(true);
  };

  // Tab Filtering
  const pendingReports = reports.filter(r => r.colJ && r.colJ !== '' && (!r.colK || r.colK === ''));
  const historyReports = reports.filter(r => r.colJ && r.colJ !== '' && r.colK && r.colK !== '');

  const displayReports = activeTab === 'pending' ? pendingReports : historyReports;

  // Global Filters
  const filteredReports = displayReports.filter(rpt => {
    if (filters.fromDate && rpt.date < filters.fromDate) return false;
    if (filters.toDate && rpt.date > filters.toDate) return false;
    if (filters.personName && rpt.name !== filters.personName) return false;

    if (filters.searchQuery) {
      const q = filters.searchQuery.toLowerCase();
      return (
        rpt.sn?.toLowerCase().includes(q) ||
        rpt.name?.toLowerCase().includes(q) ||
        rpt.details?.toLowerCase().includes(q) ||
        rpt.location?.toLowerCase().includes(q) ||
        rpt.remarks?.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const sortedReports = [...filteredReports].reverse();
  const totalPages = Math.ceil(sortedReports.length / itemsPerPage);
  const paginatedReports = sortedReports.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  return (
    <div className="p-6 space-y-6">
      {/* Header & Filter Row */}
      <div className="flex flex-col md:flex-row items-center gap-3 w-full overflow-x-auto pb-4 border-b border-gray-100">
        {/* Tabs */}
        <div className="flex gap-1 flex-shrink-0 mr-4 bg-gray-100 p-1 rounded-lg">
          <button
            onClick={() => { setActiveTab('pending'); setSelectedIds([]); }}
            className={`py-1.5 px-4 font-bold transition text-sm rounded-md flex items-center gap-2 ${activeTab === 'pending'
              ? 'bg-white text-indigo-700 shadow-sm'
              : 'text-gray-500 hover:text-indigo-600'
              }`}
          >
            Pending <span className="bg-indigo-100 px-1.5 py-0.5 rounded text-[10px]">{pendingReports.length}</span>
          </button>
          <button
            onClick={() => { setActiveTab('history'); setSelectedIds([]); }}
            className={`py-1.5 px-4 font-bold transition text-sm rounded-md flex items-center gap-2 ${activeTab === 'history'
              ? 'bg-white text-indigo-700 shadow-sm'
              : 'text-gray-500 hover:text-indigo-600'
              }`}
          >
            History <span className="bg-gray-200 px-1.5 py-0.5 rounded text-[10px]">{historyReports.length}</span>
          </button>
        </div>

        {/* Global Search */}
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
          <input
            type="text"
            placeholder="Search reports..."
            value={filters.searchQuery}
            onChange={(e) => setFilters({ ...filters, searchQuery: e.target.value })}
            className="w-full bg-white border border-gray-300 rounded-lg pl-10 pr-4 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm shadow-sm transition-all"
          />
        </div>

        {/* Simple Filters */}
        <div className="flex gap-2">
          <input
            type="date"
            value={filters.fromDate}
            onChange={(e) => setFilters({ ...filters, fromDate: e.target.value })}
            className="bg-white border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm shadow-sm transition-all"
            title="From Date"
          />
          <input
            type="date"
            value={filters.toDate}
            onChange={(e) => setFilters({ ...filters, toDate: e.target.value })}
            className="bg-white border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm shadow-sm transition-all"
            title="To Date"
          />
        </div>

        {activeTab === 'pending' && selectedIds.length > 0 && (
          <button
            onClick={handleBulkSubmit}
            disabled={loading}
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2 rounded-lg font-bold flex items-center gap-2 transition shadow-lg animate-in zoom-in-95"
          >
            <Save size={18} />
            {loading ? 'Processing...' : `Approve Selected (${selectedIds.length})`}
          </button>
        )}
      </div>

      {/* Main Content Area */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm flex flex-col overflow-hidden min-h-[500px]">
        {/* Mobile View: Card List */}
        <div className="md:hidden flex flex-col gap-3 p-3 overflow-y-auto h-[calc(100vh-380px)] min-h-[350px] bg-gray-50/50">
          {fetching ? (
            <div className="flex-1 flex flex-col items-center justify-center py-20 space-y-4">
              <div className="w-10 h-10 border-4 border-indigo-100 border-t-indigo-600 rounded-full animate-spin"></div>
              <p className="text-gray-400 text-xs font-bold uppercase tracking-widest animate-pulse">Syncing Reports...</p>
            </div>
          ) : (
            <>
              {paginatedReports.map((rpt, idx) => (
                <div
                  key={idx}
                  className={`bg-white rounded-xl border transition-all duration-200 shadow-sm overflow-hidden flex flex-col ${activeTab === 'pending' && selectedIds.includes(rpt.sn) ? 'border-indigo-500 ring-1 ring-indigo-500' : 'border-gray-200'
                    }`}
                  onClick={() => activeTab === 'pending' && handleSelectRow(rpt.sn)}
                >
                  {/* Card Header */}
                  <div className={`px-4 py-2 border-b flex justify-between items-center ${activeTab === 'pending' && selectedIds.includes(rpt.sn) ? 'bg-indigo-50 border-indigo-100' : 'bg-gray-50 border-gray-100'
                    }`}>
                    <div className="flex items-center gap-2">
                      {activeTab === 'pending' && (
                        <div className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${selectedIds.includes(rpt.sn) ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-white border-gray-300'
                          }`}>
                          {selectedIds.includes(rpt.sn) && <Check size={12} strokeWidth={4} />}
                        </div>
                      )}
                      <span className="text-xs font-black text-indigo-900 tracking-wider">{rpt.sn}</span>
                    </div>

                    {activeTab === 'history' ? (
                      <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase ${rpt.status === 'Approved' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                        }`}>
                        {rpt.status}
                      </span>
                    ) : (
                      <select
                        onClick={(e) => e.stopPropagation()}
                        disabled={!selectedIds.includes(rpt.sn)}
                        value={rowStatuses[rpt.sn] || 'Approved'}
                        onChange={(e) => setRowStatuses({ ...rowStatuses, [rpt.sn]: e.target.value })}
                        className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded border ${!selectedIds.includes(rpt.sn)
                            ? 'bg-gray-100 border-gray-200 text-gray-400 opacity-50'
                            : 'bg-white border-indigo-200 text-indigo-700'
                          }`}
                      >
                        <option value="Approved">Approve</option>
                        <option value="Rejected">Reject</option>
                      </select>
                    )}
                  </div>

                  {/* Card Body */}
                  <div className="p-4 space-y-3">
                    <div className="flex justify-between items-start">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center text-gray-400">
                          <User size={16} />
                        </div>
                        <div>
                          <p className="text-xs font-black text-gray-900 uppercase tracking-tight leading-none mb-1">{rpt.name}</p>
                          <p className="text-[9px] font-bold text-gray-400 flex items-center gap-1 uppercase">
                            <Calendar size={10} /> {rpt.date ? formatDate(rpt.date) : '-'}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-[10px]">
                      <div className="bg-gray-50 p-2 rounded-lg border border-gray-100">
                        <p className="text-gray-400 font-bold uppercase mb-0.5 tracking-tighter">Status</p>
                        <p className="font-bold text-gray-700 uppercase">{rpt.opStatus}</p>
                      </div>
                      <div className="bg-gray-50 p-2 rounded-lg border border-gray-100">
                        <p className="text-gray-400 font-bold uppercase mb-0.5 tracking-tighter">Location</p>
                        <p className="font-bold text-indigo-600 uppercase truncate">{rpt.location}</p>
                      </div>
                    </div>

                    {activeTab === 'history' && (
                      <div className="bg-indigo-50/50 p-2 rounded-lg border border-indigo-100 flex justify-between items-center">
                        <span className="text-[9px] font-bold text-indigo-400 uppercase tracking-tighter">Approve By</span>
                        <span className="text-[10px] font-bold text-indigo-900 uppercase">{rpt.approveBy || '-'}</span>
                      </div>
                    )}

                    <div className="flex justify-between items-end gap-2 pt-1">
                      <div className="flex-1">
                        <p className="text-[9px] font-bold text-gray-400 uppercase tracking-tighter mb-1">Activity</p>
                        <p className="text-xs text-gray-600 line-clamp-2 leading-relaxed h-[36px]">{rpt.details}</p>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleViewDetails(rpt);
                        }}
                        className="flex-shrink-0 bg-indigo-50 p-2 rounded-lg text-indigo-600 hover:bg-indigo-100"
                      >
                        <FileText size={18} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}

              {paginatedReports.length === 0 && (
                <div className="flex-1 flex flex-col items-center justify-center py-20 opacity-30">
                  <FileText size={48} />
                  <p className="text-sm font-bold uppercase tracking-widest mt-2">No Reports Found</p>
                </div>
              )}
            </>
          )}
        </div>

        {/* Desktop View: Table */}
        <div className="hidden md:block overflow-x-auto overflow-y-auto h-[calc(110vh-350px)] [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
          <table className="w-full min-w-[1000px] relative border-collapse">
            <thead className="bg-gray-50 border-b border-gray-200 sticky top-0 z-10 shadow-sm">
              <tr>
                {activeTab === 'pending' && (
                  <th className="px-4 py-4 text-center">
                    <input
                      type="checkbox"
                      className="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                      checked={selectedIds.length > 0 && selectedIds.length === paginatedReports.length}
                      onChange={() => handleSelectAll(paginatedReports)}
                    />
                  </th>
                )}
                {activeTab === 'pending' && <th className="px-4 py-3 text-center text-sm font-semibold text-gray-900">Status</th>}
                <th className="px-4 py-3 text-center text-sm font-semibold text-gray-900">SN</th>
                {activeTab === 'history' && <th className="px-4 py-3 text-center text-sm font-semibold text-gray-900">Decision</th>}
                {activeTab === 'history' && <th className="px-4 py-3 text-center text-sm font-semibold text-gray-900">Approve By</th>}
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">Person Name</th>
                <th className="px-4 py-3 text-center text-sm font-semibold text-gray-900">Work Date</th>
                <th className="px-4 py-3 text-center text-sm font-semibold text-gray-900">Op Status</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">Working Details</th>
                <th className="px-4 py-3 text-center text-sm font-semibold text-gray-900">Location</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">Remarks</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {fetching ? (
                <tr>
                  <td colSpan="11" className="py-20 text-center">
                    <div className="flex flex-col items-center justify-center space-y-4">
                      <div className="w-12 h-12 border-4 border-indigo-100 border-t-indigo-600 rounded-full animate-spin"></div>
                      <p className="text-gray-400 text-sm font-bold uppercase tracking-widest animate-pulse">Synchronizing with Sheet...</p>
                    </div>
                  </td>
                </tr>
              ) : paginatedReports.map((rpt, idx) => (
                <tr key={idx} className={`group hover:bg-gray-50/80 transition-colors ${selectedIds.includes(rpt.sn) ? 'bg-indigo-50/30' : ''}`}>
                  {activeTab === 'pending' && (
                    <td className="px-4 py-4 text-center">
                      <input
                        type="checkbox"
                        className="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                        checked={selectedIds.includes(rpt.sn)}
                        onChange={() => handleSelectRow(rpt.sn)}
                      />
                    </td>
                  )}
                  {activeTab === 'pending' && (
                    <td className="px-4 py-4 text-center">
                      <select
                        disabled={!selectedIds.includes(rpt.sn)}
                        value={rowStatuses[rpt.sn] || 'Approved'}
                        onChange={(e) => setRowStatuses({ ...rowStatuses, [rpt.sn]: e.target.value })}
                        className={`text-xs font-bold uppercase px-2 py-1 rounded-md border transition-all ${!selectedIds.includes(rpt.sn)
                            ? 'bg-gray-50 border-gray-200 text-gray-400 cursor-not-allowed'
                            : rowStatuses[rpt.sn] === 'Rejected'
                              ? 'bg-red-50 border-red-200 text-red-600'
                              : 'bg-green-50 border-green-200 text-green-600'
                          }`}
                      >
                        <option value="Approved">Approve</option>
                        <option value="Rejected">Reject</option>
                      </select>
                    </td>
                  )}
                  <td className="px-4 py-4 text-center text-sm font-bold text-indigo-900 tracking-tight">{rpt.sn}</td>

                  {activeTab === 'history' && (
                    <td className="px-4 py-4 text-center">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${rpt.status === 'Approved' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                        }`}>
                        {rpt.status === 'Approved' ? <CheckCircle size={12} /> : <XCircle size={12} />}
                        {rpt.status}
                      </span>
                    </td>
                  )}
                  {activeTab === 'history' && (
                    <td className="px-4 py-4 text-center">
                      <div className="flex flex-col items-center">
                        <span className="text-xs font-bold text-gray-900">{rpt.approveBy || '-'}</span>
                        <span className="text-[9px] text-gray-400 font-medium">{rpt.colK ? formatDate(rpt.colK) : ''}</span>
                      </div>
                    </td>
                  )}


                  <td className="px-4 py-4 text-left">
                    <div className="text-sm font-bold text-gray-800 uppercase tracking-tight">{rpt.name}</div>
                  </td>
                  <td className="px-4 py-4 text-center text-sm text-gray-600 font-medium whitespace-nowrap">
                    {rpt.date ? formatDate(rpt.date) : '-'}
                  </td>
                  <td className="px-4 py-4 text-center">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-tighter ${rpt.opStatus === 'Full Day' ? 'bg-green-50 text-green-600' :
                        rpt.opStatus === 'Half Day' ? 'bg-amber-50 text-amber-600' : 'bg-red-50 text-red-600'
                      }`}>
                      {rpt.opStatus}
                    </span>
                  </td>
                  <td className="px-4 py-4 text-left max-w-xs">
                    <div className="flex flex-col gap-1">
                      <p className="text-xs text-gray-600 line-clamp-1 leading-relaxed" title={rpt.details}>
                        {rpt.details}
                      </p>
                      <button
                        onClick={() => handleViewDetails(rpt)}
                        className="text-[10px] font-bold text-indigo-600 hover:text-indigo-800 uppercase tracking-tighter flex items-center gap-1 w-fit"
                      >
                        <FileText size={10} />
                        View All
                      </button>
                    </div>
                  </td>
                  <td className="px-4 py-4 text-center text-xs font-bold text-gray-500 uppercase">{rpt.location}</td>
                  <td className="px-4 py-4 text-left">
                    <p className="text-xs text-gray-500 italic truncate max-w-[150px]">{rpt.remarks || '-'}</p>
                  </td>
                </tr>
              ))}
              {paginatedReports.length === 0 && !fetching && (
                <tr>
                  <td colSpan="11" className="py-32 text-center">
                    <div className="flex flex-col items-center space-y-2 opacity-30">
                      <FileText size={64} />
                      <p className="text-xl font-bold uppercase tracking-widest">No Records Found</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Improved Pagination Footer */}
        <div className="px-6 py-4 border-t border-gray-100 bg-gray-50/50 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3 text-sm text-gray-500">
            <span className="font-medium">Displaying</span>
            <select
              value={itemsPerPage}
              onChange={(e) => { setItemsPerPage(Number(e.target.value)); setCurrentPage(1); }}
              className="border border-gray-300 rounded px-2 py-1 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              {[15, 30, 50, 100].map(v => <option key={v} value={v}>{v}</option>)}
            </select>
            <span className="text-gray-300">|</span>
            <span>
              Showing <span className="font-bold text-gray-900">{filteredReports.length > 0 ? ((currentPage - 1) * itemsPerPage) + 1 : 0}</span> to <span className="font-bold text-gray-900">{Math.min(currentPage * itemsPerPage, filteredReports.length)}</span> of <span className="font-bold text-gray-900">{filteredReports.length}</span>
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="p-2 border border-gray-300 rounded-lg bg-white disabled:opacity-30 hover:bg-indigo-50 transition-all shadow-sm"
            >
              <ChevronLeft size={20} className="text-indigo-600" />
            </button>
            <div className="bg-indigo-600 text-white px-4 py-2 rounded-lg font-bold text-sm shadow-md">
              Page {currentPage} of {totalPages || 1}
            </div>
            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages || totalPages === 0}
              className="p-2 border border-gray-300 rounded-lg bg-white disabled:opacity-30 hover:bg-indigo-50 transition-all shadow-sm"
            >
              <ChevronRight size={20} className="text-indigo-600" />
            </button>
          </div>
        </div>
      </div>

      {/* View Details Modal */}
      {showViewModal && selectedReport && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex flex-col items-center justify-center z-50 sm:p-4">
          <div className="bg-white rounded-t-2xl sm:rounded-xl shadow-2xl w-full max-w-md h-full sm:h-auto sm:max-h-[85vh] flex flex-col overflow-hidden animate-in slide-in-from-bottom sm:zoom-in-95 duration-200">
            {/* Header */}
            <div className="p-5 border-b border-gray-200 flex justify-between items-center bg-indigo-900 text-white flex-shrink-0">
              <div>
                <h2 className="text-xl font-bold uppercase tracking-tight">{selectedReport.sn}</h2>
                <p className="text-[10px] font-bold text-indigo-300 uppercase tracking-widest mt-0.5">Report Details</p>
              </div>
              <button type="button" onClick={() => setShowViewModal(false)} className="text-indigo-200 hover:text-white transition-colors p-1">
                <X size={24} />
              </button>
            </div>

            {/* Content */}
            <div className="p-6 overflow-y-auto flex-1 space-y-6">
              {/* Profile Bar */}
              <div className="flex flex-col gap-1 pb-4 border-b border-gray-100">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Employee Name</p>
                <h3 className="text-2xl font-black text-gray-900 uppercase tracking-tighter leading-none">{selectedReport.name}</h3>
              </div>

              {/* Stats Grid */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Work Date</p>
                  <p className="font-bold text-gray-900 text-sm flex items-center gap-2">
                    <Calendar size={14} className="text-indigo-500" />
                    {selectedReport.date ? formatDate(selectedReport.date) : '-'}
                  </p>
                </div>
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Op Status</p>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 size={14} className="text-green-500" />
                    <span className="font-bold text-gray-900 text-xs uppercase">{selectedReport.opStatus}</span>
                  </div>
                </div>
                <div className="bg-gray-50 rounded-lg p-3 col-span-2">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Work Location</p>
                  <p className="font-bold text-indigo-600 text-sm flex items-center gap-2">
                    <MapPin size={14} className="text-indigo-500" />
                    {selectedReport.location}
                  </p>
                </div>
              </div>

              {/* Work Details & Images */}
              <div className="space-y-4">
                <h4 className="text-xs font-bold text-gray-900 uppercase tracking-widest flex items-center gap-2">
                  <FileText size={16} className="text-indigo-600" />
                  Working Details & Images
                </h4>
                <div className="space-y-3">
                  {selectedReport.details.split('\n').map((line, idx) => {
                    const detailImages = selectedReport.imageLinks && selectedReport.imageLinks[idx] ? selectedReport.imageLinks[idx] : [];
                    return (
                      <div key={idx} className="bg-indigo-50/30 rounded-xl border border-indigo-100 p-4 space-y-3">
                        <p className="text-sm text-gray-700 leading-relaxed font-medium">{line}</p>
                        {detailImages.length > 0 && (
                          <div className="flex flex-wrap gap-2">
                              <button 
                                key={imgIdx} 
                                onClick={() => setPreviewImage(link)}
                                className="block w-20 h-20 rounded-lg overflow-hidden border border-indigo-200 hover:ring-2 hover:ring-indigo-400 transition shadow-sm"
                              >
                                <img src={link} alt="Work" className="w-full h-full object-cover" />
                              </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Remarks */}
              {selectedReport.remarks && (
                <div className="space-y-1">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Additional Remarks</p>
                  <p className="text-sm text-gray-600 italic border-l-2 border-gray-200 pl-3">{selectedReport.remarks}</p>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-gray-100 bg-gray-50 flex-shrink-0">
              <button
                onClick={() => setShowViewModal(false)}
                className="w-full bg-indigo-600 text-white font-bold py-3 rounded-lg hover:bg-indigo-700 transition shadow-lg"
              >
                Close Details
              </button>
            </div>
          </div>
        </div>
      )}
        </div>
      )}

      {/* Full Image Preview Modal */}
      {previewImage && (
        <div 
          className="fixed inset-0 bg-black/90 backdrop-blur-sm flex items-center justify-center z-[100] p-4 animate-in fade-in duration-200"
          onClick={() => setPreviewImage(null)}
        >
          <button 
            className="absolute top-4 right-4 text-white/70 hover:text-white transition p-2"
            onClick={() => setPreviewImage(null)}
          >
            <X size={32} />
          </button>
          <img 
            src={previewImage} 
            alt="Preview" 
            className="max-w-full max-h-[90vh] object-contain rounded-lg shadow-2xl animate-in zoom-in-95 duration-300"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}
