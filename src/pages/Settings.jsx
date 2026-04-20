import React, { useState, useEffect, useMemo } from 'react';
import toast from 'react-hot-toast';
import {
  Plus,
  Edit2,
  Eye,
  EyeOff,
  X,
  Save,
  User,
  Shield,
  CheckCircle2,
  XCircle,
  Clock,
  ChevronLeft,
  ChevronRight,
  Activity
} from 'lucide-react';

export default function Settings() {
  const [users, setUsers] = useState([]);
  const [pageOptions, setPageOptions] = useState([]);
  const [fetching, setFetching] = useState(true);
  const [loading, setLoading] = useState(false);

  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [editingRowIndex, setEditingRowIndex] = useState(null);
  const [showPassword, setShowPassword] = useState(false);

  const [formData, setFormData] = useState({
    empId: '',
    name: '',
    userId: '',
    pass: '',
    role: 'User',
    access: [],
    status: 'Active'
  });

  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(15);

  const API_URL = import.meta.env.VITE_APPS_SCRIPT_URL;
  const MASTER_SHEET = import.meta.env.VITE_MASTER_SHEET_NAME || 'Master';

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setFetching(true);
      const resp = await fetch(`${API_URL}?sheet=${MASTER_SHEET}`);
      const result = await resp.json();
      if (result.success && result.data) {
        // Users start at Row 2 (index 1)
        const userData = result.data.slice(1);

        // Parse Columns A-I
        const formattedUsers = userData
          .map((row, index) => ({
            rowIndex: index + 2,
            timestamp: row[0],
            sn: row[1],
            empId: row[2],
            name: row[3],
            userId: row[4],
            pass: row[5],
            role: row[6],
            access: row[7] ? String(row[7]).split(',').map(p => p.trim()) : [],
            status: row[8]
          }))
          .filter(u => u.sn && u.sn !== '');

        // Fetch Page Access options from Column L (index 11)
        const opts = result.data.slice(1)
          .map(row => row[11])
          .filter(Boolean);

        const uniqueOpts = [...new Set(opts)];
        // Fallback if L is empty
        setPageOptions(uniqueOpts.length > 0 ? uniqueOpts : ['Dashboard', 'Daily Report', 'Admin Approval']);
        setUsers(formattedUsers);
      }
    } catch (err) {
      console.error('Fetch settings error:', err);
      toast.error('Failed to sync user data');
    } finally {
      setFetching(false);
    }
  };

  const getIndiaTime = () => {
    const now = new Date();
    // India is UTC + 5:30
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
    if (users.length === 0) return 'SN-001';

    // Extract numbers from all SNs to find the maximum
    const numbers = users.map(u => {
      const match = u.sn?.match(/\d+/);
      return match ? parseInt(match[0], 10) : 0;
    });

    const maxNum = Math.max(...numbers);
    return `SN-${String(maxNum + 1).padStart(3, '0')}`;
  };

  const handleOpenAdd = () => {
    setEditingRowIndex(null);
    setFormData({
      empId: '',
      name: '',
      userId: '',
      pass: '',
      role: 'User',
      access: [],
      status: 'Active'
    });
    setShowPassword(false);
    setShowModal(true);
  };

  const handleOpenEdit = (user) => {
    setEditingRowIndex(user.rowIndex);
    setFormData({
      empId: user.empId,
      name: user.name,
      userId: user.userId,
      pass: user.pass,
      role: user.role,
      access: user.access,
      status: user.status
    });
    setShowPassword(false);
    setShowModal(true);
  };

  const toggleAccess = (page) => {
    const newAccess = formData.access.includes(page)
      ? formData.access.filter(p => p !== page)
      : [...formData.access, page];
    setFormData({ ...formData, access: newAccess });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const timestamp = getIndiaTime();
      const sn = editingRowIndex ? users.find(u => u.rowIndex === editingRowIndex)?.sn : generateSN();

      // Column A: Timestamp, B: SN, C: EmpID, D: Name, E: ID, F: Pass, G: Role, H: Access, I: Status
      const rowData = [
        timestamp,
        sn,
        formData.empId,
        formData.name,
        formData.userId,
        formData.pass,
        formData.role,
        formData.access.join(', '),
        formData.status
      ];

      let result;
      if (editingRowIndex) {
        // Update surgical (all cells in row A-I)
        const cellPromises = rowData.map((val, idx) => {
          const params = new URLSearchParams({
            action: 'updateCell',
            sheetName: MASTER_SHEET,
            rowIndex: String(editingRowIndex),
            columnIndex: String(idx), // 0 to 8
            value: String(val)
          });
          return fetch(`${API_URL}?${params.toString()}`, { method: 'POST' }).then(r => r.json());
        });
        await Promise.all(cellPromises);
        result = { success: true };
      } else {
        // Insert new
        const resp = await fetch(`${API_URL}?action=insert&sheetName=${MASTER_SHEET}&rowData=${JSON.stringify(rowData)}`, {
          method: 'POST'
        });
        result = await resp.json();
      }

      if (result.success) {
        toast.success(editingRowIndex ? 'User updated!' : 'User added!');
        setShowModal(false);
        fetchData();
      } else {
        throw new Error(result.error || 'Operation failed');
      }
    } catch (err) {
      console.error('Save user error:', err);
      toast.error('Failed to save: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const paginatedUsers = users.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );
  const totalPages = Math.ceil(users.length / itemsPerPage);

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-black text-gray-900 uppercase tracking-tight">User Management</h1>
          <p className="text-[10px] font-black text-indigo-600 uppercase tracking-widest mt-1">System Administration & Access Control</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={fetchData}
            disabled={fetching}
            className="hidden sm:flex bg-white border border-gray-200 px-4 py-2 rounded-lg text-gray-600 font-bold text-xs shadow-sm hover:bg-gray-50 transition-all items-center gap-2"
          >
            <Activity size={14} className={fetching ? 'animate-spin' : ''} />
            Sync
          </button>
          <button
            onClick={handleOpenAdd}
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-lg font-bold text-sm shadow-lg flex items-center gap-2 transition-all hover:scale-105"
          >
            <Plus size={18} />
            Add User
          </button>
        </div>
      </div>

      {/* Main Container */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden flex flex-col min-h-[500px]">
        {/* Mobile View: Cards */}
        <div className="md:hidden flex flex-col gap-3 p-3 bg-gray-50/50 overflow-y-auto h-[calc(100vh-320px)]">
          {fetching ? (
            <div className="flex-1 flex flex-col items-center justify-center py-20 space-y-4">
              <div className="w-10 h-10 border-4 border-indigo-100 border-t-indigo-600 rounded-full animate-spin"></div>
              <p className="text-gray-400 text-xs font-bold uppercase tracking-widest">Loading Users...</p>
            </div>
          ) : (
            <>
              {paginatedUsers.map((user, idx) => (
                <div key={idx} className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm space-y-3 relative group">
                  <div className="flex justify-between items-start">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
                        <User size={20} />
                      </div>
                      <div>
                        <h3 className="font-black text-gray-900 text-base uppercase tracking-tight leading-none mb-1">{user.name}</h3>
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{user.empId}</p>
                      </div>
                    </div>
                    <button
                      onClick={() => handleOpenEdit(user)}
                      className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors border border-transparent hover:border-indigo-100"
                    >
                      <Edit2 size={18} />
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div className="bg-gray-50 p-2 rounded-lg border border-gray-100">
                      <p className="text-[9px] text-gray-400 font-bold uppercase mb-0.5 tracking-tighter">Employee Id</p>
                      <p className="text-[10px] font-black text-gray-800 uppercase tracking-widest">{user.empId}</p>
                    </div>
                    <div className="bg-gray-50 p-2 rounded-lg border border-gray-100">
                      <p className="text-[9px] text-gray-400 font-bold uppercase mb-0.5 tracking-tighter">User ID</p>
                      <p className="text-[10px] font-black text-indigo-600 font-mono">{user.userId}</p>
                    </div>
                    <div className="bg-gray-50 p-2 rounded-lg border border-gray-100">
                      <p className="text-[9px] text-gray-400 font-bold uppercase mb-0.5 tracking-tighter">Role</p>
                      <span className={`text-[10px] font-black uppercase tracking-widest ${user.role === 'Admin' ? 'text-purple-600' : 'text-blue-600'}`}>
                        {user.role}
                      </span>
                    </div>
                    <div className="bg-gray-50 p-2 rounded-lg border border-gray-100">
                      <p className="text-[9px] text-gray-400 font-bold uppercase mb-0.5 tracking-tighter">Status</p>
                      <span className={`text-[10px] font-black uppercase tracking-widest ${user.status === 'Active' ? 'text-green-600' : 'text-red-600'}`}>
                        {user.status}
                      </span>
                    </div>
                  </div>

                  <div className="border-t border-gray-50 pt-2 flex justify-between items-center">
                    <div className="flex flex-wrap gap-1">
                      {user.access.slice(0, 2).map((acc, i) => (
                        <span key={i} className="px-1.5 py-0.5 bg-indigo-50 text-indigo-600 text-[8px] font-bold rounded uppercase">
                          {acc}
                        </span>
                      ))}
                      {user.access.length > 2 && <span className="text-[8px] font-bold text-gray-400">+{user.access.length - 2}</span>}
                    </div>
                    <span className="text-[10px] font-black text-gray-300 font-mono italic">{user.sn}</span>
                  </div>
                </div>
              ))}
            </>
          )}
        </div>

        {/* Desktop View: Table */}
        <div className="hidden md:block overflow-x-auto overflow-y-auto h-[calc(110vh-350px)]">
          <table className="w-full border-collapse">
            <thead className="bg-gray-50 border-b border-gray-200 sticky top-0 z-10">
              <tr>
                <th className="px-4 py-3 text-center text-sm font-semibold text-gray-900">Serial No</th>
                <th className="px-4 py-3 text-center text-sm font-semibold text-gray-900">Employee Id</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">Name</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">ID</th>
                <th className="px-4 py-3 text-center text-sm font-semibold text-gray-900">Pass</th>
                <th className="px-4 py-3 text-center text-sm font-semibold text-gray-900">Role</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900 whitespace-nowrap">Page Access</th>
                <th className="px-4 py-3 text-center text-sm font-semibold text-gray-900">Status</th>
                <th className="px-4 py-3 text-center text-sm font-semibold text-gray-900">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {fetching ? (
                <tr>
                  <td colSpan="8" className="py-32 text-center">
                    <div className="flex flex-col items-center justify-center space-y-4">
                      <div className="w-12 h-12 border-4 border-indigo-50 border-t-indigo-600 rounded-full animate-spin"></div>
                      <p className="text-gray-400 text-sm font-bold uppercase tracking-widest">Synchronizing Master List...</p>
                    </div>
                  </td>
                </tr>
              ) : paginatedUsers.map((user, idx) => (
                <tr key={idx} className="hover:bg-indigo-50/20 transition-colors group">
                  <td className="px-6 py-4 text-center text-xs font-black text-indigo-600 font-mono tracking-tighter">{user.sn}</td>
                  <td className="px-6 py-4 text-center text-sm font-bold text-gray-800">{user.empId}</td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center group-hover:bg-white transition-colors">
                        <User size={16} className="text-gray-400" />
                      </div>
                      <span className="text-sm font-black text-gray-900 uppercase tracking-tight">{user.name}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm font-bold text-indigo-600 font-mono tracking-tight">{user.userId}</td>
                  <td className="px-6 py-4 text-center text-xs font-bold text-gray-400 font-mono">••••••••</td>
                  <td className="px-6 py-4 text-center">
                    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${user.role === 'Admin' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'
                      }`}>
                      <Shield size={10} />
                      {user.role}
                    </span>
                  </td>
                  <td className="px-6 py-4 max-w-xs">
                    <div className="flex flex-wrap gap-1">
                      {user.access.map((acc, i) => (
                        <span key={i} className="px-1.5 py-0.5 bg-gray-100 border border-gray-200 text-gray-500 text-[9px] font-bold rounded uppercase tracking-tighter">
                          {acc}
                        </span>
                      ))}
                      {user.access.length === 0 && <span className="text-[10px] text-gray-400 italic">No Access</span>}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase ${user.status === 'Active' ? 'text-green-600' : 'text-red-500'}`}>
                      {user.status === 'Active' ? <CheckCircle2 size={12} /> : <XCircle size={12} />}
                      {user.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <button
                      onClick={() => handleOpenEdit(user)}
                      className="text-indigo-600 hover:text-indigo-800 transition-transform hover:scale-110 flex items-center justify-center w-full"
                    >
                      <Edit2 size={18} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="p-4 border-t border-gray-100 bg-gray-50 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
            <Clock size={12} />
            Showing {paginatedUsers.length} of {users.length} Records
          </div>
          <div className="flex items-center gap-2">
            <button
              disabled={currentPage === 1}
              onClick={() => setCurrentPage(prev => prev - 1)}
              className="p-1.5 border border-gray-300 rounded bg-white disabled:opacity-30 hover:bg-indigo-50 transition-all"
            >
              <ChevronLeft size={18} className="text-indigo-600" />
            </button>
            <div className="bg-indigo-600 text-white px-3 py-1.5 rounded-lg font-bold text-xs shadow-md mx-2">
              Page {currentPage} / {totalPages || 1}
            </div>
            <button
              disabled={currentPage === totalPages || totalPages === 0}
              onClick={() => setCurrentPage(prev => prev + 1)}
              className="p-1.5 border border-gray-300 rounded bg-white disabled:opacity-30 hover:bg-indigo-50 transition-all"
            >
              <ChevronRight size={18} className="text-indigo-600" />
            </button>
          </div>
        </div>
      </div>

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
            <form onSubmit={handleSubmit} className="flex flex-col h-full">
              {/* Modal Header */}
              <div className="px-6 py-5 bg-indigo-900 flex justify-between items-center text-white">
                <div>
                  <h2 className="text-xl font-black uppercase tracking-tight">{editingRowIndex ? 'Edit User Configuration' : 'Onboard New User'}</h2>
                  <p className="text-[10px] font-bold text-indigo-300 uppercase tracking-widest mt-0.5">Define employee credentials & access level</p>
                </div>
                <button type="button" onClick={() => setShowModal(false)} className="text-indigo-300 hover:text-white transition-colors">
                  <X size={24} />
                </button>
              </div>

              {/* Modal Body */}
              <div className="p-6 space-y-5 overflow-y-auto max-h-[70vh]">
                <div className="grid grid-cols-2 gap-4">
                  {/* Emp ID */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Employee ID *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. 1024"
                      value={formData.empId}
                      onChange={(e) => setFormData({ ...formData, empId: e.target.value })}
                      className="w-full border border-gray-300 rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm font-bold"
                    />
                  </div>
                  {/* Status */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Account Status</label>
                    <select
                      value={formData.status}
                      onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                      className="w-full border border-gray-300 rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm font-bold bg-white"
                    >
                      <option value="Active">Active</option>
                      <option value="Inactive">Inactive</option>
                    </select>
                  </div>
                </div>

                {/* Name */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Full Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="Enter employee's full legal name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full border border-gray-300 rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm font-bold"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  {/* User ID */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">User ID *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. john_doe"
                      value={formData.userId}
                      onChange={(e) => setFormData({ ...formData, userId: e.target.value })}
                      className="w-full border border-gray-300 rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm font-bold font-mono"
                    />
                  </div>
                  {/* Password */}
                  <div className="space-y-1.5 relative">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Password *</label>
                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        required
                        placeholder="••••••••"
                        value={formData.pass}
                        onChange={(e) => setFormData({ ...formData, pass: e.target.value })}
                        className="w-full border border-gray-300 rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm font-bold font-mono pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-indigo-600 transition-colors"
                      >
                        {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Role */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">System Role</label>
                  <div className="flex gap-2">
                    {['User', 'Admin'].map(r => (
                      <button
                        key={r}
                        type="button"
                        onClick={() => setFormData({ ...formData, role: r })}
                        className={`flex-1 py-3 rounded-xl border text-xs font-black uppercase tracking-widest transition-all ${formData.role === r
                            ? 'bg-indigo-900 border-indigo-900 text-white shadow-md scale-[1.02]'
                            : 'bg-white border-gray-200 text-gray-400 hover:border-indigo-300'
                          }`}
                      >
                        {r}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Page Access */}
                <div className="space-y-3 pt-2">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block">Authorized Page Access</label>
                  <div className="grid grid-cols-2 gap-3">
                    {pageOptions.map((page, idx) => (
                      <div
                        key={idx}
                        onClick={() => toggleAccess(page)}
                        className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${formData.access.includes(page)
                            ? 'bg-indigo-50 border-indigo-300 ring-1 ring-indigo-300'
                            : 'bg-gray-50 border-gray-100 hover:border-indigo-200 opacity-60'
                          }`}
                      >
                        <div className={`w-5 h-5 rounded flex items-center justify-center transition-colors ${formData.access.includes(page) ? 'bg-indigo-600 text-white' : 'bg-white border-2 border-gray-200'
                          }`}>
                          {formData.access.includes(page) && <Save size={12} strokeWidth={4} />}
                        </div>
                        <span className={`text-[11px] font-bold uppercase tracking-tight ${formData.access.includes(page) ? 'text-indigo-900' : 'text-gray-500'}`}>
                          {page}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="p-6 bg-gray-50 border-t border-gray-100 flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 py-3 bg-white border border-gray-300 text-gray-700 font-black uppercase tracking-widest text-[10px] rounded-xl hover:bg-gray-50 transition-all font-bold"
                >
                  Discard
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 py-3 bg-indigo-600 text-white font-black uppercase tracking-widest text-[10px] rounded-xl hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 flex items-center justify-center gap-2"
                >
                  {loading ? 'Processing...' : (editingRowIndex ? 'Update Credentials' : 'Create Account')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
