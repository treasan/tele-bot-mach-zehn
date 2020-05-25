// imports
import * as config from "./../config.js"

const mongoClient = require("mongodb").MongoClient;
const TelegramBot = require('node-telegram-bot-api');


// connect to mongo *once* and reuse connection in order to optimize pooling
const db = await mongoClient.connect(config.DB_URL);


// create repositories for entities as an additional layer of abstraction
const userRepo = new UserRepository(db);
const chatRepo = new ChatRepository(db);
const taskRepo = new TaskRepository(db);


// create the bot api instance
const api = new TelegramBot(config.BOT_TOKEN, {polling: true});



// async function processUpdates(updates) {
//     // const db = await mongoClient.connect(config.DB_URL);
//     const messages = [];

//     updates.forEach(u => {
//         if(u.hasOwnProperty("message")) messages.push(u.message);
//     });

//     await processMessages(messages, db);

//     // await db.close();
// }


// async function processMessages(messages, db) {
//     let chat, user;

//     messages.forEach(m => {
//         if(m.chat.type === "private") {
//             chat = await chatRepo.findPrivateById(m.chat.id);

//             if(chat == null) {
//                 chatRepo.createPrivate(m.chat.id);
//             }
//         } else if(m.chat.type === "group") {
//             chat = await chatRepo.findGroupById(m.chat.id);

//             if(chat == null) {
//                 chatRepo.createGroup(m.chat.id);
//             }
//         }

//         user = await userRepo.createOrUpdateFromMessageJson(m);
//     })

//     let updateAccumulator = new UpdateAccumulator();
    
//     let offs;
//     messages.forEach(m => {
//         offs = [];

//         m.entities.forEach(e => {
//             if(e.type === "bot_command") {
//                 offs.push(e.offset);
//             }
//         });
    
//         if(offs.length > 0) {
//             for(let i = 0; i < offs.length; ++i) {
//                 let commstr = m.text.slice(offs[i], (i < offs.length-1) ? offs[i+1] : m.text.length);
//                 let command = commstr.split(/\ +/);

//                 processCommand(command, m, chatRepo, userRepo, taskRepo, updateAccumulator);
//             }
//         }
//     });
// }


api.onText(/(\/.) (.*)/, (msg, match) => {
    // update backend state
    // =======================================================

    // ensure user entity
    await userRepo.createOrUpdateFromMessageJson(msg);
    

    // ensure chat entity
    if(msg.chat.type === "private") {
        const chat = await chatRepo.findPrivateById(msg.chat.id);

        if(chat == null) {
            chatRepo.createPrivate(msg.chat.id);
        }
    } else if(msg.chat.type === "group") {
        const chat = await chatRepo.findGroupById(msg.chat.id);

        if(chat == null) {
            chatRepo.createGroup(msg.chat.id);
        }
    }


    // process command
    processCommand(match[0], match[1].split(" "), msg);


    // update frontend state
    // =======================================================


});



async function processCommand(op, params, msg) {
    let processed = false;

    if(!processed) processed = await processGeneralCommand(op, params, msg);

    if(!processed) processed = await processAdminCommand(op, params, msg);

    if(!processed) processed = await processGameCommand(op, params, msg);

    if(!processed) {
        // unkown command
    }

    return processed;
}


async function processGeneralCommand(op, params, msg) {
    switch(op) {

        // help
        // ==============================================================          
        case "/help": {
            break;
        }

        default: return false;
    }

    return true;
}

async function processAdminCommand(op, params, msg) {
    return false;
}


/**
 * 
 * @param {string} op
 * @param {Array<string>} params
 * @param {any} msg
 */
async function processGameCommand(op, params, msg) {
    let user = await userRepo.findById(msg.from.id);

    let chat = await chatRepo.findGroupById(msg.chat.id);

    switch(op) {

        // done
        // ==============================================================
        case "/done": {
            // checking param count
            if(params.length < 2 || (params.length % 2) !== 0) {
                chat.frontendData.invalidParameters.push({
                    userId: user.id,
                    op,
                    params
                });
                // updater.invalidCommandParameters(user, chat, op, "invalid_count");
                break;
            }

            let task, reps;

            // for each <task, repetition> pair
            for(let i = 0; i < params.length; i += 2) {

                // check and get reps
                reps = parseInt(params[i]);

                if(isNaN(reps)) {
                    chat.frontendData.invalidParameters.push({
                        userId: user.id,
                        op,
                        params
                    });
                    break;
                }

                // check and get tasks
                task = await taskRepo.findByName(params[i + 1]);

                if(task == null) {
                    let tId = chat.getTaskIdByAlias(params[i + 1]);

                    if(tId != null) {
                        task = await taskRepo.findById(tId);
                    }
                }

                if(task == null) {
                    chat.frontendData.invalidParameters.push({
                        userId: user.id,
                        op,
                        params
                    });
                    break;
                }

                // add task repetitions to user
                user.addTaskRepetitions(task.id, msg.date, reps);

                // notify frontend of all chats the user is in
                const otherGroups = await chatRepo.findGroupsByIds(user.groupChatIds);

                otherGroups.forEach(group => {
                    if(group.registeredTasks.hasOwnProperty(task.id)) {
                        // TODO: unnecessary true. Set maybe? but mongo..
                        group.frontendData.updatedTasks[task.id] = true;
                    }
                });
            }

            break;
        }



        // learn
        // ==============================================================
        case "/learn": {
            if(params.length !== 1) {
                chat.frontendData.invalidParameters.push({
                    userId: user.id,
                    op,
                    params
                });

                break;
            }

            const task = taskRepo.findByName(params[0]);

            if(task == null) {
                chat.frontendData.invalidParameters.push({
                    userId: user.id,
                    op,
                    params
                });
                break;
            }

            if(!chat.registeredTasks.hasOwnProperty(params[0])) {
                // TODO: not -1
                chat.registeredTasks[params[0]] = -1;
                chat.frontendData.registeredTasks.push(params[0]);
            } else {

            }

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


// async function renderFrontends(chatIds) {
//     const groups = await chatRepo.findGroupsByIds(chatIds);

//     groups.forEach(group => {
//         renderGroupFrontend(group);
//     });
// }

// async function renderGroupFrontend(group) {
//     /** @type {FrontendData} */
//     const data = group.frontendData;

//     if(data.registeredTasks.length > 0) {
//         let str = "";
//         data.registeredTasks.forEach(tName => {
//             str += "Ich kenne jetzt " + tName + "\n";
//         })
//         api.sendMessage(
//             group.id, 
//             str,
//             {parse_mode: "MarkdownV2"});
//     }

//     if(data.)
// }




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