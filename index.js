// import * as config from "./config"
const config = require("./config");

const https = require("https");
var mongoClient = require("mongodb").MongoClient;

// const MODE = "DEBUG";

// const token = MODE === "DEBUG" ? "1075045753:AAFnxEfR7Xilqt1QbeVeDMeU_5WW5OXyHFw" : "1069385444:AAHeTuUtegFcLpzXdKj0iThesuPdq_IuqQ0";
// const DB_URL =  "mongodb://192.168.0.125:27017/" + (MODE === "DEBUG" ? "test" : "armordb");
// const UPDATE_POLL_RATE = 3500; // in ms

class TaskEntity {
    constructor(id, name, aliases) {
        this.id = id;
        this.name = name;
        this.aliases = aliases;
    }
}

class GroupChatEntity {
    constructor(id) {
        this.id = id;
        this.userIds = [];      // <-- nur für big-data
        this.playerIds = [];
        this.taskIds = [];
        this.highestTaskRepetitions = {}; // <taskId, reps>
    }

    getHighestRepetitions(taskId) {
        if(!this.highestTaskRepetitions.hasOwnProperty(taskId))
            this.highestTaskRepetitions[taskId] = 0;
        return this.highestTaskRepetitions[taskId];
    }

    addTask(name) {
        
    }
}

class PrivateChatEntity {
    constructor(id) {
        this.id = id;
        this.partnerId = null;
    }
}

class UserEntity {
    constructor(id){
        this.id = id;
        this.surname = "";
        this.lastname = "";
        this.username = "";
        this.languageCode = "";

        this.chatIds = []; // <-- nur für big-data

        this.taskRepetitions = {/*
            "liegestuetze": {
                "total": 100,
                "<chatId0>": 30,
                "<chatId1>": 50,
                "<chatId2>": 20,
            },
            "situps": ...
        */};



        this.hasStarted = false;

        this.lastUpdate = -1;
    }

    static createFromResponse(userResp, chatResp) {
        let u = new UserEntity(resp.id);
        if(chatIds.find(chatResp.id) === undefined)
            u.chatIds.push(chatResp.id);
        if(resp.hasOwnProperty("first_name")) u.surname = userResp.first_name;
        if(resp.hasOwnProperty("last_name")) u.lastname = userResp.last_name;
        if(resp.hasOwnProperty("username")) u.username = userResp.username;
        if(resp.hasOwnProperty("language_code")) u.languageCode = userResp.language_code;
        u.lastUpdate = Date.now();
        return u;
    }

    updateFromResponse(userResp, chatResp) {
        if(chatIds.find(chatResp.id) === undefined)
            u.chatIds.push(chatResp.id);
        if(resp.hasOwnProperty("first_name")) this.surname = userResp.first_name;
        if(resp.hasOwnProperty("last_name")) this.lastname = userResp.last_name;
        if(resp.hasOwnProperty("username")) this.username = userResp.username;
        if(resp.hasOwnProperty("language_code")) this.languageCode = userResp.language_code;
        u.lastUpdate = Date.now();
    }

    addTaskRepetitions(taskId, groupId, repetitions) {
        if(!this.taskRepetitions.hasOwnProperty(taskId))
            this.taskRepetitions[taskId] = {};
          
        if(!this.taskRepetitions[taskId].hasOwnProperty(groupId))
            this.taskRepetitions[taskId][groupId] = 0;

            this.taskRepetitions[taskId][groupId] += repetitions;
    }
}





class ChatData {
    constructor(chatId) {
        this.id = chatId;
        this.users = {};                    // {userId1: UserData, userId2: UserData, ...}
        this.exerciseReps = {};             // {pushups: 50, situps: 20, ...}
        this.exerciseAliases = {};          // {alias: exercise}
        this.defaultExercise = "";
    }
}

class UserData {
    constructor(id, name, username) {
        this.id = id;
        this.name = name;
        this.lastName = "";
        this.username = username;
        this.totalReps = {};        // {pushups: 150, situps: 60, ...};
        this.remainders = {};       // {pushups: 10, situps: 5, ...}
        this.history = [];          //
        this.unrecognizedUpdates = {

        };
    }
}



//
// Application-scoped variable needed to mark updates as processed on the telegram servers
var lastUpdateId = null;


var responseStr = "";
var pollCount = 0;

/**
 * Message poll loop
 */
setInterval(() => {
    console.log("\n ["+ ++pollCount + "] INTERVAL");

    let requestOptions;
    if(lastUpdateId == null) {
        requestOptions = GET("getUpdates");
    }
    else {
        let queryStr = toParamString(["offset", lastUpdateId+1]);
        requestOptions = GET("getUpdates", queryStr);
    }

    const req = https.request(requestOptions);

    req.on("response", res => {
        res
        .on("data", chunk => responseStr += chunk)
        .on("end", () => {
            let json = JSON.parse(responseStr);
            let updates = [];
            if(json.hasOwnProperty("ok") && json.ok && json.hasOwnProperty("result")) {
                json.result.forEach(updates.push(update));
            }

            processUpdates(updates);

            responseStr = "";
        });
    });
    
    req.on('error', error => {
        console.error(error)
    });

    req.end();
}, config.UPDATE_POLL_RATE);





async function processUpdates(updates) {
    let db = await mongoClient.connect(config.DB_URL);

    let messages = [];
    updates.forEach(u => {
        if(u.hasOwnProperty("message")) 
            messages.push(u.message);
    });

    await processMessages(messages, db);

    await db.close();
}


async function processMessages(messages, db) {
    let privateChats, groupChats, users;
    await Promise.all([
        db.collection("private_chats"), 
        db.collection("group_chats"),
        db.collection("users")]
    ).then(v => {privateChats = v[0]; groupChats = v[1]; users = v[2]});

    let chatEntities = {};
    let userEntities = {};

    let chat, user;
    messages.forEach(m => {
        if(!chatEntities.hasOwnProperty(m.chat.id)) {
            if(m.chat.type === "private") {
                chat = await privateChats.findOne({id: m.chat.id});
                if(chat != null) 
                    chat = new PrivateChatEntity(m.chat.id);
            }
            else if(m.chat.type === "group") {
                chat = await groupChats.findOne({id: m.chat.id});
                if(chat == null) {
                    chat = new GroupChatEntity(m.chat.id, m.chat.type, )
                }
            }
            chatEntities[m.chat.id] = chat;
        }

        if(!userEntities.hasOwnProperty(m.from.id)) {
            user = await users.findOne({id: m.from.id});
            if(user == null)
                user = new UserEntity.createFromResponse(m.from, m.chat);
            else
                user.updateFromResponse(m.from, m.chat);
        }
    })

    let updates = {
        users: {},
        game: {}
    }
    let offs;
    messages.forEach(m => {
        offs = [];
        m.entities.forEach(e => {
            if(e.type === "bot_command")
                offs.push(e.offset);
        });
    
        if(offs.length > 0) {
            for(let i = 0; i < offs.length; ++i) {
                let commstr = m.text.slice(offs[i], (i < offs.length-1) ? offs[i+1] : m.text.length);
                let command = commstr.split(/\ +/);

                updates.users[m.from.id] = {};
                processCommand(command, chatEntities[m.chat.id], userEntities[m.from.id], m, updates);
            }
        }
    });
}


function processCommand(command, chat, user, message, updates) {
    let op = command[0];
    let params = command.slice(1);
    
    let processed = false;
    if(!processed) 
        processed = processAdminCommand(op, params, chat, user, message, updates);

    if(!processed) 
        processed = processGuestCommand(op, params, chat, user, message, updates);

    if(!processed) {

        processed = processPlayerCommand(op, params, chat, user, message, updates);
    }

    return processed;
}


function processAdminCommand(op, params, chat, user, message, updates) {
    return false;
}


function processGuestCommand(op, params, chat, user, message, updates) {
    if(!user.hasStarted) {
        switch(op) {
    
            // start
            // ==============================================================  
            case "/start": {
                user.hasStarted = true;
                updates.users[user.id].hasStarted = true;
                updates.users[user.id].unknownGuestCommand = false;
                // if(!chat.users.hasOwnProperty(userId)) {
                //     chat.users[userId] = new UserData(userId, message.from.first_name, message.from.username);
                //     sendMessage(chatId, "*Willkommen beim flexn, " + userName + "!*\nHilfe findest du unter /help");
                //     chatChanged = true;
                // }
                break;
            }
    
            // help
            // ==============================================================          
            case "/help": {
                updates.users[user.id].wantsHelp = true;
                // let response = new TextForm();
                // response.newLine("*Flex mit anderen in der Quarantäne!*\n");
                // response.newLine("/start");
                // response.newLine("_Trete dem Machen bei_\n");
    
                // response.newLine("/machma` [reps] [exercise] `");
                // response.newLine("_Gib den Lauchs was zu tun_\n");
    
                // response.newLine("/done` [reps] [exercise] `");
                // response.newLine("_Lasse dir Wiederholungen anrechnen_\n");
    
                // response.newLine("/exercise` [name] `");
                // response.newLine("_Füge der Gruppe eine neue Übung hinzu_\n");
    
                // response.newLine("/exercises");
                // response.newLine("_Sieh' dir alle Übungen an_\n");
    
                // response.newLine("/alias` [exercise] [bezeichnung] `");
                // response.newLine("_Lege eine weitere Bezeichnung für eine Übung fest_\n");
    
                // response.newLine("/stats ` [player - optional] `");
                // response.newLine("_Sieh dir deine Statistik an_\n");
    
                // response.newLine("/players ` `");
                // response.newLine("_Zeige alle Mitflexer an_\n");
    
                // sendMessage(chatId, response.render());
                // response += "/propose *vorschlag* für Funktionsvorschläge" + "\n";
                break;
            }
    
            default: {
                updates.users[user.id].unknownGuestCommand = true;
                break;
            }
        }
        return true;
    }

    return false;
}


function processPlayerCommand(op, params, chat, users, userId, message, updates) {
    let user = users[userId];

    if(!user.hasStarted)
        return false;

    switch(op) {

            // flex
            // ==============================================================
            case "/flex": {
                if(params.length !== 2) {
                    updates.game.player[userId].invalidParams.flex = "invalid_count";
                    return;
                }

                let reps = params[0];
                if(isNaN(reps)) {
                    updates.game.player[userId].invalidParams.flex = "reps_is_nan";
                    return;
                }

                let task = params[1];
                if(!chat.tasks.hasOwnProperty(task)) {
                    updates.game.player[userId].invalidParams.flex = "unknown_task";
                    return;                    
                }

                //
                // Update user
                let taskId = chat.tasks[task].id;
                user.addRepetitions(taskId, reps);

                if(!update.game.player[userId].taskReps.hasOwnProperty(taskId))
                    update.game.player[userId].taskReps[taskId] = {};
                
                if(!update.game.player[userId].taskReps[taskId].hasOwnProperty(chat.id))
                    update.game.player[userId].taskReps[taskId][chat.id] = {total: 0, instructed: 0};

                update.game.player[userId].taskReps[taskId][chat.id].total += reps;

                let currHighest = chat.getHighestRepetitions(taskId);
                let currReps = user.getRepetitions(taskId);
                if(currHighest < currReps) {
                    let additional = currReps - currHighest;
                    update.game.player[userId].taskReps[taskId][chat.id].instructed += additional;

                    //
                    // Update chat
                    chat.highestTaskRepetitions[taskId] += additional;
                    updates.game.chats[chat.id].tasks[taskId].reps += additional;
                
                    // add to other players
                    // for(let pId in chat.players) {
                    //     let other = users[pId];
                    //     other
                    // }
                }
            





                // let response = new TextForm();

                // if(commandArray.length >= 3) {
                //     let alias = commandArray[2];
                //     let exercise = chat.exerciseAliases.hasOwnProperty(alias) ? chat.exerciseAliases[alias] : alias;

                //     if(!chat.exerciseReps.hasOwnProperty(exercise)) {
                //         response.newLine("Unbekannte Übung", "*");
                //         response.newLine("Verwende /exercise, um eine neue Übung hinzuzufügen");
                //         sendMessage(chatId, response.render(), message.message_id);
                //     }
                //     else {
                //         let reps = parseInt(commandArray[1]);
                //         if(isNaN(reps)) {
                //             sendMessage(chatId, "Gib a echte Zahl ein zefix!", message.message_id);
                //         }
                //         else if(reps <= 0){
                //             sendMessage(chatId, "Gib a postive Zahl ein zefix!", message.message_id);
                //         }
                //         else {
                //             let remainder = getRemaining(chat, userId, exercise);
                //             if(remainder > 0) {
                //                 response.newLine("Machma erstmal deine `" + remainder + "` `" + exercise + "`");
                //                 sendMessage(chatId, response.render(), message.message_id);
                //             }
                //             else {
                //                 // update total reps for this exercise in chat
                //                 if(!chat.exerciseReps.hasOwnProperty(exercise))
                //                     chat.exerciseReps[exercise] = 0;

                //                 chat.exerciseReps[exercise] += reps;

                //                 // update total reps for this exercise of this user
                //                 if(!chat.users[userId].totalReps.hasOwnProperty(exercise))
                //                     chat.users[userId].totalReps[exercise] = 0;

                //                 chat.users[userId].totalReps[exercise] += reps;

                //                 // update exercise remainder for all remaining users in chat
                //                 for(let uId in chat.users) {
                //                     if(uId != userId) addRemaining(chat, uId, exercise, reps);
                //                 }

                //                 // response.newLine("" + linkUser(getUserName(message.from), userId) + "* ist am Machen!*");
                //                 response.newLine("*Weitere* `" + reps + "` `" + exercise + "` *von* " + linkUser(getUserName(message.from), userId));
                //                 // response.newLine(linkUser(getUserName(message.from), userId) + " legt vor");
                //                 // sendMessage(chatId, chat.users[userId].name + " machts vor!");
                //                 sendMessage(chatId, response.render());

                //                 chatChanged = true;
                //             }
                //         }
                //     }
                // }
                // else {

                // }
                // break;
            }

            // exercise
            // ==============================================================
            case "/exercise": {
                if(params.length !== 1) {
                    updates.game.player[userId].invalidParams.exercise = "invalid_count";
                    return;
                }

                let task = params[0];

                if(chat.hasTask(task)) {
                    updates.game.player[userId].invalidParams.exercise = "task_exists";
                }

                updates.game.chats[chat.id].newTasks.push(task);

                if(commandArray.length === 2) {
                    let response = new TextForm();
                    let newEx = commandArray[1];
                    if(chat.exerciseAliases.hasOwnProperty(newEx)) {
                        response.newLine("`" + newEx + "` ist bereits ein Alias für `" + chat.exerciseAliases[newEx] + "`");
                        sendMessage(chatId, response.render(), message.message_id);
                    }
                    else if(chat.exerciseReps.hasOwnProperty(newEx)) {
                        response.newLine("Ich kenne `" + newEx + "` schon");
                        sendMessage(chatId, response.render(), message.message_id);
                    }
                    else {
                        chat.exerciseReps[newEx] = 0;
                        response.newLine("*Ich kenne jetzt* `" + newEx + "`");
                        sendMessage(chatId, response.render());
                        chatChanged = true;
                    }
                }
                break;
            }


            // done
            // ==============================================================
            case "/done": {
                let reps = parseInt(commandArray[1]);
                if(isNaN(reps)) {
                    sendMessage(chatId, "Gib a echte Zahl ein zefix!", message.message_id);
                    // sendMessage(chatId, "Gib a echte Zahl ein etz!", message.message_id);
                }
                else if(reps <= 0) {
                    sendMessage(chatId, "Gib a positive Zahl ein zefix!", message.message_id);
                }
                else {
                    let response = new TextForm();

                    let alias = commandArray[2];
                    let exercise;

                    if(chat.exerciseAliases.hasOwnProperty(alias))  exercise = chat.exerciseAliases[alias];
                    else                                            exercise = alias;

                    if(!chat.exerciseReps.hasOwnProperty(exercise)) {
                        response.newLine("Unbekannte Übung", "*");
                        response.newLine("Verwende /exercise, um eine neue Übung hinzuzufügen");
                        sendMessage(chatId, response.render(), message.message_id);
                    }
                    else {
                        addRemaining(chat, userId, exercise, -reps);

                        if(!chat.users[userId].totalReps.hasOwnProperty(exercise))
                            chat.users[userId].totalReps[exercise] = 0;

                        chat.users[userId].totalReps[exercise] += reps;

                        let remainder = getRemaining(chat, userId, exercise);
                        response.newLine("*Nicer dicer!* " + "@" + getUserName(message.from));
                        response.newLine("Du musst noch `" + remainder + " " + exercise + "` machen");
                        sendMessage(chatId, response.render());

                        chatChanged = true;
                    }
                }
                break;
            }


            // exercise
            // ==============================================================
            case "/exercise": {
                if(commandArray.length === 2) {
                    let response = new TextForm();
                    let newEx = commandArray[1];
                    if(chat.exerciseAliases.hasOwnProperty(newEx)) {
                        response.newLine("`" + newEx + "` ist bereits ein Alias für `" + chat.exerciseAliases[newEx] + "`");
                        sendMessage(chatId, response.render(), message.message_id);
                    }
                    else if(chat.exerciseReps.hasOwnProperty(newEx)) {
                        response.newLine("Ich kenne `" + newEx + "` schon");
                        sendMessage(chatId, response.render(), message.message_id);
                    }
                    else {
                        chat.exerciseReps[newEx] = 0;
                        response.newLine("*Ich kenne jetzt* `" + newEx + "`");
                        sendMessage(chatId, response.render());
                        chatChanged = true;
                    }
                }
                break;
            }


            // exercises
            // ==============================================================
            case "/exercises": {
                let response = new TextForm();
                let table = new TableForm("Rekord");

                response.newLine("Übungen", "*");
                for(let exercise in chat.exerciseReps) {
                    table.newEntry(""+exercise, [chat.exerciseReps[exercise]]);
                    // response.newLine()
                    // response += exercise + ": " + chat.exerciseReps[exercise] + "\n";
                }
                response.newLine("```" + table.render() + "```");
                sendMessage(chatId, response.render());
                break;
            }


            // alias
            // ==============================================================
            case "/alias": {
                if(commandArray.length === 3) {
                    let response = new TextForm();
                    let exercise = commandArray[1];
                    if(!chat.exerciseReps.hasOwnProperty(exercise)) {
                        response.newLine("*Unbekannte Übung* `" + exercise + "`!");
                        response.newLine("Mit /exercises siehst du alle Übungen");
                        // response.newLine("/exercise kannst du neue Übungen hinzufügen");
                        sendMessage(chatId, response.render(), message.message_id);
                    }
                    else {
                        let alias = commandArray[2];
                        chat.exerciseAliases[alias] = exercise;
                        chatChanged = true;
                        sendMessage(chatId, "*Ihr könnt jetzt*` " + alias + " `*anstatt*` " + exercise + " `*schreiben*");
                    }

                }
                else {
                    sendMessage(chatId, "Du musst eine Übung und ein Pseudonym angeben!", message.message_id);
                }
                break;
            }


            // aliases
            // ==============================================================
            case "/aliases": {
                let mapping = new Map();
                for(let alias in chat.exerciseAliases) {
                    if(!mapping.has(chat.exerciseAliases[alias]))
                        mapping.set(chat.exerciseAliases[alias], []);

                    mapping.get(chat.exerciseAliases[alias]).push(alias);
                }

                let response = new TextForm();

                let table = new TableForm("Bezeichnungen");
                mapping.forEach((aliasArr, ex) => {
                    table.newEntry(ex, [aliasArr.join(", ")]);
                })

                response.newLine("```" + table.render() + "```");
                sendMessage(chatId, response.render());
                break;
            }


            // stats
            // ==============================================================                 
            case "/stats": {
                let playerName = null;
                let playerLink = null;
                let playerId = null;
                if(commandArray.length === 1) {
                    playerId = userId;
                    playerLink = linkUser(userName, userId);
                }
                else if(commandArray.length === 2) {
                    let userRef = commandArray[1];
                    if(userRef.startsWith("@")) {
                        playerName = userRef.slice(1);
                    }
                    else {
                        playerName = userRef.slice();
                    }

                    for(let uId in chat.users) {
                        if((chat.users[uId].hasOwnProperty("username") && chat.users[uId].username === playerName) ||
                        (chat.users[uId].hasOwnProperty("name") && chat.users[uId].name === playerName))
                        {
                            playerId = uId;
                            playerLink = linkUser(playerName, uId);
                            break;
                        }
                    }
                }

                if(playerId != null) {
                    let table = new TableForm("Todo", "Done");
                    let response = "*Statistik für *" + playerLink + "\n\n";
                    response += "```";
                    for(let exercise in chat.exerciseReps) {
                        table.newEntry(
                            exercise, 
                            [
                                getRemaining(chat, playerId, exercise), 
                                ((!chat.users.hasOwnProperty(playerId) || !chat.users[playerId].totalReps.hasOwnProperty(exercise)) ? 0 : chat.users[playerId].totalReps[exercise])
                            ]
                        );
                    }
                    response += table.render();
                    response += "```";
                    sendMessage(chatId, response);    
                }

                else {
                    sendMessage(chatId, "*Ich kenne* _" + playerName + "_ *(noch) nicht*")
                }

                break;
            }


            // players
            // ==============================================================     
            case "/players": {
                let response = new TextForm();
                response.newLine("Die Macher der Gruppe", "*");

                let table = new TableForm();
                for(let uId in chat.users) {
                    table.newEntry(getUserNameFromData(chat.users[uId]), []);
                    // response.newLine(getUserNameFromData(chat.users[uId]), "_");
                }

                response.newLine("```" + table.render() + "```");
                sendMessage(chatId, response.render());
                break;
            }


            case "/f": {
                let response = "*JOJ**O** peünis vergergergergregerh\nferertwertzezwerzrzz* _rooolf_";
                sendMessage(chatId, response);
                break;
            }
    }
}

async function processCommand(chatId, userId, userName, commandArray, message) {
    // Temporary only to update db
    if(chat.users.hasOwnProperty(userId)) {
        chat.users[userId].id = userId;
        if(message.from.first_name != null) chat.users[userId].name = message.from.first_name;
        if(message.from.username != null) chat.users[userId].username = message.from.username;
        chatChanged = true;
    }

    if(commandArray[0] !== "/start" && commandArray[0] !== "/help" && !chat.users.hasOwnProperty(userId)) {
        if(!chat.users.hasOwnProperty(userId)) {
            sendMessage(chatId, "Du bist dem flexn noch nicht beigetreten! Beginne mit /start", "Markdown");
        }
    }
    else {
        switch(commandArray[0]) {
            // start
            // ==============================================================                        
            case "/start": {
                if(!chat.users.hasOwnProperty(userId)) {
                    chat.users[userId] = new UserData(userId, message.from.first_name, message.from.username);
                    sendMessage(chatId, "*Willkommen beim flexn, " + userName + "!*\nHilfe findest du unter /help");
                    chatChanged = true;
                }
                
                break;
            }


            // machma
            // ==============================================================
            case "/machma": {
                let response = new TextForm();

                if(commandArray.length >= 3) {
                    let alias = commandArray[2];
                    let exercise = chat.exerciseAliases.hasOwnProperty(alias) ? chat.exerciseAliases[alias] : alias;

                    if(!chat.exerciseReps.hasOwnProperty(exercise)) {
                        response.newLine("Unbekannte Übung", "*");
                        response.newLine("Verwende /exercise, um eine neue Übung hinzuzufügen");
                        sendMessage(chatId, response.render(), message.message_id);
                    }
                    else {
                        let reps = parseInt(commandArray[1]);
                        if(isNaN(reps)) {
                            sendMessage(chatId, "Gib a echte Zahl ein zefix!", message.message_id);
                        }
                        else if(reps <= 0){
                            sendMessage(chatId, "Gib a postive Zahl ein zefix!", message.message_id);
                        }
                        else {
                            let remainder = getRemaining(chat, userId, exercise);
                            if(remainder > 0) {
                                response.newLine("Machma erstmal deine `" + remainder + "` `" + exercise + "`");
                                sendMessage(chatId, response.render(), message.message_id);
                            }
                            else {
                                // update total reps for this exercise in chat
                                if(!chat.exerciseReps.hasOwnProperty(exercise))
                                    chat.exerciseReps[exercise] = 0;

                                chat.exerciseReps[exercise] += reps;

                                // update total reps for this exercise of this user
                                if(!chat.users[userId].totalReps.hasOwnProperty(exercise))
                                    chat.users[userId].totalReps[exercise] = 0;

                                chat.users[userId].totalReps[exercise] += reps;

                                // update exercise remainder for all remaining users in chat
                                for(let uId in chat.users) {
                                    if(uId != userId) addRemaining(chat, uId, exercise, reps);
                                }

                                // response.newLine("" + linkUser(getUserName(message.from), userId) + "* ist am Machen!*");
                                response.newLine("*Weitere* `" + reps + "` `" + exercise + "` *von* " + linkUser(getUserName(message.from), userId));
                                // response.newLine(linkUser(getUserName(message.from), userId) + " legt vor");
                                // sendMessage(chatId, chat.users[userId].name + " machts vor!");
                                sendMessage(chatId, response.render());

                                chatChanged = true;
                            }
                        }
                    }
                }
                else {

                }
                break;
            }


            // done
            // ==============================================================
            case "/done": {
                let reps = parseInt(commandArray[1]);
                if(isNaN(reps)) {
                    sendMessage(chatId, "Gib a echte Zahl ein zefix!", message.message_id);
                    // sendMessage(chatId, "Gib a echte Zahl ein etz!", message.message_id);
                }
                else if(reps <= 0) {
                    sendMessage(chatId, "Gib a positive Zahl ein zefix!", message.message_id);
                }
                else {
                    let response = new TextForm();

                    let alias = commandArray[2];
                    let exercise;

                    if(chat.exerciseAliases.hasOwnProperty(alias))  exercise = chat.exerciseAliases[alias];
                    else                                            exercise = alias;

                    if(!chat.exerciseReps.hasOwnProperty(exercise)) {
                        response.newLine("Unbekannte Übung", "*");
                        response.newLine("Verwende /exercise, um eine neue Übung hinzuzufügen");
                        sendMessage(chatId, response.render(), message.message_id);
                    }
                    else {
                        addRemaining(chat, userId, exercise, -reps);

                        if(!chat.users[userId].totalReps.hasOwnProperty(exercise))
                            chat.users[userId].totalReps[exercise] = 0;

                        chat.users[userId].totalReps[exercise] += reps;

                        let remainder = getRemaining(chat, userId, exercise);
                        response.newLine("*Nicer dicer!* " + "@" + getUserName(message.from));
                        response.newLine("Du musst noch `" + remainder + " " + exercise + "` machen");
                        sendMessage(chatId, response.render());

                        chatChanged = true;
                    }
                }
                break;
            }


            // exercise
            // ==============================================================
            case "/exercise": {
                if(commandArray.length === 2) {
                    let response = new TextForm();
                    let newEx = commandArray[1];
                    if(chat.exerciseAliases.hasOwnProperty(newEx)) {
                        response.newLine("`" + newEx + "` ist bereits ein Alias für `" + chat.exerciseAliases[newEx] + "`");
                        sendMessage(chatId, response.render(), message.message_id);
                    }
                    else if(chat.exerciseReps.hasOwnProperty(newEx)) {
                        response.newLine("Ich kenne `" + newEx + "` schon");
                        sendMessage(chatId, response.render(), message.message_id);
                    }
                    else {
                        chat.exerciseReps[newEx] = 0;
                        response.newLine("*Ich kenne jetzt* `" + newEx + "`");
                        sendMessage(chatId, response.render());
                        chatChanged = true;
                    }
                }
                break;
            }


            // exercises
            // ==============================================================
            case "/exercises": {
                let response = new TextForm();
                let table = new TableForm("Rekord");

                response.newLine("Übungen", "*");
                for(let exercise in chat.exerciseReps) {
                    table.newEntry(""+exercise, [chat.exerciseReps[exercise]]);
                    // response.newLine()
                    // response += exercise + ": " + chat.exerciseReps[exercise] + "\n";
                }
                response.newLine("```" + table.render() + "```");
                sendMessage(chatId, response.render());
                break;
            }


            // alias
            // ==============================================================
            case "/alias": {
                if(commandArray.length === 3) {
                    let response = new TextForm();
                    let exercise = commandArray[1];
                    if(!chat.exerciseReps.hasOwnProperty(exercise)) {
                        response.newLine("*Unbekannte Übung* `" + exercise + "`!");
                        response.newLine("Mit /exercises siehst du alle Übungen");
                        // response.newLine("/exercise kannst du neue Übungen hinzufügen");
                        sendMessage(chatId, response.render(), message.message_id);
                    }
                    else {
                        let alias = commandArray[2];
                        chat.exerciseAliases[alias] = exercise;
                        chatChanged = true;
                        sendMessage(chatId, "*Ihr könnt jetzt*` " + alias + " `*anstatt*` " + exercise + " `*schreiben*");
                    }

                }
                else {
                    sendMessage(chatId, "Du musst eine Übung und ein Pseudonym angeben!", message.message_id);
                }
                break;
            }


            // aliases
            // ==============================================================
            case "/aliases": {
                let mapping = new Map();
                for(let alias in chat.exerciseAliases) {
                    if(!mapping.has(chat.exerciseAliases[alias]))
                        mapping.set(chat.exerciseAliases[alias], []);

                    mapping.get(chat.exerciseAliases[alias]).push(alias);
                }

                let response = new TextForm();

                let table = new TableForm("Bezeichnungen");
                mapping.forEach((aliasArr, ex) => {
                    table.newEntry(ex, [aliasArr.join(", ")]);
                })

                response.newLine("```" + table.render() + "```");
                sendMessage(chatId, response.render());
                break;
            }


            // stats
            // ==============================================================                 
            case "/stats": {
                let playerName = null;
                let playerLink = null;
                let playerId = null;
                if(commandArray.length === 1) {
                    playerId = userId;
                    playerLink = linkUser(userName, userId);
                }
                else if(commandArray.length === 2) {
                    let userRef = commandArray[1];
                    if(userRef.startsWith("@")) {
                        playerName = userRef.slice(1);
                    }
                    else {
                        playerName = userRef.slice();
                    }

                    for(let uId in chat.users) {
                        if((chat.users[uId].hasOwnProperty("username") && chat.users[uId].username === playerName) ||
                           (chat.users[uId].hasOwnProperty("name") && chat.users[uId].name === playerName))
                        {
                            playerId = uId;
                            playerLink = linkUser(playerName, uId);
                            break;
                        }
                    }
                }

                if(playerId != null) {
                    let table = new TableForm("Todo", "Done");
                    let response = "*Statistik für *" + playerLink + "\n\n";
                    response += "```";
                    for(let exercise in chat.exerciseReps) {
                        table.newEntry(
                            exercise, 
                            [
                                getRemaining(chat, playerId, exercise), 
                                ((!chat.users.hasOwnProperty(playerId) || !chat.users[playerId].totalReps.hasOwnProperty(exercise)) ? 0 : chat.users[playerId].totalReps[exercise])
                            ]
                        );
                    }
                    response += table.render();
                    response += "```";
                    sendMessage(chatId, response);    
                }

                else {
                    sendMessage(chatId, "*Ich kenne* _" + playerName + "_ *(noch) nicht*")
                }

                break;
            }


            // players
            // ==============================================================     
            case "/players": {
                let response = new TextForm();
                response.newLine("Die Macher der Gruppe", "*");

                let table = new TableForm();
                for(let uId in chat.users) {
                    table.newEntry(getUserNameFromData(chat.users[uId]), []);
                    // response.newLine(getUserNameFromData(chat.users[uId]), "_");
                }

                response.newLine("```" + table.render() + "```");
                sendMessage(chatId, response.render());
                break;
            }


            // help
            // ==============================================================          
            case "/help": {
                let response = new TextForm();
                response.newLine("*Flex mit anderen in der Quarantäne!*\n");
                response.newLine("/start");
                response.newLine("_Trete dem Machen bei_\n");

                response.newLine("/machma` [reps] [exercise] `");
                response.newLine("_Gib den Lauchs was zu tun_\n");

                response.newLine("/done` [reps] [exercise] `");
                response.newLine("_Lasse dir Wiederholungen anrechnen_\n");

                response.newLine("/exercise` [name] `");
                response.newLine("_Füge der Gruppe eine neue Übung hinzu_\n");

                response.newLine("/exercises");
                response.newLine("_Sieh' dir alle Übungen an_\n");

                response.newLine("/alias` [exercise] [bezeichnung] `");
                response.newLine("_Lege eine weitere Bezeichnung für eine Übung fest_\n");

                response.newLine("/stats ` [player - optional] `");
                response.newLine("_Sieh dir deine Statistik an_\n");

                response.newLine("/players ` `");
                response.newLine("_Zeige alle Mitflexer an_\n");

                sendMessage(chatId, response.render());
                // response += "/propose *vorschlag* für Funktionsvorschläge" + "\n";
                break;
            }


            case "/f": {
                let response = "*JOJ**O** peünis vergergergergregerh\nferertwertzezwerzrzz* _rooolf_";
                sendMessage(chatId, response);
                break;
            }

            // default: {
            //     if(!chat.users.hasOwnProperty(userId)) {
            //         sendMessage(chatId, "Du bist dem flexn noch nicht beigetreten! Beginne mit /start", "Markdown");
            //     }
            //     break;
            // }
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




const GET = function(functionName, paramString) {
    return {
        hostname: config.HOST,
        port: 443,
        path: '/bot' + config.BOT_TOKEN + "/" + functionName + ((paramString != null && paramString != "") ? paramString : ""),
        method: 'GET'
    };
}

const POST = function(functionName, data) {
    return {
        hostname: config.HOST,
        port: 443,
        path: '/bot' + config.BOT_TOKEN + "/" + functionName,
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(data)
        }

    };
}

function toParamString(...params) {
    if(params != null) {
        let assignements = [];
        params.forEach(p => assignements.push(p[0]+"="+p[1]));
        return ("?" + assignements.join());
    }
    return "";
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