import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { Plus, Search, ChevronLeft, ChevronRight, X, Calendar, Clock, MapPin, User, FileText, CheckCircle2 } from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { formatDate } from '../utils/helpers';

export default function DailyReport() {
  const { user } = useAuthStore();
  const [reports, setReports] = useState([]);
  const [usersList, setUsersList] = useState([]);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [showFormModal, setShowFormModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [selectedReport, setSelectedReport] = useState(null);

  // Filters
  const [filters, setFilters] = useState({
    fromDate: '',
    toDate: '',
    personName: '',
    searchQuery: ''
  });

  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(15);

  const [formData, setFormData] = useState({
    personName: user?.name || '',
    employeeId: user?.empId || '',
    date: new Date().toISOString().split('T')[0],
    status: 'Full Day',
    details: [{ text: '', images: [] }],
    location: '',
    remarks: ''
  });

  const API_URL = import.meta.env.VITE_APPS_SCRIPT_URL;
  const REPORT_SHEET = (import.meta.env.VITE_DAILY_REPORT_SHEET_NAME || 'Daily Report').replace(/"/g, '');

  useEffect(() => {
    fetchInitialData();
  }, []);

  const fetchInitialData = async () => {
    try {
      setFetching(true);
      await Promise.all([fetchReports(), fetchUsers()]);
    } finally {
      setFetching(false);
    }
  };

  const fetchReports = async () => {
    try {
      const resp = await fetch(`${API_URL}?sheet=${REPORT_SHEET}`);
      const result = await resp.json();
      if (result.success && result.data) {
        // First 6 rows are headers/instructions as per "A7:A" mapping
        const reportData = result.data.slice(6); // Data starts at Row 7
        const formattedReports = reportData
          .filter(row => row[1] && row[1] !== '') // Filter empty rows (B is Serial No)
          .map((row, idx) => ({
            timestamp: row[0],
            sn: row[1],
            empId: row[2],
            name: row[3],
            date: row[4],
            status: row[5],
            details: row[6],
            location: row[7],
            remarks: row[8],
            imageLinks: row[14] ? JSON.parse(row[14]) : []
          }));
        setReports(formattedReports);
      }
    } catch (err) {
      console.error('Fetch reports error:', err);
      toast.error('Failed to load reports');
    }
  };

  const fetchUsers = async () => {
    if (user?.role !== 'ADMIN' && user?.role !== 'MASTER ADMIN') return;
    const MASTER_SHEET = import.meta.env.VITE_MASTER_SHEET_NAME || 'Master';
    try {
      const resp = await fetch(`${API_URL}?sheet=${MASTER_SHEET}`);
      const result = await resp.json();
      if (result.success && result.data) {
        const users = result.data.slice(1).map(row => ({
          empId: row[2], // Column C
          name: row[3]   // Column D
        }));
        setUsersList(users);
      }
    } catch (err) {
      console.error('Fetch users error:', err);
    }
  };

  const getIndiaTime = () => {
    const now = new Date();
    const indiaOffset = 5.5 * 60 * 60 * 1000;
    const indiaTime = new Date(now.getTime() + indiaOffset);

    const pad = (num) => String(num).padStart(2, '0');

    const yyyy = indiaTime.getUTCFullYear();
    const mm = pad(indiaTime.getUTCMonth() + 1);
    const dd = pad(indiaTime.getUTCDate());
    const hh = pad(indiaTime.getUTCHours());
    const min = pad(indiaTime.getUTCMinutes());
    const ss = pad(indiaTime.getUTCSeconds());

    return `${yyyy}/${mm}/${dd} ${hh}:${min}:${ss}`;
  };

  const generateSN = () => {
    const count = reports.length;
    return `SN-${String(count + 1).padStart(3, '0')}`;
  };

  const handleUserChange = (name) => {
    const selected = usersList.find(u => u.name === name);
    setFormData({
      ...formData,
      personName: name,
      employeeId: selected ? selected.empId : ''
    });
  };

  const handleImageChange = async (e, detailIndex) => {
    const files = Array.from(e.target.files);
    const newImages = await Promise.all(files.map(async (file) => {
      const base64 = await new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.readAsDataURL(file);
      });
      return {
        name: file.name,
        type: file.type,
        base64: base64.split(',')[1] // Remove the prefix
      };
    }));

    setFormData(prev => {
      const newDetails = [...prev.details];
      newDetails[detailIndex] = {
        ...newDetails[detailIndex],
        images: [...newDetails[detailIndex].images, ...newImages]
      };
      return { ...prev, details: newDetails };
    });
  };

  const removeImage = (detailIndex, imgIndex) => {
    setFormData(prev => {
      const newDetails = [...prev.details];
      newDetails[detailIndex] = {
        ...newDetails[detailIndex],
        images: newDetails[detailIndex].images.filter((_, i) => i !== imgIndex)
      };
      return { ...prev, details: newDetails };
    });
  };

  const FOLDER_ID = "1bV1AvkFLm5mRsR_Ojxy36LOE7xXClfeJ";

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const timestamp = getIndiaTime();
      const sn = generateSN();

      // 1. Upload Images for each detail item first
      const imageLinksMapping = await Promise.all(formData.details.map(async (detail, dIdx) => {
        if (!detail.images || detail.images.length === 0) return [];

        const uploadedUrls = await Promise.all(detail.images.map(async (img) => {
          const uploadParams = new URLSearchParams();
          uploadParams.append('action', 'uploadFile');
          uploadParams.append('base64Data', img.base64);
          uploadParams.append('fileName', img.name);
          uploadParams.append('mimeType', img.type);
          uploadParams.append('folderId', FOLDER_ID);

          const uploadResp = await fetch(API_URL, {
            method: 'POST',
            body: uploadParams.toString(),
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
            }
          });
          const uploadResult = await uploadResp.json();
          if (!uploadResult.success) throw new Error(uploadResult.error || "Image upload failed");
          return uploadResult.fileUrl;
        }));
        return uploadedUrls;
      }));

      // 2. Construct the final row data
      const rowData = [
        timestamp,         // A
        sn,                // B
        formData.employeeId, // C
        formData.personName, // D
        formData.date.replace(/-/g, '/'), // E
        formData.status,   // F
        formData.details.filter(d => d.text.trim() !== '').map((d, i) => `${i + 1}. ${d.text}`).join('\n'), // G
        formData.location, // H
        formData.remarks,  // I
        "", "", "", "", "", // J, K, L, M, N (Empty placeholders)
        JSON.stringify(imageLinksMapping) // O: The JSON array of image links
      ];

      // 3. Send the final row insertion request
      const insertParams = new URLSearchParams();
      insertParams.append('action', 'insert');
      insertParams.append('sheetName', REPORT_SHEET);
      insertParams.append('rowData', JSON.stringify(rowData));

      const resp = await fetch(API_URL, {
        method: 'POST',
        body: insertParams.toString(),
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        }
      });
      const result = await resp.json();

      if (result.success) {
        toast.success(`Report ${sn} saved successfully!`);
        setShowFormModal(false);
        setFormData({
          ...formData,
          details: [{ text: '', images: [] }],
          location: '',
          remarks: ''
        });
        fetchReports();
      } else {
        throw new Error(result.error || 'Failed to save');
      }
    } catch (err) {
      console.error('Save error:', err);
      toast.error('Error saving report: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const filteredReports = reports.filter(rpt => {
    if (filters.fromDate && rpt.date < filters.fromDate) return false;
    if (filters.toDate && rpt.date > filters.toDate) return false;
    if (filters.personName && rpt.name !== filters.personName) return false;

    if (filters.searchQuery) {
      const q = filters.searchQuery.toLowerCase();
      return (
        rpt.sn?.toLowerCase().includes(q) ||
        rpt.name?.toLowerCase().includes(q) ||
        rpt.empId?.toLowerCase().includes(q) ||
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
      {/* Header with Filters */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-3 md:gap-4 w-full">
        <div className="flex flex-col md:flex-row w-full gap-3">

          {/* Search + Add Button Row (Mobile grouping) */}
          <div className="flex items-end gap-2 w-full md:w-auto md:flex-1">
            <div className="flex-1 w-full">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 md:top-2 text-gray-400" size={14} />
                <input
                  type="text"
                  placeholder="Search all fields..."
                  value={filters.searchQuery}
                  onChange={(e) => setFilters({ ...filters, searchQuery: e.target.value })}
                  className="w-full bg-white border border-gray-300 rounded-lg md:rounded pl-8 pr-3 py-2 md:py-1.5 focus:outline-none focus:border-sky-500 text-sm"
                />
              </div>
            </div>
            {/* Mobile Add Button */}
            <button
              onClick={() => setShowFormModal(true)}
              className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg flex items-center justify-center md:hidden h-[38px] w-[38px] flex-shrink-0 shadow-sm transition"
            >
              <Plus size={20} />
            </button>
          </div>

          {/* Filters */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 w-full md:w-auto md:flex-1">
            <div>
              <input
                type="date"
                value={filters.fromDate}
                onChange={(e) => setFilters({ ...filters, fromDate: e.target.value })}
                className="w-full bg-white border border-gray-300 rounded-lg md:rounded px-2 md:px-3 py-2 md:py-1.5 focus:outline-none focus:border-sky-500 text-sm"
              />
            </div>
            <div>
              <input
                type="date"
                value={filters.toDate}
                onChange={(e) => setFilters({ ...filters, toDate: e.target.value })}
                className="w-full bg-white border border-gray-300 rounded-lg md:rounded px-2 md:px-3 py-2 md:py-1.5 focus:outline-none focus:border-sky-500 text-sm"
              />
            </div>
            <div>
              <select
                value={filters.personName}
                onChange={(e) => setFilters({ ...filters, personName: e.target.value })}
                className="w-full bg-white border border-gray-300 rounded-lg md:rounded px-2 md:px-3 py-2 md:py-1.5 focus:outline-none focus:border-sky-500 text-sm"
              >
                <option value="">All Persons</option>
                {Array.from(new Set(reports.map(r => r.name))).filter(Boolean).map(name => (
                  <option key={name} value={name}>{name}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Desktop Add Button */}
        <button
          onClick={() => setShowFormModal(true)}
          className="hidden md:flex bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2 md:h-[34px] rounded-lg font-semibold items-center justify-center gap-2 transition shadow-sm w-full md:w-auto mt-2 md:mt-0 flex-shrink-0"
        >
          <Plus size={18} />
          Add Daily Report
        </button>
      </div>

      {/* List Section */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm flex flex-col mt-4">
        {/* Mobile View: Cards */}
        <div className="md:hidden flex flex-col gap-3 p-3 overflow-y-auto h-[calc(100vh-380px)] min-h-[300px] bg-gray-50/50">
          {fetching ? (
            <div className="flex-1 flex flex-col items-center justify-center py-20 space-y-4">
              <div className="w-10 h-10 border-4 border-indigo-100 border-t-indigo-600 rounded-full animate-spin"></div>
              <p className="text-gray-400 text-xs font-bold uppercase tracking-widest animate-pulse">Loading Reports...</p>
            </div>
          ) : (
            <>
              {paginatedReports.map((rpt, idx) => (
                <div
                  key={idx}
                  onClick={() => {
                    setSelectedReport(rpt);
                    setShowViewModal(true);
                  }}
                  className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden flex cursor-pointer active:scale-[0.98] transition-all hover:shadow-md"
                >
                  {/* Left Status Stripe */}
                  <div className={`w-1.5 flex-shrink-0 ${rpt.status === 'Full Day' ? 'bg-green-500' :
                      rpt.status === 'Half Day' ? 'bg-amber-500' : 'bg-red-500'
                    }`} />

                  {/* Card Content */}
                  <div className="flex-1 p-3 flex flex-col gap-2 min-w-0">
                    {/* Top Row: SN + Status Badge */}
                    <div className="flex justify-between items-center">
                      <span className="text-[11px] font-black text-indigo-800 tracking-wider font-mono">{rpt.sn}</span>
                      <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-widest ${rpt.status === 'Full Day' ? 'bg-green-100 text-green-700' :
                          rpt.status === 'Half Day' ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'
                        }`}>
                        {rpt.status}
                      </span>
                    </div>

                    {/* Middle Row: User + Date */}
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600 border border-indigo-100 flex-shrink-0">
                        <User size={15} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <h3 className="font-black text-gray-900 text-sm uppercase tracking-tight leading-tight truncate">{rpt.name}</h3>
                        <div className="flex items-center gap-3 mt-0.5">
                          <span className="flex items-center gap-1 text-[10px] text-gray-500 font-bold">
                            <Calendar size={10} className="text-indigo-400" />
                            {rpt.date ? formatDate(rpt.date) : '-'}
                          </span>
                          {rpt.location && (
                            <span className="flex items-center gap-1 text-[10px] text-gray-500 font-bold truncate">
                              <MapPin size={10} className="text-gray-400" />
                              <span className="truncate">{rpt.location}</span>
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Bottom Row: Work Preview */}
                    {rpt.details && (
                      <p className="text-[11px] text-gray-500 leading-snug line-clamp-1 italic pl-[42px]">
                        {rpt.details}
                      </p>
                    )}
                  </div>
                </div>
              ))}

              {filteredReports.length === 0 && (
                <div className="flex-1 flex flex-col items-center justify-center py-20 opacity-30">
                  <FileText size={48} />
                  <p className="text-sm font-bold uppercase tracking-widest mt-2">No Reports Found</p>
                </div>
              )}
            </>
          )}
        </div>

        {/* Desktop View: Table */}
        <div className="hidden md:block overflow-x-auto overflow-y-auto h-[calc(110vh-300px)] [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
          <table className="w-full min-w-[800px] relative border-collapse">
            <thead className="bg-gray-50 border-b border-gray-200 sticky top-0 z-10 shadow-sm">
              <tr>
                <th className="px-4 py-3 text-center text-sm font-semibold text-gray-900">Serial No</th>
                <th className="px-4 py-3 text-center text-sm font-semibold text-gray-900">Employee</th>
                <th className="px-4 py-3 text-center text-sm font-semibold text-gray-900">Work Date</th>
                <th className="px-4 py-3 text-center text-sm font-semibold text-gray-900">Status</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">Work Details</th>
                <th className="px-4 py-3 text-center text-sm font-semibold text-gray-900">Location</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">Remarks</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {fetching ? (
                <tr>
                  <td colSpan="7" className="py-20 text-center">
                    <div className="flex flex-col items-center justify-center space-y-4">
                      <div className="w-12 h-12 border-4 border-indigo-100 border-t-indigo-600 rounded-full animate-spin"></div>
                      <p className="text-gray-400 text-sm font-bold uppercase tracking-widest">Loading Reports...</p>
                    </div>
                  </td>
                </tr>
              ) : (
                <>
                  {paginatedReports.map((rpt, idx) => (
                    <tr key={idx} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-center text-sm font-medium text-gray-900">{rpt.sn}</td>
                      <td className="px-4 py-3 text-center text-sm text-gray-700">
                        <div className="font-bold text-gray-900">{rpt.name}</div>
                      </td>
                      <td className="px-4 py-3 text-center text-sm text-gray-700">
                        {rpt.date ? formatDate(rpt.date) : '-'}
                      </td>
                      <td className="px-4 py-3 text-center text-sm text-gray-700 uppercase tracking-tighter font-bold">
                        <span className={`px-2 py-0.5 rounded text-[10px] ${rpt.status === 'Full Day' ? 'bg-green-100 text-green-700' :
                          rpt.status === 'Half Day' ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'
                          }`}>
                          {rpt.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-left text-sm text-gray-600 max-w-sm">
                        <div className="flex flex-col gap-1">
                          <div className="whitespace-pre-line leading-relaxed line-clamp-2">
                            {rpt.details}
                          </div>
                          <button
                            onClick={() => {
                              setSelectedReport(rpt);
                              setShowViewModal(true);
                            }}
                            className="text-indigo-600 hover:text-indigo-800 text-[10px] font-bold flex items-center gap-1 mt-1 transition w-fit"
                          >
                            <FileText size={12} />
                            VIEW ALL
                          </button>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center text-sm text-gray-700">{rpt.location}</td>
                      <td className="px-4 py-3 text-left text-sm text-gray-600 max-w-xs truncate">
                        {rpt.remarks || '-'}
                      </td>
                    </tr>
                  ))}
                  {paginatedReports.length === 0 && (
                    <tr>
                      <td colSpan="7" className="p-8 text-center text-gray-500">
                        No entries found.
                      </td>
                    </tr>
                  )}
                </>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Controls */}
        <div className="px-4 py-3 border-t border-gray-200 bg-gray-50 flex flex-col lg:flex-row items-center justify-between gap-3 rounded-b-lg">
          <div className="text-sm text-gray-600 flex items-center gap-2">
            <span>Show</span>
            <select
              value={itemsPerPage}
              onChange={(e) => {
                setItemsPerPage(Number(e.target.value));
                setCurrentPage(1);
              }}
              className="border border-gray-300 rounded px-1.5 py-1 focus:outline-none focus:border-sky-500 bg-white"
            >
              {[10, 15, 20, 50, 100].map(v => <option key={v} value={v}>{v}</option>)}
            </select>
            <span>entries</span>
            <span className="text-gray-300 mx-1">|</span>
            <span className="text-sm text-gray-500">
              {reports.length > 0 ? ((currentPage - 1) * itemsPerPage) + 1 : 0}-{Math.min(currentPage * itemsPerPage, reports.length)} of {reports.length}
            </span>
          </div>

          <div className="flex gap-2 items-center text-gray-700">
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="p-1 border border-gray-300 rounded bg-white disabled:opacity-50 hover:bg-gray-100 transition shadow-sm"
            >
              <ChevronLeft size={18} />
            </button>
            <div className="text-sm font-medium px-2">
              Pg {currentPage}/{totalPages || 1}
            </div>
            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages || totalPages === 0}
              className="p-1 border border-gray-300 rounded bg-white disabled:opacity-50 hover:bg-gray-100 transition shadow-sm"
            >
              <ChevronRight size={18} />
            </button>
          </div>
        </div>
      </div>

      {/* Form Modal */}
      {showFormModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex flex-col items-center justify-center z-50 sm:p-4">
          <div className="bg-white rounded-t-2xl sm:rounded-xl shadow-2xl w-full max-w-md h-full sm:h-auto sm:max-h-[90vh] flex flex-col overflow-hidden">
            <form onSubmit={handleSubmit} className="flex flex-col h-full overflow-hidden">
              {/* Header - Fixed */}
              <div className="p-5 border-b border-gray-200 flex justify-between items-center bg-gray-50 flex-shrink-0">
                <h2 className="text-xl font-bold text-gray-900">Daily Report Form</h2>
                <button type="button" onClick={() => setShowFormModal(false)} className="text-gray-400 hover:text-red-500 transition-colors">
                  <X size={24} />
                </button>
              </div>

              {/* Body - Scrollable */}
              <div className="p-4 md:p-5 overflow-y-auto flex-1 space-y-4">
                <div className="grid grid-cols-1 gap-4">
                  {/* Person Name */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Person Name *</label>
                    {(user?.role === 'ADMIN' || user?.role === 'MASTER ADMIN') ? (
                      <select
                        value={formData.personName}
                        onChange={(e) => handleUserChange(e.target.value)}
                        className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-sky-400"
                        required
                      >
                        <option value="">Select Employee</option>
                        {usersList.map((u, i) => <option key={i} value={u.name}>{u.name}</option>)}
                      </select>
                    ) : (
                      <input
                        type="text"
                        value={formData.personName}
                        className="w-full border border-gray-300 rounded-lg px-4 py-2 bg-gray-50 cursor-not-allowed"
                        disabled
                      />
                    )}
                  </div>

                  {/* Work Date */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Work Date *</label>
                    <input
                      type="date"
                      value={formData.date}
                      onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                      className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-sky-400"
                      required
                    />
                  </div>

                  {/* Operational Status */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Operational Status *</label>
                    <div className="grid grid-cols-3 gap-2">
                      {['Full Day', 'Half Day', 'Absent'].map(st => (
                        <button
                          key={st}
                          type="button"
                          onClick={() => setFormData({ ...formData, status: st })}
                          className={`py-3 sm:py-2 text-xs font-bold rounded-lg border transition-all ${formData.status === st
                            ? 'bg-indigo-600 border-indigo-600 text-white'
                            : 'bg-white border-gray-200 text-gray-500 hover:border-indigo-300'
                            }`}
                        >
                          {st}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Location */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Work Location *</label>
                    <input
                      type="text"
                      placeholder="e.g. Office, Field, Customer Site"
                      value={formData.location}
                      onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                      className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-sky-400"
                      required
                    />
                  </div>
                </div>

                {/* Working Details Section */}
                <div className="space-y-3">
                  <div className="flex justify-between items-center mb-1">
                    <label className="block text-sm font-bold text-indigo-900 uppercase tracking-wide">Working Details *</label>
                    <span className="text-[10px] font-bold text-gray-400">
                      {Array.isArray(formData.details) ? formData.details.length : 0}/10 ITEMS
                    </span>
                  </div>

                  <div className="space-y-4">
                    {formData.details.map((detail, index) => (
                      <div key={index} className="p-4 bg-gray-50 rounded-xl border border-gray-200 space-y-3">
                        <div className="flex justify-between items-center">
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-full bg-indigo-600 text-white flex items-center justify-center text-xs font-bold">
                              {index + 1}
                            </div>
                            <span className="text-xs font-bold text-gray-500 uppercase tracking-widest">Detail Item</span>
                          </div>
                          {index > 0 && (
                            <button
                              type="button"
                              onClick={() => {
                                const newDetails = formData.details.filter((_, i) => i !== index);
                                setFormData({ ...formData, details: newDetails });
                              }}
                              className="text-red-500 hover:text-red-700 p-1 transition"
                            >
                              <X size={16} />
                            </button>
                          )}
                        </div>

                        <textarea
                          rows="2"
                          placeholder={index === 0 ? "Describe your main activity..." : "Add another task detail..."}
                          value={detail.text}
                          onChange={(e) => {
                            const newDetails = [...formData.details];
                            newDetails[index].text = e.target.value;
                            setFormData({ ...formData, details: newDetails });
                          }}
                          className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-sky-400 text-sm bg-white"
                          required={index === 0}
                        />

                        {/* Image Upload for this detail */}
                        <div className="space-y-2">
                          <div className="flex flex-wrap gap-2">
                            {detail.images.map((img, imgIdx) => (
                              <div key={imgIdx} className="relative w-16 h-16 rounded-lg overflow-hidden border border-gray-300 shadow-sm">
                                <img
                                  src={`data:image/png;base64,${img.base64}`}
                                  alt="preview"
                                  className="w-full h-full object-cover"
                                />
                                <button
                                  type="button"
                                  onClick={() => removeImage(index, imgIdx)}
                                  className="absolute top-0 right-0 bg-red-500 text-white rounded-bl-lg p-0.5"
                                >
                                  <X size={10} />
                                </button>
                              </div>
                            ))}
                            {detail.images.length < 3 && (
                              <label className="w-16 h-16 flex flex-col items-center justify-center border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:bg-gray-100 transition bg-white">
                                <Plus size={16} className="text-gray-400" />
                                <input
                                  type="file"
                                  className="hidden"
                                  accept="image/*"
                                  multiple
                                  onChange={(e) => handleImageChange(e, index)}
                                />
                              </label>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {formData.details.length < 10 && (
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, details: [...formData.details, { text: '', images: [] }] })}
                      className="w-full py-2 border-2 border-dashed border-indigo-200 rounded-lg text-indigo-600 font-bold text-sm hover:bg-indigo-50 hover:border-indigo-400 transition flex items-center justify-center gap-2"
                    >
                      <Plus size={16} />
                      Add More Details
                    </button>
                  )}
                </div>

                {/* Remarks */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Remarks</label>
                  <input
                    type="text"
                    placeholder="Any additional notes..."
                    value={formData.remarks}
                    onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-sky-400"
                  />
                </div>
              </div>

              {/* Footer - Fixed */}
              <div className="p-4 md:p-5 border-t border-gray-200 bg-gray-50/80 backdrop-blur-sm flex-shrink-0">
                <div className="flex flex-col sm:flex-row gap-3">
                  <button
                    type="button"
                    onClick={() => setShowFormModal(false)}
                    className="w-full sm:flex-1 py-3 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition font-bold"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full sm:flex-1 bg-indigo-600 text-white font-bold py-3 px-6 rounded-lg hover:bg-indigo-700 transition disabled:opacity-50"
                  >
                    {loading ? 'Saving...' : 'Save Report'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* View Details Modal */}
      {showViewModal && selectedReport && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex flex-col items-center justify-center z-50 sm:p-4">
          <div className="bg-white rounded-t-2xl sm:rounded-xl shadow-2xl w-full max-w-md h-full sm:h-auto sm:max-h-[85vh] flex flex-col overflow-hidden">
            {/* Header */}
            <div className="p-5 border-b border-gray-200 flex justify-between items-center bg-indigo-900 text-white flex-shrink-0">
              <div>
                <h2 className="text-xl font-bold uppercase tracking-tight">{selectedReport.sn}</h2>
                <p className="text-[10px] font-bold text-indigo-300 uppercase tracking-widest mt-0.5">Report Details</p>
              </div>
              <button type="button" onClick={() => setShowViewModal(false)} className="text-indigo-200 hover:text-white transition-colors">
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
                  <p className="font-bold text-gray-900 flex items-center gap-2">
                    <Calendar size={16} className="text-indigo-500" />
                    {selectedReport.date ? formatDate(selectedReport.date) : '-'}
                  </p>
                </div>
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Status</p>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 size={16} className="text-green-500" />
                    <span className="font-bold text-gray-900 uppercase">{selectedReport.status}</span>
                  </div>
                </div>
                <div className="bg-gray-50 rounded-lg p-3 col-span-2">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Work Location</p>
                  <p className="font-bold text-indigo-600 flex items-center gap-2">
                    <MapPin size={16} className="text-indigo-500" />
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
                            {detailImages.map((link, imgIdx) => (
                              <a key={imgIdx} href={link} target="_blank" rel="noopener noreferrer" className="block w-20 h-20 rounded-lg overflow-hidden border border-indigo-200 hover:opacity-80 transition shadow-sm">
                                <img src={link} alt="Work" className="w-full h-full object-cover" />
                              </a>
                            ))}
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
                Close View
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
