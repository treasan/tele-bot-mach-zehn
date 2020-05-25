export class DefaultMetric {
    constructor() {
        this.state = {};
    }

    update(userId, taskId, addedReps) {
        if(!this.state.hasOwnProperty(taskId)) this.state[taskId] = {};
        if(!this.state[taskId].hasOwnProperty(userId)) this.state[taskId][userId] = {};

        const taskState = this.state[taskId];
        taskState[userId].done += addedReps;

        const prevRank = taskState.ranking.findIndex(userId);
        taskState.ranking = taskState.ranking.sort((u1Id, u2Id) => taskState[u1Id].done - taskState[u2Id].done);
        const currRank = taskState.ranking.findIndex(userId);

        return currRank - prevRank;
    }


}