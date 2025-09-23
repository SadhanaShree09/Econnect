# server.py
import os
from datetime import datetime
from typing import Any, Dict, List
import json
from bson import Binary, ObjectId
import shutil
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from fastapi.responses import StreamingResponse
import io
import pytz
from bson import Binary
import uvicorn
import traceback
import uuid
from bson import ObjectId
from fastapi import (
    Body,
    Depends,
    FastAPI,
    Form,
    HTTPException,
    Path,
    Query,
    Request,
    WebSocket,
    WebSocketDisconnect,
    File,
    UploadFile,
    Form,
     
)
from fastapi.middleware.cors import CORSMiddleware
from apscheduler.schedulers.background import BackgroundScheduler
from ws_manager import DirectChatManager, GeneralChatManager, NotifyManager,GroupChatManager


direct_chat_manager = DirectChatManager()
chat_manager = GeneralChatManager()
notify_manager = NotifyManager()
group_ws_manager = GroupChatManager()


# --- Your application modules (assumed present) ---
import Mongo
from Mongo import (
    Otherleave_History_Details,
    Permission_History_Details,
    normal_leave_details,
    store_Other_leave_request,
    get_approved_leave_history,
    get_remote_work_requests,
    attendance_details,
    leave_History_Details,
    Remote_History_Details,
    get_attendance_by_date,
    update_remote_work_request_status_in_mongo,
    updated_user_leave_requests_status_in_mongo,
    get_user_leave_requests,
    get_employee_id_from_db,
    store_Permission_request,
    get_all_users,
    get_admin_info,
    add_task_list,
    edit_the_task,
    delete_a_task,
    get_the_tasks,
    delete_leave,
    get_user_info,
    store_sunday_request,
    get_admin_info,
    add_an_employee,
    PreviousDayClockout,
    auto_clockout,
    leave_update_notification,
    recommend_manager_leave_requests_status_in_mongo,
    get_manager_leave_requests,
    get_only_user_leave_requests,
    get_admin_page_remote_work_requests,
    update_remote_work_request_recommend_in_mongo,
    get_TL_page_remote_work_requests,
    users_leave_recommend_notification,
    managers_leave_recommend_notification,
    auto_approve_manager_leaves,
    edit_an_employee,
    get_managers,
    task_assign_to_multiple_users,
    get_team_members,
    manager_task_assignment,
    assigned_task,
    get_single_task,
    get_public_ip,
    get_local_ip,
    get_allowed_contacts,
    append_chat_message,
    get_chat_history,
    chats_collection,
    threads_collection,
    groups_collection,
    update_file_status,
    get_assigned_docs,
    save_file_to_db,
    assign_docs,
    assignments_collection,
    Users,
    messages_collection,
    files_collection
    
    
    
    
)
from model import (
    Item4,
    Item,
    Item2,
    Item3,
    Csvadd,
    Csvedit,
    Csvdel,
    CT,
    Item5,
    Item6,
    Item9,
    RemoteWorkRequest,
    Item7,
    Item8,
    Tasklist,
    Taskedit,
    Deletetask,
    Gettasks,
    DeleteLeave,
    AddEmployee,
    EditEmployee,
    Taskassign,
    SingleTaskAssign,
    TaskIn,
    CommentIn,
    AssignPayload,
    Message,
    ThreadMessage,
    Reaction,
    ChatHistoryResponse,
    PresencePayload,
    AssignPayload,
    ReviewPayload,
    ReviewDocument,
    GroupCreate,
    GroupUpdate,
   UpdateGroupPayload,
)
from auth.auth_bearer import JWTBearer
direct_chat_manager = DirectChatManager()

active_users: Dict[str, WebSocket] = {}
active_connections: Dict[str, WebSocket] = {}
# Task-specific chat manager



# --- App setup ---
app = FastAPI(title="HR / Task Server")
origins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:8000",
    "http://127.0.0.1:8000",
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Connections map for simple notify socket: user_id -> websocket
class ConnectionManager:
    def __init__(self):
        self.active_connections: dict[str, WebSocket] = {}  # userid -> WebSocket

    async def connect(self, user_id: str, websocket: WebSocket):
        await websocket.accept()
        self.active_connections[user_id] = websocket

    def disconnect(self, user_id: str):
        self.active_connections.pop(user_id, None)

    async def send_personal_message(self, message: dict, user_id: str):
        ws = self.active_connections.get(user_id)
        if ws:
            await ws.send_json(message)

manager = ConnectionManager()


scheduler = BackgroundScheduler()

scheduler.add_job(auto_clockout, "cron", hour=21, minute=30)  # example: 21:30 IST
scheduler.start()


@app.get("/")
def read_root():
    return {"Hello": "World"}


# -----------------------
# JSON / CSV endpoints
# -----------------------
@app.post("/addjson", dependencies=[Depends(JWTBearer())])
def Addjson(item: Item4):
    a = Mongo.Adddata(item.data, item.id, item.filename)
    return {"data": a}


@app.post("/Editjson", dependencies=[Depends(JWTBearer())])
def editjson(item: Item4):
    a = Mongo.Editdata(item.data, item.id, item.filename)
    return {"data": a}


@app.post("/deljson", dependencies=[Depends(JWTBearer())])
def Deljson(item: Item3):
    Mongo.deletedata(item.id)
    return {"data": "Successfully Deleted"}


@app.post("/Addcsvjson")
async def Addcsvjson(Data: Csvadd):
    a = Mongo.addcsv(name=Data.name, data=Data.data, id=Data.fileid)
    return a


@app.post("/Getcsvjson")
async def Getcsvjson(item: Item3):
    a = Mongo.Getcsvdata(item.id)
    return a


@app.post("/Updatecsvjson")
async def Updatecsvjson(item: Csvedit):
    a = Mongo.Updatecsv(data=item.data, id=item.id, fileid=item.fileid, name=item.name)
    return a


@app.post("/deletecsvjson")
async def Deletecsv(item: Csvdel):
    a = Mongo.Deletecsv(fileid=item.fileid, id=item.id)
    return a


# -----------------------
# Auth endpoints
# -----------------------
@app.post("/signup")
def Signup(item: Item):
    jwt = Mongo.Signup(item.email, item.password, item.name)
    return jwt


@app.post("/signin")
def Signin(item: Item2):
    c = Mongo.signin(item.email, item.password)
    return c


@app.post("/Gsignin")
def Gsignin(item: Item5):
    jwt = Mongo.Gsignin(item.client_name, item.email)
    return jwt


@app.post("/id", dependencies=[Depends(JWTBearer())])
def userbyid(item: Item3):
    a = Mongo.Userbyid(item.id)
    return {"data": a}


# -----------------------
# Time / attendance
# -----------------------
@app.post("/Clockin")
def clockin(Data: CT):
    time = Data.current_time
    result = Mongo.Clockin(userid=Data.userid, name=Data.name, time=time)
    return {"message": result}


@app.post("/Clockout")
def clockout(Data: CT):
    time = Data.current_time
    result = Mongo.Clockout(userid=Data.userid, name=Data.name, time=time)
    return {"message": result}


@app.post("/PreviousDayClockout")
def previous_day_clockout(Data: CT):
    result = PreviousDayClockout(userid=Data.userid, name=Data.name)
    return {"message": result}


@app.get("/clock-records/{userid}")
async def get_clock_records(userid: str = Path(..., title="The user id")):
    try:
        clock_records = attendance_details(userid)
        return {"clock_records": clock_records}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/attendance/")
async def fetch_attendance_by_date():
    attendance_data = get_attendance_by_date()
    if not attendance_data:
        return {"attendance": []}
    return {"attendance": attendance_data}


@app.get("/get_EmployeeId/{name}")
async def get_employee_id(name: str = Path(..., title="The username of the user")):
    try:
        employee_id = get_employee_id_from_db(name)
        if employee_id:
            return {"Employee_ID": employee_id}
        else:
            raise HTTPException(status_code=404, detail="User not found")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# -----------------------
# Leave related
# -----------------------
@app.post("/leave-request")
def leave_request(item: Item6):
    try:
        time = datetime.now(pytz.timezone("Asia/Kolkata")).strftime("%I:%M:%S %p")
        result = Mongo.store_leave_request(
            item.userid,
            item.employeeName,
            time,
            item.leaveType,
            item.selectedDate,
            item.requestDate,
            item.reason,
        )
        return {"message": "Leave request stored successfully", "result": result}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/Bonus-leave-request")
def bonus_leave_request(item: Item9):
    try:
        time = datetime.now(pytz.timezone("Asia/Kolkata")).strftime("%I:%M:%S %p")
        result = store_sunday_request(
            item.userid,
            item.employeeName,
            time,
            item.leaveType,
            item.selectedDate,
            item.reason,
            item.requestDate,
        )
        return {"message": "Bonus leave request stored successfully", "result": result}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.get("/leave-History/{userid}")
async def get_leave_History(userid: str = Path(..., title="The userid of the user")):
    try:
        leave_history = Mongo.normal_leave_details(userid)
        return {"leave_history": leave_history}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/all_users_leave_requests/")
async def fetch_user_leave_requests(selectedOption: str = Query(..., alias="selectedOption")):
    user_leave_requests = get_user_leave_requests(selectedOption)
    if not user_leave_requests:
        raise HTTPException(status_code=404, detail="No leave data found for the selected date")
    return {"user_leave_requests": user_leave_requests}


@app.get("/manager_leave_requests/")
async def fetch_manager_leave_requests(selectedOption: str = Query(..., alias="selectedOption")):
    user_leave_requests = get_manager_leave_requests(selectedOption)
    if not user_leave_requests:
        raise HTTPException(status_code=404, detail="No leave data found for the selected date")
    return {"user_leave_requests": user_leave_requests}


@app.get("/only_users_leave_requests/")
async def fetch_users_leave_requests(
    selectedOption: str = Query(..., alias="selectedOption"), TL: str = Query(..., alias="TL")
):
    user_leave_requests = get_only_user_leave_requests(selectedOption, TL)
    if not user_leave_requests:
        raise HTTPException(status_code=404, detail="No leave data found")
    return {"user_leave_requests": user_leave_requests}


@app.get("/leave_update_reminder")
async def fetch_pending_leave(TL: str = Query(None, alias="TL")):
    """
    If TL provided -> returns TL notifications; otherwise returns general leave update notifications.
    """
    if TL:
        return users_leave_recommend_notification(TL)
    return leave_update_notification()


@app.get("/managers_leave_recommend_reminder")
async def fetch_managers_pending():
    return managers_leave_recommend_notification()


@app.put("/updated_user_leave_requests")
async def updated_user_leave_requests_status(leave_id: str = Form(...), status: str = Form(...)):
    try:
        response = updated_user_leave_requests_status_in_mongo(leave_id, status)
        return response
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.put("/recommend_users_leave_requests")
async def recommend_managers_leave_requests_status(leave_id: str = Form(...), status: str = Form(...)):
    try:
        response = recommend_manager_leave_requests_status_in_mongo(leave_id, status)
        return response
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.delete("/delete_leave_request")
async def delete_leave_request(item: DeleteLeave):
    try:

        def parse_date(date_str: str) -> datetime:
            if not date_str:
                raise ValueError("Empty date")
            s = date_str.rstrip("Z")
            for fmt in ("%Y-%m-%dT%H:%M:%S.%f", "%Y-%m-%dT%H:%M:%S", "%Y-%m-%d"):
                try:
                    return datetime.strptime(s, fmt)
                except ValueError:
                    continue
            raise ValueError(f"Invalid date format: {date_str}")

        selected_date = parse_date(item.fromDate)
        request_date = parse_date(item.requestDate)

        selected_date_utc = pytz.utc.localize(selected_date)
        request_date_utc = pytz.utc.localize(request_date)

        result = delete_leave(item.userid, selected_date_utc, request_date_utc, item.leavetype)
        return result

    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


# -----------------------
# Remote work
# -----------------------
@app.post("/remote-work-request")
def remote_work_request(request: RemoteWorkRequest):
    try:
        time = datetime.now(pytz.timezone("Asia/Kolkata")).strftime("%I:%M:%S %p")
        result = Mongo.store_remote_work_request(
            request.userid,
            request.employeeName,
            time,
            request.fromDate,
            request.toDate,
            request.requestDate,
            request.reason,
            request.ip,
        )
        return {"message": "Remote work request stored successfully", "result": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/Remote-History/{userid}")
async def get_Remote_History(userid: str = Path(..., title="The name of the user")):
    try:
        Remote_History = Remote_History_Details(userid)
        return {"Remote_History": Remote_History}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/remote_work_requests")
async def fetch_remote_work_requests():
    remote_work_requests = get_remote_work_requests()
    return {"remote_work_requests": remote_work_requests}


@app.get("/admin_page_remote_work_requests")
async def fetch_remote_work_requests_admin():
    remote_work_requests = get_admin_page_remote_work_requests()
    return {"remote_work_requests": remote_work_requests}


@app.get("/TL_page_remote_work_requests")
async def fetch_remote_work_requests_tl(TL: str = Query(..., alias="TL")):
    remote_work_requests = get_TL_page_remote_work_requests(TL)
    return {"remote_work_requests": remote_work_requests}


@app.put("/update_remote_work_requests")
async def update_remote_work_request_status(userid: str = Form(...), status: str = Form(...), id: str = Form(...)):
    try:
        updated = update_remote_work_request_status_in_mongo(userid, status, id)
        if updated:
            return {"message": "Status updated successfully"}
        raise HTTPException(status_code=404, detail="Not updated")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.put("/recommend_remote_work_requests")
async def update_remote_work_request_recommend(userid: str = Form(...), status: str = Form(...), id: str = Form(...)):
    try:
        updated = update_remote_work_request_recommend_in_mongo(userid, status, id)
        if updated:
            return {"message": "Recommend status updated successfully"}
        raise HTTPException(status_code=404, detail="Not updated")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/approved-leave-history/{name}")
def get_leave_history(name: str = Path(..., title="Team lead name")):
    leave_history = get_approved_leave_history(name)
    return {"leave_history": leave_history}


@app.post("/admin_signup")
def adminid_Signup(item: Item):
    jwt = Mongo.admin_Signup(item.email, item.password, item.name, item.phone, item.position, item.date_of_joining)
    return jwt


@app.post("/admin_signin")
def admin_Signup(item: Item2):
    jwt = Mongo.admin_signin(item.email, item.password)
    email = jwt.get("email")
    admin = get_admin_info(email)
    return {"jwt": jwt, "Name": admin.get("name"), "Email": admin.get("email"), "Phone no": admin.get("phone"), "Position": admin.get("position"), "Date of joining": admin.get("date_of_joining")}


@app.post("/admin_Gsignin")
def admin_signup(item: Item5):
    jwt = Mongo.admin_Gsignin(item.client_name, item.email)
    return jwt


def parse_and_format_date(date_str: str):
    """Parses various date formats and converts them to DD-MM-YYYY format."""
    if not date_str:
        return None
    s = date_str.rstrip("Z")
    for fmt in ("%Y-%m-%dT%H:%M:%S.%f", "%Y-%m-%dT%H:%M:%S", "%Y-%m-%d"):
        try:
            parsed_date = datetime.strptime(s, fmt)
            return parsed_date.strftime("%d-%m-%Y")
        except ValueError:
            continue
    raise ValueError(f"Invalid date format: {date_str}")


@app.post("/Other-leave-request")
def other_leave_request(item: Item7):
    try:
        time = datetime.now(pytz.timezone("Asia/Kolkata")).strftime("%I:%M:%S %p")
        result = store_Other_leave_request(
            item.userid, item.employeeName, time, item.leaveType, item.selectedDate, item.ToDate, item.requestDate, item.reason
        )
        return {"message": "Leave request stored successfully", "result": result}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/Permission-request")
def permission_request(item: Item8):
    try:
        result = store_Permission_request(item.userid, item.employeeName, item.time, item.leaveType, item.selectedDate, item.requestDate, item.timeSlot, item.reason)
        return {"message": "Leave request stored successfully", "result": result}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.get("/Other-leave-history/{userid}")
async def get_other_leave_history(userid: str = Path(..., title="The ID of the user")):
    try:
        leave_history = Otherleave_History_Details(userid)
        return {"leave_history": leave_history}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/Permission-history/{userid}")
async def get_Permission_history(userid: str = Path(..., title="The ID of the user")):
    try:
        leave_history = Permission_History_Details(userid)
        return {"leave_history": leave_history}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/get_all_users")
async def get_all_users_route():
    users = get_all_users()
    if users:
        return users
    raise HTTPException(status_code=404, detail="No users found")


@app.post("/add_task")
async def add_task(item: Tasklist):
    try:
        parsed_date = datetime.strptime(item.date, "%Y-%m-%d").strftime("%d-%m-%Y")
        due_date = datetime.strptime(item.due_date, "%Y-%m-%d").strftime("%d-%m-%Y")
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD for input.")
    result = add_task_list(item.task, item.userid, parsed_date, due_date)
    return result


@app.post("/manager_task_assign")
async def task_assign(item: SingleTaskAssign):
    parsed_date = datetime.strptime(item.date, "%Y-%m-%d").strftime("%d-%m-%Y")
    due_date = datetime.strptime(item.due_date, "%Y-%m-%d").strftime("%d-%m-%Y")
    result = manager_task_assignment(item.task, item.userid, item.TL, parsed_date, due_date)
    return result


@app.put("/edit_task")
async def edit_task(item: Taskedit):
    today = datetime.today()
    formatted_date = today.strftime("%d-%m-%Y")
    result = edit_the_task(item.taskid, item.userid, formatted_date, item.due_date, item.updated_task, item.status)
    return {"result": result}


@app.delete("/task_delete/{taskid}")
async def task_delete(taskid: str):
    result = delete_a_task(taskid)
    return {"result": result}


@app.get("/get_tasks/{userid}")
async def get_tasks(userid: str):
    result = get_the_tasks(userid)
    if not result:
        return {"message": "No tasks found for the given user"}
    return result


@app.get("/get_single_task/{taskid}")
async def get_task(taskid: str):
    result = get_single_task(taskid)
    if not result:
        return {"message": "No tasks found for the given task id"}
    return result


@app.get("/get_user/{userid}")
def get_user(userid: str):
    result = get_user_info(userid)
    return result


@app.put("/edit_employee")
def edit_employee(item: EditEmployee):
    result = edit_an_employee(item.dict())
    return result


@app.get("/get_managers_list")
async def fetch_managers():
    result = get_managers()
    return result


@app.get("/get_admin/{userid}")
def get_admin(userid: str):
    result = Mongo.get_admin_information(userid)
    return result


@app.post("/add_employee")
def add_employee(item: AddEmployee):
    result = add_an_employee(item.dict())
    return result


@app.get("/auto_approve_manager_leaves")
async def trigger_auto_approval():
    result = auto_approve_manager_leaves()
    return result


@app.get("/get_team_members")
def get_members(TL: str = Query(..., alias="TL")):
    result = get_team_members(TL)
    return result


@app.post("/task_assign_to_multiple_members")
async def task_assign_multiple(item: Taskassign):
    task_details = item.Task_details
    result = task_assign_to_multiple_users(task_details)
    # notify assigned users via simple websocket map (if connected)
    for task in task_details:
        uid = task.get("userid")
        if uid and uid in connections:
            try:
                await connections[uid].send_json(
                    {
                        "type": "task_assigned",
                        "message": f"New Task: {task.get('Tasks')} (Due: {task.get('due_date')})",
                    }
                )
            except Exception:
                pass
    return {"inserted_ids": result}


@app.get("/get_assigned_task")
def get_assigned_tasks(TL: str = Query(..., alias="TL"), userid: str | None = Query(None, alias="userid")):
    result = assigned_task(TL, userid)
    return result


@app.get("/ip-info")
def fetch_ip_info():
    return {"public_ip": get_public_ip(), "local_ip": get_local_ip()}


# -----------------------
# Task + comments REST endpoints (using Mongo)
# -----------------------
# NOTE: Ensure `Mongo` provides `get_task_comments(task_id)` and `append_task_comment(task_id, comment)`
# If not present, implement them in your Mongo module.


@app.websocket("/ws/notify/{user_id}")
async def ws_notify(websocket: WebSocket, user_id: str):
    await notify_manager.connect(user_id, websocket)
    try:
        # Keep the connection alive; client does not need to send anything frequently.
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        await notify_manager.disconnect(user_id, websocket)


# Fetch chat history
# server.py
active_users: dict[str, WebSocket] = {}

@app.websocket("/ws/{userid}")
async def websocket_endpoint(websocket: WebSocket, userid: str):
    # connect socket
    await direct_chat_manager.connect(userid, websocket)
    try:
        while True:
            data = await websocket.receive_text()
            msg = json.loads(data)
            msg["timestamp"] = datetime.utcnow().isoformat() + "Z"
            msg.pop("pending", None)

            msg_type = msg.get("type", "chat")

            if msg_type == "thread":
                msg["id"] = msg.get("id") or str(ObjectId())
                threads_collection.insert_one(msg.copy())
                msg.pop("_id", None)

                # send to both sender and recipient
                await direct_chat_manager.send_message(msg["to_user"], msg)

            else:  # normal chat
                msg["chatId"] = msg.get("chatId") or "_".join(sorted([userid, msg["to_user"]]))
                chats_collection.insert_one(msg.copy())
                msg.pop("_id", None)

                # send to both sender and recipient
                await direct_chat_manager.send_message(msg["to_user"], msg)

    except WebSocketDisconnect:
        direct_chat_manager.disconnect(userid, websocket)




@app.get("/history/{chatId}")
async def history(chatId: str):
    cursor = chats_collection.find({"chatId": chatId}).sort("timestamp", 1)
    messages = []
    for doc in cursor:
        mid = str(doc.get("id") or doc.get("_id"))
        reply_count = threads_collection.count_documents({"rootId": mid})
        messages.append({
            "id": mid,
            "from_user": doc.get("from_user"),
            "to_user": doc.get("to_user"),
            "text": doc.get("text"),
            "file": doc.get("file"),
            "timestamp": doc["timestamp"].isoformat() if isinstance(doc.get("timestamp"), datetime) else doc.get("timestamp"),
            "chatId": doc.get("chatId"),
            "reply_count": reply_count,   # ✅ so frontend can show "💬 3 replies"
        })
    return messages


@app.post("/thread")
async def save_thread(payload: dict = Body(...)):
    payload["id"] = payload.get("id") or str(ObjectId())
    payload["timestamp"] = datetime.utcnow().isoformat() +"Z"
    threads_collection.insert_one(payload.copy())
    return {"status": "success", "thread": payload}

@app.get("/thread/{rootId}")
async def get_threads(rootId: str):
    threads = list(threads_collection.find({"rootId": rootId}).sort("timestamp", 1))
    result = []
    for t in threads:
        result.append({
            "id": str(t.get("id") or t.get("_id")),
            "from_user": t.get("from_user"),
            "to_user": t.get("to_user"),
            "text": t.get("text"),
            "file": t.get("file"),
            "timestamp": t.get("timestamp"),
            "rootId": t.get("rootId"),
        })
    return result


# Assign docs to users
# ------------------ Assign Documents ------------------

# ------------------ Assign Document ------------------
@app.post("/assign_docs")
def assign_docs(payload: AssignPayload, assigned_by: str = "HR"):
    if not payload.userIds or not payload.docName:
        raise HTTPException(status_code=400, detail="docName and userIds required")
    
    count = 0
    for uid in payload.userIds:
        # Only add doc if not already assigned
        result = Users.update_one(
            {"userid": uid, "assigned_docs.docName": {"$ne": payload.docName}},
            {"$push": {
                "assigned_docs": {
                    "docName": payload.docName,
                    "status": "Pending",
                    "assignedBy": assigned_by,
                    "assignedAt": datetime.utcnow(),
                    "fileId": None,
                    "remarks": None
                }
            }}
        )
        if result.modified_count > 0:
            count += 1

    return {"message": f'"{payload.docName}" assigned to {count} user(s)'}
@app.get("/assign_docs")
def get_assigned_docs(userId: str = Query(...)):
    """
    Return all assigned documents for a given userId.
    """
    user = Users.find_one({"userId": userId}, {"assigned_docs": 1, "_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    assigned_docs = user.get("assigned_docs", [])
    # Optional: sort by assignedAt descending
    assigned_docs.sort(key=lambda d: d["assignedAt"], reverse=True)
    return assigned_docs

# ------------------ Fetch Assigned Documents ------------------
@app.get("/documents/assigned/{userId}")
def fetch_assigned_docs(userId: str):
    user = Users.find_one({"userid": userId})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    assigned_docs = []
    for doc in user.get("assigned_docs", []):
        file_id = doc.get("fileId")
        file_doc = assignments_collection.find_one({"_id": ObjectId(file_id)}) if file_id else None
        
        assigned_docs.append({
            "docName": doc.get("docName"),
            "status": doc.get("status", "Pending"),
            "fileUrl": f"/download_file/{file_id}" if file_doc else None,
            "assignedBy": doc.get("assignedBy"),
            "assignedAt": doc.get("assignedAt"),
            "fileId": file_id,
            "remarks": doc.get("remarks")
        })
    return assigned_docs



# ------------------ Review Document ------------------
@app.put("/review_document")
def review_document(payload: ReviewPayload):
    result = Users.update_one(
        {"userid": payload.userId, "assigned_docs.docName": payload.docName},
        {"$set": {
            "assigned_docs.$.status": payload.status,
            "assigned_docs.$.remarks": payload.remarks,
            "assigned_docs.$.reviewedAt": datetime.utcnow()
        }}
    )
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Document assignment not found")
    return {"message": f"Document {payload.docName} marked as {payload.status}"}



@app.post("/chat_upload")
async def upload_chat_file(
    file: UploadFile = File(...),
    from_user: str = Form(...),
    to_user: str = Form(...),
    chatId: str = Form(...)
):
    try:
        file_bytes = await file.read()
        file_doc = {
            "filename": file.filename,
            "content": Binary(file_bytes),
            "from_user": from_user,
            "to_user": to_user,
            "chatId": chatId,
            "timestamp": datetime.utcnow(),
            "size": len(file_bytes),
            "mime_type": file.content_type,
        }
        result = files_collection.insert_one(file_doc)
        file_doc["_id"] = str(result.inserted_id)

        # Optional: return all files for the chat
        docs = list(files_collection.find({"chatId": chatId}))
        for d in docs:
            d["_id"] = str(d["_id"])

        return {"status": "success", "file": file_doc, "all_chat_files": docs}

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/get_files/{chatId}")
async def get_files(chatId: str):
    docs = list(files_col.find({"chatId": chatId}))
    return [{"name": d["name"], "type": d["type"], "data": d["data"]} for d in docs]

# ------------------ Upload Document ------------------

@app.post("/upload_document")
async def upload_document(
    userid: str = Form(...),
    docName: str = Form(...),
    file: UploadFile = File(...)
):
    try:
        # Read file content
        file_data = await file.read()

        # Create file document
        file_doc = {
            "userid": userid,
            "docName": docName,
            "file": Binary(file_data),
            "filename": file.filename,
            "content_type": file.content_type,
            "createdAt": datetime.utcnow()
        }

        # Insert into files collection
        result = assignments_collection.insert_one(file_doc)
        file_id = str(result.inserted_id)

        # Update assigned_docs with consistent field names
        result_update = Users.update_one(
            {"userid": userid, "assigned_docs.docName": docName},
            {"$set": {"assigned_docs.$.status": "Uploaded", "assigned_docs.$.fileId": file_id}}
        )

        # If no existing doc, append
        if result_update.matched_count == 0:
            Users.update_one(
                {"userid": userid},
                {"$push": {
                    "assigned_docs": {
                        "docName": docName,
                        "status": "Uploaded",
                        "fileId": file_id
                    }
                }}
            )

        return {"message": "File uploaded successfully", "file_id": file_id}

    except Exception as e:
        print("Error storing file in MongoDB:", e)
        raise HTTPException(status_code=500, detail="500: Failed to save file in database")

# ------------------ Download Document ------------------
@app.get("/download_file/{file_id}")
def download_file(file_id: str):
    try:
        file_doc = assignments_collection.find_one({"_id": ObjectId(file_id)})
        if not file_doc:
            raise HTTPException(status_code=404, detail="File not found")

        return StreamingResponse(
            iter([file_doc["file"]]),
            media_type=file_doc.get("content_type", "application/octet-stream"),
            headers={"Content-Disposition": f'attachment; filename="{file_doc["filename"]}"'}
        )
    except Exception as e:
        print("Download error:", e)
        raise HTTPException(status_code=500, detail="Failed to download file")

    try:
        file_doc = assignments_collection.find_one({"_id": ObjectId(file_id)})
        if not file_doc:
            raise HTTPException(status_code=404, detail="File not found")

        # Delete file from collection
        assignments_collection.delete_one({"_id": ObjectId(file_id)})

        # Update user's assigned_docs to remove fileId and set status to pending
        Users.update_one(
            {"userid": file_doc["userid"], "assigned_docs.fileId": file_id},
            {"$set": {"assigned_docs.$.status": "Pending", "assigned_docs.$.fileId": None}}
        )

        return {"message": "File deleted successfully"}
    except Exception as e:
        print("Delete error:", e)
        raise HTTPException(status_code=500, detail="Failed to delete file")

@app.delete("/documents/delete/{file_id}")
def delete_file(file_id: str):
    try:
        file_doc = assignments_collection.find_one({"_id": ObjectId(file_id)})
        if not file_doc:
            raise HTTPException(status_code=404, detail="File not found")

        # Delete file from collection
        assignments_collection.delete_one({"_id": ObjectId(file_id)})

        # Update user's assigned_docs
        Users.update_one(
            {"userid": file_doc["userid"], "assigned_docs.fileId": file_id},
            {"$set": {"assigned_docs.$.status": "Pending", "assigned_docs.$.fileId": None}}
        )

        return {"message": "File deleted successfully"}
    except Exception as e:
        print("Delete error:", e)
        raise HTTPException(status_code=500, detail="Failed to delete file")

@app.delete("/assigned_doc_delete")
async def delete_assigned_doc(data: dict):
    userId = data.get("userId")
    docName = data.get("docName")

    user = Users.find_one({"userid": userId})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    Users.update_one(
        {"userid": userId},
        {"$pull": {"assigned_docs": {"docName": docName}}}
    )

    return {"message": f"Document '{docName}' deleted successfully"}

@app.get("/view_file/{file_id}")
async def view_file(file_id: str):
    file_doc = files_collection.find_one({"_id": ObjectId(file_id)})
    if not file_doc:
        raise HTTPException(status_code=404, detail="File not found")
    return Response(
        content=file_doc["file"],
        media_type=file_doc["content_type"],
        headers={"Content-Disposition": f"inline; filename={file_doc['filename']}"}
    )

@app.post("/create_group")
async def create_group(group: GroupCreate):
    group_id = str(uuid.uuid4())
    doc = {
        "_id": group_id,
        "name": group.name,
        "members": group.members,
        "created_at": datetime.utcnow()
    }
    groups_collection.insert_one(doc)
    return {"status": "success", "group_id": group_id, "name": group.name}

from fastapi.responses import JSONResponse
from fastapi.encoders import jsonable_encoder

@app.get("/get_user_groups/{user_id}")
async def get_user_groups(user_id: str):
    # Fetch groups where user is a member
    groups_cursor = groups_collection.find({"members": user_id})
    groups = list(groups_cursor)  # <--- await here

    # Convert MongoDB ObjectId and datetime to JSON-safe
    groups_json = jsonable_encoder(groups)

    return JSONResponse(content=groups_json)


@app.get("/group_members/{group_id}")
async def get_group_members(group_id: str):
    group = db.groups.find_one({"_id": ObjectId(group_id)})
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")
    
    members = list(db.users.find({"_id": {"$in": group.get("members", [])}}, {"name": 1, "depart": 1}))
    # Convert ObjectId to string for frontend
    for m in members:
        m["_id"] = str(m["_id"])
    return members



@app.websocket("/ws/group/{group_id}")
async def websocket_group(websocket: WebSocket, group_id: str):
    await group_ws_manager.connect(group_id, websocket)
    try:
        while True:
            data = await websocket.receive_json()
            # Add timestamp & unique id
            data["timestamp"] = datetime.utcnow().isoformat() + "Z"
            data["id"] = data.get("id") or str(ObjectId())

            # Save to MongoDB
            messages_collection.insert_one({
                "chatId": group_id,
                "from_user": data.get("from_user"),
                "text": data.get("text"),
                "file": data.get("file"),
                "timestamp": data["timestamp"]
            })

            # Broadcast to all group members
            await group_ws_manager.broadcast(group_id, data)
    except Exception as e:
        print("WS disconnected", e)
    finally:
        group_ws_manager.disconnect(group_id, websocket)


# Fetch group chat history
@app.get("/group_history/{group_id}")
async def group_history(group_id: str):
    cursor = messages_collection.find({"chatId": group_id}).sort("timestamp", 1)
    messages = []
    for doc in cursor:
        messages.append({
            "id": str(doc.get("_id")),
            "from_user": doc.get("from_user"),
            "text": doc.get("text"),
            "file": doc.get("file"),
            "timestamp": doc.get("timestamp").isoformat() if isinstance(doc.get("timestamp"), datetime) else doc.get("timestamp"),
            "chatId": doc.get("chatId")
        })
    return messages

@app.delete("/delete_group/{group_id}")
async def delete_group(group_id: str):
    result = groups_collection.delete_one({"_id": group_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Group not found")
    
    # Optionally, delete all messages in that group
    messages_collection.delete_many({"chatId": group_id})
    
    return {"status": "success", "message": f"Group {group_id} deleted successfully"}

@app.put("/update_group/{group_id}")
async def update_group(group_id: str, group: GroupUpdate):
    result = groups_collection.update_one(
        {"_id": group_id},
        {"$set": {"name": group.name, "members": group.members, "updated_at": datetime.utcnow()}}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Group not found")
    return {"status": "success", "group_id": group_id, "name": group.name}

# Run app
# -----------------------
if __name__ == "__main__":
    # If you want to run with SSL certs, set the paths correctly; otherwise comment ssl args out.
    key_file_path = os.path.join(os.path.dirname(__file__), "../certificates/key.pem")
    cert_file_path = os.path.join(os.path.dirname(__file__), "../certificates/cert.pem")

    uvicorn.run(
        "server:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        # If you have cert + key and want to run HTTPS locally, uncomment below:
        ssl_keyfile=key_file_path,
        ssl_certfile=cert_file_path,
    )
