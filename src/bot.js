class UserUpdateInfo {
    constructor() {
        this.startRequested = false;
        this.helpRequested = false;
        this.updatedTasks = new Set();
        this.unknownCommands = new Set();
        this.invalidParams = new Map();
    }
}

class UpdateAccumulator {
    constructor() {
        /**
         * user update flags
         * 
         * @type {Map<number, UserUpdateInfo>}
         */
        this.users = new Map();

        // game state changes
        this.game = {};
    }


    // General
    startedGame(user) {
        let u = this._getUserFlags(user.id);
        u.startRequested = true;
    }

    requestsHelp(user) {
        let u = this._getUserFlags(user.id);
        u.startRequested = true;
    }


    // Player updates
    addedTaskRepetitions(user, task) {
        this._getUserFlags(user.id).updatedTasks.add(task.id);
    }


    // Invalid user behaviour
    unknownCommand(user, op) {
        this._getUserFlags(user.id).unknownCommands.add(op);
    }

    invalidCommandParameters(user, chat, op, params, errorCode) {
        let u = this._getUserFlags(user.id);

        if(!u.invalidParams.has(chat.id)) {
            u.invalidParams.set(chat.id, new Map());
        }

        let chatEntry = u.invalidParams.get(chat.id);
        if(!chatEntry.has(op)) {
            chatEntry.set(op, []);
        }

        chatEntry.get(op).push({params, errorCode});
    }

    

    /**
     * 
     * @param {number} id
     */
    _getUserFlags(id) {
        if(!this.users.hasOwnProperty(id)) {
            this.users[id] = new UserUpdateInfo();
        }

        return this.users[id];
    }
}