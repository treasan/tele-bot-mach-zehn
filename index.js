const https = require("https");
var mongoClient = require("mongodb").MongoClient;

const token = "1069385444:AAHeTuUtegFcLpzXdKj0iThesuPdq_IuqQ0";
const dbUrl = "mongodb://192.168.0.125:27017/armordb";
const UPDATE_POLL_RATE = 3500; // in ms



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
    constructor(name) {
        this.name = name;
        this.totalReps = {};        // {pushups: 150, situps: 60, ...};
        this.remainders = {};       // {pushups: 10, situps: 5, ...}
    }
}


var lastUpdateId = null;
// var chats = new Map(); // Map<chatId, ChatData>


var responseStr = "";
var pollCount = 0;

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

            // console.log("JSON");
            // console.log(json);

            if(json.hasOwnProperty("ok") && json.ok && json.hasOwnProperty("result")) {
                let result = json.result;
                result.forEach(update => {
                    if(lastUpdateId == null || (update.update_id > lastUpdateId)) {
                        lastUpdateId = update.update_id;
                        if(update.hasOwnProperty("message") && update.message.hasOwnProperty("entities")) {
                            let offsets = [];
                            update.message.entities.forEach(entity => {
                                if(entity.type === "bot_command") {
                                    offsets.push(entity.offset);
                                }
                            });

                            console.log("Commands: ");
                            if(offsets.length > 0) {
                                for(let i = 0; i < offsets.length; ++i) {
                                    let commandStr = update.message.text.slice(offsets[i], (i < offsets.length-1) ? offsets[i+1] : update.message.text.length);
                                    let commandArr = commandStr.split(" ");
                                    console.log(commandArr);
                                    processCommand(update.message.chat.id, update.message.from.id, update.message.from.first_name, commandArr, update.message.message_id);
                                }
                            }
                        }
                    }
                });
            }
            else {

            }
            responseStr = "";
        });
    });
    
    req.on('error', error => {
        console.error(error)
    });

    req.end();
}, UPDATE_POLL_RATE);

function processCommand(chatId, userId, userName, commandArray, messageId) {
    var chat = null;

    mongoClient.connect(dbUrl, (err, db) => {
        // console.log("err");
        // console.log(err);

        db.collection("chats", (err2, collection) => {
            // console.log("err2");
            // console.log(err2);
            collection.findOne({id: chatId}, (err3, chatObj) => {
                chat = chatObj;
                if(chat == null) {
                    // console.log("jooooooo is null");
                    chat = new ChatData(chatId);
                    collection.insertOne(chat, (err, result) => {console.log(err);});
                }

                // console.log("chat");
                // console.log(chat);

                let chatChanged = false;
                sendMessage(chatId, "rgfreg");
                if(commandArray[0] !== "/start" && !chat.users.hasOwnProperty(userId)) {
                    if(!chat.users.hasOwnProperty(userId)) {
                        sendMessage(chatId, "Du bist dem flexn noch nicht beigetreten! Beginne mit /start", "Markdown");
                    }
                }
                else {
                    switch(commandArray[0]) {
                        case "/start": {
                            if(!chat.users.hasOwnProperty(userId)) {
                                chat.users[userId] = new UserData(userName);
                                sendMessage(chatId, "*Willkommen beim flexn, " + userName + "!*\nHilfe findest du unter /help");
                                chatChanged = true;
                            }
                            
                            break;
                        }
    
                        case "/exercise": {
                            if(commandArray.length === 2) {
                                let newEx = commandArray[1];
                                if(chat.exerciseAliases.hasOwnProperty(newEx)) {
                                    sendMessage(chatId, "Das ist schon ein Alias für _" + chat.exerciseAliases[newEx] + "_", messageId);
                                }
                                else if(chat.exerciseReps.hasOwnProperty(newEx)) {
                                    sendMessage(chatId, "Ich kenne diese Übung schon", messageId);
                                }
                                else {
                                    chat.exerciseReps[newEx] = 0;
                                    sendMessage(chatId, "Ich kenne jetzt die Übung *" + newEx + "*");
                                    chatChanged = true;
                                }
                            }
                            break;
                        }
    
                        // machma
                        // ==============================================================
                        case "/machma": {
                            let alias;
                            if(commandArray.length === 2) {
                                alias = "liegestütze";
                            }
                            else {
                                alias = commandArray[2];
                            }
    
                            let exercise = chat.exerciseAliases.hasOwnProperty(alias) ? chat.exerciseAliases[alias] : alias;
                            if(!chat.exerciseReps.hasOwnProperty(exercise)) {
                                sendMessage(chatId, "Ich kenne diese Übung nicht. Verwende /exercise, um eine neue Übung hinzuzufügen.", messageId);
                            }
                            else {
                                let reps = parseInt(commandArray[1]);
                                if(isNaN(reps)) {
                                    sendMessage(chatId, "Gib a echte Zahl ein etz!", messageId);
                                }
                                else if(commandArray[1] <= 0){
                                    sendMessage(chatId, "Gib a positive Zahl ein etz!", messageId);
                                }
                                else {
                                    let remainder = getRemaining(chat, userId, exercise);
                                    if(remainder > 0) {
                                        sendMessage(chatId, "Mach erstmal deine offenen *" + chat.users[userId].remainders[exercise] + "* " + exercise + " fertig bevor du hier mit dem scheiß anfängst...", messageId);
                                    }
                                    else {
                                        // update total reps for this exercise in chat
                                        if(!chat.exerciseReps.hasOwnProperty(exercise))
                                        chat.exerciseReps[commandArray[2]] = 0;
        
                                        chat.exerciseReps[exercise] += reps;
        
                                        // update total reps for this exercise of this user
                                        // if(!chat.users.hasOwnProperty(userId))
                                        // chat.users[userId] = new UserData();
        
                                        if(!chat.users[userId].totalReps.hasOwnProperty(exercise))
                                        chat.users[userId].totalReps[exercise] = 0;
        
                                        chat.users[userId].totalReps[exercise] += reps;
        
                                        // update exercise remainder for all remaining users in chat
                                        for(let uId in chat.users) {
                                            if(uId != userId) addRemaining(chat, uId, exercise, reps);
                                        }
        
                                        sendMessage(chatId, chat.users[userId].name + " machts vor!");
                                        sendMessage(chatId, "Weitere * " + reps + " " + exercise + " * für euch Lauchs!");

                                        chatChanged = true;
                                    }
                                }
                            }
                            break;
                        }
    
                        // done
                        // ==============================================================
                        case "/done": {
                            let alias = commandArray[2];
                            let reps = parseInt(commandArray[1]);
    
                            if(isNaN(reps)) {
                                sendMessage(chatId, "Gib a echte Zahl ein etz!", messageId);
                            }
                            else if(reps <= 0) {
                                sendMessage(chatId, "Gib a positive Zahl ein etz!", messageId);
                            }
                            else {
                                let exercise;
        
                                if(chat.exerciseAliases.hasOwnProperty(alias)) exercise = chat.exerciseAliases[alias];
                                else exercise = alias;
        
                                addRemaining(chat, userId, exercise, -reps);

                                if(!chat.users[userId].totalReps.hasOwnProperty(exercise))
                                    chat.users[userId].totalReps[exercise] = 0;
                                chat.users[userId].totalReps[exercise] += reps;
        
                                sendMessage(chatId, "*Guter Mann!*");

                                chatChanged = true;
                            }
                            break;
                        }
    
                        case "/alias": {
                            if(commandArray.length === 2) {
    
                            }
                            else if(commandArray.length === 3) {
                                let exercise = commandArray[1];
                                let alias = commandArray[2];
                                chat.exerciseAliases[alias] = exercise;
                                chatChanged = true;
    
                                sendMessage(chatId, "Ihr könnt jetzt auch *" + alias + "* für *" + exercise + "* verwenden!");
                            }
                            else {
                                sendMessage(chatId, "Du musst eine Übung und einen Alias angeben!", messageId);
                            }
                            break;
                        }
    
                        case "/stats": {
                            let response = "_Statistik für " + chat.users[userId].name + "_\n";
                            for(let exercise in chat.exerciseReps) {
                                let rem = getRemaining(chat, userId, exercise);
                                response += 
                                "*" + exercise + ":*   " +
                                "offen: " + rem + 
                                ", done: " +((!chat.users.hasOwnProperty(userId) || !chat.users[userId].totalReps.hasOwnProperty(exercise)) ? 0 : chat.users[userId].totalReps[exercise]);
                            }

                            // let test = "*lol*";
                            sendMessage(chatId, response);
                            break;
                        }
    
                        case "/exercises": {
                            let response = "*Ich kenne diese Übungen:* \n";
                            for(let exercise in chat.exerciseReps) {
                                response += exercise + ": " + chat.exerciseReps[exercise] + "\n";
                            }
                            sendMessage(chatId, response);
                            break;
                        }
    
                        // case "/propose": {
    
                        // }
    
                        case "/help": {
                            let s = "Flexn in Quarantäne!\n\n";
                            s += "/start -  Trete dem machen bei" + "\n\n";
                            s += "/machma [reps] [exercise] -  Gib den Lauchs was zu tun" + "\n";
                            s += "/done [anzahl] [exercise] -  Mindere deine Schande indem du dir Übungen anrechnen lässt" + "\n\n";
                            s += "/exercise [name] -  Füge der Gruppe eine neue Übung hinzu" + "\n";
                            s += "/exercises -  Schau dir die bestehenden Übungen an" + "\n";
                            s += "/alias [exercise] [pseudonym] -  Lege eine weitere Bezeichnung für eine Übung fest" + "\n";
                            s += "/stats [optional @user] -  Sieh dir deine Statistik an" + "\n";
                            sendMessage(chatId, s);
                            // response += "/propose *vorschlag* für Funktionsvorschläge" + "\n";
                            break;
                        }

                        case "/players": {
                            let response = "*Die Flexer der Gruppe*";
                            for(let uId in chat.users) response += "\n" + chat.users[uId].name;
                            sendMessage(chatId, response);
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
    
                    if(chatChanged) {
                        // console.log("collectioning ...");
                        // console.log(err2);
                        collection.update({id: chatId}, chat).then(() => db.close());
                    }
                }
            });
        });
    });
}

function sendMessage(chatId, text, messageId) {
    // let params = [["chat_id", chatId], ["text", text]];
    // if(parseMode != null) params.push(["parse_mode", parseMode]);

    var data = {
        chat_id: chatId,
        text: text
    };
    data.parse_mode = "markdown";
    if(messageId != null) data.reply_to_message_id = messageId;

    var stringData = JSON.stringify(data);

    // console.log("stringData");
    // console.log(stringData);

    // var postData = toParamString(params);
    
    const req = https.request(
        POST("sendMessage", stringData), res => {
            res.on('data', d => {
                console.log("MEEEESSAGE SENT");
                console.log(JSON.parse(d));
                // getting sent message object
            });
        }
    );

    req.on('error', error => {
        console.error(error);
    });

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
        hostname: "api.telegram.org",
        port: 443,
        path: '/bot' + token + "/" + functionName + ((paramString != null && paramString != "") ? paramString : ""),
        method: 'GET'
    };
}

const POST = function(functionName, data) {
    return {
        hostname: "api.telegram.org",
        port: 443,
        path: '/bot' + token + "/" + functionName,
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Content-Length': data.length
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