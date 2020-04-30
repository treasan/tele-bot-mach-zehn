class TaskEntity {
    constructor(id, name) {
        // custom id
        this.id = id;

        // unique name
        this.name = name;

        // description of the task in various possible formats
        this.description = {
            text: "",
            picture: null,
            video: null
        };
    }
}


class UserEntity {
    constructor(id){
        /**
         * telegram user id
         * 
         * @type {number}
         */
        this.id = id;

        /**
         * @type {number}
         */
        this.privateChatId = null;


        /**
         * active chats where user and bot is a member
         * 
         * @type {Array<number>}
         */
        this.groupChatIds = [];


        /**
         * stores user's task repetitions with a timestamp
         * 
         * value: <timestamp, repetitions>
         * 
         * @type {{[taskId: number]: Array<[number, number]>}}
         */
        this.taskRepetitions = {};


        // did user start his bot?
        this.hasStarted = false;


        // additional info
        this.surname = "";
        this.lastname = "";
        this.username = "";
        this.languageCode = "";

        // last update timestamp
        this.lastUpdate = -1;
    }

    addTaskRepetitions(taskId, timestamp, repetitions) {
        if(!this.taskRepetitions.hasOwnProperty(taskId)) {}
            this.taskRepetitions[taskId] = [];
          
        this.taskRepetitions[taskId].push([timestamp, repetitions]);
    }

    accumulateTaskRepetitions(taskId, since, until) {
        if(!this.taskRepetitions.hasOwnProperty(taskId)) return 0;
        if(since < 0 || until < 0 || since > until) return 0;

        let reps = this.taskRepetitions[taskId];

        if(reps.length === 0) return 0;

        let untilIdx = reps.length-1;
        if(until != null) {
            let lower = 0;
            let upper = untilIdx;
            let mid = (lower - upper) / 2;
            let curr = reps[mid][1];
            
            while(true) {
                if(since < curr) upper = mid;
                else if(since > curr) lower = mid;
                else lower = upper = mid;
        
                if((upper - lower) <= 1) break;
    
                mid = lower + Math.floor((upper - lower) / 2);
                curr = reps[mid][1];
            }

            untilIdx = lower;
        }

        let sinceIdx = 0;
        if(since != null) {
            let lower = sinceIdx;
            let upper = untilIdx;
            let mid = (lower - upper) / 2;
            let curr = reps[mid][1];
            
            while(true) {
                if(since < curr) upper = mid;
                else if(since > curr) lower = mid;
                else lower = upper = mid;
        
                if((upper - lower) <= 1) break;
    
                mid = lower + Math.floor((upper - lower) / 2);
                curr = reps[mid][1];
            }

            sinceIdx = upper;
        }
        
        let accReps = 0;
        
        for(let i = sinceIdx; i <= untilIdx; ++i) {
            accReps += reps[i][0];
        }

        return accReps;
    }
}


class GroupChatEntity {
    constructor(id) {
        // telegram id (must be negative for group chat)
        this.id = id;

        // all known users in this group
        this.userIds = [];

        // FIXME: not sure if necessary
        this.playerIds = [];

        /**
         * stores all tasks that were done at least once in this group
         * 
         * currentRecord: currently highest repetition in this group
         * 
         * userId: id of user that did it
         * 
         * @type {{[taskId: number]: {currentRecord: number, userId: number}}}
         */
        this.taskInformation = {};

        // unix timestamp to know when the group started to use the bot
        this.botAddedTimestamp = -1
    }

    update(taskId, userId, totalRepetitions) {
        if(!this.taskInformation.hasOwnProperty(taskId)) {
            this.taskInformation[taskId] = {
                currentRecord: totalRepetitions,
                userId
            }

            return true;
        } else {
            let taskInfo = this.taskInformation[taskId];
            if(taskInfo.currentRecord < totalRepetitions) {
                taskInfo.currentRecord = totalRepetitions;
                taskInfo.userId = userId;
                return true;
            }
        }

        return false;
    }

    static isGroupChatId(chatId) {
        return chatId < 0;
    }
}


class PrivateChatEntity {
    constructor(id, userId) {
        // telegram id (must be positive for private chat)
        this.id = id;

        // id of user that wrote with the bot
        this.userId = userId;
    }

    static isPrivateChatId(chatId) {
        return chatId > 0;
    }
}