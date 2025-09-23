import React, { useState, useEffect } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faSearch,
  faDownload,
  faEllipsisV,
  faUserCheck,
  faCalendarAlt,
  faIdBadge,
} from "@fortawesome/free-solid-svg-icons";
import axios from "axios";
import * as XLSX from "xlsx";
import { Link } from "react-router-dom";

const EmployeeList = () => {
  const [employeeData, setEmployeeData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(5);
  const [openMenu, setOpenMenu] = useState(null);

  const ip = import.meta.env.VITE_HOST_IP;

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const response = await axios.get(`${ip}/get_all_users`);
        const filteredData =
          response.data && Array.isArray(response.data)
            ? response.data.filter(
                (item) =>
                  item.name &&
                  item.name.toLowerCase().includes(searchTerm.toLowerCase())
              )
            : [];
        setEmployeeData(filteredData);
        setLoading(false);
        setError(null);
      } catch (error) {
        setLoading(false);
        setEmployeeData([]);
        setError("Error fetching data");
      }
    };

    fetchData();
  }, [searchTerm]);

  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = employeeData.slice(indexOfFirstItem, indexOfLastItem);

  const paginate = (pageNumber) => setCurrentPage(pageNumber);

  const downloadExcel = () => {
    const worksheet = XLSX.utils.json_to_sheet(employeeData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "EmployeeData");
    XLSX.writeFile(workbook, "employee_data.xlsx");
  };

  const toggleStatus = async (id, currentStatus) => {
    try {
      const newStatus = currentStatus === "Active" ? "Inactive" : "Active";
      await axios.put(`${ip}/update_user_status/${id}`, { status: newStatus });
      setEmployeeData((prev) =>
        prev.map((emp) =>
          emp.id === id ? { ...emp, status: newStatus } : emp
        )
      );
    } catch (err) {
      console.error("Error updating status:", err);
    }
  };

  return (
    <div className="p-8 bg-white rounded-xl shadow-md">
      <h1 className="text-3xl font-bold text-gray-800 border-b pb-3 mb-6">
        Employee List
      </h1>

      {/* Search + Download */}
      <div className="flex justify-between items-center mb-5">
        <div className="relative">
          <input
            type="text"
            placeholder="Search employees..."
            className="px-3 py-2 rounded-md border text-sm pl-8 border-gray-300 w-64 shadow-sm focus:ring-2 focus:ring-blue-400"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <div className="absolute top-2 left-2 text-gray-400">
            <FontAwesomeIcon icon={faSearch} />
          </div>
        </div>
        <button
          className="py-2 px-4 bg-blue-600 hover:bg-blue-500 text-white text-sm rounded-md flex items-center gap-2 shadow"
          onClick={downloadExcel}
        >
          <FontAwesomeIcon icon={faDownload} /> Export Excel
        </button>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="table-auto w-full bg-white border rounded-lg shadow-sm">
          <thead className="text-xs font-semibold uppercase text-gray-600 bg-gray-100">
            <tr>
              <th className="p-3">#</th>
              <th className="p-3">Name</th>
              <th className="p-3">Email</th>
              <th className="p-3">Department</th>
              <th className="p-3">Position</th>
              <th className="p-3">Status</th>
              <th className="p-3 text-center">Actions</th>
            </tr>
          </thead>
          <tbody className="text-sm text-gray-700">
            {loading ? (
              <tr>
                <td colSpan="7" className="text-center p-5">
                  Loading...
                </td>
              </tr>
            ) : currentItems.length > 0 ? (
              currentItems.map((row, index) => (
                <tr
                  key={row.id}
                  className="border-b hover:bg-gray-50 transition"
                >
                  <td className="p-3 text-center">
                    {index + 1 + (currentPage - 1) * itemsPerPage}
                  </td>
                  <td className="p-3 font-medium flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center font-bold text-blue-600">
                      {row.name ? row.name.charAt(0) : "?"}
                    </div>
                    {row.name || "N/A"}
                  </td>
                  <td className="p-3">{row.email || "N/A"}</td>
                  <td className="p-3">
                    <span className="px-2 py-1 text-xs rounded-full bg-indigo-100 text-indigo-700">
                      {row.department || "N/A"}
                    </span>
                  </td>
                  <td className="p-3">{row.position || "N/A"}</td>
                  <td className="p-3 text-center">
                    <button
                      className={`px-3 py-1 rounded-full text-xs font-semibold ${
                        row.status === "Active"
                          ? "bg-green-100 text-green-700"
                          : "bg-red-100 text-red-700"
                      }`}
                      onClick={() => toggleStatus(row.id, row.status)}
                    >
                      {row.status || "Inactive"}
                    </button>
                  </td>
                  <td className="p-3 text-center relative">
                    <button
                      className="px-2 py-1 rounded-md hover:bg-gray-100"
                      onClick={() =>
                        setOpenMenu(openMenu === row.id ? null : row.id)
                      }
                    >
                      <FontAwesomeIcon icon={faEllipsisV} />
                    </button>
                    {openMenu === row.id && (
                      <div className="absolute right-0 mt-2 w-40 bg-white border rounded-lg shadow-lg z-10">
                        <Link
                          to={`/admin/${row.id}`}
                          className="block px-4 py-2 text-sm hover:bg-gray-50"
                        >
                          <FontAwesomeIcon
                            icon={faIdBadge}
                            className="mr-2 text-blue-500"
                          />
                          Details
                        </Link>
                        <Link
                          to={`/admin/time/${row.id}`}
                          className="block px-4 py-2 text-sm hover:bg-gray-50"
                        >
                          <FontAwesomeIcon
                            icon={faUserCheck}
                            className="mr-2 text-green-500"
                          />
                          Attendance
                        </Link>
                        <Link
                          to={`/admin/history/${row.id}`}
                          className="block px-4 py-2 text-sm hover:bg-gray-50"
                        >
                          <FontAwesomeIcon
                            icon={faCalendarAlt}
                            className="mr-2 text-yellow-500"
                          />
                          Leave
                        </Link>
                      </div>
                    )}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="7" className="text-center p-5">
                  No employees found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="mt-4 flex justify-between items-center text-sm text-gray-600">
        <div>
          Showing {indexOfFirstItem + 1}–
          {Math.min(indexOfLastItem, employeeData.length)} of{" "}
          {employeeData.length} employees
        </div>
        <div>
          <button
            className="py-1 px-3 bg-blue-500 text-white rounded-md mr-2 disabled:opacity-50"
            onClick={() => paginate(currentPage - 1)}
            disabled={currentPage === 1}
          >
            Previous
          </button>
          <button
            className="py-1 px-3 bg-blue-500 text-white rounded-md disabled:opacity-50"
            onClick={() => paginate(currentPage + 1)}
            disabled={indexOfLastItem >= employeeData.length}
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
};

export default EmployeeList;
