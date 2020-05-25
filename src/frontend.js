import * as config from "./../config.js"

const TelegramBot = require('node-telegram-bot-api');


class Frontend {
    constructor(type, userRepository, chatRepository, taskRepository) {
        this.type = type;

        /** @type {UserRepository} */
        this.userRepo = userRepository;

        /** @type {ChatRepository} */
        this.chatRepo = chatRepository;

        /** @type {TaskRepository} */
        this.taskRepo = taskRepository;
    }

    async onTaskRepetitions(chatId, userId, taskId, messageId) {
    }

    async onTaskLearned(chatId, userId, taskId, messageId) {
    }

    async onTaskLabelled(chatId, userId, taskId, messageId, label) {
    }

    async onHelpRequest(chatId, userId, messageId, timestamp) {
    }

    async onUnknownCommand(chatId, userId, messageId, command, timestamp) {
    }

    async onInvalidParameters(chatId, userId, messageId, command, params, timestamp) {
    }

    /**
     * 
     * @param {TelegramBot} api 
     * @param {ChatRepository} chatRepo 
     * @param {UserRepository} userRepo 
     * @param {TaskRepository} taskRepo 
     */
    render(api, chatRepo, userRepo, taskRepo) {
    }
}
/**
 *      this.lastUpdate = -1;

        this.updatedTasks = {};
        this.registeredTasks = [];

        this.helpRequested = false;
        
        this.unknownCommands = [];
        this.invalidParameters = [];
 */

// class FrontendData {
//     constructor() {
//         this.needsUpdate = false;
//         this.lastUpdate = -1;
//         this.updatedTasks = {};
//         this.registeredTasks = [];
//         this.helpRequested = false;
//         this.unknownCommands = [];
//         this.invalidParameters = [];
//     }
// }

class SimpleFrontend extends Frontend {
    constructor() {
        super("simple");
        this.pendingGroups = new Set();
    }

    async onTaskRepetitions(chatId, userId, taskId, messageId) {
        const user = await this.userRepo.findById(userId);

        if(user != null) {
            const groups = await this.chatRepo.findGroupsByIds(user.groupChatIds);

            groups.forEach(group => {
                if(group.id == chatId) {
                    group.frontendData.deletableMessages.push(messageId);
                }

                if(!group.frontendData.updatedTasks.hasOwnProperty(taskId)) {
                    group.frontendData.updatedTasks[taskId] = new Set();
                }

                group.frontendData.updatedTasks[taskId].add(userId);

                group.frontendData.needsUpdate = true;

                this.pendingGroups.add(group.id);
            });
        }
    }

    async onTaskLearned(chatId, userId, taskId, messageId) {
        const group = await this.chatRepo.findGroupById(chatId);
        group.frontendData.deletableMessages.push(messageId);

        if(group != null) {
            group.frontendData.registeredTasks.add(taskId);
            group.frontendData.needsUpdate = true;
            this.pendingGroups.add(group.id);
        }
    }

    async onTaskLabelled(chatId, userId, taskId, messageId, label) {
        const group = await this.chatRepo.findGroupById(chatId);

        group.frontendData.deletableMessages.push(messageId);

        if(group != null) {
            if(!group.frontendData.newTaskLabels.hasOwnProperty(taskId)) {
                group.frontendData.newTaskLabels[taskId] = [];
            }

            group.frontendData.newTaskLabels[taskId].push(label);
            group.frontendData.needsUpdate = true;
            this.pendingGroups.add(group.id);
        }
    }

    async onHelpRequest(chatId, userId, messageId, timestamp) {
        const group = await this.chatRepo.findGroupById(chatId);

        group.frontendData.deletableMessages.push(messageId);

        if(group != null) {
            group.frontendData.helpRequested = true;
            group.frontendData.needsUpdate = true;
            this.pendingGroups.add(group.id);
        }
    }

    async onUnknownCommand(chatId, userId, messageId, command, timestamp) {
        const group = await this.chatRepo.findGroupById(chatId);

        if(group != null) {
            if(!group.frontendData.unknownCommands.hasOwnProperty(userId)) {
                group.frontendData.unknownCommands[userId] = {};
            }

            if(!group.frontendData.unknownCommands[userId].hasOwnProperty(command)) {
                group.frontendData.unknownCommands[userId][command] = {};
            }

            group.frontendData.unknownCommands[userId][command] = timestamp;
            group.frontendData.needsUpdate = true;
            this.pendingGroups.add(group.id);
        }
    }

    async onInvalidParameters(chatId, userId, messageId, command, params, timestamp) {
        const group = await this.chatRepo.findGroupById(chatId);

        if(group != null) {
            if(!group.frontendData.invalidParameters.hasOwnProperty(userId)) {
                group.frontendData.invalidParameters[userId] = {};
            }

            if(!group.frontendData.invalidParameters[userId].hasOwnProperty(command)) {
                group.frontendData.invalidParameters[userId][command] = {};
            }

            group.frontendData.invalidParameters[userId][command] = timestamp;
            group.frontendData.needsUpdate = true;
            this.pendingGroups.add(group.id);
        }        
    }


    /**
     * 
     * @param {TelegramBot} api 
     */
    async render(api) {
        const groups = await this.chatRepo.findGroupsByIds([...this.pendingGroups]);

        let str = "";
        if(groups != null) {
            for(const group of groups) {
                const data = group.frontendData;
    

                // delete messages
                data.deletableMessages.forEach(msgId => 
                    api.deleteMessage(group.id, msgId));
    
                

                // notify users of new task labels
                str = "";

                const labelledTasks = Object.keys(data.newTaskLabels);

                if(labelledTasks.length === 1) {
                    const task = await this.taskRepo.findById(labelledTasks[0]);
        
                    if(task != null) {
                        const labels = data.newTaskLabels[labelledTasks[0]];

                        str += "Zu "
                            + "*" + task.name + "* "
                            + "könnt ihr jetzt auch "
                            + "*" + labels.join(", ") + "*"
                            + "sagen";
                    }

                    str += "Ihr könnt jetzt auch"
                } else if(labelledTasks.length > 1) {
                    str = "*Neue Labels:*\n";

                    for(const taskId in data.newTaskLabels) {
                        const task = await this.taskRepo.findById(taskId);
        
                        if(task != null) {
                            const labels = data.newTaskLabels[taskId];
                            str += "*" + task.name + "*: " + labels.join(", ") + "\n";
                        }
                    }

                }
                
                if(str != "") {
                    api.sendMessage(group.id, str, {parse_mode: "MarkdownV2"});
                }



                // dfewf
                str = "";
                for(const taskId in data.updatedTasks) {
                    const task = await this.taskRepo.findById(taskId);
                    const users = await this.userRepo.findByIds(group.userIds);

                    let prevReps = {};
                    for(const user of users) {
                        prevReps[user.id] = user.accumulateTaskRepetitions(
                            taskId, 
                            group.botAddedTimestamp,
                            data.lastUpdate
                        );
                    }

                    // TODO: optimize
                    let currReps = {};
                    for(const user of users) {
                        currReps[user.id] = user.accumulateTaskRepetitions(
                            taskId, 
                            group.botAddedTimestamp
                        );
                    }

                    const relevantUserIds = data.updatedTasks[taskId];
                    relevantUserIds.forEach(uId => {
                        str += "*+"
                            + (currReps[uId] - prevReps[uId])
                            + " "
                            + task.name + "*";
                    });
                }
            }
        }
    }
}