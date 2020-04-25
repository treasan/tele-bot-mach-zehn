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
        // telegram id
        this.id = id;

        // active chats where user and bot is a member
        this.chatIds = [];

        // stores user's task repetitions (e.g. liegestütze -> 450)
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
         * key: task id
         * value: {
         *   highest: currently highest repetition in this group,
         *   userId: id of user that did it,
         *   timestamp: unix timestamp
         * }
         */
        this.tasks = {};
    }
}


class PrivateChatEntity {
    constructor(id, userId) {
        // telegram id (must be positive for private chat)
        this.id = id;

        // id of user that wrote with the bot
        this.userId = userId;
    }
}