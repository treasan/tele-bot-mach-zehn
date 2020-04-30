// imports
const config = require("../config");
const TelegramBot = require('node-telegram-bot-api');
const mongoClient = require("mongodb").MongoClient;


// bot api instance
const telegramBot = new TelegramBot(config.BOT_TOKEN, {polling: true});


async function processUpdates(updates) {
    const db = await mongoClient.connect(config.DB_URL);
    const messages = [];

    updates.forEach(u => {
        if(u.hasOwnProperty("message")) messages.push(u.message);
    });

    await processMessages(messages, db);

    await db.close();
}


async function processMessages(messages, db) {
    let userRepo = new UserRepository(db);
    let chatRepo = new ChatRepository(db);
    let taskRepo = new TaskRepository(db);

    let chat, user;

    messages.forEach(m => {
        if(m.chat.type === "private") {
            chat = await chatRepo.findPrivateById(m.chat.id);

            if(chat == null) {
                chatRepo.createPrivate(m.chat.id);
            }
        } else if(m.chat.type === "group") {
            chat = await chatRepo.findGroupById(m.chat.id);

            if(chat == null) {
                chatRepo.createGroup(m.chat.id);
            }
        }

        user = await userRepo.createOrUpdateFromMessageJson(m);
    })

    let updateAccumulator = new UpdateAccumulator();
    
    let offs;
    messages.forEach(m => {
        offs = [];

        m.entities.forEach(e => {
            if(e.type === "bot_command") {
                offs.push(e.offset);
            }
        });
    
        if(offs.length > 0) {
            for(let i = 0; i < offs.length; ++i) {
                let commstr = m.text.slice(offs[i], (i < offs.length-1) ? offs[i+1] : m.text.length);
                let command = commstr.split(/\ +/);

                processCommand(command, m, chatRepo, userRepo, taskRepo, updateAccumulator);
            }
        }
    });
}



function processCommand(command, msgJson, chatRepo, userRepo, taskRepo, stateUpdater) {
    let op = command[0];
    let params = command.slice(1);
    
    let processed = false;
    if(!processed) processed = processAdminCommand(op, params, msgJson, chatRepo, userRepo, taskRepo, stateUpdater);

    if(!processed) processed = processUserCommand(op, params, msgJson, chatRepo, userRepo, taskRepo, stateUpdater);

    if(!processed) processed = processGameCommand(op, params, msgJson, chatRepo, userRepo, taskRepo, stateUpdater);

    return processed;
}


function processAdminCommand(op, params, msgJson, chatRepo, userRepo, taskRepo, updater) {
    return false;
}


function processUserCommand(op, params, msgJson, chatRepo, userRepo, taskRepo, updater) {
    switch(op) {

        // start
        // ==============================================================  
        case "/start": {
            updater.startedGame(user);
            break;
        }

        // help
        // ==============================================================          
        case "/help": {
            updater.requestsHelp(user);
            break;
        }

        default: return false;
    }

    return true;
}

/**
 * 
 * @param {string} op 
 * @param {Array<string>} params 
 * @param {any} msgJson 
 * @param {ChatRepository} chatRepo 
 * @param {UserRepository} userRepo 
 * @param {TaskRepository} taskRepo 
 * @param {UpdateAccumulator} updater 
 */
async function processGameCommand(op, params, msgJson, chatRepo, userRepo, taskRepo, updater) {
    let user = await userRepo.findById(msgJson.from.id);

    /** @type {GroupChatEntity} */
    let chat = chatRepo.getGroupById(msgJson.chat.id);

    if(!user.hasStarted) return false;

    switch(op) {
        // done
        // ==============================================================
        case "/done": {
            // checking param count
            if(params.length < 2 || (params.length % 2) !== 0) {
                updater.invalidCommandParameters(user, chat, op, "invalid_count");
                break;
            }

            let task, reps;

            // for each <task, repetition> pair
            for(let i = 0; i < params.length; i += 2) {

                // check and get reps
                reps = parseInt(params[i]);

                if(isNaN(reps)) {
                    updater.invalidCommandParameters(user, chat, op, "reps_is_nan");
                    break;
                }

                // check and get tasks
                task = taskRepo.getByName(params[i + 1]);

                if(task == null) {
                    let tId = chat.getTaskIdByAlias(params[i + 1]);

                    if(tId != null) {
                        task = taskRepo.getById(tId);
                    }
                }

                if(task == null) {
                    updater.invalidCommandParameters(user, chat, op, "unknown_task");
                    break;
                }

                // add task repetitions to user
                user.addTaskRepetitions(task.id, msgJson.date, reps);
            }

            break;
        }



        // learn
        // ==============================================================
        case "/learn": {
            if(params.length !== 1) {
                updater.invalidCommandParameters(user, chat, op, "invalid_count");
                break;
            }

            updater.learnTask(user, chat, params[0]);

            break;
        }


        // alias / label
        // ==============================================================
        case "/label": {
            if(params.length !== 2) {
                updater.invalidCommandParameters(user, chat, op, "invalid_count");
            }

            updater.setAlias(user, chat, task, alias);

            break;
        }


        // tasks
        // ==============================================================
        case "/tasks": {
            // updater.requestsTasks(user, chat);
            break;
        }

        default: return false;
    }

    return true;
}


/**
 * 
 * @param {UpdateAccumulator} updateAccumulator 
 * @param {UserRepository} userRepo 
 * @param {ChatRepository} chatRepo 
 */
async function updateChats(updateAccumulator, userRepo, chatRepo) {
    for(const userInfo of updateAccumulator.users) {
        const uId = userInfo[0];
        const info = userInfo[1];

        const user = await userRepo.findById(uId);

        // get all groups that the user is in
        const groups = await chatRepo.findGroupsByIds(user.groupChatIds);

        // foreach updated task:
        for(const taskId of info.updatedTasks) {

            // update all groups
            groups.forEach(g => {
                const accReps = user.accumulateTaskRepetitions(taskId, g.botAddedTimestamp);
                const hasNewRecord = g.update(taskId, user.id, accReps);

                // TODO: send message to group
                if(hasNewRecord) {

                }

                // send message
            })
        }     
    }
}

function sendMessage(chatId, text, messageId) {
    var data = {
        chat_id: chatId,
        text: text
    };
    data.parse_mode = "Markdown";
    if(messageId != null) data.reply_to_message_id = messageId;

    var stringData = JSON.stringify(data);

    const req = https.request(
        POST("sendMessage", stringData), res => {
            res.on('data', d => {
                // console.log("MEEEESSAGE SENT");
                // console.log(JSON.parse(d));
                // getting sent message object
            });
        }
    );

    req.on('error', error => {
        console.error(error);
    });

    console.log("Sending message:");
    console.log(stringData);

    req.write(stringData);

    req.end();
}

function addRemaining(chat, userId, exercise, count) {
    if(!chat.users.hasOwnProperty(userId))
        chat.users[userId] = new UserData();
    if(!chat.users[userId].remainders.hasOwnProperty(exercise))
        chat.users[userId].remainders[exercise] = 0;

    chat.users[userId].remainders[exercise] += count;
    if(chat.users[userId].remainders[exercise] < 0) 
        chat.users[userId].remainders[exercise] = 0;
}

function getRemaining(chat, userId, exercise) {
    if(!chat.users.hasOwnProperty(userId)) return 0;
    if(!chat.users[userId].remainders.hasOwnProperty(exercise)) return 0;
    return chat.users[userId].remainders[exercise];
}






class TextForm {
    constructor(initText) {
        this.str = initText != null ? ("" + initText) : "";
    }

    newLine(text, formatting) {
        if(formatting != null)  this.str += "\n" + formatting + text + formatting;
        else                    this.str += "\n" + text;
    }

    render() {
        return this.str;
    }
}

class TableForm {
    constructor(...columns) {
        this.properties = columns; // Array<String>
        this.longestPropertyName = this.properties.reduce((acc, curr) => curr.length > acc ? curr.length : acc, 0);
        this.propertyNameOffset = 3;

        this.entries = new Map();
        this.longestEntryName = 0;
        this.entryNameOffset = 3;
    }

    newEntry(name, values) {
        this.entries.set(name, values);
        if(name.length > this.longestEntryName) this.longestEntryName = name.length;
    }

    render() {
        let str = "";

        let namesColLen = this.longestEntryName + this.entryNameOffset;
        let propColsLen = this.longestPropertyName + this.propertyNameOffset;
        console.log("propColsLen");
        console.log(propColsLen);

        str += spaces(namesColLen) + this.properties.reduce((acc, curr) => acc + curr + spaces(propColsLen - curr.length), "") + "\n";

        this.entries.forEach((vals, name) => {
            str += name + spaces(namesColLen - name.length) + vals.reduce((acc, curr) => acc + (""+curr) + spaces(propColsLen - (""+curr).length), "") + "\n";
        });
        
        return str;
    }
}

function linkUser(name, id) {
    if(id == null)  return "@"+name;
    else            return "["+name+"](tg://user?id="+id+")";
}

function getUserName(userObj) {
    if(userObj.first_name != null) return ("" + userObj.first_name);
    else if(userObj.username != null) return ("" + userObj.username);
    else return ("" + userObj.id);
}

function getUserNameFromData(userData) {
    if(userData.name != null) return ("" + userData.name);
    else if(userData.username != null) return ("" + userData.username);
    else if(userData.id != null) return ("" + userData.id);
    return "";  
}

function spaces(num) {
    if(num <= 0) return "";
    let s = ""; let i = num;
    while(i > 0) {
        s+=" ";
        --i;
    } 
    return s;
}