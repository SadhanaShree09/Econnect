import React, { useEffect, useState } from "react";
import axios from "axios";
import { Bell } from "lucide-react";
import { ipadr } from "../Utils/Resuse";

const Notification = ({ userId }) => {
  const [notifications, setNotifications] = useState([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 10000); // poll every 10s
    return () => clearInterval(interval);
  }, []);

  const fetchNotifications = async () => {
    try {
      const res = await axios.get(`${ipadr}/get_notifications/${userId}`);
      setNotifications(res.data || []);
    } catch (err) {
      console.error("Error fetching notifications", err);
    }
  };

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="relative bg-gray-100 p-2 rounded-full hover:bg-gray-200"
      >
        <Bell className="w-5 h-5 text-gray-700" />
        {notifications.length > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs px-2 py-0.5 rounded-full">
            {notifications.length}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-72 bg-white shadow-xl border rounded-lg max-h-80 overflow-y-auto z-50">
          {notifications.length === 0 ? (
            <p className="p-3 text-gray-500 text-sm">No new notifications</p>
          ) : (
            notifications.map((note, i) => (
              <div
                key={i}
                className="p-3 border-b last:border-none hover:bg-gray-50"
              >
                <p className="text-sm">{note.message}</p>
                <span className="text-xs text-gray-400">
                  {new Date(note.date).toLocaleString()}
                </span>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};

export default Notification;
