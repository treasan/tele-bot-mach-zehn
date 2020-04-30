class UserRepository {
    constructor(database) {
        this.db = database;
        this.userCollection = null;
        this.cachedUserEntities = {};
    }

    /**
     * 
     * @param {number} id 
     * @return {Promise<UserEntity>}
     */
    async findById(id) {
        if(this.userCollection === null) {
            this.userCollection = await this.db.collection("users");
        }

        if(!this.cachedUserEntities.hasOwnProperty(id)) {
            this.cachedUserEntities[id] = await this.userCollection.findOne({id}); 
        }

        return this.cachedUserEntities[id];
    }

    async createOrUpdateFromMessageJson(messageJson) {
        let userJson = messageJson.from;
        let chatJson = messageJson.chat;

        let user = null;

        if(this.cachedUserEntities.hasOwnProperty(userJson.id)) {
            user = this.cachedUserEntities[userJson.id];
        } else {
            user = this.findById(userJson.id);
        }

        if(user == null) {
            user = new UserEntity(userJson.id);
        }

        // FIXME: should be a Set object for faster search, but im unsure about mongo compatibility
        if(!user.chatIds.find(chatJson.id)) {
            user.chatIds.push(chatJson.id);
        }

        if(userJson.hasOwnProperty("first_name"))           user.surname = userJson.first_name;
        if(userJson.hasOwnProperty("last_name"))            user.lastname = userJson.last_name;
        if(userJson.hasOwnProperty("username"))             user.username = userJson.username;
        if(userJson.hasOwnProperty("language_code"))        user.languageCode = userJson.language_code;

        user.lastUpdate = Date.now();

        this.cachedUserEntities[user.id] = user;

        return user;
    }
}


class ChatRepository {
    constructor(database) {
        this.db = database;
        this.groupChatCollection = null;
        this.privateChatCollection = null;
        this.cachedChatEntities = {};
    }

    createGroup(id) {
        if(!this.cachedChatEntities.hasOwnProperty(id)) {
            this.cachedChatEntities[id] = new GroupChatEntity(id);
        }

        return this.cachedChatEntities[id];
    }

    createPrivate(id) {
        if(!this.cachedChatEntities.hasOwnProperty(id)) {
            this.cachedChatEntities[id] = new PrivateChatEntity(id);
        }

        return this.cachedChatEntities[id];
    }

    /**
     * 
     * @param {number} id 
     * @return {Promise<GroupChatEntity>}
     */
    async findGroupById(id) {
        if(this.groupChatCollection === null) {
            this.groupChatCollection = await this.db.collection("group_chats");
        }

        if(!this.cachedChatEntities.hasOwnProperty(id)) {
            this.cachedChatEntities[id] = await this.groupChatCollection.findOne({id}); 
        }

        return this.cachedChatEntities[id];
    }

    /**
     * 
     * @param {Array<number>} ids 
     */
    async findGroupsByIds(ids) {
        return Promise.all(ids.map(id => this.findGroupById(id)));
    }

    /**
     * 
     * @param {number} id 
     * @return {Promise<PrivateChatEntity>}
     */
    async findPrivateById(id) {
        if(this.privateChatCollection === null) {
            this.privateChatCollection = await this.db.collection("private_chats");
        }

        if(!this.cachedChatEntities.hasOwnProperty(id)) {
            this.cachedChatEntities[id] = await this.privateChatCollection.findOne({id}); 
        }

        return this.cachedChatEntities[id];
    }
}

class TaskRepository {
    constructor(database) {
        this.db = database;
        this.taskCollection = null;
        this.cachedTaskEntities = {};
    }
}