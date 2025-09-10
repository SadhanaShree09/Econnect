import React, { useState, useEffect } from "react";
import { useLocation, Link, Outlet, useNavigate } from "react-router-dom";
import { AiOutlineMenuUnfold } from "react-icons/ai";
import { Baseaxios, LS } from "../Utils/Resuse";

function Clockin_int() {
  const location = useLocation();
  let path = location.pathname.split("/")[2];
  const navigate = useNavigate();
  const [Navbool, Setnavbool] = useState(false);
  const togglebtn = () => {
    Setnavbool(!Navbool);
  };
  const [startTime, setStartTime] = useState(null);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [Login, Setlogin] = useState(false);
  const [showBackButton, setShowBackButton] = useState(false);

  useEffect(() => {
    const storedStartTime = parseInt(localStorage.getItem("startTime"));
    const storedElapsedTime = parseInt(localStorage.getItem("elapsedTime"));
    const storedIsRunning = localStorage.getItem("isRunning") === "true";
    const storedLogin = localStorage.getItem("Login") === "true";

    if (!isNaN(storedStartTime)) {
      setStartTime(storedStartTime);
    }
    if (!isNaN(storedElapsedTime)) {
      setElapsedTime(storedElapsedTime);
    }
    setIsRunning(storedIsRunning);
    Setlogin(storedLogin);
  }, []);

  useEffect(() => {
    localStorage.setItem("startTime", startTime);
    localStorage.setItem("elapsedTime", elapsedTime);
    localStorage.setItem("isRunning", isRunning);
    localStorage.setItem("Login", Login);
  }, [startTime, elapsedTime, isRunning, Login]);

  useEffect(() => {
    let timer;

    if (isRunning) {
      timer = setInterval(() => {
        const now = Date.now();
        const elapsed = now - startTime;
        setElapsedTime(elapsed);
      }, 1000);
    } else {
      clearInterval(timer);
    }

    return () => {
      clearInterval(timer);
    };
  }, [isRunning, startTime]);

  const toggleTimer = () => {
    Setlogin(true);
    if (isRunning) {
      setIsRunning(false);
    } else {
      const now = Date.now() - elapsedTime;
      setStartTime(now);
      setIsRunning(true);
    }
  };

  const resetTimer = () => {
    Setlogin(false);
    setIsRunning(false);
    setElapsedTime(0);
    setStartTime(null);
  };

  const clockinapi = () => {
    const userid = LS.get("userid");
    const userName = LS.get("name");
    let currentDate = new Date();
    let time = currentDate.toLocaleTimeString().toString();
    
    Baseaxios.post("/Clockin", { userid, name: userName, time: time })
      .then((response) => {
        console.log("✅ Clock-in successful:", response.data);
        toggleTimer();
        
        // Show success feedback
        if (window.toast) {
          window.toast.success(`Successfully clocked in at ${time}! Check your notifications for confirmation.`);
        }
      })
      .catch((err) => {
        console.error("❌ Clock-in error:", err);
        if (window.toast) {
          window.toast.error("Failed to clock in. Please try again.");
        }
      });
  };

  const clockoutapi = () => {
    const userid = LS.get("userid");
    const userName = LS.get("name");
    console.log("Clock-out for user:", userid);
    let currentDate = new Date();
    let time = currentDate.toLocaleTimeString().toString();
    
    Baseaxios.post("/Clockout", {
      userid: userid,
      name: userName,
      time: time,
    })
      .then((res) => {
        console.log(res);
        resetTimer();
      })
      .catch((err) => {
        console.log(err);
      });
  };

  const formatTime = (time) => {
    const seconds = Math.floor((time / 1000) % 60);
    const minutes = Math.floor((time / (1000 * 60)) % 60);
    const hours = Math.floor(time / (1000 * 60 * 60));
    return `${hours}:${minutes < 10 ? "0" : ""}${minutes}:${seconds < 10 ? "0" : ""
      }${seconds}`;
  };

  const handleDetailsClick = () => {
    setShowBackButton(true);
  };

  const handleBackClick = () => {
    setShowBackButton(false);
    navigate("/User/Clockin_int");
  };

  return (
    <div className="mr-8 p-10 bg-white min-h-96 lg:min-h-[90vh] w-full shadow-black rounded-xl justify-center items-center relative jsonback ml-10 rounded-md">
      <div className="">
        <div className="mb-6  w-full flex items-start justify-between font-poppins border-b-2 pb-3">
          <div className=" text-4xl font-semibold text-zinc-700">
            Welcome{" "}
            <span>
              {LS.get("name")}
            </span>
            👋
          </div>
          <div className="">
            {!showBackButton ? (
              <Link
                className="m-4 px-4 py-2 text-base bg-blue-500 rounded-md text-white hover:bg-[#b7c6df80] hover:text-black  active:bg-white active:text-white"
                to={"Clockdashboard"}
                onClick={handleDetailsClick}
              >
                Details
              </Link>
            ) : (
              <button
                className="px-4 py-2 text-base bg-blue-500 rounded-md text-white hover:bg-[#b7c6df80] hover:text-black  active:bg-white active:text-white"
                onClick={handleBackClick}
              >
                Go Back
              </button>
            )}
          </div>
        </div>
        <Outlet />
      </div>
    </div>
  );
}

export default Clockin_int;