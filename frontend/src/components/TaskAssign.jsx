import React, { useState, useEffect } from "react";
import axios from "axios";
import { Link, useParams } from "react-router-dom";
import { createPortal } from "react-dom";

import { AiFillCloseSquare } from "react-icons/ai";
import { AiOutlineDelete, AiOutlineEdit } from "react-icons/ai";
import { FaEdit, FaCheck } from "react-icons/fa";
import { ArrowUp, ArrowDown, ArrowUpDown, RotateCw } from "lucide-react";

import Multiselect from "multiselect-react-dropdown";
import { DateRangePicker } from "react-date-range";
import { format, isWithinInterval, parseISO } from "date-fns";
import { toast, ToastContainer } from "react-toastify";

import { ipadr, LS } from "../Utils/Resuse";
import { Modal } from "./Modal";

import "react-toastify/dist/ReactToastify.css";
import "react-date-range/dist/styles.css";
import "react-date-range/dist/theme/default.css";

// ----------------------------
// Small helper: today in yyyy-mm-dd
// ----------------------------
const getTodayYMD = () => {
  const t = new Date();
  const yyyy = t.getFullYear();
  const mm = String(t.getMonth() + 1).padStart(2, "0");
  const dd = String(t.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
};

// Robust convert date (handles yyyy-mm-dd and dd-mm-yyyy)
const convertDateFormat = (dateString) => {
  if (!dateString) return "";
  const parts = dateString.split("-");
  if (parts.length !== 3) return dateString;
  // if already yyyy-mm-dd
  if (parts[0].length === 4) return dateString;
  // assumed dd-mm-yyyy -> yyyy-mm-dd
  const [dd, mm, yyyy] = parts;
  return `${yyyy}-${mm}-${dd}`;
};

// robust date parsing
const toISOFromUnknown = (dateString) => {
  if (!dateString) return "";
  try {
    if (dateString.includes("-")) {
      const parts = dateString.split("-");
      if (parts[0].length === 4) return dateString; // already yyyy-mm-dd
      return convertDateFormat(dateString); // dd-mm-yyyy
    }
    return dateString;
  } catch {
    return dateString;
  }
};

// ----------------------------
// Task card (keeps same UI/classes)
// ----------------------------
const Note = ({ empdata, handleDelete, handleEdit }) => {
  return (
    <div
      className={`${
        empdata.bg ? empdata.bg : "bg-green-300"
      } p-6 pt-12 w-[320px] min-h-[250px] relative flex flex-col  
      rounded-lg shadow-xl border-l-[10px] border-grey-500 
      transition-all transform hover:scale-105 hover:-translate-y-2 
      hover:shadow-2xl hover:z-10 animate-fade-in`}
    >
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-24 h-6 bg-gray-400 opacity-30 rounded-b-lg"></div>

      <p className="text-gray-900 font-bold text-xl mb-3 text-center">📝 Task Details</p>
      <ul className="text-gray-800 text-base space-y-2">
        <li>
          <span className="font-semibold">Task:</span> {empdata.task}
        </li>
        <li>
          <span className="font-semibold">Assigned Date:</span> {empdata.date}
        </li>
        <li>
          <span className="font-semibold">Due Date:</span> {empdata.due_date}
        </li>
        <li className="flex items-center">
          <span className="font-semibold">Status:</span>
          <span
            className={`ml-2 px-3 py-1 text-xs font-bold rounded-full shadow-md ${
              empdata.status === "Completed"
                ? "bg-green-500 text-white"
                : empdata.status === "Pending"
                ? "bg-yellow-500 text-black"
                : "bg-red-500 text-white"
            }`}
          >
            {empdata.status || "Pending"}
          </span>
        </li>
      </ul>

      <div className="absolute top-2 right-4 flex gap-2">
        <button
          className="bg-green-600 text-white p-2 rounded-full shadow-lg transition-transform transform hover:scale-110 hover:shadow-green-500"
          onClick={() => handleEdit(empdata.taskid || empdata._id)}
        >
          <AiOutlineEdit className="text-xl" />
        </button>
        <button
          className="bg-red-600 text-white p-2 rounded-full shadow-lg transition-transform transform hover:scale-110 hover:shadow-red-500"
          onClick={() => handleDelete(empdata.taskid || empdata._id)}
        >
          <AiOutlineDelete className="text-xl" />
        </button>
      </div>
    </div>
  );
};

// ----------------------------
// Main component
// ----------------------------
const TaskAssign = () => {
  // data
  const [employeeData, setEmployeeData] = useState([]); // must be array
  const [taskData, SetTaskData] = useState([]);
  const [filteredData, setFilteredData] = useState([]);

  // UI & state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState();
  const [errorMessage, setErrorMessage] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(5);

  const [openmodel, SetOpenmodel] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);

  const [selectone, SetSelectone] = useState({});
  const [allselect, SetAllSelect] = useState({});
  const [tempdata, SetTempdata] = useState({});

  const [options, SetOptions] = useState([]);
  const [selectedValue, setSelectedValue] = useState("");
  const [ValueSelected, SetValueSelected] = useState("");
  const [selectedUsers, setSelectedUsers] = useState([]);

  const [showDatePicker, setShowDatePicker] = useState(false);
  const [dateRange, setDateRange] = useState([
    {
      startDate: null,
      endDate: null,
      key: "selection",
    },
  ]);

  const [sortConfig, setSortConfig] = useState({
    column: null,
    direction: "asc",
  });

  const [editModel, SetEditmodel] = useState([]);

  const [modeldata, setModelData] = useState({
    task: [""],
    userid: "",
    date: "",
    due_date: "",
    TL: "",
  });

  // NEW: filters
  const [statusFilter, setStatusFilter] = useState("All"); // All | Pending | In Progress | Completed
  const [priorityFilter, setPriorityFilter] = useState("All"); // assuming tasks may have priority

  const isManager = LS.get("position") === "Manager" ? true : false;
  const user_id = useParams();
  const userid = LS.get("userid");

  const todayYMD = getTodayYMD();

  let url = "";
  if (isManager) {
    url = `${ipadr}/get_assigned_task?TL=${LS.get("name")}`;
  } else {
    url = `${ipadr}/get_tasks/${userid}`;
  }

  // initial fetch
  useEffect(() => {
    fetchEmpdata();
    users();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Apply filters whenever relevant data changes
  useEffect(() => {
    applyAllFilters();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [employeeData, statusFilter, priorityFilter, dateRange]);

  // ----------------------------
  // Fetch tasks
  // ----------------------------
  const fetchEmpdata = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${url}`);
      const Empdata = response.data && Array.isArray(response.data) ? response.data : [];
      setEmployeeData(Empdata);
      setFilteredData(Empdata);
      setLoading(false);
    } catch (err) {
      setLoading(false);
      setEmployeeData([]);
      setFilteredData([]);
      setError("Error while fetching");
      toast.error("Error while fetching tasks");
    }
  };

  // ----------------------------
  // users (manager dropdown)
  // ----------------------------
  let url1 = "";
  let url2 = "";
  if (isManager) {
    url1 = `${ipadr}/get_team_members?TL=${LS.get("name")}`;
    url2 = `${ipadr}/get_assigned_task?TL=${LS.get("name")}&userid=${ValueSelected}`;
  }

  const users = async () => {
    if (!isManager) return;
    try {
      const response = await axios.get(`${url1}`);
      const userdetails = response.data && Array.isArray(response.data) ? response.data : [];
      SetOptions(userdetails);
    } catch (error) {
      console.error("Error fetching users:", error);
      SetOptions([]);
    }
  };

  const dropdown = async () => {
    if (!isManager || !ValueSelected) {
      if (isManager && !ValueSelected) {
        setFilteredData(employeeData);
      }
      return;
    }

    try {
      const response = await axios.get(`${url2}`);
      const Empdata = response.data && Array.isArray(response.data) ? response.data : [];
      setFilteredData(Empdata);
    } catch (error) {
      console.error("Error in dropdown:", error);
      setFilteredData([]);
    }
  };

  // ----------------------------
  // Filter helpers
  // ----------------------------
  const applyAllFilters = () => {
    // start from original dataset
    let data = Array.isArray(employeeData) ? [...employeeData] : [];

    // date range filter
    const sel = dateRange?.[0];
    if (sel && sel.startDate && sel.endDate) {
      data = data.filter((item) => {
        const base = item?.date || item?.due_date;
        if (!base) return false;
        const iso = toISOFromUnknown(base);
        try {
          const itemDate = parseISO(iso);
          return isWithinInterval(itemDate, { start: sel.startDate, end: sel.endDate });
        } catch {
          return false;
        }
      });
    }

    // status filter
    if (statusFilter && statusFilter !== "All") {
      data = data.filter((t) => {
        const st = (t.status || "Pending").toString().toLowerCase();
        return st === statusFilter.toString().toLowerCase();
      });
    }

    // priority filter (if present on tasks)
    if (priorityFilter && priorityFilter !== "All") {
      data = data.filter((t) => {
        const p = (t.priority || "").toString().toLowerCase();
        return p === priorityFilter.toString().toLowerCase();
      });
    }

    // Sorting same as your sortConfig logic
    if (sortConfig.column) {
      data = sortData(data, sortConfig.column);
    }

    setFilteredData(data);
    // reset pagination to first page when filters change
    setCurrentPage(1);
  };

  // ----------------------------
  // Sorting util (kept from your code)
  // ----------------------------
  const sortData = (arr, column) => {
    if (!column) return arr;
    const copy = [...arr];
    copy.sort((a, b) => {
      const A = a?.[column];
      const B = b?.[column];

      const Aiso = toISOFromUnknown(A);
      const Biso = toISOFromUnknown(B);
      const Ad = Date.parse(Aiso);
      const Bd = Date.parse(Biso);

      if (!Number.isNaN(Ad) && !Number.isNaN(Bd)) {
        return sortConfig.direction === "asc" ? Ad - Bd : Bd - Ad;
      }

      const As = (A ?? "").toString().toLowerCase();
      const Bs = (B ?? "").toString().toLowerCase();
      if (As < Bs) return sortConfig.direction === "asc" ? -1 : 1;
      if (As > Bs) return sortConfig.direction === "asc" ? 1 : -1;
      return 0;
    });
    return copy;
  };

  // ----------------------------
  // Pagination slice (fixed)
  // ----------------------------
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = (filteredData || []).slice(indexOfFirstItem, indexOfLastItem);

  // ----------------------------
  // UI handlers
  // ----------------------------
  const handleReset = () => {
    setDateRange([
      {
        startDate: null,
        endDate: null,
        key: "selection",
      },
    ]);
    setFilteredData(employeeData);
    setStatusFilter("All");
    setPriorityFilter("All");
    setShowDatePicker(false);
  };

  const handleSelectvalueChange = (event) => {
    SetValueSelected(event.target.value);
    // If you want to re-run dropdown fetch:
    // dropdown();
  };

  useEffect(() => {
    // If manager selects a specific ValueSelected, you might want to fetch filtered tasks from server
    if (isManager && ValueSelected) {
      (async () => {
        try {
          const res = await axios.get(`${ipadr}/get_assigned_task?TL=${LS.get("name")}&userid=${ValueSelected}`);
          const data = Array.isArray(res.data) ? res.data : [];
          setFilteredData(data);
        } catch (err) {
          console.error(err);
        }
      })();
    } else {
      // fallback to local filters
      applyAllFilters();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ValueSelected]);

  // ----------------------------
  // CRUD methods (kept your implementations with small safe fixes)
  // ----------------------------
  const handleTaskChange = (index, event) => {
    const newTasks = [...modeldata.task];
    newTasks[index] = event.target.value;
    setModelData({ ...modeldata, task: newTasks });
  };

  const addTask = () => {
    setModelData({ ...modeldata, task: [...modeldata.task, ""] });
  };

  const onSelect = (selectedList) => {
    setSelectedUsers(selectedList);
  };
  const onRemove = (selectedList) => {
    setSelectedUsers(selectedList);
  };

  const handleonSubmit = async (e) => {
    if (e?.preventDefault) e.preventDefault();
    const today = todayYMD;
    try {
      if (isManager) {
        const taskArr = [];
        for (let i = 0; i < selectedUsers.length; i++) {
          const taskdetails = {
            Tasks: modeldata.task,
            userid: selectedUsers?.[i]?.userid,
            TL: LS.get("name"),
            date: today,
            due_date: modeldata.due_date,
          };
          taskArr.push(taskdetails);
        }
        const response = await axios({
          method: "post",
          url: `${ipadr}/task_assign_to_multiple_members`,
          data: { Task_details: taskArr },
          headers: { "Content-Type": "application/json" },
        });
        if (response.status === 200) {
          toast.success("Task Added successfully");
          setModelData({
            task: [""],
            userid: "",
            date: "",
            due_date: "",
            TL: "",
          });
          setModalOpen(false);
          fetchEmpdata();
        } else {
          toast.error("Error while adding the data");
        }
      } else {
        const response = await fetch(`${ipadr}/add_task`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            task: modeldata.task,
            userid: LS.get("userid"),
            date: today,
            due_date: modeldata.due_date,
          }),
        });
        if (response.status === 200) {
          toast.success("Task Added successfully");
          setModelData({
            task: [""],
            userid: "",
            date: "",
            due_date: "",
          });
          setModalOpen(false);
          fetchEmpdata();
        } else {
          toast.error("Error while adding the data");
        }
      }
    } catch (err) {
      console.error(err);
      toast.error("Failed to add task");
    }
  };

  const deleteTask = async (taskId) => {
    if (!taskId) {
      toast.error("Invalid task id");
      return;
    }
    try {
      const response = await fetch(`${ipadr}/task_delete/${taskId}`, { method: "DELETE" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data?.detail || "Failed to delete task");
      }
      toast.success("Task deleted successfully!");
      fetchEmpdata();
    } catch (err) {
      console.error(err);
      toast.error(err.message || "Delete failed");
    }
  };

  const confirm = async (id) => {
    if (!id) return;
    try {
      const response = await axios.get(`${ipadr}/get_single_task/${id}`);
      let taskdetails = response.data;
      if (!Array.isArray(taskdetails)) taskdetails = [taskdetails];
      SetEditmodel(taskdetails);
      SetOpenmodel(true);
    } catch (error) {
      console.error("Error in confirm function:", error);
      toast.error("Error fetching task details");
    }
  };

  const handleEditmodel = (index, e) => {
    const { name, value } = e.target;
    const updated = [...editModel];
    updated[index] = { ...updated[index], [name]: value };
    SetEditmodel(updated);
  };

  const handleoneditSubmit = async () => {
    const editedDue = editModel?.[0]?.due_date;
    if (editedDue) {
      const picked = new Date(toISOFromUnknown(editedDue));
      if (isNaN(picked.getTime()) || picked < new Date(toISOFromUnknown(todayYMD))) {
        toast.error("Due date must be today or a future date.");
        return;
      }
    }

    try {
      const updatedetails = {
        updated_task: editModel?.[0]?.task,
        userid: editModel?.[0]?.userid,
        status: editModel?.[0]?.status,
        due_date: editModel?.[0]?.due_date,
        taskid: editModel?.[0]?._id,
      };
      const response = await axios({
        method: "put",
        url: `${ipadr}/edit_task`,
        data: updatedetails,
        headers: { "Content-Type": "application/json" },
      });
      if (response.status === 200) {
        toast.success("Task edited successfully");
      } else {
        toast.error("Error while editing the data");
      }
      SetOpenmodel(false);
      fetchEmpdata();
    } catch (err) {
      console.error(err);
      toast.error("Failed to edit task");
    }
  };

  const handleDateRangeChange = (ranges) => {
    const { startDate, endDate } = ranges.selection;
    setDateRange([ranges.selection]);
  };

  // ----------------------------
  // Render
  // ----------------------------
  return (
    <div className="mr-8 p-10 bg-white min-h-96 lg:min-h-[90vh] w-full  shadow-black rounded-xl justify-center items-center relative jsonback  ml-10 rounded-md h-screen overflow-y-scroll scrollbar-hide  ">
      <div className="">
        <h1 className="text-5xl font-semibold font-inter pb-2 text-transparent bg-gradient-to-r from-zinc-600 to-zinc-950 bg-clip-text border-b-2">
          Task Assign
        </h1>

        <header className="px-5 py-4 border-b border-gray-200 flex justify-between items-center">
          <button
            className="bg-blue-500 hover:bg-blue-400 hover:text-slate-900 text-white text-sm font-inter px-4 py-2 rounded-full shadow-lg"
            onClick={() => setModalOpen(true)}
          >
            Add Task
          </button>

          <div className="flex items-center space-x-3">
            <div className="relative">
              {isManager ? (
                <>
                  <select
                    className="w-48 border border-gray-400 rounded-lg px-4 py-2 text-gray-700 bg-white shadow-md outline-none focus:ring-2 focus:ring-blue-500 transition max-w-[200px] max-h-[40px]"
                    value={ValueSelected || ""}
                    onChange={handleSelectvalueChange}
                  >
                    <option value="">--select--</option>
                    {(options || []).map((item) => (
                      <option key={item.id || item.userid} value={item.userid}>
                        {item.name}
                      </option>
                    ))}
                  </select>
                </>
              ) : null}
            </div>
          </div>

          <div className="flex items-center gap-4">
            {/* ====== NEW FILTER UI (status + priority) ====== */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="border border-gray-300 rounded px-3 py-2"
            >
              <option value="All">All Status</option>
              <option value="Pending">Pending</option>
              <option value="In Progress">In Progress</option>
              <option value="Completed">Completed</option>
            </select>

            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              className="border border-gray-300 rounded px-3 py-2"
            >
              <option value="All">All Priorities</option>
              <option value="High">High</option>
              <option value="Medium">Medium</option>
              <option value="Low">Low</option>
            </select>

            <button
              onClick={handleReset}
              className="px-4 py-2 bg-gray-500 text-white rounded-md hover:bg-gray-600 flex items-center gap-2"
            >
              <RotateCw className="w-4 h-4" />
              Reset
            </button>

            <div className="relative">
              <button
                onClick={() => setShowDatePicker(!showDatePicker)}
                className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600"
              >
                {showDatePicker ? "Hide Date Range" : "Show Date Range"}
              </button>
              {showDatePicker && (
                <div className="absolute right-0 top-12 z-50 bg-white shadow-lg rounded-md border">
                  <DateRangePicker ranges={dateRange} onChange={handleDateRangeChange} moveRangeOnFirstSelection={false} />
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Cards grid */}
        <div className="notes border-t-2 border-gray-200 mt-5 pt-5 container mx-auto grid md:grid-cols-4 gap-10 ">
          {currentItems.length > 0 ? (
            currentItems.map((item, i) => {
              return <Note handleDelete={deleteTask} handleEdit={confirm} key={item._id || item.taskid || i} empdata={item} />;
            })
          ) : (
            <p>No notes. Please add one</p>
          )}
        </div>

        {/* Add Task Modal */}
        {modalOpen &&
          createPortal(
            <Modal closeModal={() => { setModalOpen(false); }} onSubmit={handleonSubmit} onCancel={() => { setModalOpen(false); }}>
              <>
                <div className="max-h-[50vh] overflow-y-auto">
                  {modeldata.task.map((task, index) => (
                    <div key={index} className="mb-4">
                      <label className="block text-lg font-semibold text-gray-700 mb-2">Task {index + 1}</label>
                      <textarea name={`task-${index}`} value={task} onChange={(e) => handleTaskChange(index, e)} className="w-full border border-gray-300 rounded-lg px-4 py-3 shadow-sm" />
                    </div>
                  ))}

                  <button type="button" onClick={addTask} className="bg-gradient-to-r from-blue-500 to-purple-500 text-white font-medium px-4 py-2 rounded-lg shadow-md">
                    ➕ Add Another Task
                  </button>

                  <div className="mt-4">
                    <label className="block text-lg font-semibold text-gray-700 mb-2">Due date</label>
                    <input type="date" name="due_date" value={modeldata.due_date} onChange={(e) => setModelData({ ...modeldata, due_date: e.target.value })} min={todayYMD} className="w-full border border-gray-300 rounded-lg px-4 py-3 shadow-sm" />
                  </div>

                  {isManager ? (
                    <div className="mt-4">
                      <label className="block text-lg font-semibold text-gray-700 mb-2">👤 Select User</label>
                      <div className="w-full max-w-sm bg-white border border-gray-300 rounded-lg px-4 py-2 shadow-sm">
                        <Multiselect options={options} selectedValues={[]} onSelect={onSelect} onRemove={onRemove} displayValue="name" />
                      </div>
                    </div>
                  ) : null}
                </div>
              </>
            </Modal>,
            document.body
          )}

        {/* Edit Task Modal */}
        {openmodel &&
          createPortal(
            <Modal closeModal={() => SetOpenmodel(false)} onSubmit={handleoneditSubmit} onCancel={() => SetOpenmodel(false)}>
              {(editModel || []).map((item, index) => (
                <div key={item?._id || index}>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block mb-1">Task</label>
                      <textarea name="task" value={item?.task || ""} onChange={(e) => handleEditmodel(index, e)} className="w-full border border-gray-300 rounded px-3 py-2"></textarea>
                    </div>

                    <div>
                      <label className="block mb-1">Due date</label>
                      <input type="date" name="due_date" value={toISOFromUnknown(item?.due_date)} min={todayYMD} onChange={(e) => handleEditmodel(index, e)} className="w-full border border-gray-300 rounded px-3 py-2" />
                    </div>
                  </div>

                  <div>
                    <label className="block mb-1">Status</label>
                    <input type="text" name="status" value={item?.status || ""} onChange={(e) => handleEditmodel(index, e)} className="w-full border border-gray-300 rounded px-3 py-2" />
                  </div>
                </div>
              ))}
            </Modal>,
            document.body
          )}
      </div>

      <ToastContainer />
    </div>
  );
};

export default TaskAssign;


// import React,{useState,useEffect} from "react";
// import axios from "axios";
// import { Link } from "react-router-dom";
// import { ipadr,LS } from "../Utils/Resuse";
// import { Modal } from "./Modal";
// import { createPortal } from "react-dom";
// import { FaEdit } from "react-icons/fa";
// import { toast,ToastContainer } from "react-toastify";
// import Multiselect from 'multiselect-react-dropdown';
// import { FaCheck } from "react-icons/fa"; 
// import { DateRangePicker } from "react-date-range";
// import { format, isWithinInterval, parseISO } from 'date-fns';
// import { useParams } from 'react-router-dom';
// import { ArrowUp, ArrowDown, ArrowUpDown, RotateCw } from "lucide-react";
// import { AiFillCloseSquare } from 'react-icons/ai';
// import { AiOutlineDelete, AiOutlineEdit } from 'react-icons/ai';

// // Enhanced Form Component
// const Form=({ modeldata,toggleForm, setToggleForm, handleonSubmit, handleAllChange, note })=> {
//   return (
//     <div
//       className={
//         !toggleForm
//           ? 'w-full h-screen mx-auto flex justify-center items-center absolute top-[-200%] left-0 right-0 bg-[#5756564f] z-10'
//           : 'w-full h-screen mx-auto flex justify-center items-center absolute top-0 bg-[#5756564f] z-10'
//       }
//     >
//       <form
//         className="flex justify-start flex-col bg-gray-50 px-5 py-10 rounded-md relative"
//         onSubmit={handleonSubmit}
//       >
//        <div>
//              <label className="block mb-1">Task</label>
//              <textarea
//                name="task"
//                value={modeldata.task}
//                onChange={handleAllChange}
//                className="w-full border border-gray-300 rounded px-3 py-2"
//              ></textarea>
//            </div>
//            <div>
//             <label className="block mb-1">Due date</label>
//             <input 
//                type="date"
//                 name="due_date"
//                 value={modeldata.due_date}
//                 onChange={handleAllChange}
//                 className="w-full border border-gray-300 rounded px-3 py-2"
//                 />
//            </div>
//            {/* Enhanced Priority Selection */}
//            <div>
//             <label className="block mb-1">Priority</label>
//             <select 
//                name="priority"
//                value={modeldata.priority || 'medium'}
//                onChange={handleAllChange}
//                className="w-full border border-gray-300 rounded px-3 py-2"
//             >
//               <option value="low">Low</option>
//               <option value="medium">Medium</option>
//               <option value="high">High</option>
//             </select>
//            </div>
//         <button className="p-4 bg-blue-600 text-white mt-3 rounded" type="submit">
//           Save
//         </button>

//         <div
//           className="absolute top-2 right-5 text-xl font-bold text-red-400 cursor-pointer"
//           onClick={() => setToggleForm(!toggleForm)}
//         >
//           <AiFillCloseSquare size={30} />
//         </div>
//       </form>
//     </div>
//   );
// }

// // Enhanced Note Component with Assignment Transparency
// const Note = ({ empdata, handleDelete, handleEdit, handleStatusChange }) => {
//   const isOverdue = new Date(empdata.due_date) < new Date() && empdata.status !== 'Completed';
  
//   const getStatusColor = (status) => {
//     switch(status) {
//       case 'Completed': return 'bg-green-500 text-white';
//       case 'In Progress': return 'bg-blue-500 text-white';
//       case 'Pending': return 'bg-yellow-500 text-black';
//       default: return 'bg-gray-500 text-white';
//     }
//   };

//   const getPriorityColor = (priority) => {
//     switch(priority) {
//       case 'high': return 'bg-red-100 border-red-500';
//       case 'medium': return 'bg-yellow-100 border-yellow-500';
//       case 'low': return 'bg-green-100 border-green-500';
//       default: return 'bg-gray-100 border-gray-500';
//     }
//   };

//   return (
//     <div
//     className={`${
//       empdata.bg ? empdata.bg : 'bg-green-300'
//     } ${getPriorityColor(empdata.priority)} p-6 pt-12 w-[320px] min-h-[250px] relative flex flex-col  
//       rounded-lg shadow-xl border-l-[10px] ${isOverdue ? 'border-red-600' : 'border-grey-500'}
//       transition-all transform hover:scale-105 hover:-translate-y-2 
//       hover:shadow-2xl hover:z-10 animate-fade-in`}
//   >
//     {/* Sticky Tape Effect */}
//     <div className="absolute top-0 left-1/2 -translate-x-1/2 w-24 h-6 bg-gray-400 opacity-30 rounded-b-lg"></div>
    
//     {/* Overdue Warning */}
//     {isOverdue && (
//       <div className="absolute top-2 left-2 bg-red-600 text-white px-2 py-1 text-xs rounded-full font-bold">
//         OVERDUE
//       </div>
//     )}
  
//     {/* Task Details with Assignment Transparency */}
//     <p className="text-gray-900 font-bold text-xl mb-3 text-center">📝 Task Details</p>
//     <ul className="text-gray-800 text-base space-y-2">
//       <li><span className="font-semibold">Task:</span> {empdata.task}</li>
//       {empdata.TL && <li><span className="font-semibold">Assigned by:</span> {empdata.TL}</li>}
//       {empdata.assigned_to && <li><span className="font-semibold">Assigned to:</span> {empdata.assigned_to}</li>}
//       <li><span className="font-semibold">Assigned Date:</span> {empdata.date}</li>
//       <li><span className="font-semibold">Due Date:</span> {empdata.due_date}</li>
//       {empdata.priority && (
//         <li>
//           <span className="font-semibold">Priority:</span> 
//           <span className={`ml-2 px-2 py-1 text-xs font-bold rounded-full ${
//             empdata.priority === 'high' ? 'bg-red-500 text-white' :
//             empdata.priority === 'medium' ? 'bg-yellow-500 text-black' :
//             'bg-green-500 text-white'
//           }`}>
//             {empdata.priority.toUpperCase()}
//           </span>
//         </li>
//       )}
//       <li>
//         <span className="font-semibold">Status:</span> 
//         <select 
//           value={empdata.status} 
//           onChange={(e) => handleStatusChange(empdata.taskid || empdata._id, e.target.value)}
//           className={`ml-2 px-3 py-1 text-xs font-bold rounded-full shadow-md ${getStatusColor(empdata.status)}`}
//         >
//           <option value="Pending">Pending</option>
//           <option value="In Progress">In Progress</option>
//           <option value="Completed">Completed</option>
//         </select>
//       </li>
//     </ul>
  
//     {/* Action Buttons with Floating Effect */}
//     <div className="absolute top-2 right-4 flex gap-2">
//       <button
//         className="bg-green-600 text-white p-2 rounded-full shadow-lg transition-transform transform hover:scale-110 hover:shadow-green-500"
//         onClick={() => handleEdit(empdata.taskid || empdata._id)}
//       >
//         <AiOutlineEdit className="text-xl" />
//       </button>
//       <button
//         className="bg-red-600 text-white p-2 rounded-full shadow-lg transition-transform transform hover:scale-110 hover:shadow-red-500"
//         onClick={() => handleDelete(empdata.taskid || empdata._id)}
//       >
//         <AiOutlineDelete className="text-xl" />
//       </button>
//     </div>
//   </div>
//   );
// };

// const TaskAssign=()=>{
//      const [employeeData, setEmployeeData] = useState({});
//      const [taskData,SetTaskData]=useState([]);
//      const [loading, setLoading] = useState(false);
//      const [error,setError]=useState();
//      const [currentPage, setCurrentPage] = useState(1);
//      const [itemsPerPage, setItemsPerPage] = useState(5);
//      const [openmodel,SetOpenmodel]=useState(false)
//      const [modalOpen, setModalOpen] = useState(false);
//      const [selectone,SetSelectone]=useState({});
//      const [allselect,SetAllSelect]=useState({});
//      const[tempdata,SetTempdata]=useState({});
//      const [options, SetOptions] = useState([]);
//      const [selectedValue, setSelectedValue] = useState('');
//      const [ValueSelected, SetValueSelected] = useState("");
//      const [selectedUsers, setSelectedUsers] = useState([]);
//      const [showDatePicker, setShowDatePicker] = useState(false);
//      const [dateRange, setDateRange] = useState([
//           {
//             startDate: null,
//             endDate: null,
//             key: "selection",
//           },
//         ]);
//       const [filteredData, setFilteredData] = useState([]);
//        const [sortConfig, setSortConfig] = useState({
//           column: null,
//           direction: 'asc'
//         });

//     // Enhanced state for new features
//     const [currentView, setCurrentView] = useState('all'); // 'all', 'myTasks', 'assignedByMe'
//     const [statusFilter, setStatusFilter] = useState('all'); // 'all', 'pending', 'inprogress', 'completed', 'overdue'
//     const [taskStats, setTaskStats] = useState({
//       pending: 0,
//       inProgress: 0,
//       completed: 0,
//       overdue: 0
//     });

//     const [editModel,SetEditmodel]=useState([]);

//     const[modeldata,setModelData]=useState({
//         task:[""],
//           userid:"",
//           date:"",
//           due_date:"",
//           TL:"",
//           priority: "medium"
//     })
//     const isManager=LS.get('position')==="Manager"? true:false;

//     const user_id=useParams();
//     const userid=LS.get('userid')

//     console.log("userid:",userid);
    
//     let url=''

//      console.log("isManager:",isManager);

//      if(isManager)
//      {
//       url=`${ipadr}/get_assigned_task?TL=${LS.get('name')}`
//      }
//      else{
//       url=`${ipadr}/get_tasks/${userid}`
//      }

//      useEffect(()=>{
//         fetchEmpdata();
//         users();
//         // Check for due date reminders
//         checkDueDateReminders();
//      },[])

//      // Enhanced data fetching with assignment transparency
//      const fetchEmpdata= async()=>{
//       try{
//           setLoading(true);
//           const response= await axios.get(`${url}`);
//           const Empdata=response.data && Array.isArray(response.data)? response.data :[];
//           console.log("data:",Empdata);
          
//           // Add assignment transparency data
//           const enhancedData = Empdata.map(task => ({
//             ...task,
//             assigned_to: task.userid === userid ? 'Me' : task.assigned_user_name || 'Unknown',
//             status: task.status || 'Pending'
//           }));
          
//           setEmployeeData(enhancedData);
//           setFilteredData(enhancedData);
//           calculateTaskStats(enhancedData);
//           setLoading(false);
//       }
//       catch(error)
//       {
//           setLoading(false);
//           setEmployeeData([]);
//            setError("Error while fetching");
//       }
//   }

//   // Calculate task statistics
//   const calculateTaskStats = (data) => {
//     const stats = {
//       pending: 0,
//       inProgress: 0,
//       completed: 0,
//       overdue: 0
//     };

//     data.forEach(task => {
//       const isOverdue = new Date(task.due_date) < new Date() && task.status !== 'Completed';
      
//       if (isOverdue) {
//         stats.overdue++;
//       } else {
//         switch(task.status) {
//           case 'Pending':
//             stats.pending++;
//             break;
//           case 'In Progress':
//             stats.inProgress++;
//             break;
//           case 'Completed':
//             stats.completed++;
//             break;
//         }
//       }
//     });

//     setTaskStats(stats);
//   };

//   // Check for due date reminders
//   const checkDueDateReminders = () => {
//     const today = new Date();
//     const tomorrow = new Date(today);
//     tomorrow.setDate(tomorrow.getDate() + 1);

//     if (Array.isArray(employeeData)) {
//       employeeData.forEach(task => {
//         const dueDate = new Date(task.due_date);
//         if (dueDate.toDateString() === tomorrow.toDateString() && task.status !== 'Completed') {
//           toast.warning(`Task "${task.task}" is due tomorrow!`);
//         }
//       });
//     }
//   };

//   // Enhanced status change handler
//   const handleStatusChange = async (taskId, newStatus) => {
//     try {
//       // Update local state immediately for better UX
//       const updatedData = employeeData.map(task => 
//         (task.taskid || task._id) === taskId ? { ...task, status: newStatus } : task
//       );
//       setEmployeeData(updatedData);
//       setFilteredData(updatedData);
//       calculateTaskStats(updatedData);

//       // API call to update status
//       const response = await axios.put(`${ipadr}/update_task_status`, {
//         taskid: taskId,
//         status: newStatus
//       });

//       if (response.status === 200) {
//         toast.success(`Task status updated to ${newStatus}`);
//       }
//     } catch (error) {
//       console.error("Error updating status:", error);
//       toast.error("Failed to update task status");
//       // Revert on error
//       fetchEmpdata();
//     }
//   };

//   // Enhanced view filtering
//   const applyViewFilter = (data, view) => {
//     switch(view) {
//       case 'myTasks':
//         return data.filter(task => task.userid === userid);
//       case 'assignedByMe':
//         return isManager ? data.filter(task => task.TL === LS.get('name')) : [];
//       default:
//         return data;
//     }
//   };

//   // Enhanced status filtering
//   const applyStatusFilter = (data, filter) => {
//     const today = new Date();
    
//     switch(filter) {
//       case 'pending':
//         return data.filter(task => task.status === 'Pending');
//       case 'inprogress':
//         return data.filter(task => task.status === 'In Progress');
//       case 'completed':
//         return data.filter(task => task.status === 'Completed');
//       case 'overdue':
//         return data.filter(task => 
//           new Date(task.due_date) < today && task.status !== 'Completed'
//         );
//       default:
//         return data;
//     }
//   };

//   // Apply all filters
//   useEffect(() => {
//     let filtered = Array.isArray(employeeData) ? [...employeeData] : [];
//     filtered = applyViewFilter(filtered, currentView);
//     filtered = applyStatusFilter(filtered, statusFilter);
//     setFilteredData(filtered);
//     setCurrentPage(1);
//   }, [employeeData, currentView, statusFilter]);

//       const handleChange = (e) => {
//         const {name , checked} = e.target ;

//         console.log(name);

//         if(name == "allSelect") {
            
//             let tempEmp = employeeData.map(item => {
//                 return {...item,isChecked: checked,category:name}
//             }) ;
//             console.log(tempEmp);
//             SetAllSelect(tempEmp);
//             setEmployeeData(tempEmp) ;
//         }
//         else { 
//             console.log("SelectOne")
//             let tempUser = employeeData.map(item => item.name === name ? {...item, isChecked: checked,category: "SelectOne"} : item);
//             console.log(tempUser);
//             let user= Object.assign(tempUser.filter(item=>item.category==="SelectOne"));
//             console.log(user)
//             SetSelectone(user);
//             setEmployeeData(tempUser) ;
//         }
//     }

//     const handletaskeditChange=(e)=>{
//       const { name, value } = e.target;
//       console.log("name:",name,"- value:",value );

//       SetEditmodel((prevData) => ({
//           ...prevData,
//           Task_details: prevData.Task_details.map((item, index) =>
//               index === 0 ? { ...item, [name]: value } : item
//           )
        
//       }));
//     }

//     const handleduedateeditChange = (e) => {
//         const { value } = e.target;
//         console.log(value);
//         SetEditmodel({
//             ...editModel,
//             due_date: value
//         });
//     };

//     const handleEditmodel = (index, e) => {
//       const { name, value } = e.target;
//       const updatedEditModel = [...editModel];
//       updatedEditModel[index] = { ...updatedEditModel[index], [name]: value };
//       SetEditmodel(updatedEditModel);
//     };
    
//     const handleAllChange=(e,index,type)=>{
//        const {name,value}=e.target;

//        console.log(name +"-"+ value);

//        setModelData({ ...modeldata, [name]: value });
//     }

//     const handleforAllChange = (e) => {
//       const { name, value } = e.target;
//       console.log("name:",name,"- value:",value );

//       setModelData((prevData) => ({
//           ...prevData,
//           Task_details: prevData.Task_details.map((item, index) =>
//               index === 0 ? { ...item, [name]: value } : item
//           )
        
//       }));
      
//   };
//   console.log("duedate:",modeldata.due_date);
    

//     const handleButtonClick = (value) => {
//         setModalOpen(false);
//         SetOpenmodel(false);
        
//       };

//       const handleTaskChange = (index, event) => {
//         const newTasks = [...modeldata.task];
//         newTasks[index] = event.target.value; 
//         setModelData({ ...modeldata, task: newTasks, });
//       };

//       const today = new Date();
//       const month = ("0" + (today.getMonth() + 1)).slice(-2);
//       const year = today.getFullYear();
//       const date = ("0" + today.getDate()).slice(-2);
//       const currentDate = `${year}-${month}-${date}`;
      
//       console.log(currentDate);
      

//       const handleonSubmit=async(e)=>{
        
//         let taskArr=[];
       
//         if(isManager){
//           for(let i=0;i<selectedUsers.length;i++)
//             {
//               const taskdetails={
//                   Tasks:modeldata.task,
//                   userid:selectedUsers?.[i]?.userid,
//                   TL:LS.get("name"),
//                   date: currentDate,
//                   due_date:modeldata.due_date,
//                   priority: modeldata.priority || 'medium',
//                   status: 'Pending'
//               };
//                   taskArr.push(taskdetails);
//             }
    
//             console.log("taskArr:",taskArr);
            
               
//                 const response=  await axios({
//                   method: 'post',
//                   url: `${ipadr}/task_assign_to_multiple_members`,
//                   data: {Task_details:taskArr}, 
//                   headers: {
//                   'Content-Type': 'application/json'
//                   }, 
//                 })
//                 if(response.status===200)
//                   {
//                      toast.success("Task Added successfully");
//                      setModelData({
//                         task:[""],
//                         userid:"",
//                         date:"",
//                         due_date:"",
//                         TL:"",
//                         priority: "medium"
//                      })
//                   }
//                   else{
//                     toast.error("error while Added the data");
//                   }
//               setModalOpen(false);
               
//         }
//         else
//         {
//           const singletask={
//             task:modeldata.task,
//             userid:LS.get('userid'),
//             date: currentDate,
//             due_date:modeldata.due_date,
//             priority: modeldata.priority || 'medium',
//             status: 'Pending'
//           };
//           console.log("singletask:",singletask);
//            const response = await fetch(`${ipadr}/add_task`, {
//                   method: "POST",
//                   headers: {
//                     "Content-Type": "application/json",
//                   },
//                   body: JSON.stringify(singletask),
//                 });
//                 if(response.status===200)
//                   {
//                      toast.success("Task Added successfully");
//                      setModelData({
//                         task:[""],
//                         userid:"",
//                         date:"",
//                         due_date:"",
//                         priority: "medium"
//                      })
//                   }
//                   else{
//                     toast.error("error while Added the data");
//                   }
//               setModalOpen(false);
//         }

//         fetchEmpdata();          
//       }

       
//        const deleteTask = async (taskIndex) => {
//           const taskToDelete = employeeData[taskIndex];
//           console.log("taskToDelete:",taskToDelete);
//           try {
//             const response = await fetch(`${ipadr}/task_delete/${taskIndex}`, {
//               method: "DELETE",
//               headers: {
//                 "Content-Type": "application/json",
//               },
//             });
      
//             const data = await response.json();
//             if (!response.ok) {
//               throw new Error(data.detail || "Failed to delete task");
//             }
      
//             toast.success("Task deleted successfully!");
//             fetchTasks(LS.get('id'), date);
//           } catch (error) {
//             toast.error(error.message);
//           }
//           fetchEmpdata();
//         };

//         const fetchTasks = async (userId, selectedDate) => {
//             setLoading(true);
//             console.log(selectedDate);
//             try {
//               const response = await fetch(
//                 `${ipadr}/get_tasks/${userid}/${selectedDate}`
//               );
        
//               if (!response.ok) {
//                 const errorData = await response.json();
//                 throw new Error(errorData.detail || "Failed to fetch tasks");
//               }
        
//               const data = await response.json();
//               if (data.message) {
//                 setEmployeeData([]);
//               } else {
//                 setEmployeeData(data);
//               }
//             } catch (error) {
//               setError(error.message);
//             } finally {
//               setLoading(false);
//             }
//           };

//       const handleoneditSubmit=async()=>{
        
//           console.log("editmodel:",editModel);
//           console.log("editmodel:",editModel?.[0]?.task);
//          const updatedetails={
//           updated_task:editModel?.[0]?.task,
//           userid:editModel?.[0]?.userid,
//           status:editModel?.[0]?.status,
//           due_date:editModel?.[0]?.due_date,
//           taskid:editModel?.[0]?._id
//          }
//          console.log("updateddetails:",updatedetails);

//       const response=await  axios({
//           method: 'put',
//           url: `${ipadr}/edit_task`,
//           data: updatedetails, 
//           headers: {
//            'Content-Type': 'application/json'
//            },    
//          });

//          if(response.status===200)
//          {
//           toast.success("Task edited successfully");
//          }
//          else{
//           toast.error("error while editing the data");
//          }
//          SetOpenmodel(false);
//          fetchEmpdata();
//       }

//       const confirm = async (id) => {
//         if (!id) {
//           console.error("No ID provided for confirm function");
//           return;
//         }

//         try {
//           const response = await axios.get(`${ipadr}/get_single_task/${id}`);
//           let taskdetails = response.data;

//           if (!Array.isArray(taskdetails)) {
//             taskdetails = [taskdetails];
//           }

//           console.log("taskdetails:", taskdetails);
//           SetEditmodel(taskdetails);
//           SetOpenmodel(true);
//         } catch (error) {
//           console.error("Error in confirm function:", error);
//           toast.error("Error fetching task details");
//         }
//       };

//       let url1='';
//       let url2='';
      
//       if(isManager)
//       {
//         url1=`${ipadr}/get_team_members?TL=${LS.get('name')}`;
//         url2=`${ipadr}/get_assigned_task?TL=${LS.get('name')}&userid=${ValueSelected}`
//       }

//       const users=async()=>{
//         if (!isManager) return;
        
//         try {
//             const response = await axios.get(`${url1}`)
//             const userdetails=response.data && Array.isArray(response.data) ? response.data:[];
//             console.log("userdetails",userdetails)
            
//             const hardcodedOption = {
//                 userid: LS.get("userid"),
//                 name: LS.get("name"),
//                 address:LS.get("address"),
//                 date_of_joining:LS.get("date_of_joining"),
//                 email:LS.get("email"),
//                 education:LS.get("education"),
//                 department:LS.get("department"),
//                 personal_email:LS.get("personal_email"),
//                 phone:LS.get("phone"),
//                 position:LS.get("position"),
//                 resume_link:LS.get("resume_link"),
//                 skills:LS.get("skills"),
//                 TL:LS.get("TL"),
//                 status:LS.get("status")
//             };
//         const updateddetails=[...userdetails,hardcodedOption];
//         console.log("updateddetails",updateddetails);
//         SetOptions(userdetails);
//         } catch (error) {
//             console.error("Error fetching users:", error);
//             SetOptions([]);
//         }
//       }

//       console.log("options:",options);
      
//       const dropdown=async ()=>{
//         if (!isManager || !ValueSelected) return;
        
//         try {
//             const response= await axios.get(`${url2}`);
//             const Empdata=response.data && Array.isArray(response.data)? response.data :[];
//             console.log("dropdowndata:",Empdata);
//             setFilteredData(Empdata);
//         } catch (error) {
//             console.error("Error in dropdown:", error);
//             setFilteredData([]);
//         }
//     }

      
//       const [note, setNote] = useState({
//         body: '',
//         bg: ''
//       });
//       const [editNote, setEditNote] = useState();
//       const [toggleForm, setToggleForm] = useState(false);
//       const [toggleEditForm, setToggleEditForm] = useState(false);
    
//       const handlesChange = (e) => {
//         if (toggleEditForm) {
//           setEditNote({ ...editNote, [e.target.name]: e.target.value });
//         }
    
//         if (toggleForm) {
//           setNote({ ...note, [e.target.name]: e.target.value });
//         }
//       };
    
//       const handleDelete = (id) => {
//         const leftNotes = employeeData.filter((note) => note.id !== id);
//         setEmployeeData(leftNotes);
//       };
    
//       const handleEditSubmit = (e) => {
//         e.preventDefault();
    
//         const updatedNotes = employeeData.map((note) => (note.id === editNote.id ? editNote : note));
    
//         setEmployeeData(updatedNotes);
    
//         setEditNote({});
//         setToggleEditForm(!toggleEditForm);
//       };
 
//       const handleSelectChange =(event)=>{
//         setSelectedValue(event.target.value);
//       };
      
//       const handleSelectvalueChange =(event)=>{
//         SetValueSelected(event.target.value);
//         dropdown();
//       };

//       useEffect(() => {
//         dropdown();
//       }, []);

//       const addTask = () => {
//         setModelData({ ...modeldata, task: [...modeldata.task, ""] });
//       };
    
//       const onSelect=(selectedList)=>{
//         setSelectedUsers(selectedList);
//         console.log("selected",selectedList);
      
//       }
//      const onRemove=(selectedList)=>{
//       setSelectedUsers(selectedList);
//       console.log("unselected:",selectedList);

//      }

//      const handleDateRangeChange = (ranges) => {
//       const { startDate, endDate } = ranges.selection;
//       setDateRange([ranges.selection]);
//       filterDataByDateRange(startDate, endDate);
//     };

//     const filterDataByDateRange = (startDate, endDate) => {
//             if (!startDate || !endDate) {
//               setFilteredData(employeeData);
//               return;
//             }
        
//             const filtered = employeeData.filter(item => {
//               const itemDate = parseISO(convertDateFormat(item.date || item.due_date));
//               return isWithinInterval(itemDate, {
//                 start: startDate,
//                 end: endDate
//               });
//             });
        
//             const sortedData = sortConfig.column 
//               ? sortData(filtered, sortConfig.column) 
//               : filtered;
            
//             setFilteredData(sortedData);
//             setCurrentPage(1);
//           };

//           const convertDateFormat = (dateString) => {
//             if (!dateString) return '';
//             const [day, month, year] = dateString.split('-');
//             return `${year}-${month}-${day}`;
//           };
          

//           console.log("filter data:",filteredData);
//   const indexOfLastItem = currentPage * itemsPerPage;
//   const indexOfFirstItem = indexOfLastItem - itemsPerPage;
//   const currentItems = Array.isArray(filteredData) ? filteredData.slice() : [];

//   console.log("currentItems:",currentItems)
          

//   const handleReset = () => {
//     setDateRange([{
//       startDate: null,
//       endDate: null,
//       key: "selection"
//     }]);
//     setFilteredData(employeeData);
//     setCurrentView('all');
//     setStatusFilter('all');
//     setShowDatePicker(false);
//   };

//      return(
//         <div className="mr-8 p-10 bg-white min-h-96 lg:min-h-[90vh] w-full  shadow-black rounded-xl justify-center items-center relative jsonback  ml-10 rounded-md h-screen overflow-y-scroll scrollbar-hide  ">
//             <div className="">
//             <h1 className="text-5xl font-semibold font-inter pb-2 text-transparent bg-gradient-to-r from-zinc-600 to-zinc-950 bg-clip-text border-b-2">
//               Task Assign  </h1>
//               <div className="">
              
             
//        <header className="px-5 py-4 border-b border-gray-200 flex justify-between items-center">
//             <button className="bg-blue-500 hover:bg-blue-400 hover:text-slate-900 text-white text-sm font-inter px-4 py-2 rounded-full shadow-lg" onClick={() => setModalOpen(true)}>
//                     Add Task
//              </button>

//              {/* Enhanced Role-Based View Filters */}
//              <div className="flex items-center space-x-3">
//                <div className="flex bg-gray-100 rounded-lg p-1">
//                  <button
//                    onClick={() => setCurrentView('all')}
//                    className={`px-4 py-2 text-sm rounded-md transition-colors ${
//                      currentView === 'all' ? 'bg-blue-500 text-white' : 'text-gray-600 hover:bg-gray-200'
//                    }`}
//                  >
//                    All Tasks ({Array.isArray(employeeData) ? employeeData.length : 0})
//                  </button>
//                  <button
//                    onClick={() => setCurrentView('myTasks')}
//                    className={`px-4 py-2 text-sm rounded-md transition-colors ${
//                      currentView === 'myTasks' ? 'bg-blue-500 text-white' : 'text-gray-600 hover:bg-gray-200'
//                    }`}
//                  >
//                    My Tasks
//                  </button>
//                  {isManager && (
//                    <button
//                      onClick={() => setCurrentView('assignedByMe')}
//                      className={`px-4 py-2 text-sm rounded-md transition-colors ${
//                        currentView === 'assignedByMe' ? 'bg-blue-500 text-white' : 'text-gray-600 hover:bg-gray-200'
//                      }`}
//                    >
//                      Assigned by Me
//                    </button>
//                  )}
//                </div>
//              </div>

//              {/* Enhanced Status Filters */}
//              <div className="flex items-center space-x-3">
//                <select
//                  value={statusFilter}
//                  onChange={(e) => setStatusFilter(e.target.value)}
//                  className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
//                >
//                  <option value="all">All Status ({Array.isArray(filteredData) ? filteredData.length : 0})</option>
//                  <option value="pending">Pending ({taskStats.pending})</option>
//                  <option value="inprogress">In Progress ({taskStats.inProgress})</option>
//                  <option value="completed">Completed ({taskStats.completed})</option>
//                  <option value="overdue">Overdue ({taskStats.overdue})</option>
//                </select>
//              </div>

//          <div className="flex items-center space-x-3"> 
//           <div className="relative">
//           {
//             isManager ?(
//               <>
//               <select
//                   className="w-48 border border-gray-400 rounded-lg px-4 py-2 text-gray-700 bg-white shadow-md outline-none focus:ring-2 focus:ring-blue-500 transition max-w-[200px] max-h-[40px]"
//                   value={ValueSelected || ""}
//                   onChange={handleSelectvalueChange}
//               >
//                   <option value="">--select--</option>
//                   {options.map(item => (
//                       <option key={item.id || item.userid} value={item.userid}>
//                           {item.name}
//                       </option>
//                   ))}
//               </select>
//               </>
//             ):[]
//           }
//       </div>
//      </div>

//              <div className="flex items-center gap-4">
//              <button
//                 onClick={handleReset}
//                 className="px-4 py-2 bg-gray-500 text-white rounded-md hover:bg-gray-600 flex items-center gap-2"
//               >
//                 <RotateCw className="w-4 h-4" />
//                 Reset
//               </button>
              
//                   <div className="relative">
//                     <button
//                       onClick={() => setShowDatePicker(!showDatePicker)}
//                       className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600"
//                     >
//                       {showDatePicker ? 'Hide Date Range' : 'Show Date Range'}
//                     </button>
//                     {showDatePicker && (
//                       <div className="absolute right-0 top-12 z-50 bg-white shadow-lg rounded-md border">
//                         <DateRangePicker
//                           ranges={dateRange}
//                           onChange={handleDateRangeChange}
//                           moveRangeOnFirstSelection={false}
//                         />
//                       </div>
//                     )}
//                   </div>
                 
//                 </div>
//           </header>

//       <div className="notes border-t-2 border-gray-200 mt-5 pt-5 container mx-auto grid md:grid-cols-4 gap-10 ">
//         {currentItems.length > 0 ? (
//           currentItems.map((item, i) => {
//             return (
//               <Note 
//                 handleDelete={deleteTask} 
//                 handleEdit={confirm} 
//                 handleStatusChange={handleStatusChange}
//                 key={i} 
//                 empdata={item} 
//               />
//             );
//           })
//         ) : (
//           <p> No notes. Please add one </p>
//         )}
//       </div>  

//              {modalOpen &&
//         createPortal(
//           <Modal
//             closeModal={handleButtonClick}
//             onSubmit={handleonSubmit}
//             onCancel={handleButtonClick}
//           >
           
//            <>
//            <div className="max-h-[50vh] overflow-y-auto">
//            {modeldata.task.map((task, index) => (
//         <div key={index} className="mb-4">
//           <label className="block text-lg font-semibold text-gray-700 mb-2">Task {index + 1}</label>
//           <textarea
//             name={`task-${index}`}
//             value={task}
//             onChange={(e) => handleTaskChange(index, e)}
//             className="w-full border border-gray-300 rounded-lg px-4 py-3 shadow-sm focus:ring-2 focus:ring-blue-400 focus:border-blue-400 transition placeholder-gray-500"
//           ></textarea>
//         </div>
//           ))}
//            <button
//               type="button"
//               onClick={addTask}
//               className="bg-gradient-to-r from-blue-500 to-purple-500 text-white font-medium px-4 py-2 rounded-lg shadow-md hover:scale-105 transition transform"
//             >
//              ➕ Add Another Task
//             </button>
            
//             <div className="mt-4">
//             <label className="block text-lg font-semibold text-gray-700 mb-2">Due date</label>
//             <input
//                type="date"
//                 name="due_date"
//                 value={modeldata.due_date}
//                 onChange={handleAllChange}
//                 className="w-full border border-gray-300 rounded-lg px-4 py-3 shadow-sm focus:ring-2 focus:ring-pink-400 focus:border-pink-400 transition cursor-pointer"
//                 />
//            </div>

//            {/* Enhanced Priority Selection */}
//            <div className="mt-4">
//             <label className="block text-lg font-semibold text-gray-700 mb-2">Priority</label>
//             <select 
//                name="priority"
//                value={modeldata.priority}
//                onChange={handleAllChange}
//                className="w-full border border-gray-300 rounded-lg px-4 py-3 shadow-sm focus:ring-2 focus:ring-pink-400 focus:border-pink-400 transition"
//             >
//               <option value="low">Low</option>
//               <option value="medium">Medium</option>
//               <option value="high">High</option>
//             </select>
//            </div>

//            {
//             isManager? (
//       <div className="mt-4">
//        <label className="block text-lg font-semibold text-gray-700 mb-2">
//     👤 Select User
//        </label>
//         <div className="w-full max-w-sm bg-white border border-gray-300 rounded-lg px-4 py-2 shadow-sm">
//          <Multiselect
//            options={options}
//            selectedValues={selectedValue}
//            onSelect={onSelect}
//            onRemove={onRemove}
//            displayValue="name"
//            className="text-gray-700"
//            />
//            </div>
//          </div>
//             ):[]

//            }
//               </div>
//             </>
//           </Modal>,
//           document.body
//         )}

//         {
//          openmodel &&
//          createPortal(
//           <Modal
//           closeModal={handleButtonClick}
//             onSubmit={handleoneditSubmit}
//             onCancel={handleButtonClick}>
//               {
//                 editModel.map((item, index) => (
//                   <div key={index}>
//                     <div className="grid grid-cols-2 gap-3">
//                       <div>
//                         <label className="block mb-1">Task</label>
//                         <textarea 
//                           name="task"
//                           value={item.task}
//                           onChange={(e) => handleEditmodel(index, e)}
//                           className="w-full border border-gray-300 rounded px-3 py-2"
//                         ></textarea>
//                       </div>
//                       <div>
//                         <label className="block mb-1">Due date</label>
//                         <input 
//                           type="text"
//                           name="due_date"
//                           value={item.due_date}
//                           onChange={(e) => handleEditmodel(index, e)}
//                           className="w-full border border-gray-300 rounded px-3 py-2"
//                         />
//                       </div>
//                     </div>
                    
//                     <div>
//                       <label className="block mb-1">Status</label>
//                       <select 
//                         name="status"
//                         value={item.status}
//                         onChange={(e) => handleEditmodel(index, e)}
//                         className="w-full border border-gray-300 rounded px-3 py-2"
//                       >
//                         <option value="Pending">Pending</option>
//                         <option value="In Progress">In Progress</option>
//                         <option value="Completed">Completed</option>
//                       </select>
//                     </div>

//                     {/* Enhanced Priority in Edit Modal */}
//                     <div>
//                       <label className="block mb-1">Priority</label>
//                       <select 
//                         name="priority"
//                         value={item.priority || 'medium'}
//                         onChange={(e) => handleEditmodel(index, e)}
//                         className="w-full border border-gray-300 rounded px-3 py-2"
//                       >
//                         <option value="low">Low</option>
//                         <option value="medium">Medium</option>
//                         <option value="high">High</option>
//                       </select>
//                     </div>
//                   </div>
//                 ))
//               }

//           </Modal>,
//           document.body
//          )
//         }

//           </div>
        
//             </div>

//         </div>
//      )
// }

// export default TaskAssign;